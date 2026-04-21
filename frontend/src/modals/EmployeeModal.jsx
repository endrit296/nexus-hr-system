import { useState } from 'react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

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
    e?.preventDefault();

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('First name, last name and email are required.');
      return;
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (form.salary && Number(form.salary) < 0) {
      setError('Salary cannot be a negative number.');
      return;
    }

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

  const isEdit         = !!employee;
  const canSeeSalary   = userRole === 'admin';
  const managerOptions = employees.filter((e) => !isEdit || e.id !== employee.id);
  const displayError   = error || serverError;

  const labelCls = 'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5';
  const inputCls = 'w-full h-[46px] px-3 rounded border-[1.5px] border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:bg-white transition-all duration-200';
  const selectCls = inputCls;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit Employee' : 'Add Employee'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="First Name *" value={form.firstName} onChange={set('firstName')} placeholder="Jane" />
          <Input label="Last Name *"  value={form.lastName}  onChange={set('lastName')}  placeholder="Doe" />
          <Input label="Email *"      type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" />
          <Input label="Phone"        value={form.phone}    onChange={set('phone')}    placeholder="+1 555 000 0000" />
          <Input label="Position"     value={form.position} onChange={set('position')} placeholder="Software Engineer" />

          <div className="flex flex-col">
            <label className={labelCls}>Status</label>
            <select className={selectCls} value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className={labelCls}>Department</label>
            <select className={selectCls} value={form.departmentId} onChange={set('departmentId')}>
              <option value="">— None —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className={labelCls}>Manager</label>
            <select className={selectCls} value={form.managerId} onChange={set('managerId')}>
              <option value="">— None —</option>
              {managerOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}{e.position ? ` — ${e.position}` : ''}
                </option>
              ))}
            </select>
          </div>

          <Input label="Hire Date" type="date" value={form.hireDate} onChange={set('hireDate')} />

          {canSeeSalary && (
            <Input label="Salary" type="number" min="0" step="0.01" value={form.salary} onChange={set('salary')} placeholder="50000" />
          )}
        </div>

        {displayError && (
          <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            ⚠️ {displayError}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default EmployeeModal;
