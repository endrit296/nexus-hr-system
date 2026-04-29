import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import client from '../api/client';

function ActivatePage() {
  const { token }   = useParams();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    client.get(`/api/auth/activate/${token}`)
      .then(({ data }) => { setStatus('success'); setMessage(data.message); })
      .catch((err)    => { setStatus('error');   setMessage(err.response?.data?.message || 'Activation failed.'); });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 p-10 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="text-4xl mb-4 animate-pulse">⏳</div>
            <p className="text-slate-500 text-sm">Activating your account…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Account Activated</h1>
            <p className="text-slate-500 text-sm mb-6">{message}</p>
            <Link to="/login"
              className="inline-block bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
              Sign in
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Activation Failed</h1>
            <p className="text-slate-500 text-sm mb-6">{message}</p>
            <Link to="/login"
              className="inline-block text-brand-600 hover:underline text-sm font-semibold">
              Back to Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default ActivatePage;
