import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as BarTooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Tooltip as LineTooltip,
} from 'recharts';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import DataTable from '../components/ui/DataTable';
import Spinner from '../components/ui/Spinner';
import { showError } from '../utils/toast';
import { formatDateShort, formatRelative } from '../utils/formatDate';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, bg, iconColor, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-5 text-left w-full hover:shadow-md hover:ring-brand-500/30 hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
        <span className={`${iconColor} text-lg`}>{icon}</span>
      </div>
      <div className="text-2xl font-extrabold text-slate-900 mt-3">{value}</div>
      <div className="text-sm font-medium text-slate-500 mt-1">{label}</div>
    </button>
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

const DEPT_COLOR = '#6366f1';
const HIRE_COLOR = '#6366f1';

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
  { key: 'position',   label: 'Position',   render: (row) => row.position        || '—' },
  { key: 'department', label: 'Department', render: (row) => row.department?.name || '—' },
  { key: 'status',     label: 'Status',     render: (row) => <StatusBadge status={row.status} /> },
  { key: 'hireDate',   label: 'Hire Date',  render: (row) => formatDateShort(row.hireDate) },
];

// ── Data helpers ──────────────────────────────────────────────────────────────

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

function isoWeekBounds() {
  const now   = new Date();
  const day   = now.getDay(); // 0=Sun
  const mon   = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const sun   = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
  const toISO = (d) => d.toISOString().slice(0, 10);
  return [toISO(mon), toISO(sun)];
}

// ── Page ──────────────────────────────────────────────────────────────────────

