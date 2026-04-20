import { useState } from 'react';
import './Modal.css';

const empty = {
  firstName: '', lastName: '', email: '', phone: '',
  position: '', status: 'active', hireDate: '', salary: '',
  departmentId: '', managerId: '',
};

function EmployeeModal({ employee, departments, employees, userRole, onClose, onSave, loading, serverError }) {
  const [form, setForm] = useState(
    employee
      ? {
          firstName:    employee.firstName    || '',
          lastName:     employee.lastName     || '',
          email:        employee.email        || '',
          phone:        employee.phone        || '',
          position:     employee.position     || '',
          status:       employee.status       || 'active',
          hireDate:     employee.hireDate     || '',
          salary:       employee.salary       || '',
          departmentId: employee.departmentId || '',
          managerId:    employee.managerId    || '',
        }
      : { ...empty }
  );
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();

    // ── VALIDIMET E FAZËS II ─────────────────────────────────

    // 1. Kontrolli për fushat e detyrueshme
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('Emri, mbiemri dhe email-i janë të detyrueshëm!');
      return;
    }

    // 2. Kontrolli i formatit të email-it
    if (!form.email.includes('@')) {
      setError('Ju lutem jepni një email të vlefshëm!');
      return;
    }

    // 3. Kontrolli i pagës (nuk lejohen numra negativë)
    if (form.salary && Number(form.salary) < 0) {
      setError('Paga nuk mund të jetë numër negativ!');
      return;
    }

    // ─────────────────────────────────────────────────────────

    setError('');
    const payload = {
      firstName:    form.firstName.trim(),
      lastName:     form.lastName.trim(),
      email:        form.email.trim(),
      phone:        form.phone        || null,
      position:     form.position     || null,
      status:       form.status,
      hireDate:     form.hireDate     || null,
      salary:       form.salary       ? Number(form.salary) : null,
      departmentId: form.departmentId ? Number(form.departmentId) : null,
      managerId:    form.managerId    ? Number(form.managerId)    : null,
    };
    onSave(payload);
  };

  const isEdit      = !!employee;
  const canSeeSalary = userRole === 'admin';
  const managerOptions = employees.filter((e) => !isEdit || e.id !== employee.id);

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? 'Edit Employee' : 'Add Employee'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input className="form-input" value={form.firstName} onChange={set('firstName')} placeholder="Jane" />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input className="form-input" value={form.lastName} onChange={set('lastName')} placeholder="Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
              </div>
              <div className="form-group">
                <label className="form-label">Position</label>
                <input className="form-input" value={form.position} onChange={set('position')} placeholder="Software Engineer" />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={set('status')}>
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-select" value={form.departmentId} onChange={set('departmentId')}>
                  <option value="">— None —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Manager</label>
                <select className="form-select" value={form.managerId} onChange={set('managerId')}>
                  <option value="">— None —</option>
                  {managerOptions.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}{e.position ? ` — ${e.position}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Hire Date</label>
                <input className="form-input" type="date" value={form.hireDate} onChange={set('hireDate')} />
              </div>
              {canSeeSalary && (
                <div className="form-group">
                  <label className="form-label">Salary</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.salary} onChange={set('salary')} placeholder="50000" />
                </div>
              )}
              {(error || serverError) && <p className="form-error">⚠️ {error || serverError}</p>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeModal;