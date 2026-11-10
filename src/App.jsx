import React, { useState } from 'react';

/**
 * Robot Pixel-Art SVG con partes separadas para animaciones:
 * - Antena con pulso luminoso y ondas
 * - Cabeza con flotación (breathing) y giro
 * - Ojos reactivos (parpadeo, mirar al formulario/caja de texto, modo privacidad, espiar)
 * - Corazón de píxeles con latido brillante en el pecho
 * - Brazos articulados (saludo, cubrirse, pensar/analizar, celebración)
 */
function PixelRobot({ robotMood, onRobotClick, speechText }) {
  return (
    <div
      className={`robot-stage mood-${robotMood}`}
      onClick={onRobotClick}
      role="button"
      tabIndex={0}
      aria-label="Robot asistente de IA CHOOSE. Haz clic para animar."
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRobotClick();
        }
      }}
    >
      {speechText && (
        <div className="robot-speech-bubble" aria-live="polite">
          <span>{speechText}</span>
        </div>
      )}

      <svg
        className="pixel-robot-svg"
        viewBox="0 0 44 54"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {/* Sombra proyectada en el suelo */}
        <g className="robot-ground-shadow">
          <rect x="8" y="51" width="28" height="2" fill="rgba(5, 22, 18, 0.38)" />
          <rect x="11" y="50" width="22" height="1" fill="rgba(5, 22, 18, 0.22)" />
        </g>

        {/* ================= PIERNAS Y PIES (BASE) ================= */}
        <g className="robot-legs">
          {/* Pelvis / Cintura */}
          <rect x="14" y="37" width="16" height="3" fill="#080B09" />
          <rect x="16" y="37" width="12" height="2" fill="#1E2624" />
          <rect x="19" y="38" width="6" height="2" fill="#5CA800" />

          {/* Pierna Izquierda */}
          <rect x="11" y="39" width="9" height="11" fill="#080B09" />
          <rect x="12" y="40" width="7" height="3" fill="#63B800" />
          <rect x="13" y="40" width="5" height="2" fill="#99F018" />
          {/* Rodilla Izquierda */}
          <rect x="12" y="43" width="7" height="2" fill="#1F2725" />
          {/* Bota Izquierda */}
          <rect x="9" y="45" width="12" height="6" fill="#080B09" />
          <rect x="10" y="46" width="3" height="3" fill="#313B38" />
          <rect x="13" y="46" width="7" height="3" fill="#99F018" />
          <rect x="13" y="48" width="7" height="1" fill="#5CA800" />
          <rect x="8" y="49" width="13" height="2" fill="#080B09" />

          {/* Pierna Derecha */}
          <rect x="24" y="39" width="9" height="11" fill="#080B09" />
          <rect x="25" y="40" width="7" height="3" fill="#63B800" />
          <rect x="26" y="40" width="5" height="2" fill="#99F018" />
          {/* Rodilla Derecha */}
          <rect x="25" y="43" width="7" height="2" fill="#1F2725" />
          {/* Bota Derecha */}
          <rect x="23" y="45" width="12" height="6" fill="#080B09" />
          <rect x="31" y="46" width="3" height="3" fill="#313B38" />
          <rect x="24" y="46" width="7" height="3" fill="#99F018" />
          <rect x="24" y="48" width="7" height="1" fill="#5CA800" />
          <rect x="23" y="49" width="13" height="2" fill="#080B09" />
        </g>

        {/* ================= TORSO Y CORAZÓN ================= */}
        <g className="robot-torso-group">
          {/* Cuello */}
          <rect x="16" y="25" width="12" height="2" fill="#080B09" />
          <rect x="18" y="25" width="8" height="2" fill="#2A3431" />

          {/* Contorno Torso */}
          <rect x="12" y="27" width="20" height="10" fill="#080B09" />
          <rect x="13" y="28" width="18" height="8" fill="#63B800" />
          <rect x="14" y="28" width="16" height="6" fill="#99F018" />

          {/* Pantalla del Pecho */}
          <rect x="16" y="29" width="12" height="7" fill="#080B09" />

          {/* Corazón de Píxeles Brillante */}
          <g className="robot-chest-heart">
            <rect x="18" y="30" width="3" height="2" fill="#28FF3E" />
            <rect x="23" y="30" width="3" height="2" fill="#28FF3E" />
            <rect x="17" y="31" width="10" height="2" fill="#28FF3E" />
            <rect x="18" y="33" width="8" height="1" fill="#28FF3E" />
            <rect x="20" y="34" width="4" height="1" fill="#28FF3E" />
            <rect x="21" y="35" width="2" height="1" fill="#28FF3E" />
          </g>

          {/* ================= BRAZO IZQUIERDO ================= */}
          <g className="robot-arm-left">
            {/* Hombro */}
            <rect x="7" y="28" width="5" height="5" fill="#080B09" />
            <rect x="8" y="29" width="3" height="3" fill="#99F018" />
            {/* Antebrazo */}
            <rect x="6" y="33" width="6" height="6" fill="#080B09" />
            <rect x="7" y="34" width="4" height="4" fill="#82DE0C" />
            <rect x="7" y="37" width="4" height="1" fill="#5CA800" />
            {/* Mano / Pinza */}
            <rect x="6" y="39" width="6" height="4" fill="#080B09" />
            <rect x="7" y="39" width="4" height="3" fill="#2F3836" />
            <rect x="8" y="41" width="2" height="2" fill="#080B09" />
          </g>

          {/* ================= BRAZO DERECHO ================= */}
          <g className="robot-arm-right">
            {/* Hombro */}
            <rect x="32" y="28" width="5" height="5" fill="#080B09" />
            <rect x="33" y="29" width="3" height="3" fill="#99F018" />
            {/* Antebrazo */}
            <rect x="32" y="33" width="6" height="6" fill="#080B09" />
            <rect x="33" y="34" width="4" height="4" fill="#82DE0C" />
            <rect x="33" y="37" width="4" height="1" fill="#5CA800" />
            {/* Mano / Pinza */}
            <rect x="32" y="39" width="6" height="4" fill="#080B09" />
            <rect x="33" y="39" width="4" height="3" fill="#2F3836" />
            <rect x="34" y="41" width="2" height="2" fill="#080B09" />
          </g>

          {/* ================= CABEZA Y ANTENA ================= */}
          <g className="robot-head-group">
            {/* Ondas de señal de la antena */}
            <g className="antenna-waves">
              <rect x="17" y="2" width="1" height="3" fill="#28FF3E" opacity="0.7" />
              <rect x="26" y="2" width="1" height="3" fill="#28FF3E" opacity="0.7" />
              <rect x="15" y="1" width="1" height="5" fill="#99F018" opacity="0.45" />
              <rect x="28" y="1" width="1" height="5" fill="#99F018" opacity="0.45" />
            </g>

            {/* Antena Superior */}
            <g className="robot-antenna">
              <rect x="20" y="1" width="4" height="4" fill="#080B09" />
              <rect x="21" y="2" width="2" height="2" fill="#99F018" className="antenna-bulb" />
              <rect x="21" y="5" width="2" height="3" fill="#080B09" />
              <rect x="19" y="8" width="6" height="1" fill="#080B09" />
            </g>

            {/* Oreja Izquierda */}
            <rect x="5" y="14" width="4" height="8" fill="#080B09" />
            <rect x="6" y="15" width="2" height="6" fill="#252E2C" />
            <rect x="6" y="16" width="2" height="4" fill="#99F018" className="ear-light" />

            {/* Oreja Derecha */}
            <rect x="35" y="14" width="4" height="8" fill="#080B09" />
            <rect x="36" y="15" width="2" height="6" fill="#252E2C" />
            <rect x="36" y="16" width="2" height="4" fill="#99F018" className="ear-light" />

            {/* Casco Principal de la Cabeza */}
            <rect x="10" y="9" width="24" height="1" fill="#080B09" />
            <rect x="9" y="10" width="26" height="14" fill="#080B09" />
            <rect x="10" y="24" width="24" height="1" fill="#080B09" />

            {/* Relleno Verde Lima del Casco */}
            <rect x="11" y="10" width="22" height="1" fill="#B6FF3B" />
            <rect x="10" y="11" width="24" height="12" fill="#99F018" />
            {/* Sombreado inferior e izquierdo del casco */}
            <rect x="10" y="22" width="24" height="2" fill="#5CA800" />
            <rect x="10" y="12" width="2" height="10" fill="#70C904" />

            {/* Pantalla Negra del Rostro */}
            <rect x="13" y="12" width="18" height="1" fill="#080B09" />
            <rect x="12" y="13" width="20" height="8" fill="#080B09" />
            <rect x="13" y="21" width="18" height="1" fill="#080B09" />

            {/* Ojos de Píxeles */}
            <g className="robot-eyes">
              {/* Ojo Izquierdo */}
              <g className="eye-left">
                <rect x="15" y="15" width="4" height="4" fill="#28FF3E" />
                <rect x="16" y="14" width="2" height="6" fill="#28FF3E" />
                <rect x="16" y="15" width="2" height="2" fill="#9DFFAC" />
              </g>
              {/* Ojo Derecho */}
              <g className="eye-right">
                <rect x="25" y="15" width="4" height="4" fill="#28FF3E" />
                <rect x="26" y="14" width="2" height="6" fill="#28FF3E" />
                <rect x="26" y="15" width="2" height="2" fill="#9DFFAC" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * Recomendador rápido de modelo según la tarea escrita en el Dashboard
 */
