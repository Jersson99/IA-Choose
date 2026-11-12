import { apiRequest } from './api.js';
import { tokenStorage } from './tokenStorage.js';

function withToken(options = {}) {
  return { ...options, token: tokenStorage.get() };
}

export const dashboardApi = {
  getSummary: () => apiRequest('/dashboard/summary', withToken()),

  recommendTask: (prompt) =>
    apiRequest('/dashboard/recommend-task', withToken({ method: 'POST', body: { prompt } })),

  executeTask: (prompt, modelName = null) =>
    apiRequest('/dashboard/execute-task', withToken({ method: 'POST', body: { prompt, modelName } })),

  topUp: (amountCop, method) =>
    apiRequest('/dashboard/topup', withToken({ method: 'POST', body: { amountCop, method } })),

  createApiKey: (name) =>
    apiRequest('/dashboard/api-keys', withToken({ method: 'POST', body: { name } })),

  revokeApiKey: (id) =>
    apiRequest(`/dashboard/api-keys/${id}`, withToken({ method: 'DELETE' })),

  updateSettings: (payload) =>
    apiRequest('/dashboard/settings', withToken({ method: 'PUT', body: payload })),

  toggleDemoData: (action) =>
    apiRequest('/dashboard/demo-data', withToken({ method: 'POST', body: { action } })),
};
