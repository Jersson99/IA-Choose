import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { wompiService } from '../services/wompiService.js';

const router = Router();

// Obtener lista de bancos PSE desde la API de Wompi
router.get('/payments/wompi/pse-banks', requireAuth, async (_req, res, next) => {
  try {
    const result = await wompiService.listPseBanks();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Pago con API Directa de Wompi (POST /v1/transactions para Nequi, Bancolombia y PSE)
router.post('/payments/wompi/direct-charge', requireAuth, async (req, res, next) => {
  try {
    const result = await wompiService.createDirectTransaction(req.userId, req.body || {});
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// Crear sesión firmada para Widget / URL de Wompi
router.post('/payments/wompi/checkout', requireAuth, (req, res) => {
  const session = wompiService.createCheckoutSession(req.userId, {
    amountCop: req.body?.amountCop,
    method: req.body?.method,
    paymentLinkUrl: req.body?.paymentLinkUrl,
    redirectUrl: req.body?.redirectUrl,
  });
  res.status(201).json(session);
});

// Verificar estado de una transacción en la API de Wompi (GET /v1/transactions/:id)
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
