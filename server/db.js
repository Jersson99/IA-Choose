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
    balance_cop INTEGER NOT NULL DEFAULT 15000,
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

// Asegurar esquema actualizado para ai_models_benchmarks
const tableColumns = db
  .prepare("PRAGMA table_info('ai_models_benchmarks')")
  .all()
  .map((c) => c.name);

if (tableColumns.length > 0 && !tableColumns.includes('input_cost_1k_cop')) {
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
    mmlu_pro REAL NOT NULL,
    latency_sec REAL NOT NULL,
    cost_cop INTEGER NOT NULL,
    input_cost_1k_cop REAL NOT NULL,
    output_cost_1k_cop REAL NOT NULL,
    context_window TEXT NOT NULL,
    description TEXT NOT NULL,
    availability TEXT NOT NULL
  );
`);

const countRow = db.prepare('SELECT COUNT(*) as total FROM ai_models_benchmarks').get();
if (countRow.total === 0) {
  const insertModel = db.prepare(`
    INSERT INTO ai_models_benchmarks (
      slug, name, provider, tier, swe_bench, math_500, long_bench, mmlu_pro,
      latency_sec, cost_cop, input_cost_1k_cop, output_cost_1k_cop,
      context_window, description, availability
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      86.8,
      0.7,
      11,
      2.1,
      6.8,
      '128.000 tokens',
      'Modelo abierto de alto rendimiento para redacción general, síntesis estructurada y asistencia en programación estándar.',
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
      94.6,
      1.7,
      58,
      13.2,
      66.0,
      '200.000 tokens',
      'Referente en ingeniería de software, depuración de sistemas complejos, arquitectura de código y redacción analítica.',
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
