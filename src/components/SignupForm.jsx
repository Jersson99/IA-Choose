import { useState } from 'react';
import FormField from './FormField.jsx';
import GoogleButton from './GoogleButton.jsx';

export default function SignupForm({ onSubmit, onSwitch, onGoogle, onGoogleUnavailable, onFocusChange, error, submitting }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ name, email, password, confirmPassword });
  };

  return (
    <div className="auth-view-content" key="signup-view">
      <h1 className="card-heading">Crear una Nueva Cuenta</h1>
      <p className="card-subheading">Únete a IA CHOOSE hoy</p>

      <form className="minimal-auth-form" onSubmit={handleSubmit}>
        <FormField
          id="signup-name"
          name="name"
          label="Nombre Completo"
          value={name}
          onChange={setName}
          onFocusChange={onFocusChange}
          autoComplete="name"
        />
        <FormField
          id="signup-email"
          name="email"
          type="email"
          label="Correo Electrónico"
          value={email}
          onChange={setEmail}
          onFocusChange={onFocusChange}
          autoComplete="email"
        />
        <FormField
          id="signup-password"
          name="password"
          type="password"
          label="Contraseña"
          value={password}
          onChange={setPassword}
          onFocusChange={onFocusChange}
          autoComplete="new-password"
        />
        <FormField
          id="signup-confirm-password"
          name="confirmPassword"
          type="password"
          label="Confirmar Contraseña"
          value={confirmPassword}
          onChange={setConfirmPassword}
          onFocusChange={onFocusChange}
          autoComplete="new-password"
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions-stack">
          <button type="submit" className="btn-primary-green" disabled={submitting}>
            {submitting ? 'Un momento...' : 'Crear Cuenta'}
          </button>
          <GoogleButton onCredential={onGoogle} onUnavailable={onGoogleUnavailable} />
        </div>
      </form>

      <p className="switch-auth-prompt">
        ¿Ya tienes una cuenta?{' '}
        <button type="button" className="switch-auth-link" onClick={() => onSwitch('login')}>
          Ingresar aquí
        </button>
      </p>
    </div>
  );
}
