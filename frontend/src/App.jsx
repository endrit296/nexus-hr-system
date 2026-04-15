import { useState } from 'react';
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nexus_user');
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;
  return <Layout user={user} onLogout={handleLogout} />;
}

export default App;
