import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('nexus_user');
    if (token && stored) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });

  const handleLogin = (userData) => {
    localStorage.setItem('nexus_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await import('./api/client').then(({ default: client }) =>
          client.post('/api/auth/logout', { refreshToken })
        );
      }
    } catch {
      // Ignore
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('nexus_user');
      setUser(null);
    }
  };

  return (
    <Routes>
      {/* Nëse nuk është i loguar, shfaq vetëm Login */}
      <Route 
        path="/login" 
        element={!user ? <Login onLogin={handleLogin} /> : <Navigate replace to="/dashboard" />} 
      />
      
      {/* Nëse është i loguar, shfaq Layout-in që mban faqet e tjera */}
      <Route 
        path="/*" 
        element={user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate replace to="/login" />} 
      />
    </Routes>
  );
}

export default App;