import { useEffect, useState } from 'react';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import RoleBadge from '../components/ui/RoleBadge';
import Spinner from '../components/ui/Spinner';
import { showError } from '../utils/toast';

const ROLES = ['employee', 'manager', 'admin'];

const ChevronIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

function UserManagementPage({ currentUserId }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState({});
  const [pending, setPending] = useState({});
  const [saved, setSaved]     = useState({});

  const fetchUsers = () =>
    client.get('/api/auth/users')
      .then(({ data }) => {
        setUsers(data.users);
        const initial = {};
        data.users.forEach((u) => { initial[u._id] = u.role || 'employee'; });
        setPending(initial);
      })
      .catch(() => setError('Failed to load users. Admin access required.'))
      .finally(() => setLoading(false));

  useEffect(() => { fetchUsers(); }, []);

  const handleRoleChange = (userId, role) => {
    setPending((prev) => ({ ...prev, [userId]: role }));
    setSaved((prev) => ({ ...prev, [userId]: false }));
  };

  const handleSave = (userId) => {
    setSaving((prev) => ({ ...prev, [userId]: true }));
    client.put(`/api/auth/users/${userId}/role`, { role: pending[userId] })
      .then(() => {
        setSaved((prev) => ({ ...prev, [userId]: true }));
        fetchUsers();
      })
      .catch((err) => showError(err.response?.data?.message || 'Failed to update role'))
      .finally(() => setSaving((prev) => ({ ...prev, [userId]: false })));
  };

  if (loading) return <Spinner />;
  if (error)   return <p className="py-10 text-center text-red-500 text-sm">{error}</p>;

  return (
    <>
      {/* Page header */}
      <p className="text-sm font-medium text-slate-500 mb-5">
        {users.length} {users.length !== 1 ? 'users' : 'user'}
      </p>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">User</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Current Role</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Change Role</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Registered</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf    = String(u._id) === String(currentUserId);
                const isDirty   = pending[u._id] !== (u.role || 'employee');
                const isSaving  = saving[u._id];
                const justSaved = saved[u._id] && !isDirty;

                return (
                  <tr key={u._id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">

                    {/* User */}
                    <td className="px-4 py-3 text-sm text-slate-700 min-w-[200px]">
                      <div className="flex items-center gap-2.5">
                        <Avatar firstName={u.username} lastName="" size="sm" />
                        <div>
                          <div className="font-semibold text-slate-900 capitalize">
                            {u.username}
                            {isSelf && <span className="ml-1.5 text-xs text-slate-400 font-normal normal-case">(you)</span>}
                          </div>
                          <span className="block text-xs text-slate-400 mt-0.5">{u.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Current role */}
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <RoleBadge role={u.role || 'employee'} />
                    </td>

                    {/* Change role */}
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <select
                            className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                            value={pending[u._id] || 'employee'}
                            onChange={(e) => handleRoleChange(u._id, e.target.value)}
                            disabled={isSelf}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                            ))}
                          </select>
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronIcon />
                          </span>
                        </div>
                        {isSelf && (
                          <span className="text-xs text-slate-400">Cannot change own role</span>
                        )}
                      </div>
                    </td>

                    {/* Registered */}
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {!isSelf && (
                        <button
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleSave(u._id)}
                          disabled={!isDirty || isSaving}
                        >
                          {isSaving ? 'Saving…' : justSaved ? 'Saved ✓' : 'Save'}
                        </button>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default UserManagementPage;
