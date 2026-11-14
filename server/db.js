import { DatabaseSync } from 'node:sqlite'; // SQLite incluido en Node (sin compilar nada)
import bcrypt from 'bcryptjs';
import { config } from './config.js';

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_wallets (
    user_id INTEGER PRIMARY KEY,
    balance_cop INTEGER NOT NULL DEFAULT 0,
    default_routing_mode TEXT NOT NULL DEFAULT 'balanced',
    monthly_budget_cop INTEGER NOT NULL DEFAULT 50000,
    low_balance_alert_cop INTEGER NOT NULL DEFAULT 3000,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    prompt_summary TEXT NOT NULL,
    model_slug TEXT NOT NULL,
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    domain TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_cop INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS billing_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reference TEXT NOT NULL,
    type TEXT NOT NULL,
    method TEXT NOT NULL,
    amount_cop INTEGER NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Asegurar columnas de trazabilidad para Wompi en billing_transactions
const txColumns = db
  .prepare("PRAGMA table_info('billing_transactions')")
  .all()
  .map((c) => c.name);

if (!txColumns.includes('wompi_transaction_id')) {
  db.exec('ALTER TABLE billing_transactions ADD COLUMN wompi_transaction_id TEXT');
}
if (!txColumns.includes('payment_method_type')) {
  db.exec('ALTER TABLE billing_transactions ADD COLUMN payment_method_type TEXT');
}
if (!txColumns.includes('updated_at')) {
  db.exec('ALTER TABLE billing_transactions ADD COLUMN updated_at TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_billing_tx_reference ON billing_transactions(reference)');

// Asegurar columna reserved_cop en user_wallets para bloqueo pre-vuelo de saldo
const walletColumns = db
  .prepare("PRAGMA table_info('user_wallets')")
  .all()
  .map((c) => c.name);
if (!walletColumns.includes('reserved_cop')) {
  db.exec('ALTER TABLE user_wallets ADD COLUMN reserved_cop INTEGER NOT NULL DEFAULT 0');
}

// Asegurar columnas de trazabilidad de caché y costo de proveedor en usage_logs
const usageColumns = db
  .prepare("PRAGMA table_info('usage_logs')")
  .all()
  .map((c) => c.name);
if (!usageColumns.includes('cached_tokens')) {
  db.exec('ALTER TABLE usage_logs ADD COLUMN cached_tokens INTEGER NOT NULL DEFAULT 0');
}
if (!usageColumns.includes('provider_cost_cop')) {
  db.exec('ALTER TABLE usage_logs ADD COLUMN provider_cost_cop REAL NOT NULL DEFAULT 0');
}

// Tablas del Motor Centralizado de Costos, Tarifas Oficiales, Reservas y Auditoría
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    billing_currency TEXT NOT NULL DEFAULT 'USD',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS model_pricing_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_slug TEXT NOT NULL UNIQUE,
    provider_slug TEXT NOT NULL,
    remote_model_id TEXT NOT NULL,
    input_usd_per_1m REAL NOT NULL,
    input_cached_usd_per_1m REAL NOT NULL,
    cache_write_usd_per_1m REAL NOT NULL DEFAULT 0.0,
    output_usd_per_1m REAL NOT NULL,
    reasoning_usd_per_1m REAL NOT NULL,
    tool_call_usd_per_unit REAL NOT NULL DEFAULT 0.0,
    max_context_tokens INTEGER NOT NULL DEFAULT 262144,
    max_output_tokens INTEGER NOT NULL DEFAULT 8192,
    markup_multiplier REAL NOT NULL DEFAULT 2.0,
    cached_markup_multiplier REAL NOT NULL DEFAULT 3.0,
    fixed_operational_fee_cop REAL NOT NULL DEFAULT 3.0,
    min_charge_cop INTEGER NOT NULL DEFAULT 12,
    effective_from TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_current INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (provider_slug) REFERENCES ai_providers(slug)
  );

  CREATE TABLE IF NOT EXISTS fx_and_gateway_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    usd_to_cop_trm REAL NOT NULL DEFAULT 4400.0,
    fx_safety_buffer_pct REAL NOT NULL DEFAULT 0.03,
    wompi_fee_pct REAL NOT NULL DEFAULT 0.0265,
    wompi_fixed_cop REAL NOT NULL DEFAULT 700.0,
    wompi_iva_pct REAL NOT NULL DEFAULT 0.19,
    min_topup_cop INTEGER NOT NULL DEFAULT 10000,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS wallet_reservations (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    model_slug TEXT NOT NULL,
    estimated_input_tokens INTEGER NOT NULL,
    max_output_tokens INTEGER NOT NULL,
    reserved_amount_cop INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'reserved',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS request_cost_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usage_log_id INTEGER NOT NULL,
    reservation_id TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    provider_slug TEXT NOT NULL,
    model_slug TEXT NOT NULL,
    remote_model_id TEXT NOT NULL,
    pricing_rate_id INTEGER NOT NULL,
    prompt_tokens_total INTEGER NOT NULL,
    input_uncached_tokens INTEGER NOT NULL,
    input_cached_tokens INTEGER NOT NULL,
    cache_write_tokens INTEGER NOT NULL,
    output_tokens_total INTEGER NOT NULL,
    reasoning_tokens INTEGER NOT NULL DEFAULT 0,
    tool_calls_count INTEGER NOT NULL DEFAULT 0,
    is_estimated_usage INTEGER NOT NULL DEFAULT 0,
    applied_fx_rate_cop REAL NOT NULL,
    provider_cost_usd REAL NOT NULL,
    provider_cost_cop REAL NOT NULL,
    operational_overhead_cop REAL NOT NULL,
    total_internal_cost_cop REAL NOT NULL,
    user_charged_cop INTEGER NOT NULL,
    net_profit_cop REAL NOT NULL,
    net_margin_pct REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usage_log_id) REFERENCES usage_logs(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (pricing_rate_id) REFERENCES model_pricing_rates(id)
  );
`);

// Semilla de configuración cambiaria y pasarela
const fxRow = db.prepare('SELECT id FROM fx_and_gateway_settings WHERE id = 1').get();
if (!fxRow) {
  db.prepare(`
    INSERT INTO fx_and_gateway_settings (
      id, usd_to_cop_trm, fx_safety_buffer_pct, wompi_fee_pct, wompi_fixed_cop, wompi_iva_pct, min_topup_cop
    ) VALUES (1, 4400.0, 0.03, 0.0265, 700.0, 0.19, 10000)
  `).run();
}

// Semilla de proveedores oficiales
const providerCount = db.prepare('SELECT COUNT(*) as total FROM ai_providers').get();
if (providerCount.total === 0) {
  const insertProvider = db.prepare(`
    INSERT INTO ai_providers (slug, name, base_url, billing_currency, is_active)
    VALUES (?, ?, ?, 'USD', 1)
  `);
  const initialProviders = [
    ['moonshot', 'Moonshot AI', 'https://api.moonshot.ai/v1'],
    ['google', 'Google DeepMind', 'https://generativelanguage.googleapis.com/v1beta'],
    ['meta', 'Meta / Inferencia Rápida', 'https://api.groq.com/openai/v1'],
    ['deepseek', 'DeepSeek API', 'https://api.deepseek.com/v1'],
    ['anthropic', 'Anthropic API', 'https://api.anthropic.com/v1'],
    ['frontier', 'Frontier Labs', 'https://api.openai.com/v1'],
  ];
  for (const p of initialProviders) {
    insertProvider.run(...p);
  }
}

// Semilla del tarifario oficial por modelo (USD por 1M tokens)
const pricingCount = db.prepare('SELECT COUNT(*) as total FROM model_pricing_rates').get();
if (pricingCount.total === 0) {
  const insertPricing = db.prepare(`
    INSERT INTO model_pricing_rates (
      model_slug, provider_slug, remote_model_id,
      input_usd_per_1m, input_cached_usd_per_1m, cache_write_usd_per_1m,
      output_usd_per_1m, reasoning_usd_per_1m, tool_call_usd_per_unit,
      max_context_tokens, max_output_tokens,
      markup_multiplier, cached_markup_multiplier, fixed_operational_fee_cop, min_charge_cop
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialRates = [
    // Moonshot Kimi K2.6 (Oficial platform.moonshot.ai: $0.95/1M in, $0.16/1M cached, $4.00/1M out)
    ['kimi-k2', 'moonshot', 'kimi-k2.6', 0.95, 0.16, 0.0, 4.00, 4.00, 0.005, 262144, 8192, 2.0, 3.0, 3.0, 14],
    // Google Gemini Flash
    ['gemini-flash', 'google', 'gemini-3.5-flash-lite', 0.15, 0.0375, 0.0, 0.60, 0.60, 0.0, 1000000, 8192, 2.0, 2.5, 2.0, 9],
    // Llama 3.3 70B Instruct
    ['llama-3-3-70b', 'meta', 'llama-3.3-70b-versatile', 0.59, 0.15, 0.0, 0.79, 0.79, 0.0, 128000, 8192, 2.0, 2.5, 2.0, 11],
    // DeepSeek R1
    ['deepseek-r1', 'deepseek', 'deepseek-reasoner', 0.55, 0.14, 0.0, 2.19, 2.19, 0.0, 128000, 8192, 2.0, 2.8, 3.0, 14],
    // Claude 3.7 Sonnet
    ['claude-sonnet', 'anthropic', 'claude-3-7-sonnet-latest', 3.00, 0.30, 3.75, 15.00, 15.00, 0.0, 200000, 8192, 1.9, 2.5, 4.0, 58],
    // Fable 5.1 Frontier
    ['fable-5-1', 'frontier', 'fable-5-1-frontier', 5.00, 0.50, 5.00, 20.00, 20.00, 0.0, 256000, 8192, 1.85, 2.5, 5.0, 115],
  ];

  for (const r of initialRates) {
    insertPricing.run(...r);
  }
}

// Eliminar registros de demostración (is_demo = 1) solo si existen
const hasDemoRows =
  db.prepare('SELECT id FROM usage_logs WHERE is_demo = 1 LIMIT 1').get() ||
  db.prepare('SELECT id FROM billing_transactions WHERE is_demo = 1 LIMIT 1').get();
if (hasDemoRows) {
  db.exec(`
    DELETE FROM usage_logs WHERE is_demo = 1;
    DELETE FROM billing_transactions WHERE is_demo = 1;
  `);
}

// Asegurar esquema actualizado para ai_models_benchmarks (incluyendo arena_writing)
const tableColumns = db
  .prepare("PRAGMA table_info('ai_models_benchmarks')")
  .all()
  .map((c) => c.name);

if (tableColumns.length > 0 && (!tableColumns.includes('input_cost_1k_cop') || !tableColumns.includes('arena_writing'))) {
  db.exec('DROP TABLE ai_models_benchmarks');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS ai_models_benchmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    tier TEXT NOT NULL,
    swe_bench REAL NOT NULL,
    math_500 REAL NOT NULL,
    long_bench REAL NOT NULL,
    arena_writing REAL NOT NULL,
    mmlu_pro REAL NOT NULL,
    latency_sec REAL NOT NULL,
    cost_cop INTEGER NOT NULL,
    input_cost_1k_cop REAL NOT NULL,
    output_cost_1k_cop REAL NOT NULL,
    context_window TEXT NOT NULL,
    description TEXT NOT NULL,
    availability TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );
`);

if (tableColumns.length > 0 && !tableColumns.includes('is_active')) {
  db.exec('ALTER TABLE ai_models_benchmarks ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
}

const countRow = db.prepare('SELECT COUNT(*) as total FROM ai_models_benchmarks').get();
if (countRow.total === 0) {
  const insertModel = db.prepare(`
    INSERT INTO ai_models_benchmarks (
      slug, name, provider, tier, swe_bench, math_500, long_bench, arena_writing, mmlu_pro,
      latency_sec, cost_cop, input_cost_1k_cop, output_cost_1k_cop,
      context_window, description, availability
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialModels = [
    [
      'gemini-flash',
      'Gemini 2.5 Flash',
      'Google DeepMind',
      'economy',
      82.4,
      83.0,
      86.5,
      84.0,
      85.2,
      0.5,
      9,
      1.8,
      5.4,
      '1.000.000 tokens',
      'Modelo multimodal de baja latencia ideal para consultas cotidianas, formato APA, traducciones y tareas de complejidad básica.',
      'Operativo',
    ],
    [
      'llama-3-3-70b',
      'Llama 3.3 70B Instruct',
      'Meta / Inferencia Rápida',
      'economy',
      84.1,
      84.6,
      85.0,
      88.5,
      86.8,
      0.7,
      11,
      2.1,
      6.8,
      '128.000 tokens',
      'Modelo abierto de alto rendimiento para redacción estructurada, síntesis creativa intermedia y asistencia en programación estándar.',
      'Operativo',
    ],
    [
      'deepseek-r1',
      'DeepSeek R1',
      'DeepSeek API',
      'balanced',
      89.5,
      96.4,
      87.0,
      86.2,
      90.8,
      1.9,
      14,
      2.4,
      9.6,
      '128.000 tokens',
      'Especialista en razonamiento formal cadena-de-pensamiento (CoT), demostraciones matemáticas, física y algoritmos.',
      'Operativo',
    ],
    [
      'kimi-k2',
      'Moonshot Kimi K2',
      'Moonshot AI',
      'balanced',
      88.2,
      89.0,
      95.8,
      91.0,
      91.4,
      1.3,
      18,
      3.2,
      11.5,
      '256.000 tokens',
      'Modelo piloto de IA CHOOSE optimizado para lectura de tesis, PDFs extensos, análisis documental y retención de contexto.',
      'Piloto Activo',
    ],
    [
      'claude-sonnet',
      'Claude 3.7 Sonnet',
      'Anthropic API',
      'frontier',
      96.5,
      92.8,
      93.0,
      96.2,
      94.6,
      1.7,
      58,
      13.2,
      66.0,
      '200.000 tokens',
      'Referente en ingeniería de software, depuración de sistemas complejos, arquitectura de código y redacción editorial profunda.',
      'Operativo',
    ],
    [
      'fable-5-1',
      'Fable 5.1 Frontier',
      'Frontier Labs',
      'ultra',
      97.2,
      96.8,
      96.2,
      97.1,
      97.5,
      2.8,
      115,
      28.0,
      112.0,
      '256.000 tokens',
      'Modelo pesado de frontera reservado exclusivamente para tareas de complejidad extrema (>90%). El enrutador evita su uso en tareas básicas.',
      'Alta Demanda',
    ],
  ];

  for (const m of initialModels) {
    insertModel.run(...m);
  }
}

// Sincronizar todos los modelos oficiales de Google AI Pro disponibles en la suscripción del usuario
// tanto en el catálogo (ai_models_benchmarks) como en el tarifario financiero (model_pricing_rates)
const googleProSuite = [
  {
    slug: 'gemini-4-carbon',
    name: 'Gemini 4 Carbon',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-4-carbon',
    tier: 'ultra',
    sweBench: 96.8,
    math500: 97.4,
    longBench: 96.9,
    arenaWriting: 96.5,
    mmluPro: 96.4,
    latencySec: 1.4,
    costCop: 42,
    inputCost1kCop: 11.3,
    outputCost1kCop: 54.4,
    contextWindow: '1.000.000 tokens',
    description:
      'Modelo tope de gama de la familia Gemini 4 (Google DeepMind) para arquitectura de software crítica, investigación científica y razonamiento complejo.',
    availability: 'Conexión Real',
    inputUsd1M: 1.25,
    cachedUsd1M: 0.3125,
    outputUsd1M: 6.00,
    reasoningUsd1M: 6.00,
    maxContextTokens: 1048576,
    maxOutputTokens: 32768,
    markupMultiplier: 1.95,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 3.0,
    minChargeCop: 42,
  },
  {
    slug: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-4-argon',
    tier: 'frontier',
    sweBench: 94.9,
    math500: 96.2,
    longBench: 95.8,
    arenaWriting: 95.1,
    mmluPro: 95.0,
    latencySec: 1.1,
    costCop: 26,
    inputCost1kCop: 6.8,
    outputCost1kCop: 34.0,
    contextWindow: '1.000.000 tokens',
    description:
      'Modelo avanzado Gemini 4 Argon de Google DeepMind diseñado para razonamiento profundo, agentes autónomos y síntesis de alta densidad.',
    availability: 'Conexión Real',
    inputUsd1M: 0.75,
    cachedUsd1M: 0.1875,
    outputUsd1M: 3.75,
    reasoningUsd1M: 3.75,
    maxContextTokens: 1048576,
    maxOutputTokens: 32768,
    markupMultiplier: 2.0,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.5,
    minChargeCop: 26,
  },
  {
    slug: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-4-hydrogen',
    tier: 'frontier',
    sweBench: 93.4,
    math500: 95.8,
    longBench: 95.2,
    arenaWriting: 94.5,
    mmluPro: 94.1,
    latencySec: 0.9,
    costCop: 16,
    inputCost1kCop: 4.5,
    outputCost1kCop: 22.7,
    contextWindow: '1.000.000 tokens',
    description:
      'Modelo insignia de 4ª generación de Google DeepMind con razonamiento híbrido profundo (thoughts), 1M de contexto y máxima precisión técnica.',
    availability: 'Conexión Real',
    inputUsd1M: 0.50,
    cachedUsd1M: 0.125,
    outputUsd1M: 2.50,
    reasoningUsd1M: 2.50,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.0,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 16,
  },
  {
    slug: 'gemini-3-1-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-3.1-pro-preview',
    tier: 'frontier',
    sweBench: 94.2,
    math500: 95.4,
    longBench: 95.6,
    arenaWriting: 94.8,
    mmluPro: 94.5,
    latencySec: 1.2,
    costCop: 38,
    inputCost1kCop: 11.3,
    outputCost1kCop: 45.3,
    contextWindow: '1.000.000 tokens',
    description:
      'Modelo Pro de la serie Gemini 3.1 especializado en ingeniería de software compleja, depuración multi-archivo y análisis matemático avanzado.',
    availability: 'Conexión Real',
    inputUsd1M: 1.25,
    cachedUsd1M: 0.3125,
    outputUsd1M: 5.00,
    reasoningUsd1M: 5.00,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 1.95,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 3.0,
    minChargeCop: 38,
  },
  {
    slug: 'gemini-omni-1-2-flash',
    name: 'Gemini Omni 1.2 Flash',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-omni-1.2-flash',
    tier: 'balanced',
    sweBench: 88.9,
    math500: 90.4,
    longBench: 91.5,
    arenaWriting: 91.8,
    mmluPro: 90.1,
    latencySec: 0.6,
    costCop: 14,
    inputCost1kCop: 3.6,
    outputCost1kCop: 14.5,
    contextWindow: '131.072 tokens',
    description:
      'Modelo omnimodal nativo de Google DeepMind optimizado para flujos interactivos, edición generativa y comprensión multimodal.',
    availability: 'Conexión Real',
    inputUsd1M: 0.40,
    cachedUsd1M: 0.10,
    outputUsd1M: 1.60,
    reasoningUsd1M: 1.60,
    maxContextTokens: 131072,
    maxOutputTokens: 65536,
    markupMultiplier: 2.0,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 14,
  },
  {
    slug: 'gemini-3-8-flash',
    name: 'Gemini 3.8 Flash',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-3.8-flash',
    tier: 'frontier',
    sweBench: 91.2,
    math500: 93.5,
    longBench: 94.0,
    arenaWriting: 92.8,
    mmluPro: 92.0,
    latencySec: 0.7,
    costCop: 14,
    inputCost1kCop: 3.2,
    outputCost1kCop: 15.9,
    contextWindow: '1.000.000 tokens',
    description:
      'Última evolución de la serie Gemini 3.x Flash en Google AI Pro: razonamiento ágil, 1M de contexto y alto desempeño en código y arquitectura.',
    availability: 'Conexión Real',
    inputUsd1M: 0.35,
    cachedUsd1M: 0.0875,
    outputUsd1M: 1.75,
    reasoningUsd1M: 1.75,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.0,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 14,
  },
  {
    slug: 'gemini-3-7-flash',
    name: 'Gemini 3.7 Flash',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-3.7-flash',
    tier: 'balanced',
    sweBench: 89.8,
    math500: 92.1,
    longBench: 93.2,
    arenaWriting: 91.4,
    mmluPro: 90.8,
    latencySec: 0.7,
    costCop: 12,
    inputCost1kCop: 2.7,
    outputCost1kCop: 13.6,
    contextWindow: '1.000.000 tokens',
    description:
      'Modelo equilibrado de Google AI Pro con cadena de pensamiento activa, ideal para análisis de datos, matemáticas e ingeniería de software.',
    availability: 'Conexión Real',
    inputUsd1M: 0.30,
    cachedUsd1M: 0.075,
    outputUsd1M: 1.50,
    reasoningUsd1M: 1.50,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.0,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 12,
  },
  {
    slug: 'gemini-3-6-flash',
    name: 'Gemini 3.6 Flash',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-3.6-flash',
    tier: 'balanced',
    sweBench: 88.4,
    math500: 90.6,
    longBench: 92.4,
    arenaWriting: 90.2,
    mmluPro: 89.5,
    latencySec: 0.6,
    costCop: 11,
    inputCost1kCop: 2.3,
    outputCost1kCop: 11.3,
    contextWindow: '1.000.000 tokens',
    description:
      'Versión estable de alta eficiencia en Google AI Pro para flujos de producción, redacción técnica y extracción documental con 1M de ventana.',
    availability: 'Conexión Real',
    inputUsd1M: 0.25,
    cachedUsd1M: 0.0625,
    outputUsd1M: 1.25,
    reasoningUsd1M: 1.25,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.0,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 11,
  },
  {
    slug: 'gemini-3-5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-3.5-flash',
    tier: 'balanced',
    sweBench: 86.9,
    math500: 88.9,
    longBench: 91.0,
    arenaWriting: 88.8,
    mmluPro: 88.2,
    latencySec: 0.6,
    costCop: 10,
    inputCost1kCop: 1.4,
    outputCost1kCop: 5.7,
    contextWindow: '1.000.000 tokens',
    description:
      'Modelo versátil de Google DeepMind con excelente relación costo-beneficio y razonamiento integrado para tareas generales y académicas.',
    availability: 'Conexión Real',
    inputUsd1M: 0.15,
    cachedUsd1M: 0.0375,
    outputUsd1M: 0.60,
    reasoningUsd1M: 0.60,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.1,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 10,
  },
  {
    slug: 'gemini-flash',
    name: 'Gemini 3.5 Flash Lite',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-3.5-flash-lite',
    tier: 'economy',
    sweBench: 83.8,
    math500: 84.5,
    longBench: 88.0,
    arenaWriting: 85.4,
    mmluPro: 85.9,
    latencySec: 0.4,
    costCop: 8,
    inputCost1kCop: 0.8,
    outputCost1kCop: 3.0,
    contextWindow: '1.000.000 tokens',
    description:
      'Modelo ultra-rápido de Google AI Pro sin sobrecosto de pensamiento interno (0 thinking tokens). Ideal para respuestas instantáneas y máximo ahorro.',
    availability: 'Conexión Real',
    inputUsd1M: 0.075,
    cachedUsd1M: 0.01875,
    outputUsd1M: 0.30,
    reasoningUsd1M: 0.30,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.2,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 8,
  },
  {
    slug: 'gemini-3-0-flash',
    name: 'Gemini 3.0 Flash',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-3-flash-preview',
    tier: 'balanced',
    sweBench: 85.5,
    math500: 87.4,
    longBench: 89.5,
    arenaWriting: 87.2,
    mmluPro: 87.0,
    latencySec: 0.6,
    costCop: 10,
    inputCost1kCop: 1.4,
    outputCost1kCop: 5.7,
    contextWindow: '1.000.000 tokens',
    description:
      'Modelo base de la generación Gemini 3 con soporte de razonamiento paso a paso y ventana de contexto de 1.000.000 de tokens.',
    availability: 'Conexión Real',
    inputUsd1M: 0.15,
    cachedUsd1M: 0.0375,
    outputUsd1M: 0.60,
    reasoningUsd1M: 0.60,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.1,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 10,
  },
  {
    slug: 'gemini-3-1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'Google DeepMind',
    remoteModelId: 'gemini-3.1-flash-lite',
    tier: 'economy',
    sweBench: 82.9,
    math500: 83.6,
    longBench: 87.2,
    arenaWriting: 84.6,
    mmluPro: 84.8,
    latencySec: 0.4,
    costCop: 8,
    inputCost1kCop: 0.8,
    outputCost1kCop: 3.0,
    contextWindow: '1.000.000 tokens',
    description:
      'Variante ultraligera de baja latencia de la familia Gemini 3.1 (0 thinking tokens) para clasificación, traducciones y consultas rápidas.',
    availability: 'Conexión Real',
    inputUsd1M: 0.075,
    cachedUsd1M: 0.01875,
    outputUsd1M: 0.30,
    reasoningUsd1M: 0.30,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.2,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 8,
  },
  {
    slug: 'gemma-4-26b-moe',
    name: 'Gemma 4 26B MoE',
    provider: 'Google DeepMind',
    remoteModelId: 'gemma-4-26b-a4b-it',
    tier: 'economy',
    sweBench: 84.8,
    math500: 86.2,
    longBench: 85.4,
    arenaWriting: 86.0,
    mmluPro: 85.5,
    latencySec: 0.5,
    costCop: 9,
    inputCost1kCop: 1.0,
    outputCost1kCop: 4.0,
    contextWindow: '262.144 tokens',
    description:
      'Modelo abierto Mixture-of-Experts (MoE) de Google (26B parámetros totales, 4B activos por token) ejecutado en vivo desde Google AI Studio.',
    availability: 'Conexión Real',
    inputUsd1M: 0.10,
    cachedUsd1M: 0.025,
    outputUsd1M: 0.40,
    reasoningUsd1M: 0.40,
    maxContextTokens: 262144,
    maxOutputTokens: 32768,
    markupMultiplier: 2.2,
    cachedMarkupMultiplier: 2.5,
    fixedFeeCop: 2.0,
    minChargeCop: 9,
  },
  {
    slug: 'deepseek-v4-flash',
    name: 'DeepSeek V4.1 Flash',
    provider: 'DeepSeek API',
    providerSlug: 'deepseek',
    remoteModelId: 'deepseek-flash',
    tier: 'balanced',
    sweBench: 89.4,
    math500: 93.8,
    longBench: 92.5,
    arenaWriting: 90.8,
    mmluPro: 91.2,
    latencySec: 0.8,
    costCop: 10,
    inputCost1kCop: 2.4,
    outputCost1kCop: 10.0,
    contextWindow: '1.048.576 tokens',
    description:
      'Modelo rápido de última generación de DeepSeek (V4.1 Flash) con 1M de contexto, soporte multimodal y razonamiento ágil de bajo costo.',
    availability: 'Conexión Real',
    inputUsd1M: 0.27,
    cachedUsd1M: 0.07,
    outputUsd1M: 1.10,
    reasoningUsd1M: 1.10,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.0,
    cachedMarkupMultiplier: 2.8,
    fixedFeeCop: 2.5,
    minChargeCop: 10,
  },
  {
    slug: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'DeepSeek API',
    providerSlug: 'deepseek',
    remoteModelId: 'deepseek-v4-pro',
    tier: 'frontier',
    sweBench: 94.6,
    math500: 97.1,
    longBench: 94.8,
    arenaWriting: 93.5,
    mmluPro: 94.9,
    latencySec: 1.5,
    costCop: 14,
    inputCost1kCop: 5.0,
    outputCost1kCop: 19.8,
    contextWindow: '1.048.576 tokens',
    description:
      'Modelo insignia de razonamiento profundo de DeepSeek (V4 Pro) con 1M de contexto, cadena de pensamiento avanzada y máxima precisión en código y matemáticas.',
    availability: 'Conexión Real',
    inputUsd1M: 0.55,
    cachedUsd1M: 0.14,
    outputUsd1M: 2.19,
    reasoningUsd1M: 2.19,
    maxContextTokens: 1048576,
    maxOutputTokens: 65536,
    markupMultiplier: 2.0,
    cachedMarkupMultiplier: 2.8,
    fixedFeeCop: 3.0,
    minChargeCop: 14,
  },
  {
    slug: 'deepseek-r1',
    name: 'DeepSeek R1 (Reasoner)',
    provider: 'DeepSeek API',
    providerSlug: 'deepseek',
    remoteModelId: 'deepseek-reasoner',
    tier: 'balanced',
    sweBench: 91.5,
    math500: 96.4,
    longBench: 90.0,
    arenaWriting: 89.2,
    mmluPro: 92.4,
    latencySec: 1.6,
    costCop: 14,
    inputCost1kCop: 5.0,
    outputCost1kCop: 19.8,
    contextWindow: '128.000 tokens',
    description:
      'Especialista en razonamiento formal cadena-de-pensamiento (CoT), demostraciones matemáticas, física y algoritmos conectado a DeepSeek API.',
    availability: 'Conexión Real',
    inputUsd1M: 0.55,
    cachedUsd1M: 0.14,
    outputUsd1M: 2.19,
    reasoningUsd1M: 2.19,
    maxContextTokens: 128000,
    maxOutputTokens: 32768,
    markupMultiplier: 2.0,
    cachedMarkupMultiplier: 2.8,
    fixedFeeCop: 3.0,
    minChargeCop: 14,
  },
];

for (const gm of googleProSuite) {
  const existingModel = db
    .prepare('SELECT id, name, availability FROM ai_models_benchmarks WHERE slug = ?')
    .get(gm.slug);

  if (!existingModel) {
    db.prepare(`
      INSERT INTO ai_models_benchmarks (
        slug, name, provider, tier, swe_bench, math_500, long_bench, arena_writing, mmlu_pro,
        latency_sec, cost_cop, input_cost_1k_cop, output_cost_1k_cop,
        context_window, description, availability
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      gm.slug,
      gm.name,
      gm.provider,
      gm.tier,
      gm.sweBench,
      gm.math500,
      gm.longBench,
      gm.arenaWriting,
      gm.mmluPro,
      gm.latencySec,
      gm.costCop,
      gm.inputCost1kCop,
      gm.outputCost1kCop,
      gm.contextWindow,
      gm.description,
      gm.availability
    );
  } else if (existingModel.name !== gm.name || existingModel.availability !== gm.availability) {
    db.prepare(`
      UPDATE ai_models_benchmarks
      SET name = ?, provider = ?, tier = ?, swe_bench = ?, math_500 = ?, long_bench = ?,
          arena_writing = ?, mmlu_pro = ?, latency_sec = ?, cost_cop = ?,
          input_cost_1k_cop = ?, output_cost_1k_cop = ?, context_window = ?,
          description = ?, availability = ?
      WHERE slug = ?
    `).run(
      gm.name,
      gm.provider,
      gm.tier,
      gm.sweBench,
      gm.math500,
      gm.longBench,
      gm.arenaWriting,
      gm.mmluPro,
      gm.latencySec,
      gm.costCop,
      gm.inputCost1kCop,
      gm.outputCost1kCop,
      gm.contextWindow,
      gm.description,
      gm.availability,
      gm.slug
    );
  }

  const existingRate = db
    .prepare('SELECT id, remote_model_id, input_usd_per_1m, min_charge_cop FROM model_pricing_rates WHERE model_slug = ?')
    .get(gm.slug);

  if (!existingRate) {
    db.prepare(`
      INSERT INTO model_pricing_rates (
        model_slug, provider_slug, remote_model_id,
        input_usd_per_1m, input_cached_usd_per_1m, cache_write_usd_per_1m,
        output_usd_per_1m, reasoning_usd_per_1m, tool_call_usd_per_unit,
        max_context_tokens, max_output_tokens,
        markup_multiplier, cached_markup_multiplier, fixed_operational_fee_cop, min_charge_cop
      ) VALUES (?, ?, ?, ?, ?, 0.0, ?, ?, 0.0, ?, ?, ?, ?, ?, ?)
    `).run(
      gm.slug,
      gm.providerSlug || 'google',
      gm.remoteModelId,
      gm.inputUsd1M,
      gm.cachedUsd1M,
      gm.outputUsd1M,
      gm.reasoningUsd1M,
      gm.maxContextTokens,
      gm.maxOutputTokens,
      gm.markupMultiplier,
      gm.cachedMarkupMultiplier,
      gm.fixedFeeCop,
      gm.minChargeCop
    );
  } else if (
    existingRate.remote_model_id !== gm.remoteModelId ||
    Number(existingRate.input_usd_per_1m) !== gm.inputUsd1M ||
    Number(existingRate.min_charge_cop) !== gm.minChargeCop
  ) {
    db.prepare(`
      UPDATE model_pricing_rates
      SET remote_model_id = ?, input_usd_per_1m = ?, input_cached_usd_per_1m = ?,
          output_usd_per_1m = ?, reasoning_usd_per_1m = ?, max_context_tokens = ?,
          max_output_tokens = ?, markup_multiplier = ?, cached_markup_multiplier = ?,
          fixed_operational_fee_cop = ?, min_charge_cop = ?
      WHERE model_slug = ?
    `).run(
      gm.remoteModelId,
      gm.inputUsd1M,
      gm.cachedUsd1M,
      gm.outputUsd1M,
      gm.reasoningUsd1M,
      gm.maxContextTokens,
      gm.maxOutputTokens,
      gm.markupMultiplier,
      gm.cachedMarkupMultiplier,
      gm.fixedFeeCop,
      gm.minChargeCop,
      gm.slug
    );
  }
}

// Dejar activos únicamente los modelos oficiales de Google DeepMind y DeepSeek para esta fase de pruebas
db.exec(`
  UPDATE ai_models_benchmarks SET is_active = 1 WHERE provider IN ('Google DeepMind', 'DeepSeek API');
  UPDATE ai_models_benchmarks SET is_active = 0 WHERE provider NOT IN ('Google DeepMind', 'DeepSeek API');
`);

// Garantizar que exista el usuario de prueba admin / 123
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin');
if (!existingAdmin) {
  const hash = bcrypt.hashSync('123', config.bcryptRounds);
  db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(
    'Administrador Demo',
    'admin',
    hash
  );
}

// Al iniciar el proceso, liberar cualquier reserva en vuelo que haya quedado huérfana de un reinicio previo
const orphanReservation = db
  .prepare("SELECT id FROM wallet_reservations WHERE status = 'reserved' LIMIT 1")
  .get();
if (orphanReservation) {
  db.exec(`
    UPDATE wallet_reservations SET status = 'released', settled_at = CURRENT_TIMESTAMP WHERE status = 'reserved';
    UPDATE user_wallets SET reserved_cop = 0 WHERE reserved_cop > 0;
  `);
}
