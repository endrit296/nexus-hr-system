import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import client from '../api/client';
import Input from './ui/Input';
import Button from './ui/Button';

const loginSchema = z.object({
  email:    z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  firstName:       z.string().min(1, 'First name is required'),
  lastName:        z.string().min(1, 'Last name is required'),
  email:           z.string().email({ message: 'Please enter a valid email address' }),
  password:        z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const FEATURES = [
  { icon: '👥', text: 'Employee directory & profiles' },
  { icon: '🏢', text: 'Department management' },
  { icon: '📊', text: 'Workforce analytics' },
  { icon: '🔐', text: 'Role-based access control' },
];

function Login({ onLogin }) {
  const [mode, setMode]               = useState('login');
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState('');
  const [registered, setRegistered]   = useState(false);

  const lf = useForm({ resolver: zodResolver(loginSchema),    mode: 'onChange' });
  const rf = useForm({ resolver: zodResolver(registerSchema), mode: 'onChange' });

  const switchMode = (m) => {
    setMode(m);
    setServerError('');
    setRegistered(false);
    lf.reset();
    rf.reset();
  };

  const onLoginSubmit = async ({ email, password }) => {
    setLoading(true);
    setServerError('');
    try {
      const { data } = await client.post('/api/auth/login', { email, password });
      onLogin(data.user, data.token, data.refreshToken);
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
      await client.post('/api/auth/register', { username, email, password });
      // Registration now requires email verification — show success message
      setRegistered(true);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[55%] bg-dark-900 relative overflow-hidden flex-col justify-center px-16">
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-brand-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-50px] right-[-50px] w-[400px] h-[400px] rounded-full bg-indigo-500/[0.08] blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="w-12 h-12 bg-brand-600 rounded-lg flex items-center justify-center">
            <span className="text-xl font-extrabold text-white">N</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-4">Nexus HR</h1>
          <p className="text-base text-slate-400 mt-2 max-w-sm">
            Modern human resources management for growing teams.
          </p>

          <ul className="mt-10 space-y-3">
            {FEATURES.map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded px-4 py-3">
                <span>{icon}</span>
                <span className="text-sm text-white/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-[45%] bg-white flex items-center justify-center px-6 lg:px-8 py-12">
        <div className="w-full max-w-[380px]">

          {/* Mobile-only logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center">
              <span className="text-lg font-extrabold text-white">N</span>
            </div>
            <span className="text-xl font-extrabold text-slate-900">Nexus HR</span>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-8 mb-8">
            <button type="button" onClick={() => switchMode('login')}
              className={`pb-2 text-sm font-semibold transition-colors ${mode === 'login' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-400 hover:text-slate-600 cursor-pointer'}`}>
              Sign in
            </button>
            <button type="button" onClick={() => switchMode('register')}
              className={`pb-2 text-sm font-semibold transition-colors ${mode === 'register' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-400 hover:text-slate-600 cursor-pointer'}`}>
              Register
            </button>
          </div>

          {/* ── Registration success state ── */}
          {registered ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-4">📧</div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 mb-6">
                We sent an activation link to your email address. Click the link to activate your account before signing in.
              </p>
              <Button variant="primary" className="w-full" onClick={() => switchMode('login')}>
                Back to Sign in
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-base text-slate-500 mt-1 mb-8">
                {mode === 'login' ? 'Sign in to access your dashboard.' : 'Get started with Nexus HR today.'}
              </p>

              {/* ── Login form ── */}
              {mode === 'login' && (
                <form onSubmit={lf.handleSubmit(onLoginSubmit)} noValidate>
                  {serverError && (
                    <div className="bg-red-50 border border-red-200 rounded text-sm text-red-600 px-4 py-3 mb-4">
                      ⚠️ {serverError}
                    </div>
                  )}
                  <div className="space-y-4">
                    <Input label="Email address" type="email" placeholder="you@company.com"
                      error={lf.formState.errors.email?.message} {...lf.register('email')} />
                    <Input label="Password" type="password" placeholder="••••••••"
                      error={lf.formState.errors.password?.message} {...lf.register('password')} />
                  </div>
                  <div className="text-right mt-2">
                    <Link to="/forgot-password" className="text-xs text-brand-600 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Button variant="primary" type="submit" disabled={loading} className="w-full h-[46px] mt-4 uppercase tracking-wide">
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>
              )}

              {/* ── Register form ── */}
              {mode === 'register' && (
                <form onSubmit={rf.handleSubmit(onRegisterSubmit)} noValidate>
                  {serverError && (
                    <div className="bg-red-50 border border-red-200 rounded text-sm text-red-600 px-4 py-3 mb-4">
                      ⚠️ {serverError}
                    </div>
                  )}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="First Name" placeholder="Jane"
                        error={rf.formState.errors.firstName?.message} {...rf.register('firstName')} />
                      <Input label="Last Name" placeholder="Doe"
                        error={rf.formState.errors.lastName?.message} {...rf.register('lastName')} />
                    </div>
                    <Input label="Email address" type="email" placeholder="you@company.com"
                      error={rf.formState.errors.email?.message} {...rf.register('email')} />
                    <Input label="Password" type="password" placeholder="••••••••"
                      error={rf.formState.errors.password?.message} {...rf.register('password')} />
                    <Input label="Confirm Password" type="password" placeholder="••••••••"
                      error={rf.formState.errors.confirmPassword?.message} {...rf.register('confirmPassword')} />
                  </div>
                  <Button variant="primary" type="submit" disabled={loading} className="w-full h-[46px] mt-6 uppercase tracking-wide">
                    {loading ? 'Creating account…' : 'Create account'}
                  </Button>
                </form>
              )}

              <p className="text-center text-sm text-slate-400 mt-6">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button type="button" className="text-brand-600 font-semibold hover:underline"
                  onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
                  {mode === 'login' ? 'Register' : 'Sign in'}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
