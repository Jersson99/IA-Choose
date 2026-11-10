import { useState } from 'react';
import PixelRobot from '../components/PixelRobot.jsx';
import LoginForm from '../components/LoginForm.jsx';
import SignupForm from '../components/SignupForm.jsx';

export default function AuthPage({ onLogin, onRegister, onGoogleLogin, robot }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const switchMode = (next) => {
    setMode(next);
    setError('');
    robot.say('wave', next === 'signup' ? '¡Crea tu cuenta en segundos!' : '¡Qué bueno verte de nuevo!', 2200);
  };

  // Ejecuta la acción de ingreso/registro y reacciona con el robot y el mensaje de error
  const run = async (action, successMessage) => {
    setError('');
    setSubmitting(true);
    try {
      const user = await action();
      robot.onFieldFocus(null);
      robot.say('celebrate', successMessage(user));
    } catch (err) {
      setError(err.message);
      robot.say('peek', err.message, 3400);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = ({ email, password }) =>
    run(
      () => onLogin(email, password),
      (user) => `¡Bienvenido de nuevo, ${user.name.split(' ')[0]}!`
    );

  const handleSignup = ({ name, email, password, confirmPassword }) => {
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      robot.say('peek', 'Las contraseñas no coinciden', 3000);
      return;
    }
    run(() => onRegister(name, email, password), () => '¡Cuenta creada! Bienvenido a IA Choose');
  };

  const handleGoogle = (credential) =>
    run(
      () => onGoogleLogin(credential),
      (user) => `¡Bienvenido, ${user.name.split(' ')[0]}!`
    );

  const handleGoogleUnavailable = () =>
    robot.say('wave', 'Falta configurar el acceso con Google (GOOGLE_CLIENT_ID)', 3400);

  const handleForgot = () =>
    robot.say('wave', 'La recuperación de contraseña estará disponible pronto', 3000);

  const formProps = {
    onSwitch: switchMode,
    onGoogle: handleGoogle,
    onGoogleUnavailable: handleGoogleUnavailable,
    onFocusChange: robot.onFieldFocus,
    error,
    submitting,
  };

  return (
    <main className="template-viewport">
      <header className="top-brand-bar">
        <a
          href="#top"
          className="brand-title"
          onClick={(e) => {
            e.preventDefault();
            robot.handleClick();
          }}
        >
          IA CHOOSE
        </a>
      </header>

      <div className="template-content-grid">
        <section className="robot-column" aria-label="Asistente animado IA CHOOSE">
          <PixelRobot robotMood={robot.mood} onRobotClick={robot.handleClick} speechText={robot.speech} />
        </section>

        <section className="auth-card-column" aria-label="Formulario de cuenta">
          <div className="glass-auth-card">
            <div className="auth-tabs" role="tablist" aria-label="Cambiar entre Crear Cuenta e Ingresar">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => switchMode('signup')}
              >
                Crear Cuenta
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Ingresar
              </button>
            </div>

            {mode === 'signup' ? (
              <SignupForm onSubmit={handleSignup} {...formProps} />
            ) : (
              <LoginForm onSubmit={handleLogin} onForgot={handleForgot} {...formProps} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
