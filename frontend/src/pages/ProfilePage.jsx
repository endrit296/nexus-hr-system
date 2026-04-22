import { useEffect, useState } from 'react';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import RoleBadge from '../components/ui/RoleBadge';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
  let months  = now.getMonth()    - hire.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years === 0) return `${months} mo`;
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
  const [draft,   setDraft]   = useState(value || '');
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-0.5">
        <input
          className="flex-1 h-9 px-3 rounded border-[1.5px] border-brand-300 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:bg-white transition-all min-w-0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+1 (555) 000-0000"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
        />
        <button
          className="px-3 py-1.5 rounded bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors flex-shrink-0"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          className="px-2.5 py-1.5 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-base font-medium ${value ? 'text-slate-900' : 'text-slate-400 italic'}`}>
        {value || 'Not set'}
      </span>
      <button
        className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors text-xs leading-none"
        onClick={() => { setDraft(value || ''); setEditing(true); }}
        title="Edit phone"
      >
        ✏️
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ProfilePage({ user }) {
  const [employee, setEmployee] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [noRecord, setNoRecord] = useState(false);

  useEffect(() => {
    client.get('/api/employees/me')
      .then(({ data }) => setEmployee(data))
      .catch((err) => {
        if (err.response?.status === 404) setNoRecord(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePhoneSave = async (phone) => {
    const { data } = await client.put('/api/employees/me', { phone });
    setEmployee((prev) => ({ ...prev, phone: data.phone }));
  };

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
      <div className="relative h-40 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-500 mb-16">
        <div className="absolute -bottom-10 left-8">
          <Avatar firstName={firstName} lastName={lastName} size="lg" className="ring-4 ring-white shadow-lg" />
        </div>
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
            <FieldRow icon="📧" label="Email">
              {user?.email || employee?.email || '—'}
            </FieldRow>
            <FieldRow icon="📱" label="Phone">
              {employee
                ? <PhoneField value={employee.phone} onSave={handlePhoneSave} />
                : <span className="text-slate-400 italic">No employee record</span>}
            </FieldRow>
            <FieldRow icon="👤" label="Username">
              {user?.username || '—'}
            </FieldRow>
            <FieldRow icon="🔑" label="Role">
              <RoleBadge role={role} />
            </FieldRow>
          </div>
        </div>

        {/* Employment Details */}
        <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Employment Details</p>
          <div className="divide-y divide-slate-50">
            <FieldRow icon="💼" label="Position">
              <span className={employee?.position ? 'text-slate-900' : 'text-slate-400 italic'}>
                {employee?.position || '—'}
              </span>
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
              <span className={employee?.department?.name ? 'text-slate-900' : 'text-slate-400 italic'}>
                {employee?.department?.name || '—'}
              </span>
            </FieldRow>
            <FieldRow icon="👤" label="Reports To">
              <span className={employee?.manager ? 'text-slate-900' : 'text-slate-400 italic'}>
                {employee?.manager
                  ? `${employee.manager.firstName} ${employee.manager.lastName}`
                  : '—'}
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
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      sub.status === 'active'   ? 'bg-green-400' :
                      sub.status === 'on_leave' ? 'bg-amber-400' : 'bg-slate-400'
                    }`} />
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">{sub.position || 'No position'}</div>
                  {sub.department?.name && (
                    <div className="text-[10px] text-slate-400 mt-0.5">{sub.department.name}</div>
                  )}
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
