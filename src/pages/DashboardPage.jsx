import React, { useEffect, useMemo, useRef, useState } from 'react';
import PixelRobot from '../components/PixelRobot.jsx';
import {
  IconActivity,
  IconAskQuestion,
  IconBilling,
  IconLogout,
  IconModels,
  IconOverview,
  IconSettings,
  IconUsage,
} from '../components/dashboard/DashboardIcons.jsx';
import SpendChart, { formatCop, formatInt } from '../components/dashboard/SpendChart.jsx';
import { dashboardApi } from '../services/dashboardService.js';

const NAV_ITEMS = [
  { id: 'overview', label: 'Resumen general', sub: 'Overview', icon: IconOverview },
  { id: 'ask', label: 'Hacer pregunta', sub: 'Router IA', icon: IconAskQuestion },
  { id: 'usage', label: 'Consumo y estadísticas', sub: 'Usage', icon: IconUsage },
  { id: 'activity', label: 'Actividad e historial', sub: 'Activity', icon: IconActivity },
  { id: 'models', label: 'Modelos', sub: 'Models', icon: IconModels },
  { id: 'billing', label: 'Transacciones y saldo', sub: 'Billing', icon: IconBilling },
  { id: 'settings', label: 'Configuración', sub: 'Settings', icon: IconSettings },
];

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getProviderInfo(provider = '', modelName = '') {
  const p = (provider || '').toLowerCase();
  const m = (modelName || '').toLowerCase();

  if (p.includes('google') || m.includes('gemini') || m.includes('flash')) {
    return {
      name: 'Google (Gemini)',
      shortName: 'Google',
      url: 'https://gemini.google.com/',
      limitsWarning:
        'Sujeto a límites de uso diarios, cuotas por minuto y restricciones de cuenta por parte de Google.',
    };
  }
  if (p.includes('meta') || m.includes('llama')) {
    return {
      name: 'Meta AI',
      shortName: 'Meta',
      url: 'https://www.meta.ai/',
      limitsWarning:
        'Sujeto a restricciones de disponibilidad regional y límites de generación por parte de Meta.',
    };
  }
  if (p.includes('deepseek')) {
    return {
      name: 'DeepSeek',
      shortName: 'DeepSeek',
      url: 'https://chat.deepseek.com/',
      limitsWarning:
        'Sujeto a saturación frecuente de servidores, colas de espera y límites temporales de DeepSeek.',
    };
  }
  if (p.includes('moonshot') || m.includes('kimi')) {
    return {
      name: 'Moonshot Kimi',
      shortName: 'Moonshot',
      url: 'https://kimi.moonshot.cn/',
      limitsWarning:
        'Sujeto a cuotas de mensajes y verificación de cuenta por parte de Moonshot AI.',
    };
  }
  if (p.includes('anthropic') || m.includes('claude')) {
    return {
      name: 'Anthropic (Claude)',
      shortName: 'Anthropic',
      url: 'https://claude.ai/',
      limitsWarning:
        'Sujeto a límites de mensajes cada 5 horas y ventanas de espera por saturación en Claude.ai.',
    };
  }
  return {
    name: provider || 'Proveedor Oficial',
    shortName: provider || 'Proveedor Oficial',
    url: 'https://chatgpt.com/',
    limitsWarning:
      'Sujeto a límites de uso por mensaje, cuotas de cuenta y restricciones de la plataforma externa.',
  };
}

function renderInlineFormatting(str = '') {
  const segments = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return segments.map((seg, sIdx) => {
    if (seg.startsWith('**') && seg.endsWith('**')) {
      return <strong key={sIdx}>{seg.slice(2, -2)}</strong>;
    }
    if (seg.startsWith('`') && seg.endsWith('`')) {
      return (
        <code key={sIdx} className="msg-inline-code">
          {seg.slice(1, -1)}
        </code>
      );
    }
    return seg;
  });
}