function recommendModelForTask(text) {
  const lower = text.toLowerCase();
  if (
    lower.includes('código') ||
    lower.includes('codigo') ||
    lower.includes('python') ||
    lower.includes('javascript') ||
    lower.includes('programar') ||
    lower.includes('bug')
  ) {
    return {
      model: 'Claude 3.7 Sonnet',
      reason: 'Óptimo para arquitectura de software, depuración y razonamiento lógico.',
      cost: '$58 COP'
    };
  }
  if (
    lower.includes('tesis') ||
    lower.includes('pdf') ||
    lower.includes('artículo') ||
    lower.includes('articulo') ||
    lower.includes('ensayo') ||
    lower.includes('lectura')
  ) {
    return {
      model: 'Moonshot Kimi K2',
      reason: 'Ideal para análisis de documentos largos y retención de contexto académico.',
      cost: '$18 COP'
    };
  }
  if (
    lower.includes('matemática') ||
    lower.includes('calculo') ||
    lower.includes('algoritmo') ||
    lower.includes('física')
  ) {
    return {
      model: 'DeepSeek R1',
      reason: 'Especializado en verificación formal y resolución paso a paso.',
      cost: '$14 COP'
    };
  }
  return {
    model: 'Gemini 2.5 Flash',
    reason: 'Respuesta ultrarrápida y tarifa mínima para consultas generales y resúmenes.',
    cost: '$9 COP'
  };
}

