import crypto from 'node:crypto';
import { db } from '../db.js';
import { HttpError } from '../errors.js';
import { routerService } from './routerService.js';

function ensureWallet(userId) {
  let wallet = db.prepare('SELECT * FROM user_wallets WHERE user_id = ?').get(userId);
  if (!wallet) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_wallets (user_id, balance_cop, default_routing_mode, monthly_budget_cop, low_balance_alert_cop, updated_at)
      VALUES (?, 15000, 'balanced', 50000, 3000, ?)
    `).run(userId, now);

    const existingTx = db
      .prepare('SELECT COUNT(*) as total FROM billing_transactions WHERE user_id = ?')
      .get(userId);
    if (existingTx.total === 0) {
      db.prepare(`
        INSERT INTO billing_transactions (user_id, reference, type, method, amount_cop, description, status, is_demo, created_at)
        VALUES (?, ?, 'topup', 'Crédito Inicial Piloto', 15000, 'Bono de bienvenida IA CHOOSE (Piloto COP)', 'completed', 0, ?)
      `).run(userId, `BONO-${userId}01`, now);
    }
    wallet = db.prepare('SELECT * FROM user_wallets WHERE user_id = ?').get(userId);
  }
  return wallet;
}

export const dashboardService = {
  getOverviewData(userId) {
    const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(userId);
    if (!user) throw new HttpError(401, 'Sesión inválida');

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
    const models = db.prepare('SELECT * FROM ai_models_benchmarks ORDER BY cost_cop ASC').all();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentMonthPrefix = now.toISOString().slice(0, 7);

    let todaySpendCop = 0;
    let weekSpendCop = 0;
    let monthSpendCop = 0;
    let totalSpendCop = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let hasDemoData = false;

    for (const log of logs) {
      if (log.is_demo) hasDemoData = true;
      if (log.status === 'error') continue;
      const cost = Number(log.cost_cop) || 0;
      totalSpendCop += cost;
      inputTokens += Number(log.input_tokens) || 0;
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

    return {
      user,
      wallet: {
        balanceCop: wallet.balance_cop,
        defaultRoutingMode: wallet.default_routing_mode,
        monthlyBudgetCop: wallet.monthly_budget_cop,
        lowBalanceAlertCop: wallet.low_balance_alert_cop,
      },
      kpis: {
        balanceCop: wallet.balance_cop,
        todaySpendCop,
        weekSpendCop,
        monthSpendCop,
        totalSpendCop,
        totalRequests,
        inputTokens,
        outputTokens,
        totalTokens,
        avgCostPerRequestCop,
      },
      hasDemoData,
      logs,
      transactions,
      apiKeys,
      models,
    };
  },

  executeTask(userId, promptText) {
    const cleanPrompt = String(promptText || '').trim();
    if (!cleanPrompt) throw new HttpError(400, 'Escribe primero tu tarea para analizarla');

    const wallet = ensureWallet(userId);
    const rec = routerService.recommend(cleanPrompt);
    const modelRow =
      db.prepare('SELECT * FROM ai_models_benchmarks WHERE name = ?').get(rec.model) ||
      db.prepare('SELECT * FROM ai_models_benchmarks ORDER BY cost_cop ASC LIMIT 1').get();

    // Estimación proporcional de tokens procesados según longitud y complejidad de la tarea
    const words = cleanPrompt.split(/\s+/).length;
    const complexityFactor = rec.analysis?.complexity || 0.3;
    const inputTokens = Math.max(48, Math.round(words * 18 + complexityFactor * 620));
    const outputTokens = Math.max(120, Math.round(180 + complexityFactor * 940));

    const computedCost = Math.max(
      modelRow.cost_cop,
      Math.round(
        (inputTokens / 1000) * modelRow.input_cost_1k_cop +
          (outputTokens / 1000) * modelRow.output_cost_1k_cop
      )
    );

    if (wallet.balance_cop < computedCost) {
      throw new HttpError(
        402,
        `Saldo insuficiente ($${wallet.balance_cop} COP). Recarga tu cuenta en la sección Transacciones y saldo.`
      );
    }

    const now = new Date().toISOString();
    const latencyMs = Math.round(modelRow.latency_sec * 1000 + (Math.random() * 180 - 90));
    const summary = cleanPrompt.length > 90 ? `${cleanPrompt.slice(0, 87)}...` : cleanPrompt;

    db.prepare('UPDATE user_wallets SET balance_cop = balance_cop - ?, updated_at = ? WHERE user_id = ?').run(
      computedCost,
      now,
      userId
    );

    db.prepare(`
      INSERT INTO usage_logs (
        user_id, prompt_summary, model_slug, model_name, provider, domain,
        input_tokens, output_tokens, cost_cop, latency_ms, status, is_demo, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', 0, ?)
    `).run(
      userId,
      summary,
      modelRow.slug,
      modelRow.name,
      modelRow.provider,
      rec.analysis.domainLabel,
      inputTokens,
      outputTokens,
      computedCost,
      latencyMs,
      now
    );

    const ref = `API-${Date.now().toString().slice(-6)}`;
    db.prepare(`
      INSERT INTO billing_transactions (
        user_id, reference, type, method, amount_cop, description, status, is_demo, created_at
      ) VALUES (?, ?, 'usage_debit', 'Consumo API', ?, ?, 'completed', 0, ?)
    `).run(
      userId,
      ref,
      -computedCost,
      `Enrutamiento ${modelRow.name} (${inputTokens + outputTokens} tokens)`,
      now
    );

    db.prepare(`
      UPDATE user_api_keys
      SET last_used_at = ?
      WHERE id = (
        SELECT id FROM user_api_keys WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1
      )
    `).run(now, userId);

    return {
      recommendation: {
        ...rec,
        cost: `$${computedCost} COP`,
        tokens: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      },
      dashboard: this.getOverviewData(userId),
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
