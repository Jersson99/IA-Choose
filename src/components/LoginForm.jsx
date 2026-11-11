import { useState } from 'react';
import FormField from './FormField.jsx';
import GoogleButton from './GoogleButton.jsx';

export default function LoginForm({
  onSubmit,
  onSwitch,
  onGoogle,
  onGoogleUnavailable,
  onForgot,
  onFocusChange,
  error,
  submitting,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ email, password });
  };

  return (
    <div className="auth-view-content" key="login-view">
      <h1 className="card-heading">Ingresar a tu Cuenta</h1>
      <p className="card-subheading">Bienvenido de nuevo a IA CHOOSE</p>

      <form className="minimal-auth-form" onSubmit={handleSubmit}>
        <FormField
          id="login-email"
          name="email"
          type="text"
          label="Correo Electrónico o Usuario"
          value={email}
          onChange={setEmail}
          onFocusChange={onFocusChange}
          autoComplete="username"
        />
        <FormField
          id="login-password"
          name="password"
          type="password"
          label="Contraseña"
          value={password}
          onChange={setPassword}
          onFocusChange={onFocusChange}
          autoComplete="current-password"
        />

        <div className="login-extra-row">
          <button type="button" className="forgot-pass-link" onClick={onForgot}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions-stack">
          <button type="submit" className="btn-primary-green" disabled={submitting}>
            {submitting ? 'Un momento...' : 'Ingresar'}
          </button>
          <GoogleButton onCredential={onGoogle} onUnavailable={onGoogleUnavailable} />
        </div>
      </form>

      <p className="switch-auth-prompt">
        ¿No tienes una cuenta?{' '}
        <button type="button" className="switch-auth-link" onClick={() => onSwitch('signup')}>
          Crear Cuenta
        </button>
      </p>
    </div>
  );
}