export default function App() {
  // Estado de sesión: false = pantalla Login/Registro, true = Dashboard
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('admin');

  // 'login' (Ingresar) | 'signup' (Crear Cuenta)
  const [authMode, setAuthMode] = useState('login');

  // Visibilidad de contraseña
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Campos de Login / Registro
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados del Dashboard
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [recommendation, setRecommendation] = useState(null);

  // Estados de animación del robot
  const [focusedField, setFocusedField] = useState(null);
  const [manualMood, setManualMood] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const getRobotMood = () => {
    if (manualMood) return manualMood;
    if (isTitleHovered) return 'wave';
    if (focusedField === 'password' || focusedField === 'confirmPassword') {
      const isShowing =
        (focusedField === 'password' && showPassword) ||
        (focusedField === 'confirmPassword' && showConfirmPassword);
      return isShowing ? 'peek' : 'privacy';
    }
    if (focusedField === 'name' || focusedField === 'email' || focusedField === 'task') {
      return 'look';
    }
    return 'idle';
  };

  const getRobotSpeech = () => {
    if (statusMessage) return statusMessage;
    if (isTitleHovered) return '¡Bienvenido a IA Choose!';
    const mood = getRobotMood();
    if (mood === 'privacy') return '¡No miro tu clave!';
    if (mood === 'peek') return '¡Ups, clave visible!';
    if (mood === 'look') {
      return isAuthenticated
        ? 'Analizando tu tarea para elegir el mejor modelo...'
        : '¡Te leo atento!';
    }
    if (mood === 'wave') return '¡Hola! Soy el bot de IA CHOOSE';
    if (mood === 'celebrate') return '¡Genial! Todo listo';
    return null;
  };

  const triggerRobotAction = (mood, message, duration = 2800) => {
    setManualMood(mood);
    setStatusMessage(message);
    setTimeout(() => {
      setManualMood(null);
      setStatusMessage(null);
    }, duration);
  };

  const handleModeSwitch = (mode) => {
    setAuthMode(mode);
    setStatusMessage(null);
    triggerRobotAction(
      'wave',
      mode === 'signup' ? '¡Crea tu cuenta en segundos!' : 'Ingresa con admin y clave 123',
      2200
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (authMode === 'signup') {
      if (password !== confirmPassword) {
        triggerRobotAction('peek', 'Las contraseñas no coinciden', 3000);
        return;
      }
      setCurrentUser(fullName.trim() || email.trim() || 'admin');
      setIsAuthenticated(true);
      setFocusedField(null);
      triggerRobotAction('celebrate', '¡Cuenta creada! Bienvenido a IA Choose', 2800);
      return;
    }

    // Validación de usuario de prueba: admin / 123
    const cleanUser = email.trim().toLowerCase();
    if (cleanUser === 'admin' && password === '123') {
      setCurrentUser('admin');
      setIsAuthenticated(true);
      setFocusedField(null);
      triggerRobotAction('celebrate', '¡Bienvenido al Dashboard, admin!', 2800);
    } else {
      triggerRobotAction('peek', 'Usuario de prueba: admin | Contraseña: 123', 3400);
    }
  };

  const handleGoogleContinue = () => {
    setCurrentUser('admin');
    setIsAuthenticated(true);
    setFocusedField(null);
    triggerRobotAction('celebrate', '¡Sesión iniciada con Google!', 2600);
  };

  const handleRobotClick = () => {
    if (isAuthenticated) {
      triggerRobotAction('wave', 'Escribe tu tarea en el panel y te recomendaré la mejor IA', 2800);
    } else {
      triggerRobotAction('wave', 'Usa el usuario admin y contraseña 123 para entrar', 2800);
    }
  };

  const handleTaskAnalyze = (e) => {
    e.preventDefault();
    if (!taskInput.trim()) {
      triggerRobotAction('wave', 'Escribe primero tu tarea en el recuadro', 2400);
      return;
    }
    const rec = recommendModelForTask(taskInput);
    setRecommendation(rec);
    triggerRobotAction('celebrate', `Te recomiendo usar ${rec.model} (${rec.cost})`, 3400);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    setIsAuthenticated(false);
    setRecommendation(null);
    setTaskInput('');
    triggerRobotAction('wave', 'Sesión cerrada correctamente', 2200);
  };

  const currentMood = getRobotMood();

  /* =====================================================================
   * VISTA 2: DASHBOARD (AL INICIAR SESIÓN) FIEL A LA PLANTILLA SUBIDA
   * ===================================================================== */
  if (isAuthenticated) {
    return (
      <main className="template-viewport dashboard-viewport">
        {/* Barra superior: Título con traducción en hover + Menú hamburguesa */}
        <header className="dashboard-topbar">
          <h1
            className={`dashboard-welcome-title ${isTitleHovered ? 'is-translated' : ''}`}
            onMouseEnter={() => setIsTitleHovered(true)}
            onMouseLeave={() => setIsTitleHovered(false)}
            title="Pasa el cursor para traducir"
          >
            {isTitleHovered ? 'Bienvenido a IA Choose' : 'Welcome to IA Choose'}
          </h1>

          <div className="dashboard-menu-wrapper">
            <button
              type="button"
              className="hamburger-btn"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Abrir menú de usuario"
              aria-expanded={menuOpen}
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </button>

            {menuOpen && (
              <div className="dashboard-dropdown-menu" role="menu">
                <div className="dropdown-user-info">
                  <strong>Usuario: {currentUser}</strong>
                  <span>Saldo prepago: $15.000 COP</span>
                </div>
                <button
                  type="button"
                  className="dropdown-item-btn"
                  onClick={() => {
                    setTaskInput('');
                    setRecommendation(null);
                    setMenuOpen(false);
                  }}
                >
                  Nueva consulta
                </button>
                <button
                  type="button"
                  className="dropdown-item-btn logout-btn"
                  onClick={handleLogout}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Cuerpo del Dashboard: Robot animado (abajo-izquierda) + Recuadro oscuro de tarea */}
        <div className="dashboard-stage-grid">
          <section className="dashboard-robot-zone" aria-label="Robot asistente IA CHOOSE">
            <PixelRobot
              robotMood={currentMood}
              onRobotClick={handleRobotClick}
              speechText={getRobotSpeech()}
            />
          </section>

          <section className="dashboard-prompt-zone" aria-label="Clasificador de tareas">
            <form className="dark-task-box" onSubmit={handleTaskAnalyze}>
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
                onFocus={() => setFocusedField('task')}
                onBlur={() => setFocusedField(null)}
                placeholder="Ej.: Analizar un PDF de tesis de 40 páginas, depurar un script en Python o resumir artículos en formato APA..."
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
                      <strong>Modelo recomendado: {recommendation.model}</strong>
                      <span className="rec-cost">{recommendation.cost}</span>
                    </div>
                    <p>{recommendation.reason}</p>
                  </div>
                ) : (
                  <span className="task-hint-text">
                    Presiona Enter o el botón para analizar tu tarea
                  </span>
                )}

                <button type="submit" className="task-analyze-btn">
                  Recomendar modelo
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }

  /* =====================================================================
   * VISTA 1: LOGIN E INGRESO / CREAR CUENTA
   * ===================================================================== */
  return (
    <main className="template-viewport">
      {/* Marca superior izquierda igual a la plantilla */}
      <header className="top-brand-bar">
        <a
          href="#top"
          className="brand-title"
          onClick={(e) => {
            e.preventDefault();
            handleRobotClick();
          }}
        >
          IA CHOOSE
        </a>
      </header>

      <div className="template-content-grid">
        {/* ZONA IZQUIERDA: ROBOT PIXEL ART ANIMADO */}
        <section className="robot-column" aria-label="Asistente animado IA CHOOSE">
          <PixelRobot
            robotMood={currentMood}
            onRobotClick={handleRobotClick}
            speechText={getRobotSpeech()}
          />
        </section>

        {/* ZONA DERECHA: TARJETA TRASLÚCIDA DE CREAR CUENTA E INGRESAR */}
        <section className="auth-card-column" aria-label="Formulario de cuenta">
          <div className="glass-auth-card">
            {/* Selector de pestaña Crear Cuenta / Ingresar */}
            <div className="auth-tabs" role="tablist" aria-label="Cambiar entre Crear Cuenta e Ingresar">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'signup'}
                className={`auth-tab-btn ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => handleModeSwitch('signup')}
              >
                Crear Cuenta
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === 'login'}
                className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => handleModeSwitch('login')}
              >
                Ingresar
              </button>
            </div>

            {authMode === 'signup' ? (
              <div className="auth-view-content" key="signup-view">
                <h1 className="card-heading">Crear una Nueva Cuenta</h1>
                <p className="card-subheading">Únete a IA CHOOSE hoy</p>

                <form className="minimal-auth-form" onSubmit={handleSubmit}>
                  <div className="minimal-field">
                    <label htmlFor="signup-name">Nombre Completo</label>
                    <div className="minimal-input-row">
                      <input
                        id="signup-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        required
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="minimal-field">
                    <label htmlFor="signup-email">Correo Electrónico</label>
                    <div className="minimal-input-row">
                      <input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="minimal-field">
                    <label htmlFor="signup-password">Contraseña</label>
                    <div className="minimal-input-row">
                      <input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="eye-icon-btn"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="minimal-field">
                    <label htmlFor="signup-confirm-password">Confirmar Contraseña</label>
                    <div className="minimal-input-row">
                      <input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField(null)}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="eye-icon-btn"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                      >
                        {showConfirmPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="form-actions-stack">
                    <button type="submit" className="btn-primary-green">
                      Crear Cuenta
                    </button>

                    <button
                      type="button"
                      className="btn-white-google"
                      onClick={handleGoogleContinue}
                    >
                      CONTINUAR CON GOOGLE
                    </button>
                  </div>
                </form>

                <p className="switch-auth-prompt">
                  ¿Ya tienes una cuenta?{' '}
                  <button
                    type="button"
                    className="switch-auth-link"
                    onClick={() => handleModeSwitch('login')}
                  >
                    Ingresar aquí
                  </button>
                </p>
              </div>
            ) : (
              <div className="auth-view-content" key="login-view">
                <h1 className="card-heading">Ingresar a tu Cuenta</h1>
                <p className="card-subheading">Usuario de prueba: admin / Clave: 123</p>

                <form className="minimal-auth-form" onSubmit={handleSubmit}>
                  <div className="minimal-field">
                    <label htmlFor="login-email">Usuario o Correo Electrónico</label>
                    <div className="minimal-input-row">
                      <input
                        id="login-email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        required
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div className="minimal-field">
                    <label htmlFor="login-password">Contraseña</label>
                    <div className="minimal-input-row">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="eye-icon-btn"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showPassword ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="login-extra-row">
                    <button
                      type="button"
                      className="forgot-pass-link"
                      onClick={() =>
                        triggerRobotAction(
                          'wave',
                          'Te enviaremos un enlace de recuperación a tu correo',
                          3200
                        )
                      }
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <div className="form-actions-stack">
                    <button type="submit" className="btn-primary-green">
                      Ingresar
                    </button>

                    <button
                      type="button"
                      className="btn-white-google"
                      onClick={handleGoogleContinue}
                    >
                      CONTINUAR CON GOOGLE
                    </button>
                  </div>
                </form>

                <p className="switch-auth-prompt">
                  ¿No tienes una cuenta?{' '}
                  <button
                    type="button"
                    className="switch-auth-link"
                    onClick={() => handleModeSwitch('signup')}
                  >
                    Crear Cuenta
                  </button>
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
