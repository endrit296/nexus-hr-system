import { useEffect, useState } from 'react';
import client from '../api/client';
import DepartmentModal from '../modals/DepartmentModal';
import ConfirmModal from '../modals/ConfirmModal';
import Spinner from '../components/ui/Spinner';
import { showError } from '../utils/toast';

function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const [showAdd, setShowAdd]         = useState(false);
  const [saving, setSaving]           = useState(false);

  const [confirmId, setConfirmId]     = useState(null);
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchDepartments = () =>
    client.get('/api/departments')
      .then(({ data }) => setDepartments(data.departments || []))
      .catch(() => setError('Failed to load departments'))
      .finally(() => setLoading(false));

  useEffect(() => { fetchDepartments(); }, []);

  const handleAdd = (payload) => {
    setSaving(true);
    client.post('/api/departments', payload)
      .then(() => { setShowAdd(false); fetchDepartments(); })
      .catch((err) => showError(err.response?.data?.message || 'Failed to create department'))
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

  if (loading) return <Spinner />;
  if (error)   return <p className="error-msg">{error}</p>;

  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];

  return (
    <>
      <div className="page-header">
        <h3>{departments.length} department{departments.length !== 1 ? 's' : ''}</h3>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Department</button>
      </div>

      <div className="section-card">
        {departments.length === 0 ? (
          <p className="table-empty">No departments yet. Add one to get started.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Team Size</th>
                <th style={{ width: 80, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept, i) => (
                <tr key={dept.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${colors[i % colors.length]} flex items-center justify-center text-white text-base shadow-sm flex-shrink-0`}>
                        🏢
                      </div>
                      <span className="font-semibold text-slate-900">{dept.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-xs font-bold">
                      👥 {dept.employeeCount} Employees
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn-icon text-red-400 hover:bg-red-50"
                      title="Delete"
                      onClick={() => { setDeleteError(''); setConfirmId(dept.id); }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <DepartmentModal onClose={() => setShowAdd(false)} onSave={handleAdd} loading={saving} />
      )}

      {confirmId && (
        <ConfirmModal
          title="Delete Department"
          message={deleteError || 'Are you sure you want to delete this department? This cannot be undone.'}
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
          loading={deleting}
        />
      )}
    </>
  );
}

export default DepartmentsPage;
