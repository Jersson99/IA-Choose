import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.GOOGLE_CLIENT_ID;
let scriptPromise;

// Carga una sola vez la librería oficial de Google Identity Services
function loadGoogleScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('No se pudo cargar Google'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Botón oficial "Continuar con Google"; entrega el token (credential) al hacer clic
export default function GoogleButton({ onCredential, onUnavailable }) {
  const containerRef = useRef(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => callbackRef.current(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          locale: 'es',
          width: Math.min(400, Math.max(200, containerRef.current.offsetWidth)),
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Sin Client ID configurado (o sin conexión a Google): botón de respaldo con aviso
  if (!CLIENT_ID || failed) {
    return (
      <button type="button" className="btn-white-google" onClick={onUnavailable}>
        CONTINUAR CON GOOGLE
      </button>
    );
  }
  return <div ref={containerRef} className="google-btn-wrap" />;
}
