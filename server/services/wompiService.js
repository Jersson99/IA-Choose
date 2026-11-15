import crypto from 'node:crypto';
import { config } from '../config.js';
import { db } from '../db.js';
import { HttpError } from '../errors.js';
import { dashboardService } from './dashboardService.js';

const METHOD_MAP = {
  Nequi: {
    cleanMethod: 'Nequi',
    paymentMethodType: 'NEQUI',
    displayMethod: 'Wompi API · Nequi',
  },
  Bancolombia: {
    cleanMethod: 'Bancolombia',
    paymentMethodType: 'BANCOLOMBIA_TRANSFER',
    displayMethod: 'Wompi API · Bancolombia',
  },
  PSE: {
    cleanMethod: 'PSE',
    paymentMethodType: 'PSE',
    displayMethod: 'Wompi API · PSE',
  },
};

const DEFAULT_PSE_BANKS = [
  { financial_institution_code: '1', financial_institution_name: 'Banco que aprueba (Sandbox Wompi)' },
  { financial_institution_code: '2', financial_institution_name: 'Banco que declina (Sandbox Wompi)' },
  { financial_institution_code: '1007', financial_institution_name: 'Bancolombia' },
  { financial_institution_code: '1507', financial_institution_name: 'Nequi' },
  { financial_institution_code: '1051', financial_institution_name: 'Banco Davivienda' },
  { financial_institution_code: '1001', financial_institution_name: 'Banco de Bogotá' },
  { financial_institution_code: '1013', financial_institution_name: 'BBVA Colombia' },
  { financial_institution_code: '1551', financial_institution_name: 'Daviplata' },
  { financial_institution_code: '1809', financial_institution_name: 'Nu Colombia' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNestedValue(obj, dottedPath) {
  return String(dottedPath || '')
    .split('.')
    .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : ''), obj);
}

