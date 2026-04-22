import { useEffect, useState } from 'react';
import client from '../api/client';
import DepartmentModal from '../modals/DepartmentModal';
import ConfirmModal from '../modals/ConfirmModal';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { showSuccess, showError } from '../utils/toast';

const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];

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
      .then(() => { setShowAdd(false); fetchDepartments(); showSuccess('Department added.'); })
      .catch((err) => showError(err.response?.data?.message || 'Failed to create department'))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    setDeleting(true);
    setDeleteError('');
    client.delete(`/api/departments/${confirmId}`)
      .then(() => { setConfirmId(null); fetchDepartments(); showSuccess('Department deleted.'); })
      .catch((err) => {
        setDeleteError(err.response?.data?.message || 'Failed to delete department');
        setDeleting(false);
      });
  };

  if (loading) return <Spinner />;
  if (error)   return <p className="py-10 text-center text-red-500 text-sm">{error}</p>;

  const columns = [
    {
      key: 'name',
      label: 'Department Name',
      render: (dept, i) => (
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${COLORS[i % COLORS.length]} flex items-center justify-center text-white text-base shadow-sm flex-shrink-0`}>
            🏢
          </div>
          <span className="font-semibold text-slate-900">{dept.name}</span>
        </div>
      ),
    },
    {
      key: 'employeeCount',
      label: 'Team Size',
      render: (dept) => (
        <span className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-xs font-bold">
          👥 {dept.employeeCount} {dept.employeeCount === 1 ? 'Employee' : 'Employees'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (dept) => (
        <div className="flex justify-end">
          <button
            className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
            onClick={() => { setDeleteError(''); setConfirmId(dept.id); }}
          >
            🗑️
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {departments.length} {departments.length !== 1 ? 'departments' : 'department'}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>+ Add Department</Button>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={departments}
          emptyMessage="No departments yet. Add one to get started."
        />
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
