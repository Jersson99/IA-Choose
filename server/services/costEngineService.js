import crypto from 'node:crypto';
import { db } from '../db.js';
import { HttpError } from '../errors.js';

const RESERVATION_TTL_MS = 2 * 60 * 1000; // 2 minutos de bloqueo máximo por petición en vuelo
const DEFAULT_CONTEXT_BUDGET_TOKENS = 12000; // Techo de ventana deslizante para proteger costos

export function estimateTokensFromText(text = '') {
  const clean = String(text || '').trim();
  if (!clean) return 0;
  // En español 1 token equivale aprox. a 3.2 - 3.5 caracteres; usamos 3.2 como cota conservadora
  return Math.max(1, Math.ceil(clean.length / 3.2));
}

export const costEngineService = {
  getFxSettings() {
    const row = db.prepare('SELECT * FROM fx_and_gateway_settings WHERE id = 1').get();
    const trm = Number(row?.usd_to_cop_trm) || 4400.0;
    const bufferPct = Number(row?.fx_safety_buffer_pct) || 0.03;
    const effectiveFxRateCop = Math.round(trm * (1 + bufferPct) * 100) / 100;
    const wompiFeePct = Number(row?.wompi_fee_pct) || 0.0265;
    const wompiFixedCop = Number(row?.wompi_fixed_cop) || 700.0;
    const wompiIvaPct = Number(row?.wompi_iva_pct) || 0.19;
    // Comisión efectiva de pasarela sobre una recarga promedio de $15.000 COP (~8.7%)
    const effectiveGatewayRate =
      ((15000 * wompiFeePct + wompiFixedCop) * (1 + wompiIvaPct)) / 15000;

    return {
      trm,
      bufferPct,
      effectiveFxRateCop,
      wompiFeePct,
      wompiFixedCop,
      wompiIvaPct,
      effectiveGatewayRate: Math.round(effectiveGatewayRate * 10000) / 10000,
      minTopupCop: Number(row?.min_topup_cop) || 10000,
    };
  },

  getPricingForModel(modelSlug, modelRow = null) {
    const rate = db
      .prepare('SELECT * FROM model_pricing_rates WHERE model_slug = ? AND is_current = 1')
      .get(modelSlug);

    if (rate) return rate;

    // Fallback derivado de ai_models_benchmarks si se consulta un modelo nuevo sin fila explícita
    const fx = this.getFxSettings();
    const inUsd1M = modelRow?.input_cost_1k_cop
      ? (Number(modelRow.input_cost_1k_cop) * 1000) / (fx.effectiveFxRateCop * 2)
      : 0.95;
    const outUsd1M = modelRow?.output_cost_1k_cop
      ? (Number(modelRow.output_cost_1k_cop) * 1000) / (fx.effectiveFxRateCop * 2)
      : 4.0;

    return {
      id: 0,
      model_slug: modelSlug,
      provider_slug: 'moonshot',
      remote_model_id: modelSlug,
      input_usd_per_1m: inUsd1M,
      input_cached_usd_per_1m: inUsd1M * 0.2,
      cache_write_usd_per_1m: 0.0,
      output_usd_per_1m: outUsd1M,
      reasoning_usd_per_1m: outUsd1M,
      tool_call_usd_per_unit: 0.0,
      max_context_tokens: 128000,
      max_output_tokens: 4096,
      markup_multiplier: 2.0,
      cached_markup_multiplier: 3.0,
      fixed_operational_fee_cop: 3.0,
      min_charge_cop: Number(modelRow?.cost_cop) || 12,
    };
  },

  /**
   * Normaliza el historial de conversación manteniendo inmutable el prefijo para maximizar
   * el Context Caching de Moonshot AI, y aplica truncamiento de ventana deslizante si supera el presupuesto.
   */
  prepareConversationContext({
    messages,
    promptText,
    systemInstruction,
    maxContextBudgetTokens = DEFAULT_CONTEXT_BUDGET_TOKENS,
  }) {
    const defaultSystem =
      systemInstruction ||
      'Eres un modelo de inteligencia artificial integrado en la plataforma colombiana IA CHOOSE. Responde siempre en español claro, riguroso y bien estructurado.';

    let rawList = [];
    if (Array.isArray(messages) && messages.length > 0) {
      rawList = messages
        .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
        .map((m) => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
          content: m.content.trim(),
        }));
    }

    // Asegurar que el último mensaje del usuario esté incluido al final si no venía en messages
    const cleanPrompt = String(promptText || '').trim();
    if (cleanPrompt) {
      const lastMsg = rawList[rawList.length - 1];
      if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== cleanPrompt) {
        rawList.push({ role: 'user', content: cleanPrompt });
      }
    }

    const existingSystem = rawList.find((m) => m.role === 'system');
    const systemMsg = {
      role: 'system',
      content: existingSystem ? existingSystem.content : defaultSystem,
    };

    const dialogueTurns = rawList.filter((m) => m.role !== 'system');
    const systemTokens = estimateTokensFromText(systemMsg.content) + 8;

    // Calcular tokens por turno y aplicar ventana deslizante desde el final si supera el presupuesto
    let accumulatedTokens = systemTokens;
    const keptTurns = [];
    let droppedTurnsCount = 0;
    let droppedTokensCount = 0;

    for (let i = dialogueTurns.length - 1; i >= 0; i -= 1) {
      const turn = dialogueTurns[i];
      const turnTokens = estimateTokensFromText(turn.content) + 6;
      // Siempre garantizamos conservar al menos el último mensaje del usuario
      if (
        keptTurns.length > 0 &&
        accumulatedTokens + turnTokens > maxContextBudgetTokens
      ) {
        droppedTurnsCount += 1;
        droppedTokensCount += turnTokens;
        continue;
      }
      keptTurns.unshift(turn);
      accumulatedTokens += turnTokens;
    }

    const normalizedMessages = [systemMsg, ...keptTurns];
    // Tokens de historial previo (todo excepto el último turno del usuario) susceptibles de Cache Hit
    const lastUserTurnTokens =
      keptTurns.length > 0 ? estimateTokensFromText(keptTurns[keptTurns.length - 1].content) + 6 : 0;
    const prefixHistoryTokens = Math.max(0, accumulatedTokens - lastUserTurnTokens);

    return {
      normalizedMessages,
      estimatedInputTokens: accumulatedTokens,
      prefixHistoryTokens,
      lastUserTurnTokens,
      turnCount: Math.ceil(keptTurns.length / 2),
      compacted: droppedTurnsCount > 0,
      droppedTurnsCount,
      droppedTokensCount,
    };
  },

  /**
   * Estima el costo pre-vuelo para reservar saldo antes de llamar a la API externa
   */
  estimatePreFlight({ modelRow, messages, promptText, requestedMaxOutputTokens }) {
    const pricing = this.getPricingForModel(modelRow.slug, modelRow);
    const fx = this.getFxSettings();
    const contextInfo = this.prepareConversationContext({
      messages,
      promptText,
      systemInstruction: `Eres ${modelRow.name} (${pricing.remote_model_id || modelRow.slug}) de ${modelRow.provider}, conectado en tiempo real a la plataforma colombiana IA CHOOSE. Si el usuario pregunta qué modelo eres, identifícate exactamente como ${modelRow.name} (${pricing.remote_model_id || modelRow.slug}). Responde siempre en español claro, riguroso y bien estructurado.`,
    });

    const maxOutputTokens = Math.min(
      Number(requestedMaxOutputTokens) || 2048,
      pricing.max_output_tokens || 4096
    );
    // Para la reserva bloqueamos una salida esperada razonable (ej. 650 tokens) sin asumir caché
    const expectedOutputTokensForLock = Math.min(maxOutputTokens, 650);

    const estimatedProviderUsd =
      (contextInfo.estimatedInputTokens * pricing.input_usd_per_1m +
        expectedOutputTokensForLock * pricing.output_usd_per_1m) /
      1_000_000;

    const estimatedProviderCop = estimatedProviderUsd * fx.effectiveFxRateCop;
    const rawChargeCop =
      estimatedProviderCop * pricing.markup_multiplier + pricing.fixed_operational_fee_cop;

    const reservedAmountCop = Math.max(
      Number(pricing.min_charge_cop) || Number(modelRow.cost_cop) || 12,
      Math.ceil(rawChargeCop)
    );

    return {
      pricing,
      fx,
      contextInfo,
      maxOutputTokens,
      reservedAmountCop,
    };
  },

  /**
   * Calcula la liquidación financiera definitiva con base en los datos reales devueltos por la API.
   * Garantiza exclusión mutua: inputUncached = promptTokens - cachedTokens - cacheWriteTokens
   * y reasoningTokens ya incluido dentro de outputTokens.
   */
  calculateSettlement({ modelRow, usage, remoteModelId, toolCallsCount = 0 }) {
    const pricing = this.getPricingForModel(modelRow.slug, modelRow);
    const fx = this.getFxSettings();

    const inputCachedTokens = Math.max(0, Math.round(Number(usage?.cachedTokens) || 0));
    const cacheWriteTokens = Math.max(0, Math.round(Number(usage?.cacheWriteTokens) || 0));
    const promptTokensTotal = Math.max(
      inputCachedTokens + cacheWriteTokens,
      Math.round(Number(usage?.inputTokens) || 0)
    );
    const inputUncachedTokens = Math.max(
      0,
      promptTokensTotal - inputCachedTokens - cacheWriteTokens
    );

    const outputTokensTotal = Math.max(0, Math.round(Number(usage?.outputTokens) || 0));
    // En Moonshot y OpenAI, reasoning_tokens es un subconjunto informativo de completion_tokens
    const reasoningTokens = Math.min(
      outputTokensTotal,
      Math.max(0, Math.round(Number(usage?.reasoningTokens) || 0))
    );
    const cleanToolCalls = Math.max(0, Math.round(Number(toolCallsCount) || 0));

    // 1. Costo directo del proveedor en USD (sin doble contabilización)
    const uncachedInputUsd = (inputUncachedTokens * pricing.input_usd_per_1m) / 1_000_000;
    const cachedInputUsd = (inputCachedTokens * pricing.input_cached_usd_per_1m) / 1_000_000;
    const cacheWriteUsd = (cacheWriteTokens * pricing.cache_write_usd_per_1m) / 1_000_000;
    const outputUsd = (outputTokensTotal * pricing.output_usd_per_1m) / 1_000_000;
    const toolsUsd = cleanToolCalls * (pricing.tool_call_usd_per_unit || 0);

    const providerCostUsd =
      uncachedInputUsd + cachedInputUsd + cacheWriteUsd + outputUsd + toolsUsd;

    // Costo hipotético si NO hubiera existido caché (para medir ahorro real)
    const providerCostWithoutCacheUsd =
      (promptTokensTotal * pricing.input_usd_per_1m) / 1_000_000 + outputUsd + toolsUsd;

    // 2. Conversión a COP con tasa efectiva (TRM + colchón cambiario)
    const providerCostCop = providerCostUsd * fx.effectiveFxRateCop;
    const providerCostWithoutCacheCop = providerCostWithoutCacheUsd * fx.effectiveFxRateCop;

    // 3. Cálculo del precio al usuario (Modelo Híbrido: multiplicador diferenciado en caché + cargo fijo operativo)
    const userChargeUncachedPartCop =
      (uncachedInputUsd + cacheWriteUsd + outputUsd + toolsUsd) *
      fx.effectiveFxRateCop *
      pricing.markup_multiplier;

    const userChargeCachedPartCop =
      cachedInputUsd * fx.effectiveFxRateCop * (pricing.cached_markup_multiplier || 3.0);

    const rawUserChargeCop =
      userChargeUncachedPartCop +
      userChargeCachedPartCop +
      (pricing.fixed_operational_fee_cop || 3.0);

    const minFloorCop = Number(pricing.min_charge_cop) || Number(modelRow.cost_cop) || 12;
    const userChargedCop = Math.max(minFloorCop, Math.ceil(rawUserChargeCop));

    // Ahorro trasladado al usuario gracias al Context Caching
    const wouldHaveChargedWithoutCacheCop = Math.max(
      minFloorCop,
      Math.ceil(
        providerCostWithoutCacheCop * pricing.markup_multiplier +
          (pricing.fixed_operational_fee_cop || 3.0)
      )
    );
    const cacheSavingsCop = Math.max(0, wouldHaveChargedWithoutCacheCop - userChargedCop);

    // 4. Costo operativo de pasarela Wompi e infraestructura sobre este cobro
    const gatewayFeeOnChargeCop = userChargedCop * fx.effectiveGatewayRate;
    const operationalOverheadCop = gatewayFeeOnChargeCop + 0.8; // +$0.80 COP cómputo/DB
    const totalInternalCostCop = providerCostCop + operationalOverheadCop;

    // 5. Utilidad neta libre y margen neto sobre la venta
    const netProfitCop = userChargedCop - totalInternalCostCop;
    const netMarginPct =
      userChargedCop > 0 ? Math.round((netProfitCop / userChargedCop) * 1000) / 10 : 0;

    return {
      pricingRateId: pricing.id || 1,
      providerSlug: pricing.provider_slug || 'moonshot',
      modelSlug: modelRow.slug,
      remoteModelId: remoteModelId || pricing.remote_model_id || modelRow.slug,
      promptTokensTotal,
      inputUncachedTokens,
      inputCachedTokens,
      cacheWriteTokens,
      outputTokensTotal,
      reasoningTokens,
      totalTokens: promptTokensTotal + outputTokensTotal,
      toolCallsCount: cleanToolCalls,
      isEstimatedUsage: Boolean(usage?.isEstimatedUsage),
      appliedFxRateCop: fx.effectiveFxRateCop,
      providerCostUsd: Number(providerCostUsd.toFixed(6)),
      providerCostCop: Number(providerCostCop.toFixed(2)),
      operationalOverheadCop: Number(operationalOverheadCop.toFixed(2)),
      totalInternalCostCop: Number(totalInternalCostCop.toFixed(2)),
      userChargedCop,
      cacheSavingsCop,
      netProfitCop: Number(netProfitCop.toFixed(2)),
      netMarginPct,
    };
  },

  /**
   * Libera reservas vencidas (por ejemplo si un proceso se reinició en medio de una llamada)
   */
  cleanupExpiredReservations(userId) {
    const nowIso = new Date().toISOString();
    const expiredRows = db
      .prepare(
        "SELECT id, reserved_amount_cop FROM wallet_reservations WHERE user_id = ? AND status = 'reserved' AND expires_at < ?"
      )
      .all(userId, nowIso);

    if (expiredRows.length === 0) return;

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const row of expiredRows) {
        const current = db
          .prepare('SELECT status, reserved_amount_cop FROM wallet_reservations WHERE id = ?')
          .get(row.id);
        if (current && current.status === 'reserved') {
          db.prepare(
            "UPDATE wallet_reservations SET status = 'expired', settled_at = ? WHERE id = ?"
          ).run(nowIso, row.id);
          db.prepare(
            'UPDATE user_wallets SET reserved_cop = MAX(0, reserved_cop - ?), updated_at = ? WHERE user_id = ?'
          ).run(current.reserved_amount_cop, nowIso, userId);
        }
      }
      db.exec('COMMIT');
    } catch {
      db.exec('ROLLBACK');
    }
  },

  /**
   * Fase 1: Bloquea atómicamente el saldo estimado antes de invocar al proveedor externo.
   * Impide condiciones de carrera en solicitudes concurrentes.
   */
  reserveBalance({
    userId,
    modelSlug,
    estimatedInputTokens,
    maxOutputTokens,
    reservedAmountCop,
  }) {
    this.cleanupExpiredReservations(userId);

    const reservationId = `RSV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresIso = new Date(now.getTime() + RESERVATION_TTL_MS).toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
      const wallet = db
        .prepare('SELECT balance_cop, reserved_cop FROM user_wallets WHERE user_id = ?')
        .get(userId);

      if (!wallet) {
        throw new HttpError(404, 'Billetera de usuario no encontrada');
      }

      const availableCop = Number(wallet.balance_cop) - (Number(wallet.reserved_cop) || 0);
      if (availableCop < reservedAmountCop) {
        throw new HttpError(
          402,
          `Saldo disponible insuficiente ($${availableCop} COP disponibles; esta consulta requiere reservar ~$${reservedAmountCop} COP según el contexto acumulado de ${estimatedInputTokens} tokens). Recarga con Wompi o inicia un hilo nuevo.`
        );
      }

      db.prepare(
        'UPDATE user_wallets SET reserved_cop = reserved_cop + ?, updated_at = ? WHERE user_id = ?'
      ).run(reservedAmountCop, nowIso, userId);

      db.prepare(`
        INSERT INTO wallet_reservations (
          id, user_id, model_slug, estimated_input_tokens, max_output_tokens,
          reserved_amount_cop, status, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?, ?)
      `).run(
        reservationId,
        userId,
        modelSlug,
        estimatedInputTokens,
        maxOutputTokens,
        reservedAmountCop,
        expiresIso,
        nowIso
      );

      db.exec('COMMIT');
      return reservationId;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  /**
   * Si la API externa falla, libera de inmediato el saldo reservado sin cobrar un solo peso.
   */
  releaseReservation(reservationId) {
    if (!reservationId) return;
    const nowIso = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      const rsv = db
        .prepare('SELECT * FROM wallet_reservations WHERE id = ?')
        .get(reservationId);
      if (rsv && rsv.status === 'reserved') {
        db.prepare(
          "UPDATE wallet_reservations SET status = 'released', settled_at = ? WHERE id = ?"
        ).run(nowIso, reservationId);
        db.prepare(
          'UPDATE user_wallets SET reserved_cop = MAX(0, reserved_cop - ?), updated_at = ? WHERE user_id = ?'
        ).run(rsv.reserved_amount_cop, nowIso, rsv.user_id);
      }
      db.exec('COMMIT');
    } catch {
      db.exec('ROLLBACK');
    }
  },
};
