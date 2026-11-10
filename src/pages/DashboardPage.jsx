import { useState } from 'react';
import PixelRobot from '../components/PixelRobot.jsx';
import { recommendModelForTask } from '../utils/recommendModel.js';

export default function DashboardPage({ user, onLogout, robot }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [recommendation, setRecommendation] = useState(null);

  const handleTaskAnalyze = (e) => {
    e.preventDefault();
    if (!taskInput.trim()) {
      robot.say('wave', 'Escribe primero tu tarea en el recuadro', 2400);
      return;
    }
    const rec = recommendModelForTask(taskInput);
    setRecommendation(rec);
    robot.say('celebrate', `Te recomiendo usar ${rec.model} (${rec.cost})`, 3400);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    onLogout();
  };

  return (
    <main className="template-viewport dashboard-viewport">
      {/* Barra superior: Título con traducción en hover + Menú hamburguesa */}
      <header className="dashboard-topbar">
        <h1
          className={`dashboard-welcome-title ${robot.titleHovered ? 'is-translated' : ''}`}
          onMouseEnter={() => robot.setTitleHovered(true)}
          onMouseLeave={() => robot.setTitleHovered(false)}
          title="Pasa el cursor para traducir"
        >
          {robot.titleHovered ? 'Bienvenido a IA Choose' : 'Welcome to IA Choose'}
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
                <strong>Usuario: {user.name}</strong>
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
            robotMood={robot.mood}
            onRobotClick={robot.handleClick}
            speechText={robot.speech}
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
              onFocus={() => robot.onFieldFocus('task')}
              onBlur={() => robot.onFieldFocus(null)}
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
