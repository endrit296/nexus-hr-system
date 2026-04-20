import { useEffect, useState } from 'react';
import client from '../api/client';

const ROLES = ['employee', 'manager', 'admin'];

const roleBadge = {
  admin:    { background: '#fef3c7', color: '#92400e' },
  manager:  { background: '#dbeafe', color: '#1e40af' },
  employee: { background: '#f1f5f9', color: '#475569' },
};

function UserManagementPage({ currentUserId }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState({}); // { [userId]: true }
  const [pending, setPending] = useState({}); // { [userId]: 'manager' }
  const [saved, setSaved]     = useState({}); // { [userId]: true }

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
      .catch((err) => alert(err.response?.data?.message || 'Failed to update role'))
      .finally(() => setSaving((prev) => ({ ...prev, [userId]: false })));
  };

  if (loading) return <p className="status-msg">Loading…</p>;
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
              const isSelf     = String(u._id) === String(currentUserId);
              const isDirty    = pending[u._id] !== (u.role || 'employee');
              const isSaving   = saving[u._id];
              const justSaved  = saved[u._id] && !isDirty;
              const badge      = roleBadge[u.role || 'employee'];

              return (
                <tr key={u._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {u.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                          {u.username}
                          {isSelf && <span style={{ marginLeft: 6, fontSize: 10, color: '#64748b', fontWeight: 400 }}>(you)</span>}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 11.5 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ ...badge, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {u.role || 'employee'}
                    </span>
                  </td>
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
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8' }}>Cannot change own role</span>
                    )}
                  </td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>
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
    </>
  );
}

export default UserManagementPage;
