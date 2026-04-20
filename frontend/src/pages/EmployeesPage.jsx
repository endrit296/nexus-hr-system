import { useEffect, useState } from 'react';
import client from '../api/client';
import EmployeeModal from '../modals/EmployeeModal';
import ConfirmModal from '../modals/ConfirmModal';

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
  const [newCredentials, setNewCredentials] = useState(null); // { email, password }

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

  const openAdd   = () => { setModalError(''); setModalEmployee(null); };
  const openEdit  = (emp) => { setModalError(''); setModalEmployee(emp); };
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

        // Auto-provision a login account for every newly created employee
        if (isNew && emp.email) {
          const defaultPassword = 'Password123';
          const username = `${payload.firstName}${payload.lastName}`
            .toLowerCase().replace(/[^a-z0-9]/g, '');
          try {
            await client.post('/api/auth/register', {
              username,
              email:    emp.email,
              password: defaultPassword,
            });
            setNewCredentials({ email: emp.email, password: defaultPassword });
          } catch {
            // 409 = auth account already exists — silently skip
          }
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

  if (loading) return <p className="status-msg">Loading…</p>;
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
            placeholder="Search by name, email, position, department…"
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
                <th>Name</th>
                <th>Position</th>
                <th>Department</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Hire Date</th>
                {(canEdit || canDelete) && <th style={{ width: 90 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {emp.firstName?.[0]}{emp.lastName?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{emp.firstName} {emp.lastName}</div>
                        <div style={{ color: '#94a3b8', fontSize: 11.5 }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{emp.position || '—'}</td>
                  <td>{emp.department?.name || '—'}</td>
                  <td>{emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '—'}</td>
                  <td>
                    <span className={`badge badge-${emp.status}`}>
                      {emp.status.replace('_', ' ')}
                    </span>
                  </td>
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
          employee={modalEmployee}
          departments={departments}
          employees={employees}
          userRole={role}
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

      {newCredentials && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          background: '#0f172a', color: '#f1f5f9', borderRadius: 12,
          padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          maxWidth: 340, fontSize: 13, lineHeight: 1.6,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#4ade80' }}>✓ Login account created</div>
              <div style={{ color: '#94a3b8', fontSize: 11.5 }}>Share these credentials with the employee:</div>
              <div style={{ marginTop: 8, background: '#1e293b', borderRadius: 7, padding: '8px 12px' }}>
                <div><span style={{ color: '#64748b' }}>Email: </span><strong>{newCredentials.email}</strong></div>
                <div><span style={{ color: '#64748b' }}>Password: </span><strong>{newCredentials.password}</strong></div>
              </div>
            </div>
            <button
              onClick={() => setNewCredentials(null)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 0, flexShrink: 0 }}
            >✕</button>
          </div>
        </div>
      )}
    </>
  );
}

export default EmployeesPage;
