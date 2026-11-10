import { authService } from '../services/authService.js';

// Protege rutas: exige "Authorization: Bearer <token>" y deja el id en req.userId
export function requireAuth(req, _res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    req.userId = authService.verifyToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
