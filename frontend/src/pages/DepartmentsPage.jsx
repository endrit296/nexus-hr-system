import { useEffect, useState } from 'react';
import client from '../api/client';
import DepartmentModal from '../modals/DepartmentModal';
import ConfirmModal from '../modals/ConfirmModal';

function DepartmentsPage({ user }) {
  const role = user?.role || 'employee';

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const [showAdd, setShowAdd]         = useState(false);
  const [saving, setSaving]           = useState(false);

  const [confirmId, setConfirmId]     = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isAdmin = role === 'admin';

  const fetchDepartments = () =>
    client.get('/api/departments')
      .then(({ data }) => setDepartments(data.departments))
      .catch(() => setError('Failed to load departments'))
      .finally(() => setLoading(false));

  useEffect(() => { fetchDepartments(); }, []);

  const handleAdd = (payload) => {
    setSaving(true);
    client.post('/api/departments', payload)
      .then(() => { setShowAdd(false); fetchDepartments(); })
      .catch((err) => alert(err.response?.data?.message || 'Failed to create department'))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    setDeleting(true);
    setDeleteError('');
    client.delete(`/api/departments/${confirmId}`)
      .then(() => { setConfirmId(null); fetchDepartments(); })
      .catch((err) => {
        setDeleteError(err.response?.data?.message || 'Failed to delete department');
        setDeleting(false);
      });
  };

  if (loading) return <p className="status-msg">Loading…</p>;
  if (error)   return <p className="error-msg">{error}</p>;

  return (
    <>
      <div className="page-header">
        <h3>{departments.length} department{departments.length !== 1 ? 's' : ''}</h3>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Department</button>
        )}
      </div>

      <div className="section-card">
        {departments.length === 0 ? (
          <p className="table-empty">No departments yet. Add one to get started.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Employees</th>
                {isAdmin && <th style={{ width: 80 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {departments.map((dept, i) => {
                const colors = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899'];
                const bg = colors[i % colors.length];
                return (
                  <tr key={dept.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, flexShrink: 0 }}>🏢</div>
                        <strong style={{ color: '#0f172a' }}>{dept.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                        👥 {dept.employeeCount}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          className="btn-icon"
                          title="Delete"
                          onClick={() => { setDeleteError(''); setConfirmId(dept.id); }}
                        >🗑️</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <DepartmentModal
          onClose={() => setShowAdd(false)}
          onSave={handleAdd}
          loading={saving}
        />
      )}

      {confirmId && (
        <ConfirmModal
          title="Delete Department"
          message={
            deleteError
              ? deleteError
              : 'Are you sure you want to delete this department? This cannot be undone.'
          }
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
          loading={deleting}
        />
      )}
    </>
  );
}

export default DepartmentsPage;
