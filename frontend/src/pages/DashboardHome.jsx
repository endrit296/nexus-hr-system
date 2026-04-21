import { useEffect, useState } from 'react';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { showError } from '../utils/toast';

function StatCard({ icon, iconClass, value, label }) {
  const colorMap = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    amber:  'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm ring-1 ring-slate-200 flex items-center gap-4 min-w-[200px]">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${colorMap[iconClass] ?? colorMap.blue}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-sm font-medium text-slate-500">{label}</div>
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
      setEmployees(empRes.data.employees || []);
      setDepartments(deptRes.data.departments || []);
    }).catch(() => showError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  const total     = employees.length;
  const active    = employees.filter((e) => e.status === 'active').length;
  const onLeave   = employees.filter((e) => e.status === 'on_leave').length;
  const deptCount = departments.length;

  const recent = [...employees]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="👥" iconClass="blue"   value={total}     label="Total Employees" />
        <StatCard icon="✅" iconClass="green"  value={active}    label="Active" />
        <StatCard icon="🏖️" iconClass="amber"  value={onLeave}   label="On Leave" />
        <StatCard icon="🏢" iconClass="purple" value={deptCount} label="Departments" />
      </div>

      <div className="bg-white rounded-lg shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-md font-bold text-slate-900">Recent Hires</h3>
        </div>
        <div className="overflow-x-auto">
          {recent.length === 0 ? (
            <p className="p-10 text-center text-slate-400">No employees yet.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Name</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Position</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Department</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Hire Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors duration-100">
                    <td className="px-4 py-3 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <Avatar firstName={emp.firstName} lastName={emp.lastName} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{emp.firstName} {emp.lastName}</div>
                          <div className="text-slate-400 text-xs">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-t border-slate-100 text-sm text-slate-600">{emp.position || '—'}</td>
                    <td className="px-4 py-3 border-t border-slate-100 text-sm text-slate-600">{emp.department?.name || '—'}</td>
                    <td className="px-4 py-3 border-t border-slate-100"><StatusBadge status={emp.status} /></td>
                    <td className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500">{emp.hireDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;
