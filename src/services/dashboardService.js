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

  createWompiCheckout: (amountCop, method, paymentLinkUrl = '') =>
    apiRequest(
      '/payments/wompi/checkout',
      withToken({ method: 'POST', body: { amountCop, method, paymentLinkUrl } })
    ),

  createWompiDirectCharge: (payload) =>
    apiRequest('/payments/wompi/direct-charge', withToken({ method: 'POST', body: payload })),

  getWompiPseBanks: () => apiRequest('/payments/wompi/pse-banks', withToken()),

  verifyWompiPayment: (payload) =>
    apiRequest('/payments/wompi/verify', withToken({ method: 'POST', body: payload })),

  createApiKey: (name) =>
    apiRequest('/dashboard/api-keys', withToken({ method: 'POST', body: { name } })),

  revokeApiKey: (id) =>
    apiRequest(`/dashboard/api-keys/${id}`, withToken({ method: 'DELETE' })),

  testGatewayCompletion: ({ apiKey, model, prompt }) =>
    apiRequest('/v1/chat/completions', {
      method: 'POST',
      token: apiKey && apiKey.trim() ? apiKey.trim() : tokenStorage.get(),
      body: {
        model: model || 'kimi-k2',
        messages: [{ role: 'user', content: prompt }],
      },
    }),

  updateSettings: (payload) =>
    apiRequest('/dashboard/settings', withToken({ method: 'PUT', body: payload })),

  toggleDemoData: (action) =>
    apiRequest('/dashboard/demo-data', withToken({ method: 'POST', body: { action } })),
};
