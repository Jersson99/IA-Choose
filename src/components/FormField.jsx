import { useState } from 'react';

function EyeIcon({ open }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  return open ? (
    <svg {...common}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg {...common}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// Campo de formulario reutilizable; si es de tipo password añade el botón de ojo
export default function FormField({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  onFocusChange,
  autoComplete,
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="minimal-field">
      <label htmlFor={id}>{label}</label>
      <div className="minimal-input-row">
        <input
          id={id}
          type={isPassword && visible ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => onFocusChange?.(name, visible)}
          onBlur={() => onFocusChange?.(null, false)}
          required
          autoComplete={autoComplete}
        />
        {isPassword && (
          <button
            type="button"
            className="eye-icon-btn"
            onClick={() => setVisible((prev) => !prev)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <EyeIcon open={visible} />
          </button>
        )}
      </div>
    </div>
  );
}
