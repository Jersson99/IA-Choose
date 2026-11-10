import { HttpError } from '../errors.js';
import { authService } from '../services/authService.js';
import { verifyGoogleIdToken } from '../services/googleVerifier.js';
import { validateLogin, validateRegister } from '../validators/authValidator.js';

// Traduce HTTP <-> servicio; cada función maneja sus errores con next()
export const authController = {
  async register(req, res, next) {
    try {
      const result = await authService.register(validateRegister(req.body));
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      res.json(await authService.login(validateLogin(req.body)));
    } catch (err) {
      next(err);
    }
  },

  async google(req, res, next) {
    try {
      const credential = req.body?.credential;
      if (typeof credential !== 'string' || !credential) {
        throw new HttpError(400, 'Falta la credencial de Google');
      }
      const profile = await verifyGoogleIdToken(credential);
      res.json(await authService.loginWithGoogleProfile(profile));
    } catch (err) {
      next(err);
    }
  },

  me(req, res, next) {
    try {
      res.json({ user: authService.getProfile(req.userId) });
    } catch (err) {
      next(err);
    }
  },
};
