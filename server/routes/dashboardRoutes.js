import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { dashboardService } from '../services/dashboardService.js';
import { wompiService } from '../services/wompiService.js';

const router = Router();

router.use('/dashboard', requireAuth);

router.get('/dashboard/summary', async (req, res, next) => {
  try {
    await wompiService.syncUserTransactionsFromWompi(req.userId);
    res.json(dashboardService.getOverviewData(req.userId));
  } catch (err) {
    next(err);
  }
});

router.post('/dashboard/recommend-task', (req, res) => {
  res.json(dashboardService.recommendTask(req.body?.prompt));
});

router.post('/dashboard/execute-task', async (req, res, next) => {
  try {
    const result = await dashboardService.executeTask(
      req.userId,
      req.body?.prompt,
      req.body?.modelName,
      {
        messages: Array.isArray(req.body?.messages) ? req.body.messages : null,
        maxTokens: req.body?.maxTokens,
      }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/dashboard/topup', (req, res) => {
  res.json(
    dashboardService.topUpBalance(req.userId, {
      amountCop: req.body?.amountCop,
      method: req.body?.method,
    })
  );
});

router.post('/dashboard/api-keys', (req, res) => {
  res.status(201).json(dashboardService.createApiKey(req.userId, { name: req.body?.name }));
});

router.delete('/dashboard/api-keys/:id', (req, res) => {
  res.json(dashboardService.revokeApiKey(req.userId, req.params.id));
});

router.put('/dashboard/settings', (req, res) => {
  res.json(dashboardService.updateSettings(req.userId, req.body || {}));
});

router.post('/dashboard/demo-data', (req, res) => {
  res.json(dashboardService.toggleDemoData(req.userId, req.body?.action));
});

export default router;
