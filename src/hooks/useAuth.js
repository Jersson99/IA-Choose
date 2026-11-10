import { useEffect, useState } from 'react';
import { authService } from '../services/authService.js';
import { tokenStorage } from '../services/tokenStorage.js';

// Maneja la sesión: usuario actual, restauración al abrir la app, ingreso, registro y salida
export function useAuth() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setChecking(false);
      return;
    }
    authService
      .me(token)
      .then((data) => setUser(data.user))
      .catch(() => tokenStorage.clear())
      .finally(() => setChecking(false));
  }, []);

  const startSession = ({ token, user: loggedUser }) => {
    tokenStorage.set(token);
    setUser(loggedUser);
    return loggedUser;
  };

  const login = async (email, password) => startSession(await authService.login(email, password));

  const register = async (name, email, password) =>
    startSession(await authService.register(name, email, password));

  const loginWithGoogle = async (credential) => startSession(await authService.google(credential));

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
  };

  return { user, checking, login, register, loginWithGoogle, logout };
}
