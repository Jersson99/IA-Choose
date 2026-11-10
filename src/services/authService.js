import { apiRequest } from './api.js';

export const authService = {
  register: (name, email, password) =>
    apiRequest('/register', { method: 'POST', body: { name, email, password } }),

  login: (email, password) =>
    apiRequest('/login', { method: 'POST', body: { email, password } }),

  google: (credential) => apiRequest('/google', { method: 'POST', body: { credential } }),

  me: (token) => apiRequest('/me', { token }),
};
