import { useEffect, useState } from 'react';
import client from '../api/client';
import EmployeeModal from '../modals/EmployeeModal';
import ConfirmModal from '../modals/ConfirmModal';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { showSuccess, showError } from '../utils/toast';

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
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
        showSuccess(isNew ? 'Employee added successfully.' : 'Employee updated successfully.');
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
      .catch((err) => {
        const msg = err.response?.data?.message || 'Failed to save employee.';
        setModalError(msg);
        showError(msg);
      })
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    setDeleting(true);
    client.delete(`/api/employees/${confirmId}`)
      .then(() => { setConfirmId(null); fetchAll(); showSuccess('Employee deleted.'); })
      .catch(() => showError('Failed to delete employee.'))
      .finally(() => setDeleting(false));
  };

  if (loading) return <Spinner />;
  if (error)   return <p className="py-10 text-center text-red-500 text-sm">{error}</p>;

  const canAdd    = role === 'admin';
  const canEdit   = role === 'admin' || role === 'manager';
  const canDelete = role === 'admin';

  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (emp) => (
        <div className="flex items-center gap-3 min-w-[200px]">
          <Avatar firstName={emp.firstName} lastName={emp.lastName} size="sm" />
          <div>
            <div className="font-semibold text-slate-900 text-sm">{emp.firstName} {emp.lastName}</div>
            <div className="text-xs text-slate-400 mt-0.5">{emp.position || 'No position'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      render: (emp) => <span className="text-sm text-slate-600">{emp.email}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      render: (emp) => emp.department?.name || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (emp) => <StatusBadge status={emp.status} />,
    },
    ...(canEdit || canDelete ? [{
      key: 'actions',
      label: '',
      render: (emp) => (
        <div className="flex gap-1">
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(emp)} title="Edit">
              <EditIcon />
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmId(emp.id)}
              title="Delete"
              className="hover:text-red-600 hover:bg-red-50"
            >
              <DeleteIcon />
            </Button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} {filtered.length !== 1 ? 'employees' : 'employee'}{search ? ' found' : ''}
          </p>
        </div>
        {canAdd && (
          <Button variant="primary" onClick={openAdd}>+ Add Employee</Button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <SearchIcon />
        </span>
        <input
          className="w-full sm:max-w-sm h-[42px] pl-10 pr-4 rounded-lg border-[1.5px] border-slate-200 bg-white text-base placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:shadow-focus transition-all duration-200"
          placeholder="Search by name, email, position, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        emptyMessage={search ? 'No employees match your search.' : 'No employees yet. Add one to get started.'}
      />

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
          message="Are you sure you want to delete this employee? This action cannot be undone."
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
              className="text-slate-500 hover:text-slate-300 leading-none flex-shrink-0"
            >✕</button>
          </div>
        </div>
      )}
    </>
  );
}

export default EmployeesPage;
