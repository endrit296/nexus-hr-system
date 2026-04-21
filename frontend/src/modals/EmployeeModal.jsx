import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const employeeSchema = z.object({
  firstName:    z.string().min(1, 'Required'),
  lastName:     z.string().min(1, 'Required'),
  email:        z.string().email('Invalid email'),
  phone:        z.string().optional(),
  position:     z.string().min(1, 'Required'),
  status:       z.enum(['active', 'on_leave', 'inactive']),
  departmentId: z.string().min(1, 'Select a department'),
  managerId:    z.string().optional(),
  hireDate:     z.string().optional(),
  salary:       z.string().optional(),
});

const labelCls  = 'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5';
const selectCls = 'w-full h-[46px] px-3 rounded border-[1.5px] bg-slate-50 text-sm text-slate-900 transition-all duration-200 focus:outline-none focus:bg-white';

function SelectField({ label, error, children, ...props }) {
  return (
    <div className="flex flex-col">
      <label className={labelCls}>{label}</label>
      <select
        className={`${selectCls} ${error ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-brand-500'}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function EmployeeModal({ employee, departments, employees, userRole, onClose, onSave, loading, serverError }) {
  const isEdit = !!employee;

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(employeeSchema),
    mode: 'onChange',
    defaultValues: {
      firstName:    employee?.firstName    || '',
      lastName:     employee?.lastName     || '',
      email:        employee?.email        || '',
      phone:        employee?.phone        || '',
      position:     employee?.position     || '',
      status:       employee?.status       || 'active',
      departmentId: employee?.departmentId ? String(employee.departmentId) : '',
      managerId:    employee?.managerId    ? String(employee.managerId)    : '',
      hireDate:     employee?.hireDate     || '',
      salary:       employee?.salary       ? String(employee.salary)       : '',
    },
  });

  const onSubmit = (data) => {
    onSave({
      firstName:    data.firstName.trim(),
      lastName:     data.lastName.trim(),
      email:        data.email.trim(),
      phone:        data.phone        || null,
      position:     data.position     || null,
      status:       data.status,
      hireDate:     data.hireDate     || null,
      salary:       data.salary       ? Number(data.salary)       : null,
      departmentId: data.departmentId ? Number(data.departmentId) : null,
      managerId:    data.managerId    ? Number(data.managerId)    : null,
    });
  };

  const canSeeSalary    = userRole === 'admin';
  const managerOptions  = employees.filter((e) => !isEdit || e.id !== employee.id);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit Employee' : 'Add Employee'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit(onSubmit)} disabled={loading}>
            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Employee'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4" noValidate>
        <Input label="First Name *" placeholder="Jane" error={errors.firstName?.message} {...register('firstName')} />
        <Input label="Last Name *"  placeholder="Doe"  error={errors.lastName?.message}  {...register('lastName')} />
        <Input label="Email *" type="email" placeholder="jane@company.com" error={errors.email?.message} {...register('email')} />
        <Input label="Phone" placeholder="+1 555 000 0000" error={errors.phone?.message} {...register('phone')} />
        <Input label="Position *" placeholder="Software Engineer" error={errors.position?.message} {...register('position')} />

        <SelectField label="Status" error={errors.status?.message} {...register('status')}>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
        </SelectField>

        <SelectField label="Department *" error={errors.departmentId?.message} {...register('departmentId')}>
          <option value="">— None —</option>
          {departments.map((d) => (
            <option key={d.id} value={String(d.id)}>{d.name}</option>
          ))}
        </SelectField>

        <SelectField label="Manager" error={errors.managerId?.message} {...register('managerId')}>
          <option value="">— None —</option>
          {managerOptions.map((e) => (
            <option key={e.id} value={String(e.id)}>
              {e.firstName} {e.lastName}{e.position ? ` — ${e.position}` : ''}
            </option>
          ))}
        </SelectField>

        <Input label="Hire Date" type="date" error={errors.hireDate?.message} {...register('hireDate')} />

        {canSeeSalary && (
          <Input label="Salary" type="number" min="0" step="0.01" placeholder="50000" error={errors.salary?.message} {...register('salary')} />
        )}

        {serverError && (
          <div className="col-span-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            ⚠️ {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}

export default EmployeeModal;