function renderFormattedMessage(text = '') {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const firstLineBreak = part.indexOf('\n');
      const lang = part.slice(3, firstLineBreak).trim() || 'code';
      const code = part.slice(firstLineBreak + 1, -3);
      return (
        <div key={idx} className="msg-code-block">
          <div className="msg-code-header">
            <span>{lang}</span>
            <button
              type="button"
              className="msg-copy-code-btn"
              onClick={() => {
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(code).catch(() => {});
                }
              }}
              title="Copiar código"
            >
              Copiar
            </button>
          </div>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    const lines = part.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        elements.push(<div key={`empty-${i}`} className="msg-empty-line" />);
        i += 1;
        continue;
      }

      // Detectar tablas en Markdown (| Col 1 | Col 2 |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i += 1;
        }
        const parseRow = (r) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
        const isSeparator = (r) => /^\|?[\s:-]+\|[\s|:-]*$/.test(r);
        const headerCells = tableLines.length > 0 ? parseRow(tableLines[0]) : [];
        const bodyRows = tableLines
          .slice(1)
          .filter((r) => !isSeparator(r))
          .map(parseRow);

        elements.push(
          <div
            key={`tbl-${i}`}
            style={{
              overflowX: 'auto',
              margin: '0.65rem 0',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.22)',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.82rem',
                textAlign: 'left',
              }}
            >
              {headerCells.length > 0 && (
                <thead>
                  <tr style={{ background: 'rgba(30, 41, 59, 0.85)' }}>
                    {headerCells.map((cell, cIdx) => (
                      <th
                        key={cIdx}
                        style={{
                          padding: '0.5rem 0.7rem',
                          borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
                          color: '#38bdf8',
                          fontWeight: 600,
                        }}
                      >
                        {renderInlineFormatting(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    style={{
                      background: rIdx % 2 === 0 ? 'rgba(15, 23, 42, 0.45)' : 'transparent',
                    }}
                  >
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: '0.45rem 0.7rem',
                          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                        }}
                      >
                        {renderInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      if (trimmed.startsWith('#### ') || trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
        const cleanHead = trimmed.replace(/^#{2,4}\s+/, '');
        elements.push(
          <h4 key={`hd-${i}`} className="msg-subhead">
            {renderInlineFormatting(cleanHead)}
          </h4>
        );
        i += 1;
        continue;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <li key={`li-${i}`} className="msg-bullet-item">
            {renderInlineFormatting(trimmed.slice(2))}
          </li>
        );
        i += 1;
        continue;
      }

      elements.push(
        <p key={`p-${i}`} className="msg-paragraph">
          {renderInlineFormatting(line)}
        </p>
      );
      i += 1;
    }

    return (
      <div key={idx} className="msg-text-segment">
        {elements}
      </div>
    );
  });
}

function buildTimeSeries(logs, rangeType, customFrom, customTo) {
  const now = new Date();
  const buckets = new Map();

  if (rangeType === 'day') {
    // Últimas 24 horas agrupadas en bloques de 3 horas
    for (let i = 7; i >= 0; i -= 1) {
      const slot = new Date(now.getTime() - i * 3 * 3600 * 1000);
      const hourStr = `${String(slot.getHours()).padStart(2, '0')}:00`;
      const key = `${slot.toISOString().slice(0, 13)}`;
      buckets.set(key, {
        key,
        label: `Hoy · Bloque ${hourStr}`,
        shortLabel: hourStr,
        costCop: 0,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        tokens: 0,
        startMs: slot.getTime() - 3 * 3600 * 1000,
        endMs: slot.getTime() + 1000,
      });
    }
    for (const log of logs) {
      const t = new Date(log.created_at).getTime();
      for (const b of buckets.values()) {
        if (t >= b.startMs && t <= b.endMs) {
          b.costCop += Number(log.cost_cop) || 0;
          b.requests += 1;
          b.inputTokens += Number(log.input_tokens) || 0;
          b.outputTokens += Number(log.output_tokens) || 0;
          b.tokens += (Number(log.input_tokens) || 0) + (Number(log.output_tokens) || 0);
          break;
        }
      }
    }
    return Array.from(buckets.values());
  }

  let daysCount = rangeType === 'week' ? 7 : 14;
  let startDate = new Date(now.getTime() - (daysCount - 1) * 24 * 3600 * 1000);
  let endDate = now;

  if (rangeType === 'month') {
    daysCount = 15;
    startDate = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
  } else if (rangeType === 'custom' && customFrom && customTo) {
    startDate = new Date(`${customFrom}T00:00:00`);
    endDate = new Date(`${customTo}T23:59:59`);
  }

  const dayCursor = new Date(startDate);
  dayCursor.setHours(0, 0, 0, 0);
  const endMs = endDate.getTime();

  while (dayCursor.getTime() <= endMs && buckets.size < 31) {
    const key = dayCursor.toISOString().slice(0, 10);
    const shortLabel = dayCursor.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    const fullLabel = dayCursor.toLocaleDateString('es-CO', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
    });
    buckets.set(key, {
      key,
      label: fullLabel,
      shortLabel,
      costCop: 0,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      tokens: 0,
    });
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  for (const log of logs) {
    const key = String(log.created_at).slice(0, 10);
    const b = buckets.get(key);
    if (b) {
      b.costCop += Number(log.cost_cop) || 0;
      b.requests += 1;
      b.inputTokens += Number(log.input_tokens) || 0;
      b.outputTokens += Number(log.output_tokens) || 0;
      b.tokens += (Number(log.input_tokens) || 0) + (Number(log.output_tokens) || 0);
    }
  }

  return Array.from(buckets.values());
}

export default function DashboardPage({ user, onLogout, robot }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Estado principal del backend
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  // Estado del despachador de tareas y enrutador
  const [taskInput, setTaskInput] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [analyzingTask, setAnalyzingTask] = useState(false);
  const [executingTask, setExecutingTask] = useState(false);
  const [useModalOpen, setUseModalOpen] = useState(false);

  // Estado del Workspace de preguntas al modelo activo
  const [selectedModel, setSelectedModel] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatMessagesEndRef = useRef(null);

  // Filtros del gráfico en Overview
  const [overviewRange, setOverviewRange] = useState('week'); // 'day' | 'week' | 'month' | 'custom'
  const [overviewMetric, setOverviewMetric] = useState('cost'); // 'cost' | 'tokens'
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(Date.now() - 10 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Filtros de la sección Usage (Consumo y estadísticas)
  const [usageDateFilter, setUsageDateFilter] = useState('all'); // '7d' | '30d' | 'all'
  const [usageModelFilter, setUsageModelFilter] = useState('all');
  const [usageProviderFilter, setUsageProviderFilter] = useState('all');

  // Filtros y orden de la sección Activity (Actividad e historial)
  const [activitySearch, setActivitySearch] = useState('');
  const [activityModel, setActivityModel] = useState('all');
  const [activityProvider, setActivityProvider] = useState('all');
  const [activityOrigin, setActivityOrigin] = useState('all'); // 'all' | 'real' | 'demo'
  const [activitySort, setActivitySort] = useState('date_desc');

  // Filtros de la sección Models
  const [modelSearch, setModelSearch] = useState('');
  const [modelTierFilter, setModelTierFilter] = useState('all');

  // Estados de la sección Billing (Recargas con Pasarela Wompi y transacciones)
  const [topupAmount, setTopupAmount] = useState(15000);
  const [customAmountMode, setCustomAmountMode] = useState(false);
  const topupInputRef = useRef(null);
  const [topupMethod, setTopupMethod] = useState('Wompi');
  const [txTypeFilter, setTxTypeFilter] = useState('all'); // 'all' | 'topup' | 'usage_debit'
  const [processingTopup, setProcessingTopup] = useState(false);

  // Estados de la sección API Keys y Gateway Google AI (Gemini) / Moonshot Kimi
  const [newKeyName, setNewKeyName] = useState('');
  const [justCreatedSecret, setJustCreatedSecret] = useState(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [gatewayTestKey, setGatewayTestKey] = useState('');
  const [gatewayTestModel, setGatewayTestModel] = useState('gemini-flash');
  const [gatewayTestPrompt, setGatewayTestPrompt] = useState(
    'Explica brevemente en 3 puntos cómo optimizar consultas SQL y cómo IA CHOOSE enruta modelos con Google AI (Gemini).'
  );
  const [testingGateway, setTestingGateway] = useState(false);
  const [gatewayTestResult, setGatewayTestResult] = useState(null);

  // Estados de la sección Settings
  const [settingsName, setSettingsName] = useState(user?.name || '');
  const [settingsRouting, setSettingsRouting] = useState('balanced');
  const [settingsBudget, setSettingsBudget] = useState(50000);
  const [settingsAlert, setSettingsAlert] = useState(3000);
  const [savingSettings, setSavingSettings] = useState(false);

  const syncSettingsFields = (summary) => {
    if (!summary) return;
    setSettingsName(summary.user?.name || '');
    setSettingsRouting(summary.wallet?.defaultRoutingMode || 'balanced');
    setSettingsBudget(summary.wallet?.monthlyBudgetCop || 50000);
    setSettingsAlert(summary.wallet?.lowBalanceAlertCop || 3000);
  };

  const fetchDashboard = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const summary = await dashboardApi.getSummary();
      setData(summary);
      syncSettingsFields(summary);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo cargar la información del dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();

    // Si regresa después de haber ido al Link de Pago de Wompi (https://checkout.wompi.co/l/oZjvx6)
    try {
      const savedTopup = sessionStorage.getItem('ia_choose_wompi_last_topup');
      if (savedTopup) {
        sessionStorage.removeItem('ia_choose_wompi_last_topup');
        const parsed = JSON.parse(savedTopup);
        setActiveTab('billing');
        showToast(
          '¡Pago reflejado exitosamente en IA CHOOSE!',
          `Se acreditaron ${formatCop(parsed.amountCop)} (${parsed.method}) a tu billetera disponible.`
        );
        robot.say(
          'celebrate',
          `¡Recarga Wompi de ${formatCop(parsed.amountCop)} reflejada en tu saldo!`,
          3800
        );
      }
    } catch {
      // Ignorar errores de sessionStorage
    }

    const params = new URLSearchParams(window.location.search);
    const wompiTxId = params.get('id');
    const wompiReturn = params.get('wompi_return');
    const returnRef = params.get('reference');
    const returnStatus = params.get('status');
    const returnAmount = Number(params.get('amount')) || 0;
    const returnMethod = params.get('method') || 'Wompi';

    // 1. Retorno automático desde la Pasarela Web por URL (/wompi-gateway)
    if (wompiReturn === '1' && returnRef) {
      setActiveTab('billing');
      dashboardApi
        .verifyWompiPayment({
          reference: returnRef,
          simulatedStatus: returnStatus || 'APPROVED',
        })
        .then((res) => {
          if (res?.dashboard) setData(res.dashboard);
          const creditedAmount = res?.outcome?.amountCop || returnAmount;
          if (res?.outcome?.status === 'completed' || returnStatus === 'APPROVED') {
            showToast(
              '¡Pago reflejado exitosamente en IA CHOOSE!',
              `Se acreditaron ${formatCop(creditedAmount)} (${returnMethod}) a tu billetera disponible.`
            );
            robot.say(
              'celebrate',
              `¡Recarga completada por URL! +${formatCop(creditedAmount)} en tu cuenta`,
              3800
            );
          } else {
            showToast(
              'Pago declinado en la pasarela',
              'La transacción fue rechazada y no se realizaron cargos.'
            );
            robot.say('peek', 'El pago fue rechazado en la pasarela.', 3000);
          }
        })
        .catch((err) => showToast('Aviso al sincronizar pago', err.message))
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      return;
    }

    // 2. Si Wompi oficial redirige de vuelta tras un pago con ?id=xxx
    if (wompiTxId) {
      setActiveTab('billing');
      dashboardApi
        .verifyWompiPayment({ transactionId: wompiTxId })
        .then((res) => {
          if (res?.dashboard) setData(res.dashboard);
          if (res?.outcome?.status === 'completed') {
            showToast(
              'Pago aprobado por Wompi',
              `Se acreditaron ${formatCop(res.outcome.amountCop)} a tu billetera.`
            );
          } else if (res?.outcome?.status === 'declined') {
            showToast('Pago rechazado', 'La transacción fue declinada por la entidad financiera.');
          }
        })
        .catch((err) => showToast('Aviso al verificar pago', err.message))
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, []);

  const showToast = (title, detail) => {
    setFeedbackBanner({ title, detail });
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.title === title ? null : prev));
    }, 4500);
  };

  // Consultar recomendación o activar el modelo si ya está calculada
  const handleTaskSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const prompt = taskInput.trim();
    if (!prompt) {
      robot.say('wave', 'Escribe primero tu tarea en el recuadro', 2400);
      return;
    }

    if (recommendation) {
      // El modelo ya fue recomendado: cambiar la UI al workspace del modelo
      handleUseModel(recommendation.model);
      return;
    }

    setAnalyzingTask(true);
    try {
      const result = await dashboardApi.recommendTask(prompt);
      setRecommendation(result.recommendation);
      robot.say(
        'celebrate',
        `Mejor modelo: ${result.recommendation.model} (${result.recommendation.cost}) · Haz clic en Usar para comenzar`,
        4000
      );
    } catch (err) {
      showToast('Aviso al consultar modelo', err.message);
      robot.say('peek', err.message, 3400);
    } finally {
      setAnalyzingTask(false);
    }
  };

  const handleUseModel = async (chosenModelName) => {
    const targetModel = chosenModelName || recommendation?.model;
    if (!targetModel) return;

    setSelectedModel(targetModel);
    setUseModalOpen(false);

    const initialPrompt = taskInput.trim();
    if (initialPrompt && chatMessages.length === 0) {
      const userMsgId = 'usr-' + Date.now();
      const userMsg = {
        id: userMsgId,
        sender: 'user',
        text: initialPrompt,
        timestamp: new Date().toISOString(),
      };
      setChatMessages([userMsg]);
      setSendingChat(true);
      robot.say('peek', `Consultando a ${targetModel}...`, 2500);

      try {
        const result = await dashboardApi.executeTask(initialPrompt, targetModel, [
          { role: 'user', content: initialPrompt },
        ]);
        setData(result.dashboard);
        const modelMsg = {
          id: 'model-' + Date.now(),
          sender: 'model',
          text: result.reply,
          modelName: result.model,
          provider: result.provider,
          cost: result.cost,
          latencyMs: result.latencyMs,
          tokens: result.tokens,
          costBreakdown: result.costBreakdown,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, modelMsg]);
        robot.say('celebrate', `Respuesta generada con ${result.model}`, 3200);
      } catch (err) {
        showToast('Error al procesar consulta', err.message);
        robot.say('peek', err.message, 3400);
      } finally {
        setSendingChat(false);
      }
    } else {
      robot.say(
        'celebrate',
        `Modelo activo: ${targetModel}. Escribe tus preguntas directamente.`,
        3500
      );
    }
  };

  const handleSendChatMessage = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt || sendingChat) return;

    const userMsgId = 'usr-' + Date.now();
    const userMsg = {
      id: userMsgId,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toISOString(),
    };

    const historyPayload = [
      ...chatMessages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      { role: 'user', content: prompt },
    ];

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setSendingChat(true);
    robot.say('peek', `Consultando a ${selectedModel}...`, 2500);

    try {
      const result = await dashboardApi.executeTask(prompt, selectedModel, historyPayload);
      setData(result.dashboard);
      const modelMsg = {
        id: 'model-' + Date.now(),
        sender: 'model',
        text: result.reply,
        modelName: result.model,
        provider: result.provider,
        cost: result.cost,
        latencyMs: result.latencyMs,
        tokens: result.tokens,
        costBreakdown: result.costBreakdown,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, modelMsg]);
      robot.say(
        'celebrate',
        `Respuesta lista (${result.cost}) · ${result.latencyMs} ms`,
        3000
      );
    } catch (err) {
      showToast('Aviso al procesar pregunta', err.message);
      robot.say('peek', err.message, 3400);
    } finally {
      setSendingChat(false);
    }
  };

  const handleSwitchModel = (newModelName) => {
    setSelectedModel(newModelName);
    const mObj = models.find((m) => m.name === newModelName);
    showToast(
      'Modelo cambiado',
      `Ahora tus preguntas se procesarán con ${newModelName} ($${mObj?.cost_cop || 9} COP / consulta).`
    );
    robot.say('happy', `Cambiado a ${newModelName}`, 2500);
  };

  const handleReturnToRouter = () => {
    setSelectedModel(null);
    setRecommendation(null);
    setTaskInput('');
    robot.say('wave', 'Enrutador listo para analizar una nueva tarea', 2400);
  };

  const handleUseExternal = (providerInfo) => {
    const prompt = (chatInput || taskInput || '').trim();
    if (navigator.clipboard?.writeText && prompt) {
      navigator.clipboard.writeText(prompt).catch(() => {});
    }
    window.open(providerInfo.url, '_blank', 'noopener,noreferrer');
    showToast(
      `Abriendo ${providerInfo.name}`,
      `Se copió tu consulta al portapapeles. Ten en cuenta los límites de uso por parte de ${providerInfo.shortName}.`
    );
    setUseModalOpen(false);
  };

  const handleToggleDemoData = async (action) => {
    try {
      const updated = await dashboardApi.toggleDemoData(action);
      setData(updated);
      showToast(
        action === 'clear' ? 'Datos de prueba eliminados' : 'Datos de prueba cargados',
        action === 'clear'
          ? 'Ahora solo se muestran los registros reales de tu cuenta.'
          : 'Se cargaron registros de ejemplo identificados con la etiqueta [Demo].'
      );
      robot.say(
        'celebrate',
        action === 'clear' ? 'Datos de prueba limpiados' : 'Datos de demostración listos para explorar',
        2800
      );
    } catch (err) {
      showToast('Error', err.message);
    }
  };

  const openWompiCheckoutForSession = (session) => {
    // Redirigir directamente al Web Checkout oficial de Wompi (https://checkout.wompi.co/p/?...)
    // En modo página completa tiene scroll nativo 100% responsive en escritorio y móvil,
    // sin quedar atrapado en un iframe estático, y al terminar regresa con ?id=<TRANSACTION_ID>
    const targetUrl =
      session?.webCheckoutUrl || session?.checkoutUrl || 'https://checkout.wompi.co/l/oZjvx6';
    try {
      sessionStorage.setItem(
        'ia_choose_wompi_last_topup',
        JSON.stringify({
          amountCop: session.amountCop,
          method: session.method,
          reference: session.reference,
        })
      );
    } catch {
      // Ignorar errores de sessionStorage
    }
    window.location.href = targetUrl;
  };

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    setProcessingTopup(true);
    try {
      const session = await dashboardApi.createWompiCheckout(
        Number(topupAmount),
        topupMethod,
        window.location.origin
      );
      if (session?.dashboard) {
        setData(session.dashboard);
      }
      openWompiCheckoutForSession(session);
    } catch (err) {
      showToast('Error al abrir Wompi Checkout', err.message);
    } finally {
      setProcessingTopup(false);
    }
  };

  const handleResumePendingTx = async (tx) => {
    setProcessingTopup(true);
    try {
      const verified = await dashboardApi.verifyWompiPayment({
        reference: tx.reference,
        transactionId: tx.wompi_transaction_id || undefined,
      });

      if (verified?.dashboard) {
        setData(verified.dashboard);
      }

      if (verified?.outcome?.status === 'completed') {
        showToast(
          '¡Pago verificado y acreditado!',
          `Wompi confirmó la orden ${tx.reference} y se sumaron ${formatCop(verified.outcome.amountCop)} a tu billetera.`
        );
        robot.say(
          'celebrate',
          `¡Saldo actualizado! +${formatCop(verified.outcome.amountCop)} disponibles`,
          3500
        );
      } else if (verified?.outcome?.status === 'declined') {
        showToast(
          'Pago declinado en Wompi',
          `La referencia ${tx.reference} figura como rechazada o expirada.`
        );
      } else {
        showToast(
          'Aún pendiente de confirmación',
          `La transacción ${tx.reference} sigue en estado PENDING en Wompi. Intenta de nuevo tras autorizar en tu app bancaria.`
        );
      }
    } catch (err) {
      showToast('Error al verificar estado en Wompi', err.message);
    } finally {
      setProcessingTopup(false);
    }
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    setCreatingKey(true);
    try {
      const result = await dashboardApi.createApiKey(newKeyName);
      setJustCreatedSecret(result.rawSecret);
      setGatewayTestKey(result.rawSecret);
      setData(result.dashboard);
      setNewKeyName('');
      showToast('Clave API generada', 'Copia tu clave ahora; ya quedó pre-cargada en el probador del Gateway.');
    } catch (err) {
      showToast('Error al crear clave', err.message);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleTestGateway = async (e) => {
    e.preventDefault();
    if (!gatewayTestPrompt.trim()) return;
    setTestingGateway(true);
    try {
      const res = await dashboardApi.testGatewayCompletion({
        apiKey: gatewayTestKey,
        model: gatewayTestModel,
        prompt: gatewayTestPrompt,
      });
      setGatewayTestResult(res);
      if (res?.dashboard) {
        setData(res.dashboard);
      }
      const charged = res?.ia_choose_billing?.charged_formatted || '$18 COP';
      const remaining = formatCop(res?.ia_choose_billing?.remaining_balance_cop ?? 0);
      showToast(
        `Consulta procesada por ${res.model_name}`,
        `Se descontaron ${charged} de tu billetera. Saldo restante: ${remaining}.`
      );
      robot.say(
        'celebrate',
        `Gateway API: ${res.model_name} respondió y descontó ${charged}`,
        3500
      );
    } catch (err) {
      showToast('Error en Gateway API', err.message);
      robot.say('peek', err.message, 3200);
    } finally {
      setTestingGateway(false);
    }
  };

  const handleRevokeApiKey = async (id) => {
    try {
      const updated = await dashboardApi.revokeApiKey(id);
      setData(updated);
      showToast('Clave API revocada', 'La clave seleccionada ya no tiene acceso para realizar peticiones.');
    } catch (err) {
      showToast('Error al revocar', err.message);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const updated = await dashboardApi.updateSettings({
        name: settingsName,
        defaultRoutingMode: settingsRouting,
        monthlyBudgetCop: settingsBudget,
        lowBalanceAlertCop: settingsAlert,
      });
      setData(updated);
      syncSettingsFields(updated);
      showToast('Configuración guardada', 'Tus datos y preferencias de cuenta se actualizaron correctamente.');
      robot.say('celebrate', 'Configuración actualizada', 2400);
    } catch (err) {
      showToast('Error al guardar', err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const logs = data?.logs || [];
  const models = data?.models || [];
  const currentModelObj = useMemo(() => {
    if (!selectedModel) return null;
    return (
      models.find((m) => m.name === selectedModel || m.slug === selectedModel) ||
      models[0] || {
        name: selectedModel,
        provider: 'Google DeepMind',
        cost_cop: 9,
      }
    );
  }, [models, selectedModel]);

  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, sendingChat]);
  const transactions = data?.transactions || [];
  const apiKeys = data?.apiKeys || [];
  const kpis = data?.kpis || {
    balanceCop: 0,
    todaySpendCop: 0,
    weekSpendCop: 0,
    monthSpendCop: 0,
    totalSpendCop: 0,
    totalRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    avgCostPerRequestCop: 0,
  };

  // Serie temporal para el gráfico de Overview
  const overviewChartSeries = useMemo(
    () => buildTimeSeries(logs, overviewRange, customFrom, customTo),
    [logs, overviewRange, customFrom, customTo]
  );

  // Datos filtrados para la sección Usage (Consumo y estadísticas)
  const filteredUsageLogs = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;
    return logs.filter((l) => {
      if (usageDateFilter === '7d' && now - new Date(l.created_at).getTime() > 7 * dayMs) return false;
      if (usageDateFilter === '30d' && now - new Date(l.created_at).getTime() > 30 * dayMs) return false;
      if (usageModelFilter !== 'all' && l.model_name !== usageModelFilter) return false;
      if (usageProviderFilter !== 'all' && l.provider !== usageProviderFilter) return false;
      return true;
    });
  }, [logs, usageDateFilter, usageModelFilter, usageProviderFilter]);

  const usageStats = useMemo(() => {
    let spend = 0;
    let inTok = 0;
    let outTok = 0;
    const byModelMap = new Map();
    const byProviderMap = new Map();
    const byDateMap = new Map();

    for (const l of filteredUsageLogs) {
      const c = Number(l.cost_cop) || 0;
      const it = Number(l.input_tokens) || 0;
      const ot = Number(l.output_tokens) || 0;
      spend += c;
      inTok += it;
      outTok += ot;

      const mItem = byModelMap.get(l.model_name) || {
        name: l.model_name,
        provider: l.provider,
        costCop: 0,
        requests: 0,
        tokens: 0,
      };
      mItem.costCop += c;
      mItem.requests += 1;
      mItem.tokens += it + ot;
      byModelMap.set(l.model_name, mItem);

      const pItem = byProviderMap.get(l.provider) || {
        provider: l.provider,
        costCop: 0,
        requests: 0,
        tokens: 0,
      };
      pItem.costCop += c;
      pItem.requests += 1;
      pItem.tokens += it + ot;
      byProviderMap.set(l.provider, pItem);

      const dateKey = String(l.created_at).slice(0, 10);
      const dItem = byDateMap.get(dateKey) || {
        date: dateKey,
        costCop: 0,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
      dItem.costCop += c;
      dItem.requests += 1;
      dItem.inputTokens += it;
      dItem.outputTokens += ot;
      byDateMap.set(dateKey, dItem);
    }

    const reqCount = filteredUsageLogs.length;
    const avgCost = reqCount > 0 ? Math.round((spend / reqCount) * 10) / 10 : 0;

    return {
      spend,
      reqCount,
      avgCost,
      inTok,
      outTok,
      totalTok: inTok + outTok,
      byModel: Array.from(byModelMap.values()).sort((a, b) => b.costCop - a.costCop),
      byProvider: Array.from(byProviderMap.values()).sort((a, b) => b.costCop - a.costCop),
      byDate: Array.from(byDateMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [filteredUsageLogs]);

  // Datos filtrados y ordenados para la sección Activity
  const filteredActivityLogs = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    const list = logs.filter((l) => {
      if (activityModel !== 'all' && l.model_name !== activityModel) return false;
      if (activityProvider !== 'all' && l.provider !== activityProvider) return false;
      if (activityOrigin === 'real' && l.is_demo) return false;
      if (activityOrigin === 'demo' && !l.is_demo) return false;
      if (q) {
        const hay = `${l.prompt_summary} ${l.model_name} ${l.provider} ${l.domain}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (activitySort === 'date_asc') return a.created_at.localeCompare(b.created_at);
      if (activitySort === 'cost_desc') return b.cost_cop - a.cost_cop;
      if (activitySort === 'cost_asc') return a.cost_cop - b.cost_cop;
      if (activitySort === 'tokens_desc') {
        return b.input_tokens + b.output_tokens - (a.input_tokens + a.output_tokens);
      }
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }, [logs, activitySearch, activityModel, activityProvider, activityOrigin, activitySort]);

  // Modelos filtrados para la sección Models
  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return models.filter((m) => {
      if (modelTierFilter !== 'all' && m.tier !== modelTierFilter) return false;
      if (q) {
        const hay = `${m.name} ${m.provider} ${m.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [models, modelSearch, modelTierFilter]);

  // Transacciones filtradas para Billing
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
      return true;
    });
  }, [transactions, txTypeFilter]);

  const uniqueProviders = useMemo(
    () => Array.from(new Set(models.map((m) => m.provider))),
    [models]
  );

  const budgetPct = Math.min(
    100,
    Math.round(((kpis.monthSpendCop || 0) / Math.max(1, data?.wallet?.monthlyBudgetCop || 50000)) * 100)
  );

  return (
    <div className="saas-dashboard-shell">
      {/* ================= SIDEBAR LATERAL DE NAVEGACIÓN ================= */}
      <aside className={`saas-sidebar ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Menú principal del dashboard">
        <div className="sidebar-brand-block">
          <div className="sidebar-brand-row">
            <span className="sidebar-brand-logo">IA CHOOSE</span>
            <span className="sidebar-currency-badge">COP</span>
          </div>
          <p className="sidebar-brand-caption">Consola de Enrutamiento y Saldo</p>
        </div>

        <nav className="sidebar-nav-list">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
              >
                <Icon />
                <div className="nav-btn-copy">
                  <span className="nav-btn-title">{item.label}</span>
                  <span className="nav-btn-sub">{item.sub}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-user-footer">
          <div className="user-avatar-circle" aria-hidden="true">
            {(data?.user?.name || user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="user-footer-meta">
            <strong>{data?.user?.name || user?.name}</strong>
            <span>{data?.user?.email || user?.email}</span>
          </div>
          <button
            type="button"
            className="sidebar-logout-icon-btn"
            onClick={onLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <IconLogout />
          </button>
        </div>
      </aside>

      {/* ================= ÁREA DE CONTENIDO PRINCIPAL ================= */}
      <div className="saas-main-area">
        {/* Encabezado superior: mantiene "Welcome to IA Choose" con traducción al pasar el cursor */}
        <header className="saas-topbar">
          <div className="topbar-left-group">
            <button
              type="button"
              className="mobile-sidebar-toggle"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Abrir navegación lateral"
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </button>

            <div>
              <h1
                className={`dashboard-welcome-title saas-title-scale ${
                  robot.titleHovered ? 'is-translated' : ''
                }`}
                onMouseEnter={() => robot.setTitleHovered(true)}
                onMouseLeave={() => robot.setTitleHovered(false)}
                title="Pasa el cursor para traducir"
              >
                {robot.titleHovered ? 'Bienvenido a IA Choose' : 'Welcome to IA Choose'}
              </h1>
              <p className="topbar-section-breadcrumb">
                {NAV_ITEMS.find((n) => n.id === activeTab)?.label} · Cuenta de{' '}
                <strong>{data?.user?.name || user?.name}</strong>
              </p>
            </div>
          </div>

          <div className="topbar-right-actions">
            <button
              type="button"
              className="topbar-quick-btn"
              onClick={() => setActiveTab('billing')}
            >
              <span>Saldo:</span>
              <strong>{formatCop(kpis.balanceCop)}</strong>
            </button>
          </div>
        </header>

        {/* Notificación flotante de operaciones */}
        {feedbackBanner && (
          <div className="saas-toast-banner" role="status" aria-live="polite">
            <div>
              <strong>{feedbackBanner.title}</strong>
              <span>{feedbackBanner.detail}</span>
            </div>
            <button type="button" onClick={() => setFeedbackBanner(null)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        )}

        {/* Estado de carga o error */}
        {loading ? (
          <div className="saas-state-card">
            <p>Cargando métricas y actividad de tu cuenta...</p>
          </div>
        ) : errorMsg ? (
          <div className="saas-state-card is-error" role="alert">
            <p>{errorMsg}</p>
            <button type="button" className="btn-primary-green" onClick={fetchDashboard}>
              Reintentar
            </button>
          </div>
        ) : (
          <div className="saas-scroll-workspace">
            {/* =================================================================
             * SECCIÓN 1: RESUMEN GENERAL (OVERVIEW)
             * ================================================================= */}
            {activeTab === 'overview' && (
              <div className="dashboard-section-stack">
                {/* Tarjetas de Indicadores Principales (KPIs) */}
                <section className="kpi-cards-grid" aria-label="Indicadores generales de la cuenta">
                  <article className="kpi-card kpi-card-highlight">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Saldo disponible</span>
                      <span className="kpi-tag">Prepago COP</span>
                    </div>
                    <strong className="kpi-value">{formatCop(kpis.balanceCop)}</strong>
                    <span className="kpi-foot">
                      Alerta configurada en {formatCop(data?.wallet?.lowBalanceAlertCop || 3000)}
                    </span>
                  </article>

                  <article className="kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Consumo del día</span>
                      <span className="kpi-tag">Hoy</span>
                    </div>
                    <strong className="kpi-value">{formatCop(kpis.todaySpendCop)}</strong>
                    <span className="kpi-foot">Descuento exacto por token</span>
                  </article>

                  <article className="kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Consumo semanal</span>
                      <span className="kpi-tag">Últimos 7 días</span>
                    </div>
                    <strong className="kpi-value">{formatCop(kpis.weekSpendCop)}</strong>
                    <span className="kpi-foot">Acumulado últimos 7 días</span>
                  </article>

                  <article className="kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Consumo mensual</span>
                      <span className="kpi-tag">{budgetPct}% de meta</span>
                    </div>
                    <strong className="kpi-value">{formatCop(kpis.monthSpendCop)}</strong>
                    <span className="kpi-foot">
                      Presupuesto: {formatCop(data?.wallet?.monthlyBudgetCop || 50000)}
                    </span>
                  </article>

                  <article className="kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Consumo total</span>
                      <span className="kpi-tag">Histórico</span>
                    </div>
                    <strong className="kpi-value">{formatCop(kpis.totalSpendCop)}</strong>
                    <span className="kpi-foot">
                      Promedio: {formatCop(kpis.avgCostPerRequestCop)} / consulta
                    </span>
                  </article>

                  <article className="kpi-card">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Total de solicitudes</span>
                      <span className="kpi-tag">API + Router</span>
                    </div>
                    <strong className="kpi-value">{formatInt(kpis.totalRequests)}</strong>
                    <span className="kpi-foot">Peticiones procesadas</span>
                  </article>

                  <article className="kpi-card kpi-card-wide">
                    <div className="kpi-card-top">
                      <span className="kpi-label">Total de tokens utilizados</span>
                      <span className="kpi-tag">Entrada vs. Salida</span>
                    </div>
                    <strong className="kpi-value">{formatInt(kpis.totalTokens)} tokens</strong>
                    <div className="token-split-row">
                      <span>
                        Entrada (Prompt): <strong>{formatInt(kpis.inputTokens)}</strong>
                      </span>
                      <span>
                        Salida (Completion): <strong>{formatInt(kpis.outputTokens)}</strong>
                      </span>
                    </div>
                  </article>
                </section>

                {/* Aviso claro cuando el usuario aún no tiene consumo registrado */}
                {logs.length === 0 && (
                  <section className="empty-activity-banner" role="region" aria-label="Cuenta sin actividad previa">
                    <div>
                      <h2>Tu cuenta aún no registra consumo de modelos</h2>
                      <p>
                        Dirígete a la sección <strong>Hacer pregunta</strong> en el menú lateral para escribir tu primera tarea y conocer el modelo ideal, o realiza una petición desde el Gateway API.
                      </p>
                    </div>
                    <div className="empty-banner-actions">
                      <button
                        type="button"
                        className="btn-primary-green compact-btn"
                        onClick={() => setActiveTab('ask')}
                      >
                        Ir a Hacer pregunta
                      </button>
                    </div>
                  </section>
                )}

                {/* Gráfico interactivo de evolución de gastos con filtros Día / Semana / Mes / Personalizado */}
                <section className="saas-panel-card">
                  <div className="panel-header-row">
                    <div>
                      <h2 className="panel-title">Evolución del consumo en el tiempo</h2>
                      <p className="panel-subtitle">
                        Pasa el cursor sobre cada barra para inspeccionar gasto en COP, solicitudes y tokens.
                      </p>
                    </div>

                    <div className="chart-controls-wrap">
                      <div className="segmented-pills" role="group" aria-label="Métrica del gráfico">
                        <button
                          type="button"
                          className={`seg-pill ${overviewMetric === 'cost' ? 'active' : ''}`}
                          onClick={() => setOverviewMetric('cost')}
                        >
                          Gasto (COP)
                        </button>
                        <button
                          type="button"
                          className={`seg-pill ${overviewMetric === 'tokens' ? 'active' : ''}`}
                          onClick={() => setOverviewMetric('tokens')}
                        >
                          Tokens
                        </button>
                      </div>

                      <div className="segmented-pills" role="group" aria-label="Rango de tiempo">
                        <button
                          type="button"
                          className={`seg-pill ${overviewRange === 'day' ? 'active' : ''}`}
                          onClick={() => setOverviewRange('day')}
                        >
                          Día
                        </button>
                        <button
                          type="button"
                          className={`seg-pill ${overviewRange === 'week' ? 'active' : ''}`}
                          onClick={() => setOverviewRange('week')}
                        >
                          Semana
                        </button>
                        <button
                          type="button"
                          className={`seg-pill ${overviewRange === 'month' ? 'active' : ''}`}
                          onClick={() => setOverviewRange('month')}
                        >
                          Mes
                        </button>
                        <button
                          type="button"
                          className={`seg-pill ${overviewRange === 'custom' ? 'active' : ''}`}
                          onClick={() => setOverviewRange('custom')}
                        >
                          Personalizado
                        </button>
                      </div>
                    </div>
                  </div>

                  {overviewRange === 'custom' && (
                    <div className="custom-date-range-bar">
                      <label>
                        <span>Desde:</span>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Hasta:</span>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                        />
                      </label>
                    </div>
                  )}

                  <SpendChart series={overviewChartSeries} metric={overviewMetric} />
                </section>
              </div>
            )}

            {/* =================================================================
             * SECCIÓN: HACER PREGUNTA
             * MODO 1: Enrutador inteligente (buscar mejor modelo)
             * ================================================================= */}
            {activeTab === 'ask' && !selectedModel && (
              <div className="dashboard-section-stack ask-section-centered">
                {/* Espacio principal para escribir la tarea + Asistente PixelRobot */}
                <section
                  className="overview-router-grid ask-router-centered"
                  aria-label="Enrutador inteligente de tareas y asistente"
                >
                  <div className="overview-robot-card">
                    <PixelRobot
                      robotMood={robot.mood}
                      onRobotClick={robot.handleClick}
                      speechText={robot.speech}
                    />
                  </div>

                  <form className="dark-task-box overview-task-box" onSubmit={handleTaskSubmit}>
                    <div className="task-box-header">
                      <label htmlFor="dashboard-task-textarea" className="task-prompt-label">
                        <span>Dime tu tarea y te diré el mejor modelo para tí</span>
                        <svg
                          className="green-heart-icon"
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="#5FD068"
                          aria-hidden="true"
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </label>
                    </div>

                    <textarea
                      id="dashboard-task-textarea"
                      className="task-textarea"
                      value={taskInput}
                      onChange={(e) => {
                        setTaskInput(e.target.value);
                        if (recommendation) setRecommendation(null);
                      }}
                      onFocus={() => robot.onFieldFocus('task')}
                      onBlur={() => robot.onFieldFocus(null)}
                      placeholder="Escribe aquí tu tarea o pregunta (ej.: 'Haz un hola mundo en Python' vs. 'Diseñar la arquitectura de un microservicio distribuido con Kafka')..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleTaskSubmit(e);
                        }
                      }}
                    />

                    <div className="task-box-footer">
                      {recommendation ? (
                        <div className="task-recommendation-pill" role="status">
                          <div className="rec-main">
                            <strong>
                              {recommendation.model} · {recommendation.analysis?.benchmarkName}:{' '}
                              {recommendation.analysis?.benchmarkScore}%
                            </strong>
                            <span className="rec-cost">{recommendation.cost}</span>
                          </div>
                          <p>{recommendation.reason}</p>
                        </div>
                      ) : (
                        <span className="task-hint-text">
                          Presiona Enter o el botón para analizar tu tarea y conocer el modelo ideal
                        </span>
                      )}

                      <button
                        type="submit"
                        className={`task-analyze-btn ${recommendation ? 'is-ready-to-use' : ''}`}
                        disabled={analyzingTask}
                      >
                        {analyzingTask
                          ? 'Consultando...'
                          : recommendation
                          ? `Usar ${recommendation.model}`
                          : 'Consultar mejor modelo'}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}

            {/* =================================================================
             * SECCIÓN: HACER PREGUNTA
             * MODO 2: Workspace de preguntas directas al modelo activo o alternativo
             * ================================================================= */}
            {activeTab === 'ask' && selectedModel && (() => {
              const modelTurns = chatMessages.filter((m) => m.sender === 'model' && m.costBreakdown);
              const threadSummary = modelTurns.reduce(
                (acc, m) => {
                  const cb = m.costBreakdown || {};
                  const tk = m.tokens || {};
                  acc.turns += 1;
                  acc.inputTokens += Number(tk.inputTokens) || 0;
                  acc.cachedTokens += Number(tk.cachedTokens) || 0;
                  acc.outputTokens += Number(tk.outputTokens) || 0;
                  acc.reasoningTokens += Number(tk.reasoningTokens) || 0;
                  acc.providerUsd += Number(cb.providerCostUsd) || 0;
                  acc.providerCop += Number(cb.providerCostCop) || 0;
                  acc.overheadCop += Number(cb.operationalOverheadCop) || 0;
                  acc.internalCop += Number(cb.totalInternalCostCop) || 0;
                  acc.chargedCop += Number(cb.userChargedCop) || 0;
                  acc.profitCop += Number(cb.netProfitCop) || 0;
                  return acc;
                },
                {
                  turns: 0,
                  inputTokens: 0,
                  cachedTokens: 0,
                  outputTokens: 0,
                  reasoningTokens: 0,
                  providerUsd: 0,
                  providerCop: 0,
                  overheadCop: 0,
                  internalCop: 0,
                  chargedCop: 0,
                  profitCop: 0,
                }
              );
              const latestDbAudit = (data?.recentCostAudits || [])[0] || null;
              const threadMarginPct =
                threadSummary.chargedCop > 0
                  ? Math.round((threadSummary.profitCop / threadSummary.chargedCop) * 1000) / 10
                  : 0;

              return (
                <div className="dashboard-section-stack model-workspace-shell">
                  {/* Encabezado del Workspace con botón para volver al enrutador */}
                  <header className="model-workspace-header">
                    <div className="model-workspace-left">
                      <button
                        type="button"
                        className="model-workspace-back-btn"
                        onClick={handleReturnToRouter}
                        title="Volver al enrutador para buscar el mejor modelo para otra tarea"
                      >
                        ← Volver al Enrutador
                      </button>
                      {chatMessages.length > 0 && (
                        <button
                          type="button"
                          className="model-workspace-back-btn"
                          style={{ marginLeft: '0.5rem' }}
                          onClick={() => {
                            setChatMessages([]);
                            robot.say(
                              'happy',
                              'Contexto reiniciado a 0 tokens para ahorrar en tu próxima consulta',
                              2600
                            );
                          }}
                          title="Limpiar el historial de esta conversación para no reenviar tokens acumulados"
                        >
                          ＋ Nuevo hilo (Reiniciar contexto)
                        </button>
                      )}
                    </div>
                  </header>

                  {/* Monitor de Rentabilidad en Vivo (Auditoría de Tokens y Ganancia Neta) */}
                  {(threadSummary.turns > 0 || latestDbAudit) && (
                    <div
                      style={{
                        background: 'rgba(15, 23, 42, 0.78)',
                        border: '1px solid rgba(56, 189, 248, 0.28)',
                        borderRadius: '12px',
                        padding: '0.75rem 1rem',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      {threadSummary.turns > 0 ? (
                        <>
                          <div>
                            <strong style={{ color: '#38bdf8' }}>
                              📊 Auditoría en Vivo del Hilo ({threadSummary.turns}{' '}
                              {threadSummary.turns === 1 ? 'turno' : 'turnos'})
                            </strong>
                            <div style={{ color: '#94a3b8', marginTop: '0.15rem' }}>
                              Contexto enviado: <strong>{threadSummary.inputTokens} tok</strong> (
                              {threadSummary.cachedTokens} caché) · Salida:{' '}
                              <strong>{threadSummary.outputTokens} tok</strong> (
                              {threadSummary.reasoningTokens} razonamiento)
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem' }}>
                            <span>
                              Costo Proveedor:{' '}
                              <strong>
                                ${threadSummary.providerCop.toFixed(2)} COP
                              </strong>{' '}
                              <small style={{ color: '#94a3b8' }}>
                                (${threadSummary.providerUsd.toFixed(6)} USD)
                              </small>
                            </span>
                            <span>
                              Operativo + Wompi:{' '}
                              <strong>${threadSummary.overheadCop.toFixed(2)} COP</strong>
                            </span>
                            <span>
                              Cobrado Usuario: <strong>${threadSummary.chargedCop} COP</strong>
                            </span>
                            <span
                              style={{
                                color: threadSummary.profitCop >= 0 ? '#4ade80' : '#f87171',
                                fontWeight: 700,
                              }}
                            >
                              Ganancia Neta:{' '}
                              {threadSummary.profitCop >= 0 ? '+' : ''}$
                              {threadSummary.profitCop.toFixed(2)} COP ({threadMarginPct}%)
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <strong style={{ color: '#38bdf8' }}>
                              📊 Última Auditoría Real Registrada ({latestDbAudit.remote_model_id})
                            </strong>
                            <div style={{ color: '#94a3b8', marginTop: '0.15rem' }}>
                              Entrada: <strong>{latestDbAudit.prompt_tokens_total} tok</strong> (
                              {latestDbAudit.input_cached_tokens} caché) · Salida:{' '}
                              <strong>{latestDbAudit.output_tokens_total} tok</strong> (
                              {latestDbAudit.reasoning_tokens} razonamiento)
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem' }}>
                            <span>
                              Costo Proveedor:{' '}
                              <strong>
                                ${Number(latestDbAudit.provider_cost_cop).toFixed(2)} COP
                              </strong>{' '}
                              <small style={{ color: '#94a3b8' }}>
                                (${Number(latestDbAudit.provider_cost_usd).toFixed(6)} USD)
                              </small>
                            </span>
                            <span>
                              Operativo + Wompi:{' '}
                              <strong>
                                ${Number(latestDbAudit.operational_overhead_cop).toFixed(2)} COP
                              </strong>
                            </span>
                            <span>
                              Cobrado Usuario:{' '}
                              <strong>${latestDbAudit.user_charged_cop} COP</strong>
                            </span>
                            <span
                              style={{
                                color:
                                  Number(latestDbAudit.net_profit_cop) >= 0 ? '#4ade80' : '#f87171',
                                fontWeight: 700,
                              }}
                            >
                              Ganancia Neta: +$
                              {Number(latestDbAudit.net_profit_cop).toFixed(2)} COP (
                              {latestDbAudit.net_margin_pct}%)
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Tarjeta del Chat / Conversación con el modelo */}
                  <div className="model-chat-stream-card">
                    <div className="model-chat-messages-container">
                      {chatMessages.length === 0 ? (
                        <div className="chat-empty-state">
                          <div className="chat-empty-robot-preview">
                            <PixelRobot
                              robotMood={robot.mood}
                              onRobotClick={robot.handleClick}
                              speechText={robot.speech || `Listo para consultar a ${selectedModel}`}
                            />
                          </div>
                          <div className="chat-empty-text">
                            <h3>Workspace de Preguntas · {selectedModel}</h3>
                            <p>
                              Escribe tu pregunta o requerimiento abajo para procesarlo directamente con{' '}
                              <strong>{selectedModel}</strong> sin límites de cuota. También puedes cambiar a cualquier otro modelo en el selector superior.
                            </p>
                            <div className="chat-empty-specs">
                              <span>
                                Proveedor: <strong>{currentModelObj?.provider}</strong>
                              </span>
                              <span>
                                Tarifa: <strong>${currentModelObj?.cost_cop} COP</strong> / consulta
                              </span>
                              <span>
                                SWE-bench: <strong>{currentModelObj?.swe_bench}%</strong>
                              </span>
                              <span>
                                MATH-500: <strong>{currentModelObj?.math_500}%</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="chat-messages-list">
                          {chatMessages.map((msg) => (
                            <div key={msg.id} className={`chat-message-row is-${msg.sender}`}>
                              <div className="chat-msg-avatar">
                                {msg.sender === 'user' ? (
                                  (data?.user?.name || user?.name || 'U').charAt(0).toUpperCase()
                                ) : (
                                  <span className="robot-msg-icon">🤖</span>
                                )}
                              </div>

                              <div className="chat-msg-bubble">
                                <div className="chat-msg-top">
                                  <strong className="chat-msg-author">
                                    {msg.sender === 'user' ? 'Tú' : msg.modelName || selectedModel}
                                  </strong>
                                  {msg.sender === 'model' && (
                                    <div className="chat-msg-tags">
                                      {msg.latencyMs && <span>{msg.latencyMs} ms</span>}
                                      {msg.tokens?.totalTokens && (
                                        <span
                                          title={`Entrada: ${msg.tokens.inputTokens || 0} tok (${msg.tokens.cachedTokens || 0} en caché) · Salida: ${msg.tokens.outputTokens || 0} tok`}
                                        >
                                          {msg.tokens.inputTokens} in / {msg.tokens.outputTokens} out
                                        </span>
                                      )}
                                      {msg.tokens?.cachedTokens > 0 && (
                                        <span title="Tokens servidos desde el Context Cache con tarifa reducida">
                                          ⚡ {msg.tokens.cachedTokens} caché
                                          {msg.tokens.cacheSavingsCop > 0
                                            ? ` (-$${msg.tokens.cacheSavingsCop} COP)`
                                            : ''}
                                        </span>
                                      )}
                                      {msg.cost && <span className="cost-tag">{msg.cost}</span>}
                                    </div>
                                  )}
                                  <span className="chat-msg-time">{formatDateTime(msg.timestamp)}</span>
                                </div>

                                <div className="chat-msg-body">
                                  {msg.sender === 'user' ? (
                                    <p>{msg.text}</p>
                                  ) : (
                                    renderFormattedMessage(msg.text)
                                  )}
                                </div>

                                {msg.sender === 'model' && msg.costBreakdown && (
                                  <div
                                    style={{
                                      marginTop: '0.65rem',
                                      paddingTop: '0.55rem',
                                      borderTop: '1px dashed rgba(148, 163, 184, 0.22)',
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      gap: '0.6rem 1rem',
                                      fontSize: '0.74rem',
                                      color: '#94a3b8',
                                    }}
                                  >
                                    <span>
                                      🔢 <strong>Entrada:</strong> {msg.tokens?.inputTokens || 0} tok
                                      {msg.tokens?.cachedTokens > 0
                                        ? ` (${msg.tokens.cachedTokens} caché)`
                                        : ''}
                                    </span>
                                    <span>
                                      🧠 <strong>Salida:</strong> {msg.tokens?.outputTokens || 0} tok
                                      {msg.tokens?.reasoningTokens > 0
                                        ? ` (${msg.tokens.reasoningTokens} razonamiento)`
                                        : ''}
                                    </span>
                                    <span>
                                      💵 <strong>Costo Proveedor:</strong> $
                                      {Number(msg.costBreakdown.providerCostCop || 0).toFixed(2)} COP (
                                      ${Number(msg.costBreakdown.providerCostUsd || 0).toFixed(6)} USD)
                                    </span>
                                    <span>
                                      ⚙️ <strong>Operativo + Wompi:</strong> $
                                      {Number(msg.costBreakdown.operationalOverheadCop || 0).toFixed(2)}{' '}
                                      COP
                                    </span>
                                    <span>
                                      💳 <strong>Cobrado:</strong> $
                                      {msg.costBreakdown.userChargedCop} COP
                                    </span>
                                    <span
                                      style={{
                                        color:
                                          Number(msg.costBreakdown.netProfitCop) >= 0
                                            ? '#4ade80'
                                            : '#f87171',
                                        fontWeight: 700,
                                      }}
                                    >
                                      📈 Ganancia Neta:{' '}
                                      {Number(msg.costBreakdown.netProfitCop) >= 0 ? '+' : ''}$
                                      {Number(msg.costBreakdown.netProfitCop || 0).toFixed(2)} COP (
                                      {msg.costBreakdown.netMarginPct}%)
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {sendingChat && (
                            <div className="chat-message-row is-model is-loading">
                              <div className="chat-msg-avatar">
                                <span className="robot-msg-icon">🤖</span>
                              </div>
                              <div className="chat-msg-bubble">
                                <div className="chat-loading-dots">
                                  <span>Procesando con {selectedModel}</span>
                                  <span className="dot dot-1">.</span>
                                  <span className="dot dot-2">.</span>
                                  <span className="dot dot-3">.</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <div ref={chatMessagesEndRef} />
                        </div>
                      )}
                    </div>

                    {/* Barra de envío de preguntas */}
                    <form className="model-chat-input-bar" onSubmit={handleSendChatMessage}>
                      <textarea
                        className="model-chat-textarea"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onFocus={() => robot.onFieldFocus('chat')}
                        onBlur={() => robot.onFieldFocus(null)}
                        placeholder={`Haz una pregunta o continúa la conversación con ${selectedModel}... (Shift+Enter para salto de línea)`}
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChatMessage(e);
                          }
                        }}
                      />

                      <div className="model-chat-input-actions">
                        <div className="model-selector-group">
                          <span className="model-selector-label">Modelo activo:</span>
                          <select
                            className="model-workspace-select"
                            value={selectedModel}
                            onChange={(e) => handleSwitchModel(e.target.value)}
                            aria-label="Cambiar modelo activo"
                          >
                            {models.map((m) => (
                              <option key={m.slug} value={m.name}>
                                {m.name} · desde ${m.cost_cop} COP ({m.provider})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="model-chat-send-btn"
                          disabled={sendingChat || !chatInput.trim()}
                        >
                          {sendingChat ? 'Enviando...' : 'Enviar'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              );
            })()}

            {/* =================================================================
             * SECCIÓN 2: CONSUMO Y ESTADÍSTICAS (USAGE)
             * ================================================================= */}
            {activeTab === 'usage' && (
              <div className="dashboard-section-stack">
                <section className="saas-panel-card">
                  <div className="panel-header-row">
                    <div>
                      <h2 className="panel-title">Análisis detallado de consumo y créditos</h2>
                      <p className="panel-subtitle">
                        Filtra tu historial por periodo, modelo de inteligencia artificial y proveedor.
                      </p>
                    </div>

                    <div className="filter-controls-row">
                      <select
                        className="saas-select"
                        value={usageDateFilter}
                        onChange={(e) => setUsageDateFilter(e.target.value)}
                        aria-label="Filtrar por periodo"
                      >
                        <option value="7d">Últimos 7 días</option>
                        <option value="30d">Últimos 30 días</option>
                        <option value="all">Todo el historial</option>
                      </select>

                      <select
                        className="saas-select"
                        value={usageModelFilter}
                        onChange={(e) => setUsageModelFilter(e.target.value)}
                        aria-label="Filtrar por modelo"
                      >
                        <option value="all">Todos los modelos</option>
                        {models.map((m) => (
                          <option key={m.slug} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>

                      <select
                        className="saas-select"
                        value={usageProviderFilter}
                        onChange={(e) => setUsageProviderFilter(e.target.value)}
                        aria-label="Filtrar por proveedor"
                      >
                        <option value="all">Todos los proveedores</option>
                        {uniqueProviders.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Resumen numérico del filtro aplicado */}
                  <div className="usage-mini-kpis">
                    <div className="usage-mini-box">
                      <span>Gasto en selección</span>
                      <strong>{formatCop(usageStats.spend)}</strong>
                    </div>
                    <div className="usage-mini-box">
                      <span>Solicitudes realizadas</span>
                      <strong>{formatInt(usageStats.reqCount)}</strong>
                    </div>
                    <div className="usage-mini-box">
                      <span>Costo promedio / solicitud</span>
                      <strong>{formatCop(usageStats.avgCost)}</strong>
                    </div>
                    <div className="usage-mini-box">
                      <span>Tokens de entrada</span>
                      <strong>{formatInt(usageStats.inTok)}</strong>
                    </div>
                    <div className="usage-mini-box">
                      <span>Tokens de salida</span>
                      <strong>{formatInt(usageStats.outTok)}</strong>
                    </div>
                  </div>
                </section>

                {/* Gráficos comparativos: Distribución por Modelo y Consumo por Proveedor */}
                <div className="usage-two-col-grid">
                  <section className="saas-panel-card">
                    <h3 className="panel-title">Distribución de gastos por modelo de IA</h3>
                    <p className="panel-subtitle">Proporción del gasto total e intensidad de uso por modelo.</p>

                    {usageStats.byModel.length === 0 ? (
                      <p className="empty-inline-note">Sin registros para los filtros seleccionados.</p>
                    ) : (
                      <div className="comparative-bars-list">
                        {usageStats.byModel.map((item) => {
                          const pct = Math.max(
                            4,
                            Math.round((item.costCop / Math.max(1, usageStats.spend)) * 100)
                          );
                          return (
                            <div key={item.name} className="comp-bar-item">
                              <div className="comp-bar-top">
                                <div>
                                  <strong>{item.name}</strong>
                                  <span className="comp-bar-sub">{item.provider}</span>
                                </div>
                                <div className="comp-bar-numbers">
                                  <strong>{formatCop(item.costCop)}</strong>
                                  <span>
                                    {item.requests} pet. · {formatInt(item.tokens)} tok ({pct}%)
                                  </span>
                                </div>
                              </div>
                              <div className="comp-bar-track">
                                <div className="comp-bar-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="saas-panel-card">
                    <h3 className="panel-title">Consumo por proveedor</h3>
                    <p className="panel-subtitle">Comparativa de solicitudes, tokens y gasto por proveedor API.</p>

                    {usageStats.byProvider.length === 0 ? (
                      <p className="empty-inline-note">Sin registros para los filtros seleccionados.</p>
                    ) : (
                      <div className="comparative-bars-list">
                        {usageStats.byProvider.map((item) => {
                          const pct = Math.max(
                            4,
                            Math.round((item.costCop / Math.max(1, usageStats.spend)) * 100)
                          );
                          return (
                            <div key={item.provider} className="comp-bar-item">
                              <div className="comp-bar-top">
                                <strong>{item.provider}</strong>
                                <div className="comp-bar-numbers">
                                  <strong>{formatCop(item.costCop)}</strong>
                                  <span>
                                    {item.requests} solicitudes · {formatInt(item.tokens)} tokens
                                  </span>
                                </div>
                              </div>
                              <div className="comp-bar-track">
                                <div className="comp-bar-fill provider-fill" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>

                {/* Tabla de historial de consumo agrupado por fecha */}
                <section className="saas-panel-card">
                  <h3 className="panel-title">Historial de consumo por fecha</h3>
                  <div className="saas-table-wrap">
                    <table className="saas-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th className="num-cell">Solicitudes</th>
                          <th className="num-cell">Tokens Entrada</th>
                          <th className="num-cell">Tokens Salida</th>
                          <th className="num-cell">Total Tokens</th>
                          <th className="num-cell">Gasto del Día</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageStats.byDate.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="empty-table-cell">
                              No hay consumos registrados en este rango.
                            </td>
                          </tr>
                        ) : (
                          usageStats.byDate.map((row) => (
                            <tr key={row.date}>
                              <td className="mono-td">{row.date}</td>
                              <td className="num-cell mono-td">{formatInt(row.requests)}</td>
                              <td className="num-cell mono-td">{formatInt(row.inputTokens)}</td>
                              <td className="num-cell mono-td">{formatInt(row.outputTokens)}</td>
                              <td className="num-cell mono-td">
                                {formatInt(row.inputTokens + row.outputTokens)}
                              </td>
                              <td className="num-cell mono-td cost-td">{formatCop(row.costCop)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* =================================================================
             * SECCIÓN 3: ACTIVIDAD E HISTORIAL (ACTIVITY)
             * ================================================================= */}
            {activeTab === 'activity' && (
              <div className="dashboard-section-stack">
                <section className="saas-panel-card">
                  <div className="panel-header-row">
                    <div>
                      <h2 className="panel-title">Registro detallado de solicitudes</h2>
                      <p className="panel-subtitle">
                        Consulta, busca y ordena cada petición enviada a los modelos de IA.
                      </p>
                    </div>

                    <div className="filter-controls-row">
                      <input
                        type="search"
                        className="saas-search-input"
                        placeholder="Buscar por tarea, modelo o proveedor..."
                        value={activitySearch}
                        onChange={(e) => setActivitySearch(e.target.value)}
                        aria-label="Buscar en actividad"
                      />

                      <select
                        className="saas-select"
                        value={activityModel}
                        onChange={(e) => setActivityModel(e.target.value)}
                        aria-label="Filtrar por modelo"
                      >
                        <option value="all">Todos los modelos</option>
                        {models.map((m) => (
                          <option key={m.slug} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>

                      <select
                        className="saas-select"
                        value={activityProvider}
                        onChange={(e) => setActivityProvider(e.target.value)}
                        aria-label="Filtrar por proveedor"
                      >
                        <option value="all">Todos los proveedores</option>
                        {uniqueProviders.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>

                      <select
                        className="saas-select"
                        value={activitySort}
                        onChange={(e) => setActivitySort(e.target.value)}
                        aria-label="Ordenar registros"
                      >
                        <option value="date_desc">Más recientes primero</option>
                        <option value="date_asc">Más antiguos primero</option>
                        <option value="cost_desc">Mayor costo primero</option>
                        <option value="cost_asc">Menor costo primero</option>
                        <option value="tokens_desc">Mayor uso de tokens</option>
                      </select>
                    </div>
                  </div>

                  <div className="saas-table-wrap">
                    <table className="saas-table">
                      <thead>
                        <tr>
                          <th>Fecha y hora</th>
                          <th>Tarea / Dominio</th>
                          <th>Modelo utilizado</th>
                          <th>Proveedor</th>
                          <th className="num-cell">Tokens Entrada</th>
                          <th className="num-cell">Tokens Salida</th>
                          <th className="num-cell">Costo</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredActivityLogs.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="empty-table-cell">
                              No se encontraron solicitudes que coincidan con los filtros.
                            </td>
                          </tr>
                        ) : (
                          filteredActivityLogs.map((log) => (
                            <tr key={log.id}>
                              <td className="mono-td nowrap-td">{formatDateTime(log.created_at)}</td>
                              <td>
                                <div className="activity-prompt-cell">
                                  <strong>{log.prompt_summary}</strong>
                                  <span>{log.domain}</span>
                                </div>
                              </td>
                              <td>
                                <strong>{log.model_name}</strong>
                              </td>
                              <td>{log.provider}</td>
                              <td className="num-cell mono-td">{formatInt(log.input_tokens)}</td>
                              <td className="num-cell mono-td">{formatInt(log.output_tokens)}</td>
                              <td className="num-cell mono-td cost-td">{formatCop(log.cost_cop)}</td>
                              <td>
                                <div className="status-badges-cell">
                                  <span className="status-badge status-ok">
                                    {log.status === 'completed' ? 'Completado' : log.status}
                                  </span>
                                  {Boolean(log.is_demo) && (
                                    <span className="status-badge status-demo">Demo</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* =================================================================
             * SECCIÓN 4: MODELOS DISPONIBLES (MODELS)
             * ================================================================= */}
            {activeTab === 'models' && (
              <div className="dashboard-section-stack">
                <section className="saas-panel-card">
                  <div className="panel-header-row">
                    <div>
                      <h2 className="panel-title">Catálogo de modelos y tarifas en COP</h2>
                      <p className="panel-subtitle">
                        Consulta tarifas por tokens de entrada/salida, puntajes de benchmarks y disponibilidad en tiempo real.
                      </p>
                    </div>

                    <div className="filter-controls-row">
                      <input
                        type="search"
                        className="saas-search-input"
                        placeholder="Buscar modelo o proveedor..."
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        aria-label="Buscar modelo"
                      />

                      <select
                        className="saas-select"
                        value={modelTierFilter}
                        onChange={(e) => setModelTierFilter(e.target.value)}
                        aria-label="Filtrar por categoría de modelo"
                      >
                        <option value="all">Todas las categorías</option>
                        <option value="economy">Económicos (Tareas básicas)</option>
                        <option value="balanced">Equilibrados (Especialistas)</option>
                        <option value="frontier">Frontera (Alta complejidad)</option>
                        <option value="ultra">Ultra (Reservado &gt;90%)</option>
                      </select>
                    </div>
                  </div>

                  <div className="models-cards-grid">
                    {filteredModels.map((m) => (
                      <article key={m.slug} className="model-catalog-card">
                        <div className="model-card-header">
                          <div>
                            <h3 className="model-card-title">{m.name}</h3>
                            <span className="model-card-provider">{m.provider}</span>
                          </div>
                          <span
                            className={`availability-pill ${
                              m.availability === 'Piloto Activo'
                                ? 'is-pilot'
                                : m.availability === 'Alta Demanda'
                                ? 'is-warning'
                                : 'is-online'
                            }`}
                          >
                            {m.availability}
                          </span>
                        </div>

                        <p className="model-card-desc">{m.description}</p>

                        <div className="model-pricing-strip">
                          <div>
                            <span>Entrada / 1K tok</span>
                            <strong>${m.input_cost_1k_cop} COP</strong>
                          </div>
                          <div>
                            <span>Salida / 1K tok</span>
                            <strong>${m.output_cost_1k_cop} COP</strong>
                          </div>
                          <div>
                            <span>Consulta prom.</span>
                            <strong className="highlight-cop">${m.cost_cop} COP</strong>
                          </div>
                        </div>

                        <div className="model-benchmarks-mini">
                          <div className="bm-item">
                            <span>SWE-bench (Código)</span>
                            <strong>{m.swe_bench}%</strong>
                          </div>
                          <div className="bm-item">
                            <span>MATH-500 (Lógica)</span>
                            <strong>{m.math_500}%</strong>
                          </div>
                          <div className="bm-item">
                            <span>LongBench (PDFs)</span>
                            <strong>{m.long_bench}%</strong>
                          </div>
                          <div className="bm-item">
                            <span>Arena-Hard (Redacción)</span>
                            <strong>{m.arena_writing || m.mmlu_pro}%</strong>
                          </div>
                          <div className="bm-item">
                            <span>MMLU-Pro (General)</span>
                            <strong>{m.mmlu_pro}%</strong>
                          </div>
                        </div>

                        <div className="model-card-footer">
                          <span>Ventana: {m.context_window}</span>
                          <span>Latencia media: {m.latency_sec} s</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* =================================================================
             * SECCIÓN 5: TRANSACCIONES Y SALDO (BILLING / WOMPI)
             * ================================================================= */}
            {activeTab === 'billing' && (
              <div className="dashboard-section-stack">
                <div className="usage-two-col-grid">
                  {/* Panel de recarga de saldo prepago con Wompi */}
                  <section className="saas-panel-card">
                    <div className="wompi-header-row">
                      <div>
                        <h2 className="panel-title">Recargar billetera con Wompi Colombia</h2>
                        <p className="panel-subtitle">
                          Sin suscripciones ni cobros automáticos. Elige el monto a recargar y completa tu pago en la pasarela oficial de Wompi.
                        </p>
                      </div>
                    </div>

                    <div className="billing-balance-banner">
                      <span>Saldo actual disponible en tu billetera</span>
                      <strong>{formatCop(kpis.balanceCop)}</strong>
                    </div>

                    <form className="topup-form" onSubmit={handleTopupSubmit}>
                      <div className="topup-presets-row" role="group" aria-label="Montos rápidos de recarga">
                        {[5000, 15000, 30000, 50000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            className={`preset-amt-btn ${
                              !customAmountMode && Number(topupAmount) === amt ? 'active' : ''
                            }`}
                            onClick={() => {
                              setCustomAmountMode(false);
                              setTopupAmount(amt);
                            }}
                          >
                            {formatCop(amt)}
                          </button>
                        ))}
                        <button
                          type="button"
                          className={`preset-amt-btn ${
                            customAmountMode || ![5000, 15000, 30000, 50000].includes(Number(topupAmount))
                              ? 'active'
                              : ''
                          }`}
                          onClick={() => {
                            setCustomAmountMode(true);
                            setTimeout(() => {
                              topupInputRef.current?.focus();
                              topupInputRef.current?.select();
                            }, 20);
                          }}
                        >
                          Otro valor
                        </button>
                      </div>

                      <label className="saas-form-label">
                        <span>Monto a recargar (COP)</span>
                        <input
                          ref={topupInputRef}
                          type="number"
                          min={2000}
                          max={2000000}
                          step={1000}
                          className="saas-input"
                          placeholder="Escribe el monto en COP (mín. $2.000)"
                          value={topupAmount}
                          onChange={(e) => {
                            setTopupAmount(e.target.value);
                            const num = Number(e.target.value);
                            setCustomAmountMode(![5000, 15000, 30000, 50000].includes(num));
                          }}
                          required
                        />
                      </label>

                      <button type="submit" className="btn-primary-green" disabled={processingTopup}>
                        {processingTopup
                          ? 'Abriendo pasarela oficial de Wompi...'
                          : `Pagar en Wompi · ${formatCop(Number(topupAmount) || 0)}`}
                      </button>
                    </form>
                  </section>

                  {/* Resumen financiero de movimientos */}
                  <section className="saas-panel-card">
                    <h3 className="panel-title">Resumen contable de tu cuenta</h3>
                    <p className="panel-subtitle">
                      Transparencia total entre tus recargas abonadas por Wompi y los descuentos por token procesado.
                    </p>

                    <div className="billing-summary-list">
                      <div className="billing-summary-row">
                        <span>Saldo disponible hoy</span>
                        <strong className="positive-amount">{formatCop(kpis.balanceCop)}</strong>
                      </div>
                      <div className="billing-summary-row">
                        <span>Total recargado en tu cuenta (Wompi + Bono)</span>
                        <strong className="positive-amount">
                          {formatCop(kpis.totalTopupCop ?? kpis.balanceCop + kpis.totalSpendCop)}
                        </strong>
                      </div>
                      <div className="billing-summary-row">
                        <span>Total debitado por consumo de API</span>
                        <strong>{formatCop(kpis.totalSpendCop)}</strong>
                      </div>
                      <div className="billing-summary-row">
                        <span>Consumo acumulado este mes</span>
                        <strong>{formatCop(kpis.monthSpendCop)}</strong>
                      </div>
                      <div className="billing-summary-row">
                        <span>Presupuesto mensual configurado</span>
                        <strong>{formatCop(data?.wallet?.monthlyBudgetCop || 50000)}</strong>
                      </div>
                      <div className="billing-summary-row">
                        <span>Seguridad de pasarela</span>
                        <strong className="mono-td">Firma SHA-256 + Webhook Wompi</strong>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Tabla de historial de transacciones y recargas */}
                <section className="saas-panel-card">
                  <div className="panel-header-row">
                    <div>
                      <h3 className="panel-title">Historial de transacciones y recargas</h3>
                      <p className="panel-subtitle">
                        Cada orden de pago en Wompi o consumo de API queda registrado con fecha, estado y referencia única.
                      </p>
                    </div>

                    <div className="segmented-pills" role="group" aria-label="Filtrar tipo de transacción">
                      <button
                        type="button"
                        className={`seg-pill ${txTypeFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setTxTypeFilter('all')}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        className={`seg-pill ${txTypeFilter === 'topup' ? 'active' : ''}`}
                        onClick={() => setTxTypeFilter('topup')}
                      >
                        Solo recargas
                      </button>
                      <button
                        type="button"
                        className={`seg-pill ${txTypeFilter === 'usage_debit' ? 'active' : ''}`}
                        onClick={() => setTxTypeFilter('usage_debit')}
                      >
                        Débitos API
                      </button>
                    </div>
                  </div>

                  <div className="saas-table-wrap">
                    <table className="saas-table">
                      <thead>
                        <tr>
                          <th>Referencia</th>
                          <th>Fecha y hora</th>
                          <th>Tipo / Método</th>
                          <th>Descripción</th>
                          <th className="num-cell">Valor (COP)</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="empty-table-cell">
                              No hay transacciones registradas para este filtro.
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((tx) => {
                            const isPending = tx.status === 'pending';
                            const isDeclined = tx.status === 'declined';
                            return (
                              <tr key={tx.id}>
                                <td className="mono-td">{tx.reference}</td>
                                <td className="mono-td nowrap-td">{formatDateTime(tx.created_at)}</td>
                                <td>
                                  <strong>{tx.method}</strong>
                                </td>
                                <td>{tx.description}</td>
                                <td
                                  className={`num-cell mono-td ${
                                    isDeclined
                                      ? 'declined-amount'
                                      : tx.amount_cop >= 0
                                      ? 'positive-amount'
                                      : 'negative-amount'
                                  }`}
                                >
                                  {tx.amount_cop >= 0
                                    ? `+${formatCop(tx.amount_cop)}`
                                    : `-${formatCop(Math.abs(tx.amount_cop))}`}
                                </td>
                                <td>
                                  <div className="status-badges-cell">
                                    <span
                                      className={`status-badge ${
                                        tx.status === 'completed'
                                          ? 'status-ok'
                                          : isPending
                                          ? 'status-pending'
                                          : isDeclined
                                          ? 'status-revoked'
                                          : 'status-ok'
                                      }`}
                                    >
                                      {tx.status === 'completed'
                                        ? 'Aprobada'
                                        : isPending
                                        ? 'Pendiente Wompi'
                                        : isDeclined
                                        ? 'Declinada'
                                        : tx.status}
                                    </span>
                                    {isPending && (
                                      <button
                                        type="button"
                                        className="resume-tx-btn"
                                        onClick={() => handleResumePendingTx(tx)}
                                        disabled={processingTopup}
                                      >
                                        Verificar en Wompi
                                      </button>
                                    )}
                                    {Boolean(tx.is_demo) && (
                                      <span className="status-badge status-demo">Demo</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* =================================================================
             * SECCIÓN 6: CONFIGURACIÓN (SETTINGS)
             * ================================================================= */}
            {activeTab === 'settings' && (
              <div className="dashboard-section-stack">
                <section className="saas-panel-card">
                  <h2 className="panel-title">Configuración de la cuenta y preferencias de enrutamiento</h2>
                  <p className="panel-subtitle">
                    Administra tu perfil, el criterio predeterminado del clasificador IA y tus alertas de presupuesto en pesos colombianos.
                  </p>

                  <form className="settings-form-grid" onSubmit={handleSaveSettings}>
                    <label className="saas-form-label">
                      <span>Nombre completo</span>
                      <input
                        type="text"
                        className="saas-input"
                        value={settingsName}
                        onChange={(e) => setSettingsName(e.target.value)}
                        required
                      />
                    </label>

                    <label className="saas-form-label">
                      <span>Correo electrónico / Usuario registrado</span>
                      <input
                        type="text"
                        className="saas-input"
                        value={data?.user?.email || user?.email || ''}
                        disabled
                      />
                    </label>

                    <label className="saas-form-label">
                      <span>Criterio predeterminado del Enrutador IA</span>
                      <select
                        className="saas-select full-width"
                        value={settingsRouting}
                        onChange={(e) => setSettingsRouting(e.target.value)}
                      >
                        <option value="economy">Ahorro máximo (Priorizar tarifa mínima en COP)</option>
                        <option value="balanced">Equilibrado (Balance óptimo Benchmark / Costo)</option>
                        <option value="quality">Máxima capacidad (Priorizar mayor puntaje en Benchmark)</option>
                      </select>
                    </label>

                    <label className="saas-form-label">
                      <span>Meta de presupuesto mensual (COP)</span>
                      <input
                        type="number"
                        min={5000}
                        step={5000}
                        className="saas-input"
                        value={settingsBudget}
                        onChange={(e) => setSettingsBudget(e.target.value)}
                      />
                    </label>

                    <label className="saas-form-label">
                      <span>Alerta de saldo bajo (COP)</span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        className="saas-input"
                        value={settingsAlert}
                        onChange={(e) => setSettingsAlert(e.target.value)}
                      />
                    </label>

                    <div className="settings-submit-row">
                      <button type="submit" className="btn-primary-green compact-btn" disabled={savingSettings}>
                        {savingSettings ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
