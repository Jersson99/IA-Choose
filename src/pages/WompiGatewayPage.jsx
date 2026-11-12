import React, { useState } from 'react';
import { dashboardApi } from '../services/dashboardService.js';
import { formatCop } from '../components/dashboard/SpendChart.jsx';

export default function WompiGatewayPage() {
  const params = new URLSearchParams(window.location.search);
  const reference = params.get('reference') || `WMP-${Date.now()}`;
  const amountCop = Number(params.get('amount')) || 15000;
  const initialMethod = params.get('method') || 'Nequi';
  const customerEmail = params.get('email') || 'usuario@iachoose.co';
  const customerName = params.get('name') || 'Usuario IA CHOOSE';
  const redirectUrl = params.get('redirect_url') || window.location.origin;
  const externalWompiLink = params.get('external_link') || '';

  const [selectedMethod, setSelectedMethod] = useState(initialMethod);
  const [phone, setPhone] = useState('3001234567');
  const [pseBank, setPseBank] = useState('Bancolombia');
  const [personType, setPersonType] = useState('Natural');
  const [docType, setDocType] = useState('CC');
  const [docNumber, setDocNumber] = useState('1020304050');
  const [bancolombiaAccountType, setBancolombiaAccountType] = useState('Ahorros');
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'processing' | 'done'
  const [errorMsg, setErrorMsg] = useState('');

  const completeAndRedirect = async (status) => {
    setErrorMsg('');
    setProcessing(true);
    setStep('processing');

    let detail = `Pasarela URL Wompi · ${selectedMethod}`;
    if (selectedMethod === 'Nequi') {
      detail = `Wompi URL · Nequi (${phone})`;
    } else if (selectedMethod === 'Bancolombia') {
      detail = `Wompi URL · Botón Bancolombia (${bancolombiaAccountType})`;
    } else if (selectedMethod === 'PSE') {
      detail = `Wompi URL · PSE ${pseBank} (${docType} ${docNumber})`;
    }

    try {
      await dashboardApi.verifyWompiPayment({
        reference,
        simulatedStatus: status,
        simulatedDetail: detail,
      });

      setStep('done');
      setTimeout(() => {
        const returnUrl = new URL(redirectUrl, window.location.origin);
        returnUrl.searchParams.set('wompi_return', '1');
        returnUrl.searchParams.set('reference', reference);
        returnUrl.searchParams.set('status', status);
        returnUrl.searchParams.set('amount', String(amountCop));
        returnUrl.searchParams.set('method', selectedMethod);
        window.location.href = returnUrl.toString();
      }, 900);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo registrar la confirmación del pago');
      setProcessing(false);
      setStep('form');
    }
  };

  const handleOpenExternalWompiLink = () => {
    if (!externalWompiLink) return;
    window.open(externalWompiLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="wompi-url-viewport">
      <div className="wompi-url-container">
        {/* Cabecera estilo Web Checkout de Wompi */}
        <header className="wompi-url-header">
          <div className="wompi-brand-badge">
            <span className="wompi-dot" />
            <strong>wompi</strong>
            <span className="wompi-by-bancolombia">by Bancolombia · Pasarela Web URL</span>
          </div>
          <div className="wompi-secure-pill">🔒 Conexión Cifrada SSL · Pesos Colombianos (COP)</div>
        </header>

        <div className="wompi-url-grid">
          {/* Columna izquierda: Resumen del comercio y monto */}
          <aside className="wompi-summary-card">
            <span className="wompi-merchant-kicker">COMERCIO VERIFICADO</span>
            <h1 className="wompi-merchant-name">IA CHOOSE · Billetera Prepago</h1>
            <p className="wompi-merchant-desc">
              Recarga de créditos en COP para consumo de modelos de IA y Gateway API (Moonshot Kimi K2).
            </p>

            <div className="wompi-total-box">
              <span>Total a pagar</span>
              <strong>{formatCop(amountCop)}</strong>
              <small>IVA incluido · Sin cobros recurrentes</small>
            </div>

            <div className="wompi-meta-list">
              <div>
                <span>Referencia de pago</span>
                <code>{reference}</code>
              </div>
              <div>
                <span>Titular de la cuenta</span>
                <strong>{customerName}</strong>
              </div>
              <div>
                <span>Correo electrónico</span>
                <strong>{customerEmail}</strong>
              </div>
              <div>
                <span>URL de retorno automático</span>
                <code>{redirectUrl}</code>
              </div>
            </div>
          </aside>

          {/* Columna derecha: Selección de medio de pago y autorización */}
          <section className="wompi-payment-card">
            {step === 'processing' || step === 'done' ? (
              <div className="wompi-processing-state">
                <div className="wompi-spinner" />
                <h2>
                  {step === 'done'
                    ? '¡Pago confirmado! Redirigiendo a IA CHOOSE...'
                    : `Procesando transacción con ${selectedMethod}...`}
                </h2>
                <p>
                  Estamos acreditando <strong>{formatCop(amountCop)}</strong> en tu billetera de IA
                  CHOOSE y redirigiéndote de vuelta a la plataforma.
                </p>
              </div>
            ) : (
              <>
                <h2 className="wompi-card-title">Elige tu medio de pago en Colombia</h2>
                <p className="wompi-card-sub">
                  Al finalizar el pago en esta URL, serás redirigido automáticamente a IA CHOOSE y el saldo se verá reflejado de inmediato.
                </p>

                <div className="wompi-url-tabs" role="tablist">
                  {['Nequi', 'Bancolombia', 'PSE'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={selectedMethod === m}
                      className={`wompi-url-tab ${selectedMethod === m ? 'active' : ''}`}
                      onClick={() => setSelectedMethod(m)}
                    >
                      {m === 'Nequi' && '📱 Nequi'}
                      {m === 'Bancolombia' && '🏦 Bancolombia'}
                      {m === 'PSE' && '🇨🇴 PSE Bancos'}
                    </button>
                  ))}
                </div>

                {externalWompiLink && (
                  <div className="wompi-external-link-banner">
                    <div>
                      <strong>Link externo de Wompi detectado:</strong>
                      <span>Puedes abrir el link externo y luego confirmar aquí para reflejar tu saldo.</span>
                    </div>
                    <button
                      type="button"
                      className="seg-pill active"
                      onClick={handleOpenExternalWompiLink}
                    >
                      Abrir {externalWompiLink.slice(0, 32)}... ↗
                    </button>
                  </div>
                )}

                <form
                  className="wompi-url-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    completeAndRedirect('APPROVED');
                  }}
                >
                  {selectedMethod === 'Nequi' && (
                    <div className="wompi-sim-fields">
                      <label className="saas-form-label">
                        <span>Número de celular de tu cuenta Nequi</span>
                        <input
                          type="tel"
                          className="saas-input"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Ej. 3001234567"
                          required
                        />
                      </label>
                      <p className="wompi-sim-hint">
                        Recibirás una notificación en tu app Nequi para autorizar el pago de{' '}
                        <strong>{formatCop(amountCop)}</strong> a favor de IA CHOOSE.
                      </p>
                    </div>
                  )}

                  {selectedMethod === 'Bancolombia' && (
                    <div className="wompi-sim-fields">
                      <label className="saas-form-label">
                        <span>Tipo de cuenta Bancolombia</span>
                        <select
                          className="saas-select full-width"
                          value={bancolombiaAccountType}
                          onChange={(e) => setBancolombiaAccountType(e.target.value)}
                        >
                          <option value="Ahorros">Cuenta de Ahorros Bancolombia</option>
                          <option value="Corriente">Cuenta Corriente Bancolombia</option>
                          <option value="QR Bancolombia">Código QR App Bancolombia A la Mano</option>
                        </select>
                      </label>
                      <p className="wompi-sim-hint">
                        Transferencia inmediata mediante Botón Bancolombia sin costo adicional por transacción.
                      </p>
                    </div>
                  )}

                  {selectedMethod === 'PSE' && (
                    <div className="wompi-sim-fields">
                      <div className="topup-fields-grid">
                        <label className="saas-form-label">
                          <span>Banco (PSE Colombia)</span>
                          <select
                            className="saas-select full-width"
                            value={pseBank}
                            onChange={(e) => setPseBank(e.target.value)}
                          >
                            <option value="Bancolombia">Bancolombia</option>
                            <option value="Davivienda">Banco Davivienda</option>
                            <option value="BBVA Colombia">BBVA Colombia</option>
                            <option value="Banco de Bogotá">Banco de Bogotá</option>
                            <option value="Nequi">Nequi (vía PSE)</option>
                            <option value="Daviplata">Daviplata</option>
                            <option value="Nu Colombia">Nu Colombia</option>
                            <option value="Lulo Bank">Lulo Bank</option>
                            <option value="Scotiabank Colpatria">Scotiabank Colpatria</option>
                          </select>
                        </label>

                        <label className="saas-form-label">
                          <span>Tipo de persona</span>
                          <select
                            className="saas-select full-width"
                            value={personType}
                            onChange={(e) => setPersonType(e.target.value)}
                          >
                            <option value="Natural">Persona Natural</option>
                            <option value="Jurídica">Persona Jurídica / Empresa</option>
                          </select>
                        </label>
                      </div>

                      <div className="topup-fields-grid">
                        <label className="saas-form-label">
                          <span>Tipo de documento</span>
                          <select
                            className="saas-select full-width"
                            value={docType}
                            onChange={(e) => setDocType(e.target.value)}
                          >
                            <option value="CC">Cédula de Ciudadanía (CC)</option>
                            <option value="CE">Cédula de Extranjería (CE)</option>
                            <option value="NIT">NIT</option>
                          </select>
                        </label>

                        <label className="saas-form-label">
                          <span>Número de identificación</span>
                          <input
                            type="text"
                            className="saas-input"
                            value={docNumber}
                            onChange={(e) => setDocNumber(e.target.value)}
                            required
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="auth-error-banner" role="alert">
                      {errorMsg}
                    </div>
                  )}

                  <div className="wompi-url-actions">
                    <button
                      type="submit"
                      className="btn-primary-green wompi-pay-submit-btn"
                      disabled={processing}
                    >
                      Pagar {formatCop(amountCop)} con {selectedMethod} y volver a IA CHOOSE
                    </button>

                    <div className="wompi-url-secondary-btns">
                      <button
                        type="button"
                        className="revoke-key-btn"
                        disabled={processing}
                        onClick={() => completeAndRedirect('DECLINED')}
                      >
                        Simular Pago Rechazado
                      </button>
                      <a href={redirectUrl} className="wompi-cancel-link">
                        Cancelar y volver sin pagar
                      </a>
                    </div>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
