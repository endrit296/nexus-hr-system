import { useEffect, useState } from 'react';
import client from '../api/client';
import DepartmentModal from '../modals/DepartmentModal';
import ConfirmModal from '../modals/ConfirmModal';

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

  if (loading) return <p className="text-center p-10 text-slate-500 font-medium">Loading departments...</p>;
  if (error)   return <p className="text-center p-10 text-red-500 font-medium">{error}</p>;

  return (
    <div className="p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* Header modern */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {departments.length} department{departments.length !== 1 ? 's' : ''}
          </h2>
          <p className="text-slate-500 text-sm">Organizimi i strukturës së kompanisë</p>
        </div>
        <button 
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
          onClick={() => setShowAdd(true)}
        >
          <span className="text-lg">+</span> Add Department
        </button>
      </div>

      {/* Kartat e departamenteve brenda një tabele të pastër */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          {departments.length === 0 ? (
            <div className="p-20 text-center">
              <p className="text-slate-400 font-medium">No departments yet. Add one to get started.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="p-4 border-b">Department Name</th>
                  <th className="p-4 border-b">Team Size</th>
                  <th className="p-4 border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {departments.map((dept, i) => {
                  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
                  const bg = colors[i % colors.length];
                  return (
                    <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center text-white shadow-sm text-lg`}>
                            🏢
                          </div>
                          <span className="font-bold text-slate-800 tracking-tight">{dept.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                          <span>👥</span>
                          <span>{dept.employeeCount} Employees</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                          onClick={() => { setDeleteError(''); setConfirmId(dept.id); }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
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
              : `Are you sure you want to delete this department? This cannot be undone.`
          }
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}

export default DepartmentsPage;