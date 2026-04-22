import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast'; // Ti po përdor këtë librari
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
    <>
      {/* Kjo është "mbajtësja" e njoftimeve që ke aktualisht */}
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
          // Shtohet kjo për t'u siguruar që sukseset/gabimet duken mirë
          success: {
            duration: 3000,
            theme: {
              primary: '#27ae60',
            },
          },
          error: {
            duration: 4000,
            theme: {
              primary: '#e74c3c',
            },
          },
        }}
      />
      
      <Routes>
        <Route 
          path="/login" 
          element={!user ? <Login onLogin={handleLogin} /> : <Navigate replace to="/dashboard" />} 
        />
        
        <Route 
          path="/*" 
          element={user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate replace to="/login" />} 
        />
      </Routes>
    </>
  );
}

export default App;