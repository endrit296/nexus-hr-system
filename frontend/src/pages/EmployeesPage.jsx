import { useEffect, useState } from 'react';
import client from '../api/client';
import EmployeeModal from '../modals/EmployeeModal';
import ConfirmModal from '../modals/ConfirmModal';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
    <path d="m15 5 4 4"/>
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

function EmployeesPage({ user }) {
  const role = user?.role || 'employee';

  const [employees, setEmployees]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [search, setSearch]           = useState('');

  const [modalEmployee, setModalEmployee] = useState(undefined);
  const [saving, setSaving]               = useState(false);
  const [modalError, setModalError]       = useState('');

  const [confirmId, setConfirmId]           = useState(null);
  const [deleting, setDeleting]             = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);

  const fetchAll = () =>
    Promise.all([client.get('/api/employees'), client.get('/api/departments')])
      .then(([empRes, deptRes]) => {
        setEmployees(empRes.data.employees);
        setDepartments(deptRes.data.departments);
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

  const openAdd    = () => { setModalError(''); setModalEmployee(null); };
  const openEdit   = (emp) => { setModalError(''); setModalEmployee(emp); };
  const closeModal = () => setModalEmployee(undefined);

  const handleSave = (payload) => {
    setSaving(true);
    setModalError('');
    const isNew = !modalEmployee;
    const req   = isNew
      ? client.post('/api/employees', payload)
      : client.put(`/api/employees/${modalEmployee.id}`, payload);

    req
      .then(async ({ data: emp }) => {
        closeModal();
        fetchAll();
        if (isNew && emp.email) {
          const defaultPassword = 'Password123';
          const username = `${payload.firstName}${payload.lastName}`
            .toLowerCase().replace(/[^a-z0-9]/g, '');
          try {
            await client.post('/api/auth/register', { username, email: emp.email, password: defaultPassword });
            setNewCredentials({ email: emp.email, password: defaultPassword });
          } catch { /* 409 = already exists */ }
        }
      })
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

  if (loading) return <Spinner />;
  if (error)   return <p className="py-10 text-center text-red-500 text-sm">{error}</p>;

  const canAdd    = role === 'admin';
  const canEdit   = role === 'admin' || role === 'manager';
  const canDelete = role === 'admin';
  const hasActions = canEdit || canDelete;

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-medium text-slate-500">
          {filtered.length} {filtered.length !== 1 ? 'employees' : 'employee'}{search ? ' found' : ''}
        </span>
        {canAdd && (
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            onClick={openAdd}
          >
            + Add Employee
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-5">
        <input
          className="w-full max-w-md h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          placeholder="Search by name, email, position, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            onClick={() => setSearch('')}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Position</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Department</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Manager</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Hire Date</th>
                {hasActions && (
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6 + (hasActions ? 1 : 0)}
                    className="px-4 py-16 text-center text-slate-400 text-sm"
                  >
                    {search ? 'No employees match your search.' : 'No employees yet. Add one to get started.'}
                  </td>
                </tr>
              ) : filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 text-sm text-slate-700 min-w-[220px]">
                    <div className="flex items-center gap-2.5">
                      <Avatar firstName={emp.firstName} lastName={emp.lastName} size="sm" />
                      <div>
                        <div className="font-semibold text-slate-900">{emp.firstName} {emp.lastName}</div>
                        <span className="block text-xs text-slate-400 mt-0.5">{emp.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{emp.position || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{emp.department?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    <StatusBadge status={emp.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{emp.hireDate || '—'}</td>
                  {hasActions && (
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                            onClick={() => openEdit(emp)}
                          >
                            <EditIcon />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                            onClick={() => setConfirmId(emp.id)}
                          >
                            <DeleteIcon />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modalEmployee !== undefined && (
        <EmployeeModal
          employee={modalEmployee} departments={departments} employees={employees}
          userRole={role} onClose={closeModal} onSave={handleSave}
          loading={saving} serverError={modalError}
        />
      )}

      {confirmId && (
        <ConfirmModal
          title="Delete Employee"
          message="Are you sure you want to delete this employee? This cannot be undone."
          onConfirm={handleDelete} onCancel={() => setConfirmId(null)} loading={deleting}
        />
      )}

      {/* New credentials toast */}
      {newCredentials && (
        <div className="fixed bottom-6 right-6 z-50 bg-dark-800 text-slate-100 rounded-xl p-5 shadow-xl max-w-sm text-sm leading-relaxed">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="font-bold mb-1.5 text-green-400">Login account created</div>
              <div className="text-slate-400 text-xs">Share these credentials with the employee:</div>
              <div className="mt-2 bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
                <div><span className="text-slate-500">Email: </span><strong>{newCredentials.email}</strong></div>
                <div><span className="text-slate-500">Password: </span><strong>{newCredentials.password}</strong></div>
              </div>
            </div>
            <button
              onClick={() => setNewCredentials(null)}
              className="text-slate-500 hover:text-slate-300 text-base leading-none flex-shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default EmployeesPage;
