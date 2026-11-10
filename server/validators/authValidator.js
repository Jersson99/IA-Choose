import { config } from '../config.js';
import { HttpError } from '../errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value) => String(value ?? '').trim();

export function validateRegister(body) {
  const name = clean(body?.name);
  const email = clean(body?.email).toLowerCase();
  const password = String(body?.password ?? '');

  if (!name) throw new HttpError(400, 'Escribe tu nombre completo');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Correo electrónico inválido');
  if (password.length < config.minPasswordLength) {
    throw new HttpError(400, `La contraseña debe tener al menos ${config.minPasswordLength} caracteres`);
  }
  return { name, email, password };
}

export function validateLogin(body) {
  return {
    email: clean(body?.email).toLowerCase(),
    password: String(body?.password ?? ''),
  };
}
