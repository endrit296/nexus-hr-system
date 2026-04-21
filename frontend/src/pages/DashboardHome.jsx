import { useEffect, useState } from 'react';
import client from '../api/client';

function StatCard({ icon, iconClass, value, label }) {
  // Këtu i kam shtuar klasat e Tailwind që të sigurohemi që dalin kolonat
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 min-w-[200px]">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl 
        ${iconClass === 'blue' ? 'bg-blue-50 text-blue-600' : 
          iconClass === 'green' ? 'bg-green-50 text-green-600' : 
          iconClass === 'amber' ? 'bg-amber-50 text-amber-600' : 
          'bg-purple-50 text-purple-600'}`}>
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
    }).catch(err => console.error("Error fetching data:", err))
      .finally(() => setLoading(false));
  }, []);

  const total    = employees.length;
  const active   = employees.filter((e) => e.status === 'active').length;
  const onLeave  = employees.filter((e) => e.status === 'on_leave').length;
  const deptCount = departments.length;

  const recent = [...employees]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (loading) return <p className="status-msg text-center p-10">Loading…</p>;

  return (
    <div className="p-8 w-full max-w-7xl mx-auto space-y-8">
      {/* Ky rresht poshtë i rregullon kolonat 100% */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon="👥" iconClass="blue"   value={total}     label="Total Employees" />
        <StatCard icon="✅" iconClass="green"  value={active}    label="Active" />
        <StatCard icon="🏖️" iconClass="amber"  value={onLeave}   label="On Leave" />
        <StatCard icon="🏢" iconClass="purple" value={deptCount} label="Departments" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Recent Hires</h3>
        </div>
        
        <div className="overflow-x-auto">
          {recent.length === 0 ? (
            <p className="p-10 text-center text-slate-400">No employees yet.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <th className="p-4 border-b">Name</th>
                  <th className="p-4 border-b">Position</th>
                  <th className="p-4 border-b">Department</th>
                  <th className="p-4 border-b">Status</th>
                  <th className="p-4 border-b">Hire Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recent.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{emp.firstName} {emp.lastName}</div>
                          <div className="text-slate-400 text-xs">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{emp.position || '—'}</td>
                    <td className="p-4 text-sm text-slate-600">{emp.department?.name || '—'}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium 
                        ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {emp.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-500">{emp.hireDate || '—'}</td>
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