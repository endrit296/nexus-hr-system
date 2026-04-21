import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import client from '../api/client';
import Input from './ui/Input';
import './Login.css';

const loginSchema = z.object({
  email:    z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  firstName:       z.string().min(1, 'First name is required'),
  lastName:        z.string().min(1, 'Last name is required'),
  email:           z.string().email('Please enter a valid email address'),
  password:        z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

function Login({ onLogin }) {
  const [mode, setMode]           = useState('login');
  const [loading, setLoading]     = useState(false);
  const [serverError, setServerError] = useState('');

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });

  const switchMode = (m) => {
    setMode(m);
    setServerError('');
    loginForm.reset();
    registerForm.reset();
  };

  const onLoginSubmit = async ({ email, password }) => {
    setLoading(true);
    setServerError('');
    try {
      const { data } = await client.post('/api/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      onLogin(data.user);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRegisterSubmit = async ({ firstName, lastName, email, password }) => {
    setLoading(true);
    setServerError('');
    try {
      const username = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
      const { data } = await client.post('/api/auth/register', { username, email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      onLogin(data.user);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const lf = loginForm;
  const rf = registerForm;

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
            <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')} type="button">Sign in</button>
            <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')} type="button">Register</button>
          </div>

          <div className="auth-card-body">
            <h2 className="auth-heading">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="auth-subheading">
              {mode === 'login' ? 'Sign in to access your dashboard.' : 'Get started with Nexus HR today.'}
            </p>

            {mode === 'login' ? (
              <form onSubmit={lf.handleSubmit(onLoginSubmit)} className="auth-form" noValidate>
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@company.com"
                  error={lf.formState.errors.email?.message}
                  {...lf.register('email')}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  error={lf.formState.errors.password?.message}
                  {...lf.register('password')}
                />
                {serverError && <p className="auth-error">⚠️ {serverError}</p>}
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            ) : (
              <form onSubmit={rf.handleSubmit(onRegisterSubmit)} className="auth-form" noValidate>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Input
                    label="First Name"
                    placeholder="Jane"
                    error={rf.formState.errors.firstName?.message}
                    {...rf.register('firstName')}
                  />
                  <Input
                    label="Last Name"
                    placeholder="Doe"
                    error={rf.formState.errors.lastName?.message}
                    {...rf.register('lastName')}
                  />
                </div>
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@company.com"
                  error={rf.formState.errors.email?.message}
                  {...rf.register('email')}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  error={rf.formState.errors.password?.message}
                  {...rf.register('password')}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  error={rf.formState.errors.confirmPassword?.message}
                  {...rf.register('confirmPassword')}
                />
                {serverError && <p className="auth-error">⚠️ {serverError}</p>}
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>
            )}

            <p className="auth-switch">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button type="button" className="auth-switch-link" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
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
