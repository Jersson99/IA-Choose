import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../errors.js';
import { userRepository } from '../repositories/userRepository.js';

const publicUser = ({ id, name, email }) => ({ id, name, email });
const signToken = (user) =>
  jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

// Reglas de negocio de autenticación (no sabe nada de Express ni de SQL)
export const authService = {
  async register({ name, email, password }) {
    if (userRepository.findByEmail(email)) {
      throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    }
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const user = userRepository.create({ name, email, passwordHash });
    return { token: signToken(user), user: publicUser(user) };
  },

  async login({ email, password }) {
    const user = userRepository.findByEmail(email);
    // Mismo mensaje si falla el correo o la clave, para no revelar qué correos existen
    const valid = user && (await bcrypt.compare(password, user.password_hash));
    if (!valid) throw new HttpError(401, 'Correo o contraseña incorrectos');
    return { token: signToken(user), user: publicUser(user) };
  },

  // Recibe el perfil ya verificado por Google: entra si existe, o crea la cuenta si es nueva
  async loginWithGoogleProfile({ email, name }) {
    let user = userRepository.findByEmail(email);
    if (!user) {
      // Las cuentas de Google no tienen clave propia: se guarda un hash de una clave aleatoria inutilizable
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), config.bcryptRounds);
      user = userRepository.create({ name, email, passwordHash });
    }
    return { token: signToken(user), user: publicUser(user) };
  },

  verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret).sub;
    } catch {
      throw new HttpError(401, 'Sesión inválida o expirada');
    }
  },

  getProfile(userId) {
    const user = userRepository.findById(userId);
    if (!user) throw new HttpError(401, 'Sesión inválida');
    return user;
  },
};
