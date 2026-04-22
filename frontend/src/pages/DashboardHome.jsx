import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip,
  BarChart, Bar, XAxis, YAxis, Tooltip as BarTooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Tooltip as LineTooltip,
} from 'recharts';
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

// ── Chart card wrapper ────────────────────────────────────────────────────────

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── Colour palette ────────────────────────────────────────────────────────────

const STATUS_COLORS  = { active: '#22c55e', on_leave: '#f59e0b', inactive: '#94a3b8' };
const DEPT_COLOR     = '#6366f1';
const HIRE_COLOR     = '#6366f1';

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
  { key: 'position',   label: 'Position',   render: (row) => row.position         || '—' },
  { key: 'department', label: 'Department', render: (row) => row.department?.name  || '—' },
  { key: 'status',     label: 'Status',     render: (row) => <StatusBadge status={row.status} /> },
  { key: 'hireDate',   label: 'Hire Date',  render: (row) => row.hireDate          || '—' },
];

// ── Data helpers ──────────────────────────────────────────────────────────────

function buildStatusData(employees) {
  const counts = { active: 0, on_leave: 0, inactive: 0 };
  employees.forEach((e) => { if (counts[e.status] !== undefined) counts[e.status]++; });
  return [
    { name: 'Active',   value: counts.active,   color: STATUS_COLORS.active   },
    { name: 'On Leave', value: counts.on_leave,  color: STATUS_COLORS.on_leave },
    { name: 'Inactive', value: counts.inactive,  color: STATUS_COLORS.inactive },
  ].filter((d) => d.value > 0);
}

function buildDeptData(employees, departments) {
  const countMap = {};
  employees.forEach((e) => {
    if (e.departmentId) countMap[e.departmentId] = (countMap[e.departmentId] || 0) + 1;
  });
  return departments
    .map((d) => ({ name: d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name, count: countMap[d.id] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);
}

function buildHireData(employees) {
  const now    = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('default', { month: 'short' }), hires: 0 };
  });
  employees.forEach((e) => {
    if (!e.hireDate) return;
    const key = e.hireDate.slice(0, 7);
    const m   = months.find((x) => x.key === key);
    if (m) m.hires++;
  });
  return months;
}

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
      setEmployees(empRes.data.employees    || []);
      setDepartments(deptRes.data.departments || []);
    }).catch(() => showError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const total     = employees.length;
  const active    = employees.filter((e) => e.status === 'active').length;
  const onLeave   = employees.filter((e) => e.status === 'on_leave').length;
  const deptCount = departments.length;

  const recent     = [...employees].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const statusData = buildStatusData(employees);
  const deptData   = buildDeptData(employees, departments);
  const hireData   = buildHireData(employees);

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

      {/* ── Analytics charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">

        {/* Employees by status — Pie */}
        <ChartCard title="Employees by Status">
          {statusData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <PieTooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Headcount per department — Bar */}
        <ChartCard title="Headcount by Department">
          {deptData.every((d) => d.count === 0) ? (
            <p className="text-sm text-slate-400 text-center py-8">No department data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deptData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <BarTooltip />
                <Bar dataKey="count" fill={DEPT_COLOR} radius={[4, 4, 0, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Monthly hire trend — Line (spans full width) */}
        <ChartCard title="Monthly Hire Trend (last 6 months)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={hireData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <LineTooltip />
              <Line type="monotone" dataKey="hires" stroke={HIRE_COLOR} strokeWidth={2} dot={{ r: 4, fill: HIRE_COLOR }} name="Hires" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── Recent hires table ── */}
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
