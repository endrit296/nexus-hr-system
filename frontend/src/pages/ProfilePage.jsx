import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import RoleBadge from '../components/ui/RoleBadge';
import StatusBadge from '../components/ui/StatusBadge';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import LeaveModal from '../modals/LeaveModal';
import { showSuccess, showError } from '../utils/toast';
import { formatDateShort } from '../utils/formatDate';

const LEAVE_STATUS_STYLE = {
  pending:   'bg-amber-50  text-amber-700',
  approved:  'bg-green-50  text-green-700',
  rejected:  'bg-red-50    text-red-700',
  withdrawn: 'bg-slate-100 text-slate-500',
};

function LeaveStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${LEAVE_STATUS_STYLE[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function formatSalary(num) {
  if (!num) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
}

function calcTenure(hireDateStr) {
  if (!hireDateStr) return null;
  const hire  = new Date(hireDateStr);
  const now   = new Date();
  let years   = now.getFullYear() - hire.getFullYear();
  let months  = now.getMonth() - hire.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years === 0)  return `${months} mo`;
  if (months === 0) return `${years} yr`;
  return `${years} yr ${months} mo`;
}

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ icon, label, children }) {
  return (
    <div className="flex gap-3 items-start pt-4 first:pt-0">
      <span className="text-base flex-shrink-0 mt-0.5 w-5 text-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</div>
        <div className="text-base text-slate-900">{children}</div>
      </div>
    </div>
  );
}

// ── Phone inline editor ───────────────────────────────────────────────────────
function PhoneField({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value || '');
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-0.5">
        <input
          className="flex-1 h-9 px-3 rounded border-[1.5px] border-brand-300 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:bg-white transition-all min-w-0"
          value={draft} onChange={(e) => setDraft(e.target.value)}
          placeholder="+1 (555) 000-0000" autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); } }}
        />
        <button className="px-3 py-1.5 rounded bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors flex-shrink-0"
          onClick={handleSave} disabled={saving}>{saving ? '…' : 'Save'}</button>
        <button className="px-2.5 py-1.5 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
          onClick={() => { setDraft(value || ''); setEditing(false); }}>Cancel</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`text-base font-medium ${value ? 'text-slate-900' : 'text-slate-400 italic'}`}>{value || 'Not set'}</span>
      <button className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors text-xs leading-none"
        onClick={() => { setDraft(value || ''); setEditing(true); }} title="Edit phone">✏️</button>
    </div>
  );
}

// ── Change Password form ──────────────────────────────────────────────────────
const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});

