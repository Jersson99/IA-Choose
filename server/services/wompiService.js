import crypto from 'node:crypto';
import { config } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../errors.js';
import { dashboardService } from './dashboardService.js';

const METHOD_MAP = {
  Nequi: {
    cleanMethod: 'Nequi',
    paymentMethodType: 'NEQUI',
    displayMethod: 'Wompi · Nequi',
  },
  Bancolombia: {
    cleanMethod: 'Bancolombia',
    paymentMethodType: 'BANCOLOMBIA_TRANSFER',
    displayMethod: 'Wompi · Bancolombia',
  },
  PSE: {
    cleanMethod: 'PSE',
    paymentMethodType: 'PSE',
    displayMethod: 'Wompi · PSE',
  },
};

function getNestedValue(obj, dottedPath) {
  return String(dottedPath || '')
    .split('.')
    .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : ''), obj);
}

export const wompiService = {
  /**
   * 1. Crea una orden de recarga en estado PENDING y genera la firma SHA-256 de integridad para Wompi
   */
  createCheckoutSession(userId, { amountCop, method, paymentLinkUrl }) {
    const amount = Math.round(Number(amountCop));
    if (!Number.isFinite(amount) || amount < 2000 || amount > 2000000) {
      throw new HttpError(400, 'Ingresa un monto de recarga válido entre $2.000 y $2.000.000 COP');
    }

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
    if (!user) throw new HttpError(401, 'Sesión inválida');
    // Garantizar que exista la billetera del usuario
    dashboardService.getOverviewData(userId);
    const methodMeta = METHOD_MAP[method] || METHOD_MAP.Nequi;
    const amountInCents = amount * 100;
    const currency = 'COP';
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const reference = `WMP-${userId}-${Date.now()}-${randomSuffix}`;
    const now = new Date().toISOString();
    const secretForHash = config.wompi.integritySecret || 'local_sandbox_integrity_secret';
    const rawSignature = `${reference}${amountInCents}${currency}${secretForHash}`;
    const integritySignature = crypto.createHash('sha256').update(rawSignature).digest('hex');

    db.prepare(`
      INSERT INTO billing_transactions (
        user_id, reference, type, method, amount_cop, description,
        status, is_demo, payment_method_type, created_at, updated_at
      ) VALUES (?, ?, 'topup', ?, ?, ?, 'pending', 0, ?, ?, ?)
    `).run(
      userId,
      reference,
      methodMeta.displayMethod,
      amount,
      `Recarga billetera vía Wompi (${methodMeta.cleanMethod})`,
      methodMeta.paymentMethodType,
      now,
      now
    );

    const customerEmail = user.email.includes('@') ? user.email : `${user.email}@iachoose.co`;
    const cleanExternalLink = String(
      paymentLinkUrl || process.env.WOMPI_PAYMENT_LINK_URL || ''
    ).trim();

    const query = new URLSearchParams({
      reference,
      amount: String(amount),
      currency,
      method: methodMeta.cleanMethod,
      email: customerEmail,
      name: user.name,
    });
    if (cleanExternalLink) {
      query.set('external_link', cleanExternalLink);
    }
    const checkoutUrl = `/wompi-gateway?${query.toString()}`;

    return {
      mode: config.wompi.isConfigured ? 'wompi_widget' : 'wompi_url',
      checkoutUrl,
      externalPaymentLink: cleanExternalLink || null,
      environment: config.wompi.env,
      publicKey: config.wompi.publicKey || 'pub_url_checkout',
      currency,
      amountCop: amount,
      amountInCents,
      reference,
      method: methodMeta.cleanMethod,
      paymentMethodType: methodMeta.paymentMethodType,
      signature: {
        integrity: integritySignature,
      },
      customerData: {
        email: customerEmail,
        fullName: user.name,
      },
      dashboard: dashboardService.getOverviewData(userId),
    };
  },

  /**
   * 2. Aplica de forma atómica e idempotente el resultado de una transacción de Wompi
   */
  applyTransactionOutcome({
    reference,
    wompiTransactionId,
    wompiStatus,
    paymentMethodType,
    amountInCents,
    detailNote,
  }) {
    const tx = db.prepare('SELECT * FROM billing_transactions WHERE reference = ?').get(reference);
    if (!tx) {
      throw new HttpError(404, `No se encontró la orden de recarga con referencia ${reference}`);
    }
    // Idempotencia: si ya fue completada previamente, no volver a sumar saldo
    if (tx.status === 'completed') {
      return {
        alreadyProcessed: true,
        status: 'completed',
        amountCop: tx.amount_cop,
        reference: tx.reference,
        userId: tx.user_id,
      };
    }

    const upperStatus = String(wompiStatus || '').toUpperCase();
    let nextStatus = 'pending';
    if (upperStatus === 'APPROVED') {
      nextStatus = 'completed';
    } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(upperStatus)) {
      nextStatus = 'declined';
    }

    if (nextStatus === 'completed' && amountInCents !== undefined) {
      const expectedCents = Number(tx.amount_cop) * 100;
      if (Math.round(Number(amountInCents)) !== expectedCents) {
        throw new HttpError(400, 'El monto reportado por la pasarela no coincide con la orden');
      }
    }

    const now = new Date().toISOString();
    const updatedDesc = detailNote ? `${tx.description} · ${detailNote}` : tx.description;

    db.exec('BEGIN IMMEDIATE');
    try {
      const freshTx = db
        .prepare('SELECT status FROM billing_transactions WHERE id = ?')
        .get(tx.id);

      if (freshTx.status === 'completed') {
        db.exec('COMMIT');
        return {
          alreadyProcessed: true,
          status: 'completed',
          amountCop: tx.amount_cop,
          reference: tx.reference,
          userId: tx.user_id,
        };
      }

      db.prepare(`
        UPDATE billing_transactions
        SET status = ?,
            wompi_transaction_id = COALESCE(?, wompi_transaction_id),
            payment_method_type = COALESCE(?, payment_method_type),
            description = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        nextStatus,
        wompiTransactionId || null,
        paymentMethodType || null,
        updatedDesc,
        now,
        tx.id
      );

      if (nextStatus === 'completed') {
        db.prepare(`
          UPDATE user_wallets
          SET balance_cop = balance_cop + ?, updated_at = ?
          WHERE user_id = ?
        `).run(tx.amount_cop, now, tx.user_id);
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return {
      alreadyProcessed: false,
      status: nextStatus,
      amountCop: tx.amount_cop,
      reference: tx.reference,
      userId: tx.user_id,
    };
  },

  /**
   * 3. Verifica una transacción (contra la API de Wompi o desde el simulador local si no hay llaves)
   */
  async verifyTransaction(
    userId,
    { transactionId, reference, simulatedStatus, simulatedDetail } = {}
  ) {
    const isSimulatedCall =
      !config.wompi.isConfigured ||
      String(transactionId || '').startsWith('SIM-') ||
      Boolean(simulatedStatus);

    if (isSimulatedCall) {
      if (!reference) {
        throw new HttpError(400, 'Falta la referencia de la orden para verificar');
      }
      const tx = db
        .prepare('SELECT * FROM billing_transactions WHERE reference = ? AND user_id = ?')
        .get(reference, userId);
      if (!tx) {
        throw new HttpError(404, 'Orden de recarga no encontrada para este usuario');
      }

      const simId = transactionId || `SIM-WMP-${Date.now().toString().slice(-7)}`;
      const outcome = this.applyTransactionOutcome({
        reference,
        wompiTransactionId: simId,
        wompiStatus: simulatedStatus || 'APPROVED',
        paymentMethodType: tx.payment_method_type,
        amountInCents: tx.amount_cop * 100,
        detailNote: simulatedDetail || 'Sandbox Simulador',
      });

      return {
        outcome,
        dashboard: dashboardService.getOverviewData(userId),
      };
    }

    if (!transactionId) {
      throw new HttpError(400, 'Se requiere el ID de transacción de Wompi');
    }

    const url = `${config.wompi.apiBaseUrl}/transactions/${encodeURIComponent(transactionId)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new HttpError(
        502,
        `No se pudo verificar la transacción en Wompi (HTTP ${response.status})`
      );
    }

    const body = await response.json();
    const wompiTx = body?.data;
    if (!wompiTx?.reference) {
      throw new HttpError(400, 'Respuesta de transacción inválida desde Wompi');
    }

    const localTx = db
      .prepare('SELECT * FROM billing_transactions WHERE reference = ? AND user_id = ?')
      .get(wompiTx.reference, userId);

    if (!localTx) {
      throw new HttpError(403, 'La transacción consultada no pertenece a tu cuenta');
    }

    const outcome = this.applyTransactionOutcome({
      reference: wompiTx.reference,
      wompiTransactionId: String(wompiTx.id),
      wompiStatus: wompiTx.status,
      paymentMethodType: wompiTx.payment_method_type,
      amountInCents: wompiTx.amount_in_cents,
      detailNote: `Wompi ID #${wompiTx.id}`,
    });

    return {
      outcome,
      dashboard: dashboardService.getOverviewData(userId),
    };
  },

  /**
   * 4. Procesa el Webhook asíncrono enviado por Wompi (evento transaction.updated)
   */
  handleWebhookEvent(payload) {
    if (!payload || payload.event !== 'transaction.updated' || !payload.data?.transaction) {
      return { received: true, ignored: true };
    }

    if (config.wompi.eventsSecret) {
      const properties = payload.signature?.properties || [];
      const checksum = payload.signature?.checksum || '';
      const timestamp = payload.timestamp ?? '';
      const concatenatedProps = properties
        .map((prop) => getNestedValue(payload.data, prop))
        .join('');
      const stringToSign = `${concatenatedProps}${timestamp}${config.wompi.eventsSecret}`;
      const expectedChecksum = crypto
        .createHash('sha256')
        .update(stringToSign)
        .digest('hex');

      if (expectedChecksum.toLowerCase() !== String(checksum).toLowerCase()) {
        throw new HttpError(401, 'Firma de evento Webhook de Wompi inválida');
      }
    }

    const wompiTx = payload.data.transaction;
    const outcome = this.applyTransactionOutcome({
      reference: wompiTx.reference,
      wompiTransactionId: String(wompiTx.id),
      wompiStatus: wompiTx.status,
      paymentMethodType: wompiTx.payment_method_type,
      amountInCents: wompiTx.amount_in_cents,
      detailNote: `Webhook Wompi #${wompiTx.id}`,
    });
    return { received: true, outcome };
  },
};
