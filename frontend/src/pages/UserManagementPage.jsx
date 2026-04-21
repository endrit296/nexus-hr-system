import { useEffect, useState } from 'react';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import RoleBadge from '../components/ui/RoleBadge';
import Spinner from '../components/ui/Spinner';
import { showError } from '../utils/toast';

const ROLES = ['employee', 'manager', 'admin'];

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
  if (error)   return <p className="error-msg">{error}</p>;

  return (
    <>
      <div className="page-header">
        <h3>{users.length} user{users.length !== 1 ? 's' : ''}</h3>
      </div>

      <div className="section-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Current Role</th>
              <th>Change Role</th>
              <th>Registered</th>
              <th style={{ width: 100 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf    = String(u._id) === String(currentUserId);
              const isDirty   = pending[u._id] !== (u.role || 'employee');
              const isSaving  = saving[u._id];
              const justSaved = saved[u._id] && !isDirty;

              return (
                <tr key={u._id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar firstName={u.username} lastName="" size="sm" />
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">
                          {u.username}
                          {isSelf && <span className="ml-1.5 text-xs text-slate-400 font-normal">(you)</span>}
                        </div>
                        <div className="text-slate-400 text-xs">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><RoleBadge role={u.role || 'employee'} /></td>
                  <td>
                    <select
                      className="form-select"
                      style={{ fontSize: 13, padding: '5px 8px', width: 130 }}
                      value={pending[u._id] || 'employee'}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      disabled={isSelf}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                    {isSelf && (
                      <span className="ml-2 text-xs text-slate-400">Cannot change own role</span>
                    )}
                  </td>
                  <td className="text-slate-500 text-xs">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    {!isSelf && (
                      <button
                        className={`btn ${isDirty ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={() => handleSave(u._id)}
                        disabled={!isDirty || isSaving}
                      >
                        {isSaving ? 'Saving...' : justSaved ? 'Saved ✓' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default UserManagementPage;
