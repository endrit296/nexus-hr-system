import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import client from '../api/client';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const schema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
});

function ForgotPasswordPage() {
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [serverError, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }) => {
    setLoading(true);
    setError('');
    try {
      await client.post('/api/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-10 max-w-md w-full">

        <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center mb-6">
          <span className="text-lg font-extrabold text-white">N</span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Check your email</h1>
            <p className="text-sm text-slate-500 mb-6">
              If that email address is registered, we've sent a password reset link. Check your inbox.
            </p>
            <Link to="/login" className="text-brand-600 hover:underline text-sm font-semibold">
              Back to Sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-1">Forgot password?</h1>
            <p className="text-sm text-slate-500 mb-6">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded text-sm text-red-600 px-4 py-3 mb-4">
                  ⚠️ {serverError}
                </div>
              )}
              <Input label="Email address" type="email" placeholder="you@company.com"
                error={errors.email?.message} {...register('email')} />
              <Button variant="primary" type="submit" disabled={loading} className="w-full h-[46px] mt-5">
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-400 mt-5">
              <Link to="/login" className="text-brand-600 font-semibold hover:underline">
                Back to Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
