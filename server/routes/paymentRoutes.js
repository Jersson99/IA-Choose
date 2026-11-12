import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { wompiService } from '../services/wompiService.js';

const router = Router();

// Crear sesión firmada para el Widget de Wompi (o simulador local)
router.post('/payments/wompi/checkout', requireAuth, (req, res) => {
  const session = wompiService.createCheckoutSession(req.userId, {
    amountCop: req.body?.amountCop,
    method: req.body?.method,
    paymentLinkUrl: req.body?.paymentLinkUrl,
  });
  res.status(201).json(session);
});

// Verificar transacción al cerrar el Widget o regresar por redirectUrl
router.post('/payments/wompi/verify', requireAuth, async (req, res, next) => {
  try {
    const result = await wompiService.verifyTransaction(req.userId, {
      transactionId: req.body?.transactionId,
      reference: req.body?.reference,
      simulatedStatus: req.body?.simulatedStatus,
      simulatedDetail: req.body?.simulatedDetail,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Webhook público para eventos asíncronos de Wompi (transaction.updated)
router.post('/payments/wompi/webhook', (req, res, next) => {
  try {
    const result = wompiService.handleWebhookEvent(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