function ChangePasswordForm() {
  const [saving, setSaving]   = useState(false);
  const [open, setOpen]       = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(pwSchema) });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setSaving(true);
    try {
      await client.put('/api/auth/change-password', { currentPassword, newPassword });
      showSuccess('Password changed. Please sign in again.');
      reset();
      setOpen(false);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Security</p>
        {!open && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Change Password</Button>
        )}
      </div>

      {open ? (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
          <Input label="Current password" type="password" placeholder="••••••••"
            error={errors.currentPassword?.message} {...register('currentPassword')} />
          <Input label="New password" type="password" placeholder="••••••••"
            error={errors.newPassword?.message} {...register('newPassword')} />
          <Input label="Confirm new password" type="password" placeholder="••••••••"
            error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          <div className="flex gap-2 pt-1">
            <Button variant="primary" type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : 'Update password'}
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => { reset(); setOpen(false); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Keep your account secure with a strong password.</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function ProfilePage({ user }) {
  const [employee,      setEmployee]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [noRecord,      setNoRecord]      = useState(false);
  const [leaveBalance,  setLeaveBalance]  = useState([]);
  const [myRequests,    setMyRequests]    = useState([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [withdrawingId,  setWithdrawingId]  = useState(null);

  const loadEmployee = () =>
    client.get('/api/employees/me')
      .then(({ data }) => {
        setEmployee(data);
        return data;
      })
      .catch((err) => { if (err.response?.status === 404) setNoRecord(true); return null; });

  const loadLeaveData = (emp) => {
    if (!emp) return;
    Promise.all([
      client.get(`/api/v1/employees/${emp.id}/leave-balance`),
      client.get('/api/v1/leave-requests'),
    ]).then(([balRes, reqRes]) => {
      setLeaveBalance(balRes.data || []);
      setMyRequests(reqRes.data?.requests || []);
    }).catch(() => {});
  };

  useEffect(() => {
    loadEmployee()
      .then((emp) => loadLeaveData(emp))
      .finally(() => setLoading(false));
  }, []);

  const handlePhoneSave = async (phone) => {
    const { data } = await client.put('/api/employees/me', { phone });
    setEmployee((prev) => ({ ...prev, phone: data.phone }));
  };

  const handleLeaveSuccess = () => loadLeaveData(employee);

  const handleWithdraw = async (id) => {
    setWithdrawingId(id);
    try {
      await client.post(`/api/v1/leave-requests/${id}/withdraw`);
      showSuccess('Leave request withdrawn.');
      loadLeaveData(employee);
    } catch (e) {
      showError(e.response?.data?.message || 'Failed to withdraw request.');
    } finally {
      setWithdrawingId(null);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const canWithdraw = (req) =>
    ['pending', 'approved'].includes(req.status) && String(req.startDate).slice(0, 10) > today;

  if (loading) return <Spinner />;

  const role         = user?.role || 'employee';
  const tenure       = employee ? calcTenure(employee.hireDate) : null;
  const subordinates = employee?.subordinates || [];
  const firstName    = employee?.firstName || user?.username || '';
  const lastName     = employee?.lastName  || '';
  const displayName  = employee ? `${employee.firstName} ${employee.lastName}` : user?.username;

  return (
    <>
      {/* ── Hero ── */}
      <div className="relative h-24 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-500 mb-12">
        <div className="absolute -bottom-8 left-8">
          <Avatar firstName={firstName} lastName={lastName} size="lg" className="ring-4 ring-white shadow-lg" />
        </div>
        {/* Profile completion indicator */}
        {employee && (() => {
          const fields = [employee.phone, employee.position, employee.hireDate, employee.department?.name];
          const filled = fields.filter(Boolean).length;
          const pct    = Math.round((filled / fields.length) * 100);
          return pct < 100 ? (
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col items-end gap-1">
              <span className="text-white/90 text-xs font-semibold">Profile {pct}% complete</span>
              <div className="w-28 h-1.5 rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white/90 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ) : null;
        })()}
      </div>

      {/* ── Identity ── */}
      <div className="pt-4 px-8 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-extrabold text-slate-900">{displayName}</h2>
          <RoleBadge role={role} />
        </div>
        <p className="text-sm text-slate-500 mt-1">{employee?.position || 'No position assigned'}</p>
        <div className="flex gap-2 flex-wrap mt-2">
          {employee?.status && <StatusBadge status={employee.status} />}
          {employee?.department?.name && (
            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
              🏢 {employee.department.name}
            </span>
          )}
        </div>
      </div>

      {/* ── No record warning ── */}
      {noRecord && (
        <div className="mx-8 mb-6 border-[1.5px] border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-400">
          <div className="text-3xl mb-2">🔗</div>
          <div className="font-semibold text-slate-500 mb-1">No employee record linked</div>
          <div className="text-sm">Your login account exists but isn&apos;t linked to an employee profile yet.</div>
          <div className="text-sm mt-1">Ask an admin to create your employee record.</div>
        </div>
      )}

      {/* ── Info cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6 px-8">

        {/* Contact & Account */}
        <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Contact &amp; Account</p>
          <div className="divide-y divide-slate-50">
            <FieldRow icon="📧" label="Email">{user?.email || employee?.email || '—'}</FieldRow>
            <FieldRow icon="📱" label="Phone">
              {employee
                ? <PhoneField value={employee.phone} onSave={handlePhoneSave} />
                : <span className="text-slate-400 italic">No employee record</span>}
            </FieldRow>
            <FieldRow icon="👤" label="Username">{user?.username || '—'}</FieldRow>
            <FieldRow icon="🔑" label="Role"><RoleBadge role={role} /></FieldRow>
          </div>
        </div>

        {/* Employment Details */}
        <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Employment Details</p>
          <div className="divide-y divide-slate-50">
            <FieldRow icon="💼" label="Position">
              <span className={employee?.position ? 'text-slate-900' : 'text-slate-400 italic'}>{employee?.position || '—'}</span>
            </FieldRow>
            <FieldRow icon="📅" label="Hire Date">
              <span>
                {employee?.hireDate ? formatDateShort(employee.hireDate) : '—'}
                {tenure && (
                  <span className="ml-2 inline-block bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-500 px-2 py-0.5 align-middle">
                    {tenure}
                  </span>
                )}
              </span>
            </FieldRow>
            <FieldRow icon="🏢" label="Department">
              <span className={employee?.department?.name ? 'text-slate-900' : 'text-slate-400 italic'}>{employee?.department?.name || '—'}</span>
            </FieldRow>
            <FieldRow icon="👤" label="Reports To">
              <span className={employee?.manager ? 'text-slate-900' : 'text-slate-400 italic'}>
                {employee?.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'}
              </span>
            </FieldRow>
            {role === 'admin' && (
              <FieldRow icon="💰" label="Salary">
                {employee?.salary
                  ? <span className="text-lg font-bold text-slate-900">{formatSalary(employee.salary)}</span>
                  : <span className="text-slate-400 italic">—</span>}
              </FieldRow>
            )}
          </div>
        </div>
      </div>

      {/* ── Leave Balance ── */}
      {employee && leaveBalance.length > 0 && (
        <div className="mx-8 mt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Leave Balance</p>
            <Button variant="primary" size="sm" onClick={() => setLeaveModalOpen(true)}>
              + Apply for Leave
            </Button>
          </div>
          <div className={`grid gap-4 ${leaveBalance.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {leaveBalance.map((b) => (
              <div key={b.leave_type.id} className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{b.leave_type.name}</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">{b.available}</p>
                <p className="text-xs text-slate-400 mt-0.5">days available</p>
                {b.expiring_balance > 0 && (
                  <p className="text-xs text-amber-600 font-semibold mt-1">
                    ⚠ {b.expiring_balance} day{b.expiring_balance !== 1 ? 's' : ''} may expire on 1 Jul
                  </p>
                )}
                <div className="mt-4 flex gap-4 text-xs text-slate-500 border-t border-slate-50 pt-3">
                  <span><span className="font-semibold text-slate-700">{b.accrued}</span> accrued</span>
                  <span><span className="font-semibold text-slate-700">{b.consumed}</span> consumed</span>
                  {b.reserved > 0 && (
                    <span><span className="font-semibold text-amber-600">{b.reserved}</span> reserved</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── My Leave Requests ── */}
      {employee && myRequests.length > 0 && (
        <div className="mx-8 mt-5 bg-white rounded-lg ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">My Leave Requests</p>
          </div>
          <div className="divide-y divide-slate-50">
            {myRequests.slice(0, 10).map((req) => (
              <div key={req.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {req.leaveType?.name || 'Leave'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {req.startDate === req.endDate
                        ? formatDateShort(req.startDate)
                        : `${formatDateShort(req.startDate)} – ${formatDateShort(req.endDate)}`}
                      {' · '}{req.workingDaysCount} day{req.workingDaysCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <LeaveStatusBadge status={req.status} />
                {canWithdraw(req) && (
                  <button
                    className="text-xs text-red-500 hover:text-red-700 font-semibold disabled:opacity-50 flex-shrink-0"
                    onClick={() => handleWithdraw(req.id)}
                    disabled={withdrawingId === req.id}
                  >
                    {withdrawingId === req.id ? '…' : 'Withdraw'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Apply for leave CTA when no balance yet ── */}
      {employee && leaveBalance.length === 0 && (
        <div className="mx-8 mt-5 border-[1.5px] border-dashed border-slate-200 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-400">No leave balance accrued yet.</p>
        </div>
      )}

      <LeaveModal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        leaveBalance={leaveBalance}
        onSuccess={handleLeaveSuccess}
      />

      {/* ── Security (Change Password) ── */}
      <div className="mx-8 mt-5">
        <ChangePasswordForm />
      </div>

      {/* ── Direct Reports ── */}
      {subordinates.length > 0 && (
        <div className="mx-8 mt-5 bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            Direct Reports — {subordinates.length} {subordinates.length === 1 ? 'person' : 'people'}
          </p>
          <div className="flex flex-wrap gap-3">
            {subordinates.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 w-[220px] hover:border-brand-300 hover:shadow-sm transition-all">
                <Avatar firstName={sub.firstName} lastName={sub.lastName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-900 truncate">{sub.firstName} {sub.lastName}</span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sub.status === 'active' ? 'bg-green-400' : sub.status === 'on_leave' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{sub.position || 'No position'}</div>
                  {sub.department?.name && <div className="text-[10px] text-slate-400 mt-0.5">{sub.department.name}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default ProfilePage;
