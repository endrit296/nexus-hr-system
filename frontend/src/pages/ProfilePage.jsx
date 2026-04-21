import { useEffect, useState } from 'react';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import RoleBadge from '../components/ui/RoleBadge';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import './ProfilePage.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Phone inline editor ───────────────────────────────────────────────────────

function PhoneField({ value, onSave }) {
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(value || '');
  const [saving,   setSaving]   = useState(false);

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
      <div className="profile-phone-row">
        <input
          className="profile-phone-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+1 (555) 000-0000"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
        />
        <button className="profile-phone-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? '…' : 'Save'}
        </button>
        <button className="profile-phone-cancel-btn" onClick={handleCancel}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="profile-phone-row">
      <span className={value ? '' : 'profile-field-value muted'} style={{ fontSize: 13.5, fontWeight: 500, color: value ? '#0f172a' : undefined }}>
        {value || 'Not set'}
      </span>
      <button className="profile-phone-edit-btn" onClick={() => { setDraft(value || ''); setEditing(true); }} title="Edit phone">
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

  const role        = user?.role || 'employee';
  const tenure      = employee ? calcTenure(employee.hireDate) : null;
  const subordinates = employee?.subordinates || [];

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="profile-hero">
        {employee
          ? <Avatar firstName={employee.firstName} lastName={employee.lastName} size="lg" />
          : <Avatar firstName={user?.username} lastName="" size="lg" />}

        <div className="profile-hero-info">
          <h2 className="profile-hero-name">
            {employee
              ? `${employee.firstName} ${employee.lastName}`
              : user?.username}
          </h2>
          <p className="profile-hero-position">
            {employee?.position || 'No position assigned'}
          </p>
          <div className="profile-hero-tags">
            {employee?.status && <StatusBadge status={employee.status} />}
            {employee?.department?.name && (
              <span className="profile-hero-tag dept-tag">
                🏢 {employee.department.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── No employee record warning ──────────────────────────────────── */}
      {noRecord && (
        <div className="profile-no-record" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔗</div>
          <div style={{ fontWeight: 600, color: '#475569', marginBottom: 4 }}>No employee record linked</div>
          <div>Your login account exists but isn&apos;t linked to an employee profile yet.</div>
          <div style={{ marginTop: 4 }}>Ask an admin to create your employee record.</div>
        </div>
      )}

      {/* ── Card grid ──────────────────────────────────────────────────── */}
      <div className="profile-grid">

        {/* Contact & Account */}
        <div className="profile-card">
          <p className="profile-card-title">Contact &amp; Account</p>

          <div className="profile-field">
            <span className="profile-field-icon">📧</span>
            <div className="profile-field-body">
              <div className="profile-field-label">Email</div>
              <div className="profile-field-value">{user?.email || employee?.email || '—'}</div>
            </div>
          </div>

          <div className="profile-field">
            <span className="profile-field-icon">📱</span>
            <div className="profile-field-body">
              <div className="profile-field-label">Phone</div>
              {employee
                ? <PhoneField value={employee.phone} onSave={handlePhoneSave} />
                : <div className="profile-field-value muted">No employee record</div>}
            </div>
          </div>

          <div className="profile-field">
            <span className="profile-field-icon">👤</span>
            <div className="profile-field-body">
              <div className="profile-field-label">Username</div>
              <div className="profile-field-value">{user?.username || '—'}</div>
            </div>
          </div>

          <div className="profile-field">
            <span className="profile-field-icon">🔑</span>
            <div className="profile-field-body">
              <div className="profile-field-label">Role</div>
              <RoleBadge role={role} />
            </div>
          </div>
        </div>

        {/* Employment details */}
        <div className="profile-card">
          <p className="profile-card-title">Employment Details</p>

          <div className="profile-field">
            <span className="profile-field-icon">💼</span>
            <div className="profile-field-body">
              <div className="profile-field-label">Position</div>
              <div className={`profile-field-value${!employee?.position ? ' muted' : ''}`}>
                {employee?.position || '—'}
              </div>
            </div>
          </div>

          <div className="profile-field">
            <span className="profile-field-icon">📅</span>
            <div className="profile-field-body">
              <div className="profile-field-label">Hire Date</div>
              <div className="profile-field-value">
                {employee?.hireDate ? formatDateShort(employee.hireDate) : '—'}
                {tenure && <span className="profile-tenure-pill">{tenure}</span>}
              </div>
            </div>
          </div>

          <div className="profile-field">
            <span className="profile-field-icon">🏢</span>
            <div className="profile-field-body">
              <div className="profile-field-label">Department</div>
              <div className={`profile-field-value${!employee?.department?.name ? ' muted' : ''}`}>
                {employee?.department?.name || '—'}
              </div>
            </div>
          </div>

          <div className="profile-field">
            <span className="profile-field-icon">👤</span>
            <div className="profile-field-body">
              <div className="profile-field-label">Reports To</div>
              <div className={`profile-field-value${!employee?.manager ? ' muted' : ''}`}>
                {employee?.manager
                  ? `${employee.manager.firstName} ${employee.manager.lastName}`
                  : '—'}
              </div>
            </div>
          </div>

          {role === 'admin' && (
            <div className="profile-field">
              <span className="profile-field-icon">💰</span>
              <div className="profile-field-body">
                <div className="profile-field-label">Salary</div>
                {employee?.salary
                  ? <div className="profile-salary">{formatSalary(employee.salary)}</div>
                  : <div className="profile-field-value muted">—</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Direct reports ─────────────────────────────────────────────── */}
      {subordinates.length > 0 && (
        <div className="profile-reports-card">
          <p className="profile-card-title">
            Direct Reports — {subordinates.length} {subordinates.length === 1 ? 'person' : 'people'}
          </p>
          <div className="profile-reports-grid">
            {subordinates.map((sub) => (
              <div key={sub.id} className="profile-report-chip">
                <Avatar firstName={sub.firstName} lastName={sub.lastName} size="sm" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="profile-report-name">{sub.firstName} {sub.lastName}</div>
                    <span className={`profile-report-status profile-report-status--${sub.status || 'active'}`} />
                  </div>
                  <div className="profile-report-pos">{sub.position || 'No position'}</div>
                  {sub.department?.name && (
                    <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                      {sub.department.name}
                    </div>
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
