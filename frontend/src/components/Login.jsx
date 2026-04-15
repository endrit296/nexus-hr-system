import { useState } from 'react';
import client from '../api/client';
import './Login.css';

function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); 

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setEmail('');
    setPassword('');
    setUsername('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // --- FAZA II: VALIDIMI I FORMËS (Client-side Validation) ---
    if (!email.includes('@')) {
      setError('Ju lutem jepni një email të vlefshëm.');
      return;
    }
    if (password.length < 6) {
      setError('Fjalëkalimi duhet të ketë së paku 6 karaktere.');
      return;
    }
    // ---------------------------------------------------------

    setLoading(true);

    try {
      if (mode === 'login') {
        const { data } = await client.post('/api/auth/login', { email, password });
        localStorage.setItem('token', data.token);
        onLogin(data.user);
      } else {
        // Validim shtesë për Register
        if (username.trim().length < 3) {
           setError('Username duhet të ketë së paku 3 karaktere.');
           setLoading(false);
           return;
        }
        const { data } = await client.post('/api/auth/register', { username, email, password });
        localStorage.setItem('token', data.token);
        onLogin(data.user);
      }
    } catch (err) {
      // FAZA II: Trajtimi i gabimeve nga serveri
      setError(err.response?.data?.message || (mode === 'login' ? 'Dështoi hyrja.' : 'Regjistrimi dështoi.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-logo">
            <span className="auth-logo-icon">N</span>
          </div>
          <h1 className="auth-brand-name">Nexus HR</h1>
          <p className="auth-brand-tagline">Modern human resources management for growing teams.</p>
          <ul className="auth-brand-features">
            <li>👥 Employee directory &amp; profiles</li>
            <li>🏢 Department management</li>
            <li>📊 Workforce analytics</li>
            <li>🔐 Role-based access control</li>
          </ul>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
              type="button"
            >
              Register
            </button>
          </div>

          <div className="auth-card-body">
            <h2 className="auth-heading">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="auth-subheading">
              {mode === 'login'
                ? 'Sign in to access your dashboard.'
                : 'Get started with Nexus HR today.'}
            </p>

            <form onSubmit={handleSubmit} className="auth-form">
              {mode === 'register' && (
                <div className="form-field">
                  <label className="field-label">Username</label>
                  <input
                    className="field-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                  />
                </div>
              )}

              <div className="form-field">
                <label className="field-label">Email address</label>
                <input
                  className={`field-input ${error && !email ? 'input-error' : ''}`} // Feedback vizual
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>

              <div className="form-field">
                <label className="field-label">Password</label>
                <input
                  className={`field-input ${error && !password ? 'input-error' : ''}`}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {/* Shfaqja e gabimit me stil të Fazës II */}
              {error && (
                <div className="auth-error-container">
                   <p className="auth-error">⚠️ {error}</p>
                </div>
              )}

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading
                  ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                  : (mode === 'login' ? 'Sign in' : 'Create account')}
              </button>
            </form>

            <p className="auth-switch">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;