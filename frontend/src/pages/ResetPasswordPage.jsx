import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import client from '../api/client';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const schema = z.object({
  newPassword:     z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

function ResetPasswordPage() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [serverError, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ newPassword }) => {
    setLoading(true);
    setError('');
    try {
      await client.post(`/api/auth/reset-password/${token}`, { newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
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

        {done ? (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Password reset!</h1>
            <p className="text-sm text-slate-500">Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-1">Set a new password</h1>
            <p className="text-sm text-slate-500 mb-6">Choose a strong password for your account.</p>

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded text-sm text-red-600 px-4 py-3 mb-4">
                  ⚠️ {serverError}
                </div>
              )}
              <div className="space-y-4">
                <Input label="New password" type="password" placeholder="••••••••"
                  error={errors.newPassword?.message} {...register('newPassword')} />
                <Input label="Confirm new password" type="password" placeholder="••••••••"
                  error={errors.confirmPassword?.message} {...register('confirmPassword')} />
              </div>
              <Button variant="primary" type="submit" disabled={loading} className="w-full h-[46px] mt-5">
                {loading ? 'Saving…' : 'Reset password'}
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

export default ResetPasswordPage;