export const wompiService = {
  /**
   * Consulta en vivo las instituciones financieras de PSE desde la API oficial de Wompi
   */
  async listPseBanks() {
    if (!config.wompi.publicKey) {
      return { banks: DEFAULT_PSE_BANKS, source: 'fallback' };
    }
    try {
      const res = await fetch(`${config.wompi.apiBaseUrl}/pse/financial_institutions`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${config.wompi.publicKey}`,
        },
      });
      if (!res.ok) {
        return { banks: DEFAULT_PSE_BANKS, source: 'fallback' };
      }
      const body = await res.json();
      const banks = Array.isArray(body?.data) && body.data.length > 0 ? body.data : DEFAULT_PSE_BANKS;
      return { banks, source: 'wompi_api' };
    } catch {
      return { banks: DEFAULT_PSE_BANKS, source: 'fallback' };
    }
  },

  /**
   * Obtiene los tokens firmados de aceptación (Habeas Data y Reglamento) exigidos por la API Directa de Wompi
   */
  async getMerchantTokens() {
    const res = await fetch(
      `${config.wompi.apiBaseUrl}/merchants/${encodeURIComponent(config.wompi.publicKey)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) {
      throw new HttpError(
        502,
        `Error al consultar el comercio en Wompi (${config.wompi.env} · HTTP ${res.status}). Verifica WOMPI_PUBLIC_KEY.`
      );
    }
    const body = await res.json();
    const merchant = body?.data;
    const acceptanceToken = merchant?.presigned_acceptance?.acceptance_token;
    const personalAuthToken = merchant?.presigned_personal_data_auth?.acceptance_token;
    const termsPermalink = merchant?.presigned_acceptance?.permalink;

    if (!acceptanceToken) {
      throw new HttpError(502, 'Wompi no devolvió el acceptance_token del comercio');
    }

    return {
      acceptanceToken,
      personalAuthToken,
      termsPermalink,
      merchantName: merchant?.name || 'IA CHOOSE',
    };
  },

  /**
   * Crea y procesa un pago usando la API Directa de Wompi (POST /v1/transactions) para Nequi, Bancolombia o PSE
   */
  async createDirectTransaction(
    userId,
    {
      amountCop,
      method = 'Nequi',
      phoneNumber = '',
      pseBankCode = '1',
      pseBankName = 'Bancolombia',
      personType = '0',
      docType = 'CC',
      docNumber = '1020304050',
      bancolombiaSandboxStatus = 'APPROVED',
      redirectUrl = '',
    } = {}
  ) {
    const amount = Math.round(Number(amountCop));
    if (!Number.isFinite(amount) || amount < 2000 || amount > 2000000) {
      throw new HttpError(400, 'Ingresa un monto de recarga válido entre $2.000 y $2.000.000 COP');
    }

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
    if (!user) throw new HttpError(401, 'Sesión inválida');

    // Asegurar que la billetera del usuario exista
    dashboardService.getOverviewData(userId);

    const methodMeta = METHOD_MAP[method] || METHOD_MAP.Nequi;
    const amountInCents = amount * 100;
    const currency = 'COP';
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const reference = `WMP-${userId}-${Date.now()}-${randomSuffix}`;
    const now = new Date().toISOString();
    const customerEmail = user.email.includes('@') ? user.email : `${user.email}@iachoose.co`;

    const cleanPhone = String(phoneNumber || '').replace(/\D/g, '');
    if (methodMeta.cleanMethod === 'Nequi' && cleanPhone.length !== 10) {
      throw new HttpError(400, 'Ingresa un número de celular Nequi válido de 10 dígitos en Colombia');
    }

    const cleanDoc = String(docNumber || '').replace(/\D/g, '') || '1020304050';

    // Registrar inicialmente la orden en estado 'pending'
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
      `Recarga billetera vía Wompi API (${methodMeta.cleanMethod})`,
      methodMeta.paymentMethodType,
      now,
      now
    );

    // 1. Si las llaves de Wompi están configuradas en .env -> Llamada real a POST /v1/transactions de Wompi
    if (config.wompi.isConfigured) {
      if (!config.wompi.integritySecret) {
        throw new HttpError(
          400,
          'Falta configurar WOMPI_INTEGRITY_SECRET en el archivo .env para firmar la transacción de la API de Wompi'
        );
      }

      const rawSignature = `${reference}${amountInCents}${currency}${config.wompi.integritySecret}`;
      const signature = crypto.createHash('sha256').update(rawSignature).digest('hex');

      const { acceptanceToken, personalAuthToken } = await this.getMerchantTokens();

      let paymentMethodPayload;
      if (methodMeta.cleanMethod === 'Nequi') {
        paymentMethodPayload = {
          type: 'NEQUI',
          phone_number: cleanPhone,
        };
      } else if (methodMeta.cleanMethod === 'Bancolombia') {
        paymentMethodPayload = {
          type: 'BANCOLOMBIA_TRANSFER',
          user_type: 'PERSON',
          payment_description: `Recarga IA CHOOSE ${reference}`,
        };
        if (config.wompi.env === 'sandbox') {
          paymentMethodPayload.sandbox_status = bancolombiaSandboxStatus || 'APPROVED';
        }
      } else {
        // PSE
        paymentMethodPayload = {
          type: 'PSE',
          user_type: Number(personType) === 1 ? 1 : 0,
          user_legal_id_type: docType || 'CC',
          user_legal_id: cleanDoc,
          financial_institution_code: String(pseBankCode || '1'),
          payment_description: `Recarga IA CHOOSE ${reference}`,
        };
      }

      const txRequestPayload = {
        acceptance_token: acceptanceToken,
        amount_in_cents: amountInCents,
        currency,
        signature,
        customer_email: customerEmail,
        reference,
        payment_method: paymentMethodPayload,
        customer_data: {
          full_name: user.name,
          phone_number: cleanPhone ? `+57${cleanPhone}` : '+573000000000',
          legal_id: cleanDoc,
          legal_id_type: docType || 'CC',
        },
      };

      if (personalAuthToken) {
        txRequestPayload.accept_personal_auth = personalAuthToken;
      }
      if (redirectUrl) {
        txRequestPayload.redirect_url = redirectUrl;
      }

      const createRes = await fetch(`${config.wompi.apiBaseUrl}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${config.wompi.publicKey}`,
        },
        body: JSON.stringify(txRequestPayload),
      });

      const createBody = await createRes.json().catch(() => ({}));
      if (!createRes.ok || !createBody?.data?.id) {
        const errMessages = createBody?.error?.messages
          ? JSON.stringify(createBody.error.messages)
          : createBody?.error?.reason || `HTTP ${createRes.status}`;
        throw new HttpError(400, `Wompi API rechazó la solicitud: ${errMessages}`);
      }

      let wompiTx = createBody.data;
      const wompiTxId = String(wompiTx.id);

      // Guardar el ID de transacción de Wompi inmediatamente
      db.prepare(
        'UPDATE billing_transactions SET wompi_transaction_id = ?, updated_at = ? WHERE reference = ?'
      ).run(wompiTxId, new Date().toISOString(), reference);

      // En Sandbox (o Nequi rápido), Wompi resuelve la transacción en ~1.5 a 3 segundos:
      // consultamos hasta 3 veces para entregar el estado final de inmediato si ya se aprobó
      for (let attempt = 0; attempt < 3 && wompiTx.status === 'PENDING'; attempt += 1) {
        await sleep(1200);
        const pollRes = await fetch(
          `${config.wompi.apiBaseUrl}/transactions/${encodeURIComponent(wompiTxId)}`,
          { headers: { Accept: 'application/json' } }
        );
        if (pollRes.ok) {
          const pollBody = await pollRes.json().catch(() => ({}));
          if (pollBody?.data?.status) {
            wompiTx = pollBody.data;
          }
        }
      }

      const asyncPaymentUrl = wompiTx?.payment_method?.extra?.async_payment_url || null;
      const outcome = this.applyTransactionOutcome({
        reference,
        wompiTransactionId: wompiTxId,
        wompiStatus: wompiTx.status,
        paymentMethodType: wompiTx.payment_method_type,
        amountInCents: wompiTx.amount_in_cents,
        detailNote: `Wompi #${wompiTxId}`,
      });

      return {
        mode: 'wompi_direct_api',
        environment: config.wompi.env,
        wompiTransactionId: wompiTxId,
        wompiStatus: wompiTx.status,
        asyncPaymentUrl,
        reference,
        amountCop: amount,
        method: methodMeta.cleanMethod,
        outcome,
        dashboard: dashboardService.getOverviewData(userId),
      };
    }

    // 2. Respaldo Sandbox local si aún no se han pegado las llaves en .env
    const isDeclinedSim =
      (methodMeta.cleanMethod === 'Nequi' && cleanPhone === '3992222222') ||
      (methodMeta.cleanMethod === 'PSE' && String(pseBankCode) === '2') ||
      (methodMeta.cleanMethod === 'Bancolombia' && bancolombiaSandboxStatus === 'DECLINED');

    const simStatus = isDeclinedSim ? 'DECLINED' : 'APPROVED';
    const simTxId = `WMP-SANDBOX-${Date.now().toString().slice(-6)}`;
    const detail =
      methodMeta.cleanMethod === 'Nequi'
        ? `Nequi (${cleanPhone})`
        : methodMeta.cleanMethod === 'PSE'
        ? `PSE · ${pseBankName} (${docType} ${cleanDoc})`
        : 'Botón Bancolombia';

    const outcome = this.applyTransactionOutcome({
      reference,
      wompiTransactionId: simTxId,
      wompiStatus: simStatus,
      paymentMethodType: methodMeta.paymentMethodType,
      amountInCents,
      detailNote: detail,
    });

    return {
      mode: 'local_direct_sandbox',
      environment: 'sandbox',
      wompiTransactionId: simTxId,
      wompiStatus: simStatus,
      asyncPaymentUrl: null,
      reference,
      amountCop: amount,
      method: methodMeta.cleanMethod,
      outcome,
      dashboard: dashboardService.getOverviewData(userId),
    };
  },

  /**
   * Crea una sesión firmada con SHA-256 para abrir la Interfaz Oficial de Wompi
   * (WidgetCheckout oficial o Web Checkout https://checkout.wompi.co/p/)
   */
  createCheckoutSession(userId, { amountCop, method, paymentLinkUrl, redirectUrl }) {
    const amount = Math.round(Number(amountCop));
    if (!Number.isFinite(amount) || amount < 2000 || amount > 2000000) {
      throw new HttpError(400, 'Ingresa un monto de recarga válido entre $2.000 y $2.000.000 COP');
    }

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
    if (!user) throw new HttpError(401, 'Sesión inválida');
    dashboardService.getOverviewData(userId);

    const methodMeta = METHOD_MAP[method] || METHOD_MAP.Nequi;
    const amountInCents = amount * 100;
    const currency = 'COP';
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const reference = `WMP-${userId}-${Date.now()}-${randomSuffix}`;
    const now = new Date().toISOString();
    const publicKey = config.wompi.publicKey || 'pub_prod_FQBuduAuyEXu7MPKxt1tce9trPlh7pwJ';
    const secretForHash = config.wompi.integritySecret || 'local_sandbox_integrity_secret';
    const rawSignature = `${reference}${amountInCents}${currency}${secretForHash}`;
    const integritySignature = crypto.createHash('sha256').update(rawSignature).digest('hex');

    const customerEmail = user.email.includes('@') ? user.email : `${user.email}@iachoose.co`;

    // CloudFront WAF de Wompi bloquea (403) cualquier URL que contenga localhost o 127.0.0.1 en redirect-url
    const isPublicHttpsRedirect =
      typeof redirectUrl === 'string' &&
      redirectUrl.startsWith('https://') &&
      !redirectUrl.includes('localhost') &&
      !redirectUrl.includes('127.0.0.1');

    // Construcción de la URL oficial del Web Checkout de Wompi con monto y firma SHA-256
    const webCheckoutParams = new URLSearchParams({
      'public-key': publicKey,
      currency,
      'amount-in-cents': String(amountInCents),
      reference,
      'signature:integrity': integritySignature,
      'customer-data:email': customerEmail,
      'customer-data:full-name': user.name,
    });
    if (isPublicHttpsRedirect) {
      webCheckoutParams.set('redirect-url', redirectUrl);
    }
    const officialWebCheckoutUrl = `https://checkout.wompi.co/p/?${webCheckoutParams.toString()}`;

    const fallbackLinkUrl = String(
      paymentLinkUrl || config.wompi.paymentLinkUrl || 'https://checkout.wompi.co/l/oZjvx6'
    ).trim();

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

    return {
      mode: config.wompi.isConfigured ? 'wompi_widget' : 'wompi_url',
      checkoutUrl: config.wompi.isConfigured ? officialWebCheckoutUrl : fallbackLinkUrl,
      webCheckoutUrl: officialWebCheckoutUrl,
      externalPaymentLink: fallbackLinkUrl,
      environment: config.wompi.env,
      publicKey,
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
   * Aplica de forma atómica e idempotente el resultado de una transacción de Wompi
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
    const updatedDesc =
      detailNote && !String(tx.description).includes(detailNote)
        ? `${tx.description} · ${detailNote}`
        : tx.description;

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
   * Consulta el estado actualizado de una transacción en GET /v1/transactions/:id de Wompi
   */
  async verifyTransaction(
    userId,
    { transactionId, reference, simulatedStatus, simulatedDetail } = {}
  ) {
    const isSimulatedCall =
      !config.wompi.isConfigured ||
      String(transactionId || '').startsWith('SIM-') ||
      String(transactionId || '').startsWith('WMP-SANDBOX-') ||
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

      const simId = transactionId || tx.wompi_transaction_id || `SIM-WMP-${Date.now().toString().slice(-7)}`;
      const outcome = this.applyTransactionOutcome({
        reference,
        wompiTransactionId: simId,
        wompiStatus: simulatedStatus || 'APPROVED',
        paymentMethodType: tx.payment_method_type,
        amountInCents: tx.amount_cop * 100,
        detailNote: simulatedDetail || 'Confirmación Wompi',
      });

      return {
        outcome,
        dashboard: dashboardService.getOverviewData(userId),
      };
    }

    let targetWompiId = transactionId;
    if (!targetWompiId && reference) {
      const localRow = db
        .prepare('SELECT wompi_transaction_id FROM billing_transactions WHERE reference = ? AND user_id = ?')
        .get(reference, userId);
      targetWompiId = localRow?.wompi_transaction_id;
    }

    if (!targetWompiId) {
      throw new HttpError(400, 'Se requiere el ID de transacción de Wompi para consultar su estado');
    }

    const url = `${config.wompi.apiBaseUrl}/transactions/${encodeURIComponent(targetWompiId)}`;
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
      wompiStatus: wompiTx.status,
      asyncPaymentUrl: wompiTx?.payment_method?.extra?.async_payment_url || null,
      outcome,
      dashboard: dashboardService.getOverviewData(userId),
    };
  },

  /**
   * Procesa el Webhook asíncrono enviado por Wompi (evento transaction.updated)
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
