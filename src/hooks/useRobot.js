import { useCallback, useRef, useState } from 'react';

// Estado y mensajes del robot animado (estado de ánimo + globo de texto)
export function useRobot({ isAuthenticated }) {
  const [focus, setFocus] = useState({ field: null, passwordVisible: false });
  const [titleHovered, setTitleHovered] = useState(false);
  const [manualMood, setManualMood] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const timerRef = useRef(null);

  // Muestra un ánimo y un mensaje temporal; un mensaje nuevo cancela el anterior
  const say = useCallback((mood, message, duration = 2800) => {
    clearTimeout(timerRef.current);
    setManualMood(mood);
    setStatusMessage(message);
    timerRef.current = setTimeout(() => {
      setManualMood(null);
      setStatusMessage(null);
    }, duration);
  }, []);

  // Lo llaman los campos al enfocarse (field) o al perder el foco (null)
  const onFieldFocus = useCallback((field, passwordVisible = false) => {
    setFocus({ field, passwordVisible });
  }, []);

  const getMood = () => {
    if (manualMood) return manualMood;
    if (titleHovered) return 'wave';
    if (focus.field === 'password' || focus.field === 'confirmPassword') {
      return focus.passwordVisible ? 'peek' : 'privacy';
    }
    if (['name', 'email', 'task'].includes(focus.field)) return 'look';
    return 'idle';
  };

  const mood = getMood();

  const getSpeech = () => {
    if (statusMessage) return statusMessage;
    if (titleHovered) return '¡Bienvenido a IA Choose!';
    if (mood === 'privacy') return '¡No miro tu clave!';
    if (mood === 'peek') return '¡Ups, clave visible!';
    if (mood === 'look') {
      return isAuthenticated ? 'Analizando tu tarea para elegir el mejor modelo...' : '¡Te leo atento!';
    }
    if (mood === 'wave') return '¡Hola! Soy el bot de IA CHOOSE';
    if (mood === 'celebrate') return '¡Genial! Todo listo';
    return null;
  };

  const handleClick = () => {
    say(
      'wave',
      isAuthenticated
        ? 'Escribe tu tarea en el panel y te recomendaré la mejor IA'
        : '¡Crea tu cuenta o ingresa para empezar!'
    );
  };

  return { mood, speech: getSpeech(), say, onFieldFocus, titleHovered, setTitleHovered, handleClick };
}
