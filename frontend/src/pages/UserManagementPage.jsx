import { useEffect, useState } from 'react';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import RoleBadge from '../components/ui/RoleBadge';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { showSuccess, showError } from '../utils/toast';

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
        showSuccess('Role updated successfully.');
        fetchUsers();
      })
      .catch((err) => showError(err.response?.data?.message || 'Failed to update role'))
      .finally(() => setSaving((prev) => ({ ...prev, [userId]: false })));
  };

  if (loading) return <Spinner />;
  if (error)   return <p className="py-10 text-center text-red-500 text-sm">{error}</p>;

  const columns = [
    {
      key: 'user',
      label: 'User',
      render: (u) => {
        const isSelf = String(u._id) === String(currentUserId);
        return (
          <div className="flex items-center gap-2.5 min-w-[180px]">
            <Avatar firstName={u.username} lastName="" size="sm" />
            <div>
              <div className="font-semibold text-slate-900 capitalize text-sm">
                {u.username}
                {isSelf && <span className="ml-1.5 text-xs text-slate-400 font-normal normal-case">(you)</span>}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'email',
      label: 'Email',
      render: (u) => <span className="text-sm text-slate-600">{u.email}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      render: (u) => {
        const isSelf = String(u._id) === String(currentUserId);
        if (isSelf) return <RoleBadge role={u.role || 'employee'} />;
        return (
          <div className="relative inline-flex items-center">
            <select
              className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-700 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 cursor-pointer transition-all"
              value={pending[u._id] || 'employee'}
              onChange={(e) => handleRoleChange(u._id, e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronIcon />
            </span>
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Registered',
      render: (u) => (
        <span className="text-sm text-slate-500">
          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'action',
      label: '',
      render: (u) => {
        const isSelf   = String(u._id) === String(currentUserId);
        if (isSelf) return null;
        const isDirty   = pending[u._id] !== (u.role || 'employee');
        const isSaving  = saving[u._id];
        const justSaved = saved[u._id] && !isDirty;
        return (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSave(u._id)}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving…' : justSaved ? 'Saved ✓' : 'Save'}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {users.length} {users.length !== 1 ? 'users' : 'user'}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users}
        emptyMessage="No users found."
      />
    </>
  );
}

export default UserManagementPage;