function DashboardHome({ onNavigate, user }) {
  const [employees,      setEmployees]      = useState([]);
  const [departments,    setDepartments]    = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [upcomingLeave,    setUpcomingLeave]    = useState([]);
  const [pendingLeave,     setPendingLeave]     = useState([]);
  const [myRecentRequests, setMyRecentRequests] = useState([]);
  const [carryoverBanner,  setCarryoverBanner]  = useState(null); // { typeName, days }
  const [loading,        setLoading]        = useState(true);
  const [fetchError,     setFetchError]     = useState(false);

  const role = user?.role;

  useEffect(() => {
    const [weekStart, weekEnd] = isoWeekBounds();

    const reqs = [
      client.get('/api/employees?limit=500'),
      client.get('/api/departments'),
      client.get(`/api/v1/leave-requests?status=approved&startDateFrom=${weekStart}&startDateTo=${weekEnd}&limit=20`),
    ];

    if (role === 'admin') {
      reqs.push(client.get('/api/v1/leave-requests?all=true&status=pending&limit=5'));
    } else if (role === 'manager') {
      reqs.push(client.get('/api/v1/leave-requests?as=manager&status=pending&limit=5'));
    } else {
      client.get('/api/v1/leave-requests?limit=5')
        .then(({ data }) => setMyRecentRequests(data?.requests || []))
        .catch(() => {});
    }

    Promise.all(reqs).then(([empRes, deptRes, weekLeaveRes, leaveRes]) => {
      setEmployees(empRes.data.employees      || []);
      setDepartments(deptRes.data.departments || []);
      setTotalEmployees(empRes.data.pagination?.total ?? (empRes.data.employees?.length || 0));
      setUpcomingLeave(weekLeaveRes.data?.requests || []);
      if (leaveRes) setPendingLeave(leaveRes.data?.requests || []);
    }).catch(() => {
      setFetchError(true);
      showError('Failed to load dashboard data');
    }).finally(() => setLoading(false));

    // Carryover banner — fetch own balance
    client.get('/api/employees/me')
      .then(({ data: emp }) => client.get(`/api/v1/employees/${emp.id}/leave-balance`))
      .then(({ data: bal }) => {
        const worst = (bal || []).reduce((best, b) => {
          return b.expiring_balance > (best?.expiring_balance || 0) ? b : best;
        }, null);
        if (worst?.expiring_balance > 0) setCarryoverBanner({ typeName: worst.leave_type.name, days: worst.expiring_balance });
      })
      .catch(() => {});
  }, [role]);

  if (loading) return <Spinner />;

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-slate-500 text-sm">Failed to load dashboard data.</p>
        <button
          type="button"
          className="text-sm text-brand-600 font-semibold hover:underline"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const total     = totalEmployees;
  const active    = employees.filter((e) => e.status === 'active').length;
  const onLeave   = employees.filter((e) => e.status === 'on_leave').length;
  const deptCount = departments.length;

  const recent   = [...employees].sort((a, b) => new Date(b.createdAt || b.hireDate || 0) - new Date(a.createdAt || a.hireDate || 0)).slice(0, 5);
  const deptData = buildDeptData(employees, departments);
  const hireData = buildHireData(employees);

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

      {/* ── Carryover reminder banner ── */}
      {carryoverBanner && (
        <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <span className="text-amber-500 text-lg flex-shrink-0">⚠</span>
          <p className="text-sm text-amber-800 flex-1">
            <span className="font-semibold">{carryoverBanner.days} day{carryoverBanner.days !== 1 ? 's' : ''}</span> of {carryoverBanner.typeName} may be forfeited on 1 July if unused.
          </p>
          <button
            type="button"
            className="text-xs text-amber-700 font-semibold hover:underline flex-shrink-0"
            onClick={() => onNavigate?.('profile')}
          >
            View balance →
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard icon="👥" label="Total Employees" value={total}     bg="bg-brand-50"  iconColor="text-brand-600" onClick={() => onNavigate?.('employees')} />
        <StatCard icon="✅" label="Active"           value={active}    bg="bg-green-50"  iconColor="text-green-600" onClick={() => onNavigate?.('employees')} />
        <StatCard icon="🏖️" label="On Leave"         value={onLeave}   bg="bg-amber-50"  iconColor="text-amber-600" onClick={() => onNavigate?.('employees')} />
        <StatCard icon="🏢" label="Departments"      value={deptCount} bg="bg-indigo-50" iconColor="text-indigo-600" onClick={() => onNavigate?.('departments')} />
      </div>

      {/* ── Analytics charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">

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

        {/* Monthly hire trend — Line */}
        <ChartCard title="Monthly Hire Trend (last 6 months)">
          <ResponsiveContainer width="100%" height={200}>
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

      {/* ── What's happening this week ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">

        {/* Upcoming leave this week */}
        <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-md font-semibold text-slate-900">On Leave This Week</h2>
          </div>
          {upcomingLeave.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-400 text-center">No approved leave this week.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {upcomingLeave.map((req) => (
                <div key={req.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar
                    firstName={req.employee?.firstName || '?'}
                    lastName={req.employee?.lastName  || ''}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {req.employee ? `${req.employee.firstName} ${req.employee.lastName}` : 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {req.leaveType?.name || 'Leave'} · {formatDateShort(req.startDate)}
                      {req.startDate !== req.endDate && ` – ${formatDateShort(req.endDate)}`}
                    </p>
                  </div>
                  <span className="text-xs bg-green-50 text-green-700 font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0">
                    approved
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending approvals (manager/admin) or my recent requests (employee) */}
        <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-md font-semibold text-slate-900">
              {role === 'employee' ? 'My Recent Requests' : 'Pending Approvals'}
              {role !== 'employee' && pendingLeave.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                  {pendingLeave.length}
                </span>
              )}
            </h2>
            {role !== 'employee' && (
              <button
                type="button"
                className="text-sm text-brand-600 font-semibold hover:underline"
                onClick={() => onNavigate?.('leave-approvals')}
              >
                View all →
              </button>
            )}
            {role === 'employee' && (
              <button
                type="button"
                className="text-sm text-brand-600 font-semibold hover:underline"
                onClick={() => onNavigate?.('profile')}
              >
                View all →
              </button>
            )}
          </div>

          {/* Employee variant — recent requests with decision notes */}
          {role === 'employee' && (
            myRecentRequests.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">No leave requests yet.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {myRecentRequests.map((req) => (
                  <div key={req.id} className="px-5 py-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {req.leaveType?.name || 'Leave'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDateShort(req.startDate)}
                          {req.startDate !== req.endDate && ` – ${formatDateShort(req.endDate)}`}
                          {' · '}{req.workingDaysCount} day{req.workingDaysCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                        req.status === 'approved'  ? 'bg-green-50 text-green-700'  :
                        req.status === 'rejected'  ? 'bg-red-50 text-red-700'      :
                        req.status === 'withdrawn' ? 'bg-slate-100 text-slate-500' :
                                                     'bg-amber-50 text-amber-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    {req.decisionNote && req.status === 'rejected' && (
                      <p className="text-xs text-red-700 italic mt-1 truncate" title={req.decisionNote}>
                        Rejected: {req.decisionNote}
                      </p>
                    )}
                    {req.decisionNote && req.status === 'approved' && (
                      <p className="text-xs text-slate-500 italic mt-1 truncate" title={req.decisionNote}>
                        Note: {req.decisionNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {/* Manager/admin variant — pending approvals */}
          {role !== 'employee' && (
            pendingLeave.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">No pending requests to review.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {pendingLeave.map((req) => (
                  <div key={req.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {req.employee ? `${req.employee.firstName} ${req.employee.lastName}` : 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {req.leaveType?.name || 'Leave'} · {formatRelative(req.submittedAt)}
                      </p>
                    </div>
                    <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0">
                      pending
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

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
          <button
            type="button"
            className="text-sm text-brand-600 font-semibold hover:underline"
            onClick={() => onNavigate?.('employees')}
          >
            View all employees →
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;
