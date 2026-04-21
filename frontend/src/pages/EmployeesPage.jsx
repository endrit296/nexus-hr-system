import { useEffect, useState } from 'react';
import client from '../api/client';
import EmployeeModal from '../modals/EmployeeModal';
import ConfirmModal from '../modals/ConfirmModal';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';

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

  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting]   = useState(false);
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
  if (error)   return <p className="error-msg">{error}</p>;

  const canAdd    = role === 'admin';
  const canEdit   = role === 'admin' || role === 'manager';
  const canDelete = role === 'admin';

  return (
    <>
      <div className="page-header">
        <h3>{filtered.length} employee{filtered.length !== 1 ? 's' : ''}{search ? ' found' : ''}</h3>
        {canAdd && (
          <button className="btn btn-primary" onClick={openAdd}>+ Add Employee</button>
        )}
      </div>

      <div className="section-card">
        <div className="table-toolbar">
          <input
            className="search-input"
            placeholder="Search by name, email, position, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn btn-ghost" onClick={() => setSearch('')}>Clear</button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="table-empty">
            {search ? 'No employees match your search.' : 'No employees yet. Add one to get started.'}
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Position</th><th>Department</th>
                <th>Manager</th><th>Status</th><th>Hire Date</th>
                {(canEdit || canDelete) && <th style={{ width: 90 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar firstName={emp.firstName} lastName={emp.lastName} size="sm" />
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{emp.firstName} {emp.lastName}</div>
                        <div className="text-slate-400 text-xs">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{emp.position || '—'}</td>
                  <td>{emp.department?.name || '—'}</td>
                  <td>{emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '—'}</td>
                  <td><StatusBadge status={emp.status} /></td>
                  <td>{emp.hireDate || '—'}</td>
                  {(canEdit || canDelete) && (
                    <td>
                      {canEdit   && <button className="btn-icon" title="Edit"   onClick={() => openEdit(emp)}>✏️</button>}
                      {canDelete && <button className="btn-icon" title="Delete" onClick={() => setConfirmId(emp.id)}>🗑️</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
            <button onClick={() => setNewCredentials(null)} className="text-slate-500 hover:text-slate-300 text-base leading-none flex-shrink-0">x</button>
          </div>
        </div>
      )}
    </>
  );
}

export default EmployeesPage;
