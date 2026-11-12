import express from 'express';
import authRoutes from './routes/authRoutes.js';
import routerRoutes from './routes/routerRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', authRoutes);
  app.use('/api', routerRoutes);
  app.use('/api', dashboardRoutes);
  app.use('/api', paymentRoutes);
  app.use(errorHandler);
  return app;
}
