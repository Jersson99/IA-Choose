import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { HttpError } from '../errors.js';

let client;

// Comprueba con Google que el token es auténtico y fue emitido para ESTA app
export async function verifyGoogleIdToken(idToken) {
  if (!config.googleClientId) {
    throw new HttpError(503, 'El acceso con Google no está configurado en el servidor');
  }
  client ??= new OAuth2Client(config.googleClientId);
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) throw new Error('Correo no verificado');
    return { email: payload.email.toLowerCase(), name: payload.name || payload.email };
  } catch {
    throw new HttpError(401, 'No se pudo verificar tu cuenta de Google');
  }
}
