import crypto from 'node:crypto';
import { config } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../errors.js';
import { costEngineService } from './costEngineService.js';
import { llmProviderService } from './llmProviderService.js';
import { routerService } from './routerService.js';

function ensureWallet(userId) {
  let wallet = db.prepare('SELECT * FROM user_wallets WHERE user_id = ?').get(userId);
  if (!wallet) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_wallets (user_id, balance_cop, default_routing_mode, monthly_budget_cop, low_balance_alert_cop, updated_at)
      VALUES (?, 0, 'balanced', 50000, 3000, ?)
    `).run(userId, now);

    wallet = db.prepare('SELECT * FROM user_wallets WHERE user_id = ?').get(userId);
  }
  return wallet;
}

function generateRealisticResponse(prompt, model, domain) {
  const clean = prompt.toLowerCase();

  if (
    domain === 'coding' ||
    clean.includes('python') ||
    clean.includes('codigo') ||
    clean.includes('react') ||
    clean.includes('javascript') ||
    clean.includes('funcion') ||
    clean.includes('variable')
  ) {
    if (clean.includes('hola mundo') || clean.includes('variable')) {
      return `¡Hola! Aquí tienes la solución solicitada procesada con **${model.name}**:\n\n\`\`\`python\n# Declaración de variables y mensaje de bienvenida\nmi_nombre = "Usuario IA CHOOSE"\nprint(f"¡Hola, mundo! Bienvenido/a, {mi_nombre}.")\n\`\`\`\n\n**Explicación técnica:**\n- \`mi_nombre\` almacena una cadena de texto en memoria.\n- Se utiliza un *f-string* (disponible desde Python 3.6+) para interpolar variables con máxima legibilidad y eficiencia.`;
    }
    return `### Solución generada por **${model.name}**\n\nHe analizado tu requerimiento de desarrollo y arquitectura. A continuación la propuesta recomendada:\n\n\`\`\`python\nimport asyncio\nfrom typing import Dict, Any\n\nasync def process_task(payload: Dict[str, Any]) -> Dict[str, Any]:\n    # Procesamiento concurrente optimizado\n    await asyncio.sleep(0.05)\n    return {"status": "ok", "result": payload}\n\`\`\`\n\n**Aspectos clave:**\n1. Manejo asíncrono para alta concurrencia y baja latencia.\n2. Tipado estricto con \`typing\` para trazabilidad y pruebas unitarias.\n3. Arquitectura desacoplada lista para integración en microservicios.`;
  }

  if (
    domain === 'math_reasoning' ||
    clean.includes('ecuacion') ||
    clean.includes('fourier') ||
    clean.includes('calcular') ||
    clean.includes('integral') ||
    clean.includes('despejar')
  ) {
    if (clean.includes('2x + 6 = 14') || clean.includes('despejar') || clean.includes('lineal')) {
      return `### Resolución paso a paso con **${model.name}**\n\nDada la ecuación lineal:\n\\[ 2x + 6 = 14 \\]\n\n**Paso 1:** Restamos 6 a ambos miembros de la igualdad:\n\\[ 2x = 14 - 6 \\]\n\\[ 2x = 8 \\]\n\n**Paso 2:** Dividimos ambos miembros entre 2:\n\\[ x = \\frac{8}{2} = 4 \\]\n\n**Comprobación:**\n\\[ 2(4) + 6 = 8 + 6 = 14 \\quad \\checkmark \\]\n\n**Resultado:** \\( x = 4 \\)`;
    }
    return `### Demostración y análisis matemático con **${model.name}**\n\nPara resolver el problema planteado:\n\n1. **Condiciones de frontera:** Se verifican las condiciones de Dirichlet para asegurar la convergencia puntual y en media cuadrática.\n2. **Coeficientes ortogonales:**\n\\[ a_n = \\frac{1}{\\pi} \\int_{-\\pi}^{\\pi} f(x) \\cos(nx) \\, dx, \\quad b_n = \\frac{1}{\\pi} \\int_{-\\pi}^{\\pi} f(x) \\sin(nx) \\, dx \\]\n3. **Conclusión formal:** La serie converge uniformemente en los intervalos de continuidad con error asintótico \\( \\mathcal{O}(1/n) \\).`;
  }

  if (
    domain === 'long_context' ||
    clean.includes('pdf') ||
    clean.includes('tesis') ||
    clean.includes('documento') ||
    clean.includes('paginas')
  ) {
    return `### Síntesis documental generada por **${model.name}**\n\nTras el análisis contextual extenso del documento:\n\n1. **Objetivo Principal:** Articular los fundamentos teóricos con la evidencia empírica observada.\n2. **Hallazgos Metodológicos:** Se identifica consistencia en la muestra, con especial atención a las variables de control y validez interna.\n3. **Conclusiones Clave:** Las discrepancias reportadas corresponden a diferencias en el marco muestral y no a fallos estructurales.`;
  }

  if (
    domain === 'creative_writing' ||
    clean.includes('cumpleaños') ||
    clean.includes('ensayo') ||
    clean.includes('redactar') ||
    clean.includes('frase')
  ) {
    if (clean.includes('cumpleaños') || clean.includes('amigo')) {
      return `¡Feliz cumpleaños, amigo! Que este nuevo año de vida venga cargado de metas cumplidas, momentos memorables y la alegría que siempre contagias a quienes te rodean. ¡Un abrazo enorme y a celebrar como te lo mereces! 🎂🎉`;
    }
    return `### Propuesta editorial de **${model.name}**\n\nEn un entorno donde la velocidad suele opacar la profundidad, construir narrativas sólidas exige precisión conceptual y ritmo cadencioso. Esta propuesta articula una perspectiva transformadora, entrelazando rigor argumentativo con un estilo literario fluido que cautiva a la audiencia desde la primera línea.`;
  }

  return `### Respuesta generada por **${model.name}**\n\nHe procesado tu consulta de manera estructurada:\n\n- **Respuesta directa:** Tu solicitud ha sido resuelta considerando las directrices técnicas y el contexto provisto.\n- **Detalle relevante:** Se garantiza coherencia, precisión conceptual y alineación con los estándares actuales.\n\n¿Deseas profundizar en algún punto específico o añadir nuevos parámetros a la consulta?`;
}

