import crypto from 'node:crypto';
import { Router } from 'express';
import { db } from '../db.js';
import { HttpError } from '../errors.js';
import { authService } from '../services/authService.js';
import { dashboardService } from '../services/dashboardService.js';

const router = Router();

/**
 * Autentica peticiones al Gateway API de IA CHOOSE (/api/v1/*):
 * 1. Prioriza claves de cliente `iac_live_...` validando su hash SHA-256 en `user_api_keys`.
 * 2. Permite también token de sesión JWT (para el probador interactivo dentro del Dashboard).
 */
function requireApiKeyOrAuth(req, _res, next) {
  try {
    const header = String(req.headers.authorization || '').trim();
    const rawToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!rawToken) {
      throw new HttpError(
        401,
        'Falta cabecera Authorization: Bearer iac_live_... (Crea tu clave en la pestaña Claves API de IA CHOOSE)'
      );
    }

    if (rawToken.startsWith('iac_live_')) {
      const keyHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const keyRow = db
        .prepare('SELECT id, user_id, name, status FROM user_api_keys WHERE key_hash = ?')
        .get(keyHash);

      if (!keyRow) {
        throw new HttpError(401, 'Clave API iac_live_ inválida o no registrada en IA CHOOSE');
      }
      if (keyRow.status !== 'active') {
        throw new HttpError(403, `La clave API "${keyRow.name}" fue revocada`);
      }

      req.userId = keyRow.user_id;
      req.apiKeyId = keyRow.id;
      req.apiKeyName = keyRow.name;
      return next();
    }

    // Fallback: sesión JWT del Dashboard para pruebas desde el navegador
    req.userId = authService.verifyToken(rawToken);
    req.apiKeyId = null;
    return next();
  } catch (err) {
    return next(err);
  }
}

// Listar modelos disponibles en el Gateway de IA CHOOSE (estándar OpenAI /v1/models)
router.get('/v1/models', requireApiKeyOrAuth, (_req, res) => {
  const models = db
    .prepare('SELECT * FROM ai_models_benchmarks WHERE is_active = 1 ORDER BY cost_cop ASC')
    .all();
  res.json({
    object: 'list',
    data: [
      {
        id: 'auto',
        object: 'model',
        owned_by: 'ia-choose-router',
        description:
          'Enrutador inteligente IA CHOOSE: selecciona automáticamente el modelo óptimo según dominio y complejidad.',
      },
      ...models.map((m) => ({
        id: m.slug,
        name: m.name,
        object: 'model',
        owned_by: m.provider,
        tier: m.tier,
        pricing_cop: {
          min_request_cop: m.cost_cop,
          input_1k_tokens_cop: m.input_cost_1k_cop,
          output_1k_tokens_cop: m.output_cost_1k_cop,
        },
        context_window: m.context_window,
      })),
    ],
  });
});

// Endpoint compatible con OpenAI / DeepSeek (/api/v1/chat/completions) que descuenta saldo en COP
router.post('/v1/chat/completions', requireApiKeyOrAuth, async (req, res, next) => {
  try {
    const requestedModel = req.body?.model || 'deepseek-v4-flash';
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];

    // Extraer el último mensaje del usuario o el campo `prompt`
    let promptText = String(req.body?.prompt || '').trim();
    if (!promptText && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m?.role === 'user') || messages[messages.length - 1];
      promptText = String(lastUserMsg?.content || '').trim();
    }

    if (!promptText) {
      throw new HttpError(
        400,
        'Envía un arreglo `messages: [{ role: "user", content: "..." }]` o el campo `prompt`'
      );
    }

    const result = await dashboardService.executeTask(req.userId, promptText, requestedModel, {
      messages: messages.length > 0 ? messages : null,
      maxTokens: req.body?.max_tokens || req.body?.maxTokens,
      apiKeyId: req.apiKeyId,
    });

    res.json({
      id: `chatcmpl-${result.reference}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.modelSlug,
      remote_model_id: result.remoteModelId,
      model_name: result.model,
      provider: result.provider,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.reply,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: result.tokens.inputTokens,
        completion_tokens: result.tokens.outputTokens,
        total_tokens: result.tokens.totalTokens,
        prompt_tokens_details: {
          cached_tokens: result.tokens.cachedTokens || 0,
          cache_write_tokens: result.tokens.cacheWriteTokens || 0,
          uncached_tokens: result.tokens.inputUncachedTokens || result.tokens.inputTokens,
        },
        completion_tokens_details: {
          reasoning_tokens: result.tokens.reasoningTokens || 0,
        },
      },
      ia_choose_billing: {
        reference: result.reference,
        reservation_id: result.reservationId,
        charged_cop: result.costCop,
        charged_formatted: result.cost,
        cache_savings_cop: result.tokens.cacheSavingsCop || 0,
        provider_cost_usd: result.costBreakdown?.providerCostUsd,
        provider_cost_cop: result.costBreakdown?.providerCostCop,
        remaining_balance_cop: result.remainingBalanceCop,
        live_provider_connected: result.liveProvider,
        routed_domain: result.recommendation?.analysis?.domainLabel,
        latency_ms: result.latencyMs,
      },
      dashboard: result.dashboard,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
