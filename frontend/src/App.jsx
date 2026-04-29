import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login              from './components/Login';
import Layout             from './components/Layout';
import ActivatePage       from './pages/ActivatePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage  from './pages/ResetPasswordPage';
import useAuthStore       from './store/useAuthStore';
import client             from './api/client';

function App() {
  const { user, login, logout } = useAuthStore();

  const handleLogin = (userData, token, refreshToken) => {
    login(userData, token, refreshToken);
  };

  const handleLogout = async () => {
    const { refreshToken } = useAuthStore.getState();
    try {
      if (refreshToken) {
        await client.post('/api/auth/logout', { refreshToken });
      }
    } catch {
      // ignore
    } finally {
      logout();
    }
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '8px',
            background: '#0f172a',
            color: '#fff',
            fontSize: '13px',
            fontFamily: '"DM Sans", sans-serif',
          },
          success: { duration: 3000 },
          error:   { duration: 4000 },
        }}
      />

      <Routes>
        {/* ── Public auth routes (no login required) ── */}
        <Route path="/login"                   element={!user ? <Login onLogin={handleLogin} /> : <Navigate replace to="/dashboard" />} />
        <Route path="/activate/:token"         element={<ActivatePage />} />
        <Route path="/forgot-password"         element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token"   element={<ResetPasswordPage />} />

        {/* ── Protected app routes ── */}
        <Route path="/*" element={user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate replace to="/login" />} />
      </Routes>
    </>
  );
}

export default App;
