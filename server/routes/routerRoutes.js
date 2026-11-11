import { Router } from 'express';
import { HttpError } from '../errors.js';
import { routerService } from '../services/routerService.js';

const router = Router();

router.post('/router/recommend', (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) {
    throw new HttpError(400, 'Escribe primero tu tarea para analizarla');
  }
  const result = routerService.recommend(prompt);
  res.json(result);
});

router.get('/router/benchmarks', (_req, res) => {
  res.json({ models: routerService.listBenchmarks() });
});

export default router;
