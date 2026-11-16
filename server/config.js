import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_ENV_PATH = path.resolve(__dirname, '..', '.env');

// En Vercel (serverless) el sistema de archivos del código es de solo lectura; usamos /tmp
export const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'ia-choose-data')
  : path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

function cleanEnvValue(val = '') {
  return String(val || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

function readDotEnvFile() {
  try {
    if (!fs.existsSync(ROOT_ENV_PATH)) return {};
    const raw = fs.readFileSync(ROOT_ENV_PATH, 'utf8');
    const map = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = cleanEnvValue(trimmed.slice(eqIdx + 1));
      map[key] = val;
    }
    return map;
  } catch {
    return {};
  }
}

function getEnv(key, fallback = '') {
  const fromFile = readDotEnvFile()[key];
  if (fromFile !== undefined && fromFile !== '') return fromFile;
  const fromProc = cleanEnvValue(process.env[key]);
  if (fromProc !== '') return fromProc;
  return cleanEnvValue(fallback);
}

// La clave de firma de tokens se genera una vez y se guarda en DATA_DIR
function loadJwtSecret() {
  if (process.env.JWT_SECRET) return cleanEnvValue(process.env.JWT_SECRET);
  if (process.env.VERCEL) {
    // En Vercel mantenemos un secreto determinístico entre invocaciones serverless si no se definió JWT_SECRET
    return crypto
      .createHash('sha256')
      .update(`ia-choose-vercel-${process.env.GOOGLE_CLIENT_ID || 'default-secret'}`)
      .digest('hex');
  }
  const secretFile = path.join(DATA_DIR, 'jwt.secret');
  if (!fs.existsSync(secretFile)) {
    fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'));
  }
  return fs.readFileSync(secretFile, 'utf8');
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  dbPath: path.join(DATA_DIR, 'ia-choose.db'),
  jwtSecret: loadJwtSecret(),
  jwtExpiresIn: '7d',
  bcryptRounds: 10,
  minPasswordLength: 6,
  googleClientId: cleanEnvValue(
    process.env.GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      '238513514705-ltefem5gm2qoddu174v2qi9r1t2uj3lb.apps.googleusercontent.com'
  ),
  wompi: {
    get paymentLinkUrl() {
      return getEnv('WOMPI_PAYMENT_LINK_URL', 'https://checkout.wompi.co/l/oZjvx6');
    },
    get publicKey() {
      return getEnv('WOMPI_PUBLIC_KEY', 'pub_prod_FQBuduAuyEXu7MPKxt1tce9trPlh7pwJ');
    },
    get privateKey() {
      return getEnv('WOMPI_PRIVATE_KEY', 'prv_prod_TRZ0SOpHUgy4VkGmaurds1R8OyNKUlWp');
    },
    get integritySecret() {
      return getEnv('WOMPI_INTEGRITY_SECRET', 'prod_integrity_PpWoeMdhWSk3XNep9aU42iImeyq4crOb');
    },
    get eventsSecret() {
      return getEnv('WOMPI_EVENTS_SECRET', 'prod_events_gcEVnetytNPtxTRm8nY0vkxQUnNhwrIY');
    },
    get env() {
      if (this.publicKey.startsWith('pub_prod_') || this.privateKey.startsWith('prv_prod_')) {
        return 'production';
      }
      if (this.publicKey.startsWith('pub_test_') || this.privateKey.startsWith('prv_test_')) {
        return 'sandbox';
      }
      return getEnv('WOMPI_ENV', 'production').toLowerCase();
    },
    get apiBaseUrl() {
      return this.env === 'production'
        ? 'https://production.wompi.co/v1'
        : 'https://sandbox.wompi.co/v1';
    },
    get isConfigured() {
      return Boolean(this.publicKey && (this.integritySecret || this.privateKey));
    },
  },
  providers: {
    google: {
      get apiKey() {
        return getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_AI_API_KEY');
      },
      get modelId() {
        return getEnv('GEMINI_MODEL_ID', 'gemini-4-hydrogen');
      },
      get isConfigured() {
        return Boolean(this.apiKey);
      },
    },
    moonshot: {
      get apiKey() {
        return getEnv('MOONSHOT_API_KEY');
      },
      get baseUrl() {
        return getEnv('MOONSHOT_BASE_URL', 'https://api.moonshot.ai/v1').replace(/\/+$/, '');
      },
      get modelId() {
        return getEnv('MOONSHOT_MODEL_ID', 'kimi-k2.6');
      },
      get isConfigured() {
        return Boolean(this.apiKey);
      },
    },
    deepseek: {
      get apiKey() {
        return getEnv('DEEPSEEK_API_KEY', 'sk-5be3e0bf57494d4db6949130fbdb77fb');
      },
      get baseUrl() {
        return getEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1').replace(/\/+$/, '');
      },
      get modelId() {
        return getEnv('DEEPSEEK_MODEL_ID', 'deepseek-flash');
      },
      get isConfigured() {
        return Boolean(this.apiKey);
      },
    },
  },
};
