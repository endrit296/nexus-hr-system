import { useEffect, useState } from 'react';
import client from '../api/client';
import EmployeeModal from '../modals/EmployeeModal';
import ConfirmModal from '../modals/ConfirmModal';

function EmployeesPage() {
  const [employees, setEmployees]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [search, setSearch]           = useState('');

  const [modalEmployee, setModalEmployee] = useState(undefined); 
  const [saving, setSaving]               = useState(false);
  const [modalError, setModalError]       = useState('');

  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting]   = useState(false);

  const fetchAll = () =>
    Promise.all([client.get('/api/employees'), client.get('/api/departments')])
      .then(([empRes, deptRes]) => {
        setEmployees(empRes.data.employees || []);
        setDepartments(deptRes.data.departments || []);
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));

  useEffect(() => { fetchAll(); }, []);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.position || '').toLowerCase().includes(q) ||
      (e.department?.name || '').toLowerCase().includes(q)
    );
  });

  const openAdd  = () => { setModalError(''); setModalEmployee(null); };
  const openEdit = (emp) => { setModalError(''); setModalEmployee(emp); };
  const closeModal = () => setModalEmployee(undefined);

  const handleSave = (payload) => {
    setSaving(true);
    setModalError('');
    const req = modalEmployee
      ? client.put(`/api/employees/${modalEmployee.id}`, payload)
      : client.post('/api/employees', payload);

    req
      .then(() => { closeModal(); fetchAll(); })
      .catch((err) => setModalError(err.response?.data?.message || 'Failed to save employee'))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    setDeleting(true);
    client.delete(`/api/employees/${confirmId}`)
      .then(() => { setConfirmId(null); fetchAll(); })
      .catch(() => {})
      .finally(() => setDeleting(false));
  };

  if (loading) return <p className="text-center p-10 text-slate-500 font-medium">Loading...</p>;
  if (error)   return <p className="text-center p-10 text-red-500 font-medium">{error}</p>;

  return (
    <div className="p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* Header-i i ri */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {filtered.length} employee{filtered.length !== 1 ? 's' : ''}{search ? ' found' : ''}
          </h2>
          <p className="text-slate-500 text-sm">Menaxhoni stafin dhe të dhënat e tyre</p>
        </div>
        <button 
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm flex items-center justify-center gap-2" 
          onClick={openAdd}
        >
          <span className="text-lg">+</span> Add Employee
        </button>
      </div>

      {/* Toolbar-i i Search-it */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex gap-2">
        <input
          className="flex-1 bg-slate-50 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Search by name, email, position, department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="text-slate-400 hover:text-slate-600 text-sm font-medium px-2" onClick={() => setSearch('')}>
            Clear
          </button>
        )}
      </div>

      {/* Tabela me stilin e ri */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-20 text-center">
              <p className="text-slate-400 font-medium">
                {search ? 'No employees match your search.' : 'No employees yet. Add one to get started.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="p-4 border-b">Name</th>
                  <th className="p-4 border-b">Position</th>
                  <th className="p-4 border-b">Department</th>
                  <th className="p-4 border-b">Manager</th>
                  <th className="p-4 border-b">Status</th>
                  <th className="p-4 border-b">Hire Date</th>
                  <th className="p-4 border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{emp.firstName} {emp.lastName}</div>
                          <div className="text-slate-400 text-[11px]">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium">{emp.position || '—'}</td>
                    <td className="p-4 text-sm text-slate-600">{emp.department?.name || '—'}</td>
                    <td className="p-4 text-sm text-slate-500">
                      {emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '—'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-tight
                        ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {emp.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-500">{emp.hireDate || '—'}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="Edit" onClick={() => openEdit(emp)}>
                          ✏️
                        </button>
                        <button className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors" title="Delete" onClick={() => setConfirmId(emp.id)}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals mbeten po njësoj pasi ato kanë dizajnin e tyre */}
      {modalEmployee !== undefined && (
        <EmployeeModal
          employee={modalEmployee}
          departments={departments}
          employees={employees}
          onClose={closeModal}
          onSave={handleSave}
          loading={saving}
          serverError={modalError}
        />
      )}

      {confirmId && (
        <ConfirmModal
          title="Delete Employee"
          message="Are you sure you want to delete this employee? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}

export default EmployeesPage;