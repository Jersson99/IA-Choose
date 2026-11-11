import React, { useEffect, useMemo, useState } from 'react';
import PixelRobot from '../components/PixelRobot.jsx';
import {
  IconActivity,
  IconApiKeys,
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
  { id: 'usage', label: 'Consumo y estadísticas', sub: 'Usage', icon: IconUsage },
  { id: 'activity', label: 'Actividad e historial', sub: 'Activity', icon: IconActivity },
  { id: 'models', label: 'Modelos', sub: 'Models', icon: IconModels },
  { id: 'billing', label: 'Transacciones y saldo', sub: 'Billing', icon: IconBilling },
  { id: 'apikeys', label: 'Claves API', sub: 'API Keys', icon: IconApiKeys },
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

  // Estado del despachador de tareas en Overview
  const [taskInput, setTaskInput] = useState('');
  const [recommendation, setRecommendation] = useState(null);
  const [executingTask, setExecutingTask] = useState(false);

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

  // Estados de la sección Billing (Recargas y transacciones)
  const [topupAmount, setTopupAmount] = useState(15000);
  const [topupMethod, setTopupMethod] = useState('Nequi');
  const [txTypeFilter, setTxTypeFilter] = useState('all'); // 'all' | 'topup' | 'usage_debit'
  const [processingTopup, setProcessingTopup] = useState(false);

  // Estados de la sección API Keys
  const [newKeyName, setNewKeyName] = useState('');
  const [justCreatedSecret, setJustCreatedSecret] = useState(null);
  const [creatingKey, setCreatingKey] = useState(false);

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
  }, []);

  const showToast = (title, detail) => {
    setFeedbackBanner({ title, detail });
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.title === title ? null : prev));
    }, 4500);
  };

  // Ejecutar tarea con el Enrutador entrenado y registrar el consumo en la cuenta del usuario
  const handleTaskAnalyze = async (e) => {
    e.preventDefault();
    const prompt = taskInput.trim();
    if (!prompt) {
      robot.say('wave', 'Escribe primero tu tarea en el recuadro', 2400);
      return;
    }

    setExecutingTask(true);
    try {
      const result = await dashboardApi.executeTask(prompt);
      setRecommendation(result.recommendation);
      setData(result.dashboard);
      robot.say(
        'celebrate',
        `IA elegida: ${result.recommendation.model} (${result.recommendation.cost}) · Complejidad ${result.recommendation.analysis.complexityLevel}`,
        4000
      );
    } catch (err) {
      showToast('Aviso al procesar tarea', err.message);
      robot.say('peek', err.message, 3400);
    } finally {
      setExecutingTask(false);
    }
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

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    setProcessingTopup(true);
    try {
      const updated = await dashboardApi.topUp(topupAmount, topupMethod);
      setData(updated);
      showToast(
        'Recarga acreditada exitosamente',
        `Se abonaron ${formatCop(topupAmount)} mediante ${topupMethod} a tu saldo disponible.`
      );
      robot.say('celebrate', `¡Saldo recargado con ${formatCop(topupAmount)} vía ${topupMethod}!`, 3200);
    } catch (err) {
      showToast('Error en la recarga', err.message);
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
      setData(result.dashboard);
      setNewKeyName('');
      showToast('Clave API generada', 'Copia tu clave ahora; por seguridad no volverá a mostrarse completa.');
    } catch (err) {
      showToast('Error al crear clave', err.message);
    } finally {
      setCreatingKey(false);
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

        {/* Tarjeta rápida de Saldo en el menú lateral */}
        <div className="sidebar-wallet-summary">
          <span className="wallet-mini-label">SALDO DISPONIBLE</span>
          <strong className="wallet-mini-amount">{formatCop(kpis.balanceCop)}</strong>
          <button
            type="button"
            className="wallet-mini-topup-btn"
            onClick={() => {
              setActiveTab('billing');
              setMobileNavOpen(false);
            }}
          >
            + Recargar con Nequi / PSE
          </button>
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
            {data?.hasDemoData ? (
              <button
                type="button"
                className="demo-status-pill is-active"
                onClick={() => handleToggleDemoData('clear')}
                title="Quitar los registros de demostración y ver solo tus consultas reales"
              >
                <span>Datos de prueba activos · Quitar demo</span>
              </button>
            ) : (
              <button
                type="button"
                className="demo-status-pill"
                onClick={() => handleToggleDemoData('load')}
                title="Cargar actividad de ejemplo claramente identificada para probar gráficos y filtros"
              >
                <span>Cargar datos de prueba (Demo)</span>
              </button>
            )}

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
                        Envía tu primera consulta en el enrutador de abajo para registrar actividad real, o carga datos de demostración claramente etiquetados para explorar los gráficos e informes.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary-green compact-btn"
                      onClick={() => handleToggleDemoData('load')}
                    >
                      Cargar datos de prueba (Demo)
                    </button>
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

                {/* Enrutador Interactivo en vivo + Robot Pixel-Art (Preservado e integrado con SQLite) */}
                <section className="overview-router-grid" aria-label="Enrutador inteligente de tareas y asistente">
                  <div className="overview-robot-card">
                    <PixelRobot
                      robotMood={robot.mood}
                      onRobotClick={robot.handleClick}
                      speechText={robot.speech}
                    />
                  </div>

                  <form className="dark-task-box overview-task-box" onSubmit={handleTaskAnalyze}>
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
                      placeholder="Escribe una tarea para enrutarla según Benchmarks (ej.: 'Haz un hola mundo en Python' vs. 'Refactorizar microservicio en Python con concurrencia'). Se registrará en tu historial real..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleTaskAnalyze(e);
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
                          Cada consulta evalúa complejidad, elige la IA más rentable y actualiza tus estadísticas
                        </span>
                      )}

                      <button type="submit" className="task-analyze-btn" disabled={executingTask}>
                        {executingTask ? 'Enrutando...' : 'Recomendar y ejecutar'}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}

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
                        value={activityOrigin}
                        onChange={(e) => setActivityOrigin(e.target.value)}
                        aria-label="Filtrar por origen de datos"
                      >
                        <option value="all">Todos los registros</option>
                        <option value="real">Solo actividad real</option>
                        <option value="demo">Solo datos de prueba</option>
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
             * SECCIÓN 5: TRANSACCIONES Y SALDO (BILLING)
             * ================================================================= */}
            {activeTab === 'billing' && (
              <div className="dashboard-section-stack">
                <div className="usage-two-col-grid">
                  {/* Panel de recarga de saldo prepago */}
                  <section className="saas-panel-card">
                    <h2 className="panel-title">Recargar saldo prepago en pesos</h2>
                    <p className="panel-subtitle">
                      Sin suscripciones ni cobros automáticos. Recarga únicamente lo que necesites mediante Nequi o PSE.
                    </p>

                    <div className="billing-balance-banner">
                      <span>Saldo actual disponible</span>
                      <strong>{formatCop(kpis.balanceCop)}</strong>
                    </div>

                    <form className="topup-form" onSubmit={handleTopupSubmit}>
                      <div className="topup-presets-row" role="group" aria-label="Montos rápidos de recarga">
                        {[5000, 15000, 30000, 50000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            className={`preset-amt-btn ${Number(topupAmount) === amt ? 'active' : ''}`}
                            onClick={() => setTopupAmount(amt)}
                          >
                            {formatCop(amt)}
                          </button>
                        ))}
                      </div>

                      <div className="topup-fields-grid">
                        <label className="saas-form-label">
                          <span>Monto a recargar (COP)</span>
                          <input
                            type="number"
                            min={2000}
                            max={2000000}
                            step={1000}
                            className="saas-input"
                            value={topupAmount}
                            onChange={(e) => setTopupAmount(e.target.value)}
                            required
                          />
                        </label>

                        <label className="saas-form-label">
                          <span>Método de pago local</span>
                          <select
                            className="saas-select full-width"
                            value={topupMethod}
                            onChange={(e) => setTopupMethod(e.target.value)}
                          >
                            <option value="Nequi">Nequi (Transferencia inmediata)</option>
                            <option value="PSE">PSE (Débito bancario nacional)</option>
                          </select>
                        </label>
                      </div>

                      <button type="submit" className="btn-primary-green" disabled={processingTopup}>
                        {processingTopup
                          ? 'Procesando recarga...'
                          : `Agregar ${formatCop(topupAmount)} con ${topupMethod}`}
                      </button>
                    </form>
                  </section>

                  {/* Resumen financiero de movimientos */}
                  <section className="saas-panel-card">
                    <h3 className="panel-title">Resumen contable de tu cuenta</h3>
                    <p className="panel-subtitle">
                      Transparencia total entre tus recargas abonadas y los descuentos por token procesado.
                    </p>

                    <div className="billing-summary-list">
                      <div className="billing-summary-row">
                        <span>Saldo disponible hoy</span>
                        <strong className="positive-amount">{formatCop(kpis.balanceCop)}</strong>
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
                    </div>
                  </section>
                </div>

                {/* Tabla de historial de transacciones y recargas */}
                <section className="saas-panel-card">
                  <div className="panel-header-row">
                    <div>
                      <h3 className="panel-title">Historial de transacciones y recargas</h3>
                      <p className="panel-subtitle">
                        Cada movimiento de recarga o consumo de API queda registrado con fecha y referencia.
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
                          filteredTransactions.map((tx) => (
                            <tr key={tx.id}>
                              <td className="mono-td">{tx.reference}</td>
                              <td className="mono-td nowrap-td">{formatDateTime(tx.created_at)}</td>
                              <td>
                                <strong>{tx.method}</strong>
                              </td>
                              <td>{tx.description}</td>
                              <td
                                className={`num-cell mono-td ${
                                  tx.amount_cop >= 0 ? 'positive-amount' : 'negative-amount'
                                }`}
                              >
                                {tx.amount_cop >= 0
                                  ? `+${formatCop(tx.amount_cop)}`
                                  : `-${formatCop(Math.abs(tx.amount_cop))}`}
                              </td>
                              <td>
                                <div className="status-badges-cell">
                                  <span className="status-badge status-ok">
                                    {tx.status === 'completed' ? 'Completada' : tx.status}
                                  </span>
                                  {Boolean(tx.is_demo) && (
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
             * SECCIÓN 6: CLAVES API (API KEYS)
             * ================================================================= */}
            {activeTab === 'apikeys' && (
              <div className="dashboard-section-stack">
                <section className="saas-panel-card">
                  <h2 className="panel-title">Gestión de Claves API</h2>
                  <p className="panel-subtitle">
                    Crea claves para conectar tus scripts o proyectos académicos al enrutador multimodelo de IA CHOOSE. Por seguridad, solo almacenamos el hash SHA-256 de cada clave.
                  </p>

                  <form className="api-key-create-bar" onSubmit={handleCreateApiKey}>
                    <input
                      type="text"
                      className="saas-input"
                      placeholder="Nombre de la clave (ej. Proyecto Tesis, Script Python Local)..."
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn-primary-green compact-btn" disabled={creatingKey}>
                      {creatingKey ? 'Generando...' : '+ Crear nueva clave API'}
                    </button>
                  </form>

                  {justCreatedSecret && (
                    <div className="secret-key-reveal-box" role="alert">
                      <div>
                        <strong>Copia tu nueva clave API ahora (solo se muestra una vez):</strong>
                        <code className="secret-code-pill">{justCreatedSecret}</code>
                      </div>
                      <div className="secret-actions">
                        <button
                          type="button"
                          className="seg-pill active"
                          onClick={() => {
                            navigator.clipboard?.writeText(justCreatedSecret);
                            showToast('Clave copiada', 'La clave API se copió al portapapeles.');
                          }}
                        >
                          Copiar clave
                        </button>
                        <button
                          type="button"
                          className="seg-pill"
                          onClick={() => setJustCreatedSecret(null)}
                        >
                          Ocultar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="saas-table-wrap">
                    <table className="saas-table">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Clave (Enmascarada)</th>
                          <th>Fecha de creación</th>
                          <th>Último uso</th>
                          <th>Estado</th>
                          <th className="num-cell">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="empty-table-cell">
                              Aún no has creado claves API en tu cuenta.
                            </td>
                          </tr>
                        ) : (
                          apiKeys.map((k) => (
                            <tr key={k.id}>
                              <td>
                                <strong>{k.name}</strong>
                              </td>
                              <td className="mono-td">{k.key_prefix}</td>
                              <td className="mono-td">{formatDateTime(k.created_at)}</td>
                              <td className="mono-td">
                                {k.last_used_at ? formatDateTime(k.last_used_at) : 'Sin uso aún'}
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${
                                    k.status === 'active' ? 'status-ok' : 'status-revoked'
                                  }`}
                                >
                                  {k.status === 'active' ? 'Activa' : 'Revocada'}
                                </span>
                              </td>
                              <td className="num-cell">
                                {k.status === 'active' ? (
                                  <button
                                    type="button"
                                    className="revoke-key-btn"
                                    onClick={() => handleRevokeApiKey(k.id)}
                                  >
                                    Revocar
                                  </button>
                                ) : (
                                  <span className="muted-dash">—</span>
                                )}
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
             * SECCIÓN 7: CONFIGURACIÓN (SETTINGS)
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
