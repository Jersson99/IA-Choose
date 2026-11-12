import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { dashboardService } from '../services/dashboardService.js';

const router = Router();

router.use('/dashboard', requireAuth);

router.get('/dashboard/summary', (req, res) => {
  res.json(dashboardService.getOverviewData(req.userId));
});

router.post('/dashboard/recommend-task', (req, res) => {
  res.json(dashboardService.recommendTask(req.body?.prompt));
});

router.post('/dashboard/execute-task', async (req, res, next) => {
  try {
    const result = await dashboardService.executeTask(
      req.userId,
      req.body?.prompt,
      req.body?.modelName
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
