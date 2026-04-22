import { useEffect, useState } from 'react';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import DataTable from '../components/ui/DataTable';
import Spinner from '../components/ui/Spinner';
import { showError } from '../utils/toast';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, bg, iconColor }) {
  return (
    <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-5 hover:shadow-md hover:ring-brand-500/30 hover:-translate-y-0.5 transition-all duration-200">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
        <span className={`${iconColor} text-lg`}>{icon}</span>
      </div>
      <div className="text-2xl font-extrabold text-slate-900 mt-3">{value}</div>
      <div className="text-sm font-medium text-slate-500 mt-1">{label}</div>
    </div>
  );
}

// ── Table columns ─────────────────────────────────────────────────────────────

const columns = [
  {
    key: 'name',
    label: 'Name',
    render: (row) => (
      <div className="flex items-center gap-3">
        <Avatar firstName={row.firstName} lastName={row.lastName} size="sm" />
        <div>
          <div className="font-semibold text-slate-900 text-sm">{row.firstName} {row.lastName}</div>
          <div className="text-slate-400 text-xs">{row.email}</div>
        </div>
      </div>
    ),
  },
  { key: 'position',   label: 'Position',   render: (row) => row.position           || '—' },
  { key: 'department', label: 'Department', render: (row) => row.department?.name   || '—' },
  { key: 'status',     label: 'Status',     render: (row) => <StatusBadge status={row.status} /> },
  { key: 'hireDate',   label: 'Hire Date',  render: (row) => row.hireDate           || '—' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

function DashboardHome() {
  const [employees, setEmployees]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/api/employees'),
      client.get('/api/departments'),
    ]).then(([empRes, deptRes]) => {
      setEmployees(empRes.data.employees   || []);
      setDepartments(deptRes.data.departments || []);
    }).catch(() => showError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const total     = employees.length;
  const active    = employees.filter((e) => e.status === 'active').length;
  const onLeave   = employees.filter((e) => e.status === 'on_leave').length;
  const deptCount = departments.length;

  const recent = [...employees]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} employee{total !== 1 ? 's' : ''} across {deptCount} department{deptCount !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard icon="👥" label="Total Employees" value={total}     bg="bg-brand-50"  iconColor="text-brand-600" />
        <StatCard icon="✅" label="Active"           value={active}    bg="bg-green-50"  iconColor="text-green-600" />
        <StatCard icon="🏖️" label="On Leave"         value={onLeave}   bg="bg-amber-50"  iconColor="text-amber-600" />
        <StatCard icon="🏢" label="Departments"      value={deptCount} bg="bg-indigo-50" iconColor="text-indigo-600" />
      </div>

      {/* ── Recent hires ── */}
      <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-md font-semibold text-slate-900">Recent Hires</h2>
        </div>

        <DataTable
          columns={columns}
          data={recent}
          emptyMessage="No employees yet."
        />

        <div className="px-5 py-3 border-t border-slate-100">
          <span className="text-sm text-brand-600 font-semibold hover:underline cursor-pointer">
            View all employees →
          </span>
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;