export const dashboardService = {
  getOverviewData(userId) {
    const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(userId);
    if (!user) throw new HttpError(401, 'Sesión inválida');

    costEngineService.cleanupExpiredReservations(userId);
    const wallet = ensureWallet(userId);
    const logs = db
      .prepare('SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
    const transactions = db
      .prepare('SELECT * FROM billing_transactions WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
    const apiKeys = db
      .prepare(
        'SELECT id, name, key_prefix, status, last_used_at, created_at FROM user_api_keys WHERE user_id = ? ORDER BY created_at DESC'
      )
      .all(userId);
    const models = db
      .prepare('SELECT * FROM ai_models_benchmarks WHERE is_active = 1 ORDER BY cost_cop ASC')
      .all();
    const pricingRates = db
      .prepare('SELECT * FROM model_pricing_rates WHERE is_current = 1')
      .all();
    const recentCostAudits = db
      .prepare('SELECT * FROM request_cost_audit WHERE user_id = ? ORDER BY created_at DESC LIMIT 25')
      .all(userId);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentMonthPrefix = now.toISOString().slice(0, 7);

    let todaySpendCop = 0;
    let weekSpendCop = 0;
    let monthSpendCop = 0;
    let totalSpendCop = 0;
    let totalProviderCostCop = 0;
    let inputTokens = 0;
    let cachedTokens = 0;
    let outputTokens = 0;
    let hasDemoData = false;

    for (const log of logs) {
      if (log.is_demo) hasDemoData = true;
      if (log.status === 'error') continue;
      const cost = Number(log.cost_cop) || 0;
      totalSpendCop += cost;
      totalProviderCostCop += Number(log.provider_cost_cop) || 0;
      inputTokens += Number(log.input_tokens) || 0;
      cachedTokens += Number(log.cached_tokens) || 0;
      outputTokens += Number(log.output_tokens) || 0;

      const dateStr = String(log.created_at).slice(0, 10);
      const logDate = new Date(log.created_at);
      if (dateStr === todayStr) todaySpendCop += cost;
      if (logDate >= sevenDaysAgo) weekSpendCop += cost;
      if (String(log.created_at).slice(0, 7) === currentMonthPrefix) monthSpendCop += cost;
    }

    const totalRequests = logs.length;
    const totalTokens = inputTokens + outputTokens;
    const avgCostPerRequestCop =
      totalRequests > 0 ? Math.round((totalSpendCop / totalRequests) * 10) / 10 : 0;

    let totalTopupCop = 0;
    for (const tx of transactions) {
      if (tx.type === 'topup' && tx.status === 'completed' && Number(tx.amount_cop) > 0) {
        totalTopupCop += Number(tx.amount_cop);
      }
    }

    const reservedCop = Number(wallet.reserved_cop) || 0;
    const availableBalanceCop = Math.max(0, Number(wallet.balance_cop) - reservedCop);

    return {
      user,
      wallet: {
        balanceCop: wallet.balance_cop,
        reservedCop,
        availableBalanceCop,
        defaultRoutingMode: wallet.default_routing_mode,
        monthlyBudgetCop: wallet.monthly_budget_cop,
        lowBalanceAlertCop: wallet.low_balance_alert_cop,
      },
      kpis: {
        balanceCop: wallet.balance_cop,
        availableBalanceCop,
        todaySpendCop,
        weekSpendCop,
        monthSpendCop,
        totalSpendCop,
        totalProviderCostCop: Math.round(totalProviderCostCop * 100) / 100,
        totalTopupCop,
        totalRequests,
        inputTokens,
        cachedTokens,
        outputTokens,
        totalTokens,
        avgCostPerRequestCop,
      },
      hasDemoData,
      wompi: {
        isConfigured: config.wompi.isConfigured,
        env: config.wompi.env,
      },
      moonshot: {
        isConfigured: config.providers.moonshot.isConfigured,
        modelId: config.providers.moonshot.modelId,
        baseUrl: config.providers.moonshot.baseUrl,
      },
      fxSettings: costEngineService.getFxSettings(),
      pricingRates,
      recentCostAudits,
      logs,
      transactions,
      apiKeys,
      models,
    };
  },

  recommendTask(promptText) {
    const cleanPrompt = String(promptText || '').trim();
    if (!cleanPrompt) throw new HttpError(400, 'Escribe primero tu tarea para analizarla');
    const rec = routerService.recommend(cleanPrompt);
    return {
      recommendation: rec,
    };
  },

  async executeTask(userId, promptText, requestedModelName = null, options = {}) {
    const cleanPrompt = String(promptText || '').trim();
    if (!cleanPrompt) throw new HttpError(400, 'Escribe primero tu tarea para procesarla');

    ensureWallet(userId);
    const rec = routerService.recommend(cleanPrompt);

    // 1. Identificar el modelo objetivo (explícito o recomendado por el enrutador)
    let modelRow = null;
    if (requestedModelName && requestedModelName !== 'auto') {
      modelRow = db
        .prepare('SELECT * FROM ai_models_benchmarks WHERE name = ? OR slug = ?')
        .get(requestedModelName, requestedModelName);
    }
    if (!modelRow) {
      modelRow =
        db.prepare('SELECT * FROM ai_models_benchmarks WHERE name = ? AND is_active = 1').get(rec.model) ||
        db.prepare('SELECT * FROM ai_models_benchmarks WHERE is_active = 1 ORDER BY cost_cop ASC LIMIT 1').get();
    }

    // 2. Estimación Pre-Vuelo y preparación del contexto de conversación
    const preFlight = costEngineService.estimatePreFlight({
      modelRow,
      messages: options.messages || null,
      promptText: cleanPrompt,
      requestedMaxOutputTokens: options.maxTokens,
    });

    // 3. Bloqueo atómico de saldo (Reserva Pre-Vuelo) para impedir condiciones de carrera
    const reservationId = costEngineService.reserveBalance({
      userId,
      modelSlug: modelRow.slug,
      estimatedInputTokens: preFlight.contextInfo.estimatedInputTokens,
      maxOutputTokens: preFlight.maxOutputTokens,
      reservedAmountCop: preFlight.reservedAmountCop,
    });

    // 4. Invocación al proveedor externo; si falla la red o la API, liberamos la reserva sin cobrar
    let providerResult;
    try {
      const complexityFactor = rec.analysis?.complexity || 0.35;
      providerResult = await llmProviderService.generateCompletion({
        modelRow,
        messages: preFlight.contextInfo.normalizedMessages,
        promptText: cleanPrompt,
        domain: rec.analysis?.domain,
        complexity: complexityFactor,
        maxOutputTokens: preFlight.maxOutputTokens,
        contextInfo: preFlight.contextInfo,
      });
    } catch (err) {
      costEngineService.releaseReservation(reservationId);
      throw err;
    }

    // 5. Cálculo del costo definitivo y margen usando los datos reales de consumo
    const settlement = costEngineService.calculateSettlement({
      modelRow,
      usage: providerResult,
      remoteModelId: providerResult.remoteModelId,
      toolCallsCount: options.toolCallsCount || 0,
    });

    const { latencyMs, reply, liveProvider } = providerResult;
    const now = new Date().toISOString();
    const summary = cleanPrompt.length > 90 ? `${cleanPrompt.slice(0, 87)}...` : cleanPrompt;
    const ref = `API-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const methodLabel = options.apiKeyId ? 'Gateway API (iac_live)' : 'Consumo API';

    let finalChargedCop = settlement.userChargedCop;

    // 6. Liquidación Atómica (Settle Reservation + Descuento Real + Auditoría Financiera)
    db.exec('BEGIN IMMEDIATE');
    try {
      const rsv = db
        .prepare('SELECT * FROM wallet_reservations WHERE id = ?')
        .get(reservationId);
      if (!rsv || rsv.status !== 'reserved') {
        throw new HttpError(409, 'La reserva de esta solicitud ya fue procesada');
      }

      const freshWallet = db
        .prepare('SELECT balance_cop, reserved_cop FROM user_wallets WHERE user_id = ?')
        .get(userId);
      if (!freshWallet) {
        throw new HttpError(404, 'Billetera no encontrada al liquidar consumo');
      }

      // Garantía estricta contra saldos negativos
      finalChargedCop = Math.min(Number(freshWallet.balance_cop), settlement.userChargedCop);
      const nextBalanceCop = Math.max(0, Number(freshWallet.balance_cop) - finalChargedCop);
      const nextReservedCop = Math.max(
        0,
        (Number(freshWallet.reserved_cop) || 0) - Number(rsv.reserved_amount_cop)
      );

      db.prepare(
        'UPDATE user_wallets SET balance_cop = ?, reserved_cop = ?, updated_at = ? WHERE user_id = ?'
      ).run(nextBalanceCop, nextReservedCop, now, userId);

      db.prepare(
        "UPDATE wallet_reservations SET status = 'settled', settled_at = ? WHERE id = ?"
      ).run(now, reservationId);

      const logInsert = db
        .prepare(`
          INSERT INTO usage_logs (
            user_id, prompt_summary, model_slug, model_name, provider, domain,
            input_tokens, cached_tokens, output_tokens, cost_cop, provider_cost_cop,
            latency_ms, status, is_demo, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 0, ?)
        `)
        .run(
          userId,
          summary,
          modelRow.slug,
          modelRow.name,
          modelRow.provider,
          rec.analysis.domainLabel,
          settlement.promptTokensTotal,
          settlement.inputCachedTokens,
          settlement.outputTokensTotal,
          finalChargedCop,
          settlement.providerCostCop,
          latencyMs,
          now
        );

      const usageLogId = Number(logInsert.lastInsertRowid);

      const cacheNote =
        settlement.inputCachedTokens > 0
          ? ` · ${settlement.inputCachedTokens} tokens en caché`
          : '';

      db.prepare(`
        INSERT INTO billing_transactions (
          user_id, reference, type, method, amount_cop, description, status, is_demo, created_at, updated_at
        ) VALUES (?, ?, 'usage_debit', ?, ?, ?, 'completed', 0, ?, ?)
      `).run(
        userId,
        ref,
        methodLabel,
        -finalChargedCop,
        `Consulta ${modelRow.name} (${settlement.totalTokens} tokens${cacheNote})`,
        now,
        now
      );

      db.prepare(`
        INSERT INTO request_cost_audit (
          usage_log_id, reservation_id, user_id, provider_slug, model_slug, remote_model_id,
          pricing_rate_id, prompt_tokens_total, input_uncached_tokens, input_cached_tokens,
          cache_write_tokens, output_tokens_total, reasoning_tokens, tool_calls_count,
          is_estimated_usage, applied_fx_rate_cop, provider_cost_usd, provider_cost_cop,
          operational_overhead_cop, total_internal_cost_cop, user_charged_cop,
          net_profit_cop, net_margin_pct, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        usageLogId,
        reservationId,
        userId,
        settlement.providerSlug,
        settlement.modelSlug,
        settlement.remoteModelId,
        settlement.pricingRateId,
        settlement.promptTokensTotal,
        settlement.inputUncachedTokens,
        settlement.inputCachedTokens,
        settlement.cacheWriteTokens,
        settlement.outputTokensTotal,
        settlement.reasoningTokens,
        settlement.toolCallsCount,
        settlement.isEstimatedUsage ? 1 : 0,
        settlement.appliedFxRateCop,
        settlement.providerCostUsd,
        settlement.providerCostCop,
        settlement.operationalOverheadCop,
        settlement.totalInternalCostCop,
        finalChargedCop,
        Number((finalChargedCop - settlement.totalInternalCostCop).toFixed(2)),
        finalChargedCop > 0
          ? Math.round(((finalChargedCop - settlement.totalInternalCostCop) / finalChargedCop) * 1000) / 10
          : 0,
        now
      );

      if (options.apiKeyId) {
        db.prepare('UPDATE user_api_keys SET last_used_at = ? WHERE id = ?').run(
          now,
          options.apiKeyId
        );
      } else {
        db.prepare(`
          UPDATE user_api_keys
          SET last_used_at = ?
          WHERE id = (
            SELECT id FROM user_api_keys WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1
          )
        `).run(now, userId);
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      costEngineService.releaseReservation(reservationId);
      throw err;
    }

    const updatedDashboard = this.getOverviewData(userId);
    const tokenPayload = {
      inputTokens: settlement.promptTokensTotal,
      inputUncachedTokens: settlement.inputUncachedTokens,
      cachedTokens: settlement.inputCachedTokens,
      cacheWriteTokens: settlement.cacheWriteTokens,
      outputTokens: settlement.outputTokensTotal,
      reasoningTokens: settlement.reasoningTokens,
      totalTokens: settlement.totalTokens,
      cacheSavingsCop: settlement.cacheSavingsCop,
    };

    return {
      reference: ref,
      reservationId,
      liveProvider,
      recommendation: {
        ...rec,
        cost: `$${finalChargedCop} COP`,
        tokens: tokenPayload,
      },
      model: modelRow.name,
      modelSlug: modelRow.slug,
      remoteModelId: settlement.remoteModelId,
      provider: modelRow.provider,
      cost: `$${finalChargedCop} COP`,
      costCop: finalChargedCop,
      remainingBalanceCop: updatedDashboard.wallet.balanceCop,
      tokens: tokenPayload,
      costBreakdown: {
        providerCostUsd: settlement.providerCostUsd,
        providerCostCop: settlement.providerCostCop,
        operationalOverheadCop: settlement.operationalOverheadCop,
        totalInternalCostCop: settlement.totalInternalCostCop,
        userChargedCop: finalChargedCop,
        cacheSavingsCop: settlement.cacheSavingsCop,
        netProfitCop: Number((finalChargedCop - settlement.totalInternalCostCop).toFixed(2)),
        netMarginPct: settlement.netMarginPct,
        appliedFxRateCop: settlement.appliedFxRateCop,
        contextCompacted: preFlight.contextInfo.compacted,
        turnCount: preFlight.contextInfo.turnCount,
      },
      latencyMs,
      reply,
      dashboard: updatedDashboard,
    };
  },

  topUpBalance(userId, { amountCop, method }) {
    const amount = Number(amountCop);
    if (!Number.isFinite(amount) || amount < 2000 || amount > 2000000) {
      throw new HttpError(400, 'Ingresa un monto de recarga válido entre $2.000 y $2.000.000 COP');
    }
    const cleanMethod = method === 'PSE' ? 'PSE' : 'Nequi';
    ensureWallet(userId);
    const now = new Date().toISOString();
    const ref = `${cleanMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`;

    db.prepare('UPDATE user_wallets SET balance_cop = balance_cop + ?, updated_at = ? WHERE user_id = ?').run(
      amount,
      now,
      userId
    );

    db.prepare(`
      INSERT INTO billing_transactions (
        user_id, reference, type, method, amount_cop, description, status, is_demo, created_at
      ) VALUES (?, ?, 'topup', ?, ?, ?, 'completed', 0, ?)
    `).run(
      userId,
      ref,
      cleanMethod,
      amount,
      `Recarga prepago vía ${cleanMethod}`,
      now
    );

    return this.getOverviewData(userId);
  },

  createApiKey(userId, { name }) {
    const cleanName = String(name || '').trim() || 'Clave Principal';
    if (cleanName.length > 60) {
      throw new HttpError(400, 'El nombre de la clave no debe superar 60 caracteres');
    }
    const rawSecret = `iac_live_${crypto.randomBytes(18).toString('hex')}`;
    const keyPrefix = `${rawSecret.slice(0, 13)}••••••••${rawSecret.slice(-4)}`;
    const keyHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_api_keys (user_id, name, key_prefix, key_hash, status, created_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).run(userId, cleanName, keyPrefix, keyHash, now);

    return {
      rawSecret,
      dashboard: this.getOverviewData(userId),
    };
  },

  revokeApiKey(userId, keyId) {
    const row = db
      .prepare('SELECT id FROM user_api_keys WHERE id = ? AND user_id = ?')
      .get(Number(keyId), userId);
    if (!row) throw new HttpError(404, 'Clave API no encontrada');

    db.prepare("UPDATE user_api_keys SET status = 'revoked' WHERE id = ? AND user_id = ?").run(
      Number(keyId),
      userId
    );
    return this.getOverviewData(userId);
  },

  updateSettings(userId, { name, defaultRoutingMode, monthlyBudgetCop, lowBalanceAlertCop }) {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new HttpError(400, 'El nombre no puede estar vacío');

    const allowedModes = ['economy', 'balanced', 'quality'];
    const mode = allowedModes.includes(defaultRoutingMode) ? defaultRoutingMode : 'balanced';
    const budget = Math.max(5000, Number(monthlyBudgetCop) || 50000);
    const alert = Math.max(0, Number(lowBalanceAlertCop) || 3000);

    ensureWallet(userId);
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(cleanName, userId);
    db.prepare(`
      UPDATE user_wallets
      SET default_routing_mode = ?, monthly_budget_cop = ?, low_balance_alert_cop = ?, updated_at = ?
      WHERE user_id = ?
    `).run(mode, budget, alert, new Date().toISOString(), userId);

    return this.getOverviewData(userId);
  },

  toggleDemoData(userId, action) {
    ensureWallet(userId);
    // Limpiar registros de demostración previos del usuario
    db.prepare('DELETE FROM usage_logs WHERE user_id = ? AND is_demo = 1').run(userId);
    db.prepare('DELETE FROM billing_transactions WHERE user_id = ? AND is_demo = 1').run(userId);

    if (action === 'clear') {
      return this.getOverviewData(userId);
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const demoLogs = [
      {
        daysAgo: 0,
        hoursAgo: 1,
        prompt: '[Demo] Analizar marco teórico de tesis de 45 páginas en PDF y extraer citas APA 7',
        slug: 'kimi-k2',
        model: 'Moonshot Kimi K2',
        provider: 'Moonshot AI',
        domain: 'Lectura Académica y Documentos',
        inTok: 8420,
        outTok: 1950,
        cost: 49,
        latency: 1320,
        status: 'completed',
      },
      {
        daysAgo: 0,
        hoursAgo: 3,
        prompt: '[Demo] Refactorizar servicio de autenticación JWT en Node.js y crear tests unitarios',
        slug: 'claude-sonnet',
        model: 'Claude 3.7 Sonnet',
        provider: 'Anthropic API',
        domain: 'Ingeniería de Software y Código',
        inTok: 2150,
        outTok: 1480,
        cost: 126,
        latency: 1680,
        status: 'completed',
      },
      {
        daysAgo: 1,
        hoursAgo: 4,
        prompt: '[Demo] Función básica en Python para ordenar una lista de diccionarios por fecha',
        slug: 'gemini-flash',
        model: 'Gemini 2.5 Flash',
        provider: 'Google DeepMind',
        domain: 'Ingeniería de Software y Código',
        inTok: 340,
        outTok: 520,
        cost: 9,
        latency: 480,
        status: 'completed',
      },
      {
        daysAgo: 2,
        hoursAgo: 6,
        prompt: '[Demo] Demostrar paso a paso la convergencia de una serie de Fourier y graficar armónicos',
        slug: 'deepseek-r1',
        model: 'DeepSeek R1',
        provider: 'DeepSeek API',
        domain: 'Matemáticas y Lógica',
        inTok: 1280,
        outTok: 2640,
        cost: 28,
        latency: 1910,
        status: 'completed',
      },
      {
        daysAgo: 3,
        hoursAgo: 2,
        prompt: '[Demo] Traducir 15 abstracts científicos al español y normalizar referencias APA',
        slug: 'gemini-flash',
        model: 'Gemini 2.5 Flash',
        provider: 'Google DeepMind',
        domain: 'Consulta General y Formato',
        inTok: 4600,
        outTok: 4100,
        cost: 30,
        latency: 590,
        status: 'completed',
      },
      {
        daysAgo: 5,
        hoursAgo: 5,
        prompt: '[Demo] Sintetizar estado del arte sobre enrutadores de modelos LLM (RouteLLM y benchmarks)',
        slug: 'kimi-k2',
        model: 'Moonshot Kimi K2',
        provider: 'Moonshot AI',
        domain: 'Lectura Académica y Documentos',
        inTok: 6200,
        outTok: 2100,
        cost: 44,
        latency: 1290,
        status: 'completed',
      },
      {
        daysAgo: 6,
        hoursAgo: 3,
        prompt: '[Demo] Diseñar esquema relacional en SQLite con índices para historial de tokens',
        slug: 'llama-3-3-70b',
        model: 'Llama 3.3 70B Instruct',
        provider: 'Meta / Inferencia Rápida',
        domain: 'Ingeniería de Software y Código',
        inTok: 1120,
        outTok: 1340,
        cost: 12,
        latency: 710,
        status: 'completed',
      },
      {
        daysAgo: 10,
        hoursAgo: 4,
        prompt: '[Demo] Optimización no lineal con multiplicadores de Lagrange y condiciones KKT',
        slug: 'deepseek-r1',
        model: 'DeepSeek R1',
        provider: 'DeepSeek API',
        domain: 'Matemáticas y Lógica',
        inTok: 1450,
        outTok: 2890,
        cost: 31,
        latency: 1850,
        status: 'completed',
      },
      {
        daysAgo: 14,
        hoursAgo: 2,
        prompt: '[Demo] Depurar condición de carrera en WebSockets y concurrencia asíncrona',
        slug: 'claude-sonnet',
        model: 'Claude 3.7 Sonnet',
        provider: 'Anthropic API',
        domain: 'Ingeniería de Software y Código',
        inTok: 1980,
        outTok: 1620,
        cost: 133,
        latency: 1740,
        status: 'completed',
      },
      {
        daysAgo: 19,
        hoursAgo: 5,
        prompt: '[Demo] Revisión completa de capítulo metodológico de proyecto de grado (60 págs.)',
        slug: 'kimi-k2',
        model: 'Moonshot Kimi K2',
        provider: 'Moonshot AI',
        domain: 'Lectura Académica y Documentos',
        inTok: 11400,
        outTok: 2800,
        cost: 69,
        latency: 1420,
        status: 'completed',
      },
      {
        daysAgo: 24,
        hoursAgo: 3,
        prompt: '[Demo] Explicación breve de diferencias entre procesos e hilos en sistemas operativos',
        slug: 'gemini-flash',
        model: 'Gemini 2.5 Flash',
        provider: 'Google DeepMind',
        domain: 'Consulta General y Formato',
        inTok: 290,
        outTok: 610,
        cost: 9,
        latency: 450,
        status: 'completed',
      },
    ];

    const insertLog = db.prepare(`
      INSERT INTO usage_logs (
        user_id, prompt_summary, model_slug, model_name, provider, domain,
        input_tokens, output_tokens, cost_cop, latency_ms, status, is_demo, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const insertTx = db.prepare(`
      INSERT INTO billing_transactions (
        user_id, reference, type, method, amount_cop, description, status, is_demo, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed', 1, ?)
    `);

    insertTx.run(
      userId,
      'DEMO-NEQUI-01',
      'topup',
      'Nequi',
      20000,
      '[Demo] Recarga prepago vía Nequi',
      new Date(now - 20 * dayMs).toISOString()
    );

    insertTx.run(
      userId,
      'DEMO-PSE-02',
      'topup',
      'PSE',
      15000,
      '[Demo] Recarga bancaria PSE',
      new Date(now - 7 * dayMs).toISOString()
    );

    demoLogs.forEach((item, idx) => {
      const ts = new Date(now - item.daysAgo * dayMs - item.hoursAgo * 3600 * 1000).toISOString();
      insertLog.run(
        userId,
        item.prompt,
        item.slug,
        item.model,
        item.provider,
        item.domain,
        item.inTok,
        item.outTok,
        item.cost,
        item.latency,
        item.status,
        ts
      );
      insertTx.run(
        userId,
        `DEMO-API-${100 + idx}`,
        'usage_debit',
        'Consumo API',
        -item.cost,
        `${item.prompt.slice(0, 56)}...`,
        ts
      );
    });

    return this.getOverviewData(userId);
  },
};
