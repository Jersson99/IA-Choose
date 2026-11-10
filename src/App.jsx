import { useAuth } from './hooks/useAuth.js';
import { useRobot } from './hooks/useRobot.js';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

// Orquesta: decide qué pantalla mostrar según haya sesión o no
export default function App() {
  const auth = useAuth();
  const robot = useRobot({ isAuthenticated: Boolean(auth.user) });

  // Evita mostrar el login un instante si ya había una sesión guardada
  if (auth.checking) return null;

  if (auth.user) {
    const handleLogout = () => {
      auth.logout();
      robot.say('wave', 'Sesión cerrada correctamente', 2200);
    };
    return <DashboardPage user={auth.user} robot={robot} onLogout={handleLogout} />;
  }

  return (
    <AuthPage
      onLogin={auth.login}
      onRegister={auth.register}
      onGoogleLogin={auth.loginWithGoogle}
      robot={robot}
    />
  );
}
