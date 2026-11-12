import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    paymentLinkUrl: cleanEnvValue(
      process.env.WOMPI_PAYMENT_LINK_URL || 'https://checkout.wompi.co/l/oZjvx6'
    ),
    publicKey: cleanEnvValue(process.env.WOMPI_PUBLIC_KEY),
    privateKey: cleanEnvValue(process.env.WOMPI_PRIVATE_KEY),
    integritySecret: cleanEnvValue(process.env.WOMPI_INTEGRITY_SECRET),
    eventsSecret: cleanEnvValue(process.env.WOMPI_EVENTS_SECRET),
    get env() {
      if (this.publicKey.startsWith('pub_prod_') || this.privateKey.startsWith('prv_prod_')) {
        return 'production';
      }
      if (this.publicKey.startsWith('pub_test_') || this.privateKey.startsWith('prv_test_')) {
        return 'sandbox';
      }
      return cleanEnvValue(process.env.WOMPI_ENV || 'sandbox').toLowerCase();
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
    moonshot: {
      apiKey: (process.env.MOONSHOT_API_KEY || '').trim(),
      baseUrl: (process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.ai/v1')
        .trim()
        .replace(/\/+$/, ''),
      modelId: (process.env.MOONSHOT_MODEL_ID || 'kimi-k2-0711-preview').trim(),
      get isConfigured() {
        return Boolean(this.apiKey);
      },
    },
  },
};
