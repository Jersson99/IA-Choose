import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// La clave de firma de tokens se genera una vez y se guarda en server/data (ignorada por git)
function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
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
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  wompi: {
    env: (process.env.WOMPI_ENV || 'sandbox').trim().toLowerCase(),
    publicKey: (process.env.WOMPI_PUBLIC_KEY || '').trim(),
    privateKey: (process.env.WOMPI_PRIVATE_KEY || '').trim(),
    integritySecret: (process.env.WOMPI_INTEGRITY_SECRET || '').trim(),
    eventsSecret: (process.env.WOMPI_EVENTS_SECRET || '').trim(),
    get apiBaseUrl() {
      return this.env === 'production'
        ? 'https://production.wompi.co/v1'
        : 'https://sandbox.wompi.co/v1';
    },
    get isConfigured() {
      return Boolean(this.publicKey && this.integritySecret);
    },
  },
};
