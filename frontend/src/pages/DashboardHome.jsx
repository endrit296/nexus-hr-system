import { useEffect, useState } from 'react';
import client from '../api/client';

function StatCard({ icon, iconClass, value, label }) {
  return (
    <div className={`stat-card stat-card-${iconClass}`}>
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function DashboardHome() {
  const [employees, setEmployees]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/api/employees'),
      client.get('/api/departments'),
    ]).then(([empRes, deptRes]) => {
      setEmployees(empRes.data.employees);
      setDepartments(deptRes.data.departments);
    }).finally(() => setLoading(false));
  }, []);

  const total    = employees.length;
  const active   = employees.filter((e) => e.status === 'active').length;
  const onLeave  = employees.filter((e) => e.status === 'on_leave').length;
  const deptCount = departments.length;

  const recent = [...employees]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (loading) return <p className="status-msg">Loading…</p>;

  return (
    <>
      <div className="stat-cards">
        <StatCard icon="👥" iconClass="blue"   value={total}     label="Total Employees" />
        <StatCard icon="✅" iconClass="green"  value={active}    label="Active" />
        <StatCard icon="🏖️" iconClass="amber"  value={onLeave}   label="On Leave" />
        <StatCard icon="🏢" iconClass="purple" value={deptCount} label="Departments" />
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <h3 className="section-card-title">Recent Hires</h3>
        </div>
        {recent.length === 0 ? (
          <p className="table-empty">No employees yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>Department</th>
                <th>Status</th>
                <th>Hire Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
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
                  <td><span className={`badge badge-${emp.status}`}>{emp.status.replace('_', ' ')}</span></td>
                  <td>{emp.hireDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default DashboardHome;
