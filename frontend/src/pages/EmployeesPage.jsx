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

  const [modalEmployee, setModalEmployee] = useState(undefined); // undefined=closed, null=add, obj=edit
  const [saving, setSaving]               = useState(false);
  const [modalError, setModalError]       = useState('');

  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting]   = useState(false);

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

  if (loading) return <p className="status-msg">Loading…</p>;
  if (error)   return <p className="error-msg">{error}</p>;

  return (
    <>
      <div className="page-header">
        <h3>{filtered.length} employee{filtered.length !== 1 ? 's' : ''}{search ? ' found' : ''}</h3>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Employee</button>
      </div>

      <div className="section-card">
        <div className="table-toolbar">
          <input
            className="search-input"
            placeholder="Search by name, email, position, department…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn btn-ghost" onClick={() => setSearch('')}>Clear</button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="table-empty">{search ? 'No employees match your search.' : 'No employees yet. Add one to get started.'}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>Department</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Hire Date</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <strong>{emp.firstName} {emp.lastName}</strong>
                    <br />
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{emp.email}</span>
                  </td>
                  <td>{emp.position || '—'}</td>
                  <td>{emp.department?.name || '—'}</td>
                  <td>
                    {emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '—'}
                  </td>
                  <td>
                    <span className={`badge badge-${emp.status}`}>
                      {emp.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{emp.hireDate || '—'}</td>
                  <td>
                    <button className="btn-icon" title="Edit"   onClick={() => openEdit(emp)}>✏️</button>
                    <button className="btn-icon" title="Delete" onClick={() => setConfirmId(emp.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
    </>
  );
}

export default EmployeesPage;
