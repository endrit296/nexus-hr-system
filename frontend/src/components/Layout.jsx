import { lazy, Suspense, useState } from 'react';
import Avatar from './ui/Avatar';
import Spinner from './ui/Spinner';
import Sidebar from './Sidebar';
import PayrollPage from './PayrollPage';

const DashboardHome      = lazy(() => import('../pages/DashboardHome'));
const EmployeesPage      = lazy(() => import('../pages/EmployeesPage'));
const DepartmentsPage    = lazy(() => import('../pages/DepartmentsPage'));
const OrgChartPage       = lazy(() => import('../pages/OrgChartPage'));
const UserManagementPage = lazy(() => import('../pages/UserManagementPage'));
const ProfilePage        = lazy(() => import('../pages/ProfilePage'));

const pageTitles = {
  dashboard:   'Dashboard',
  employees:   'Employees',
  departments: 'Departments',
  orgchart:    'Organization Chart',
  users:       'User Management',
  profile:     'My Profile',
  payroll:     'Payroll Module',
};

function Layout({ user, onLogout }) {
  const [activePage, setActivePage]   = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':   return <DashboardHome />;
      case 'employees':   return <EmployeesPage user={user} />;
      case 'departments': return <DepartmentsPage user={user} />;
      case 'orgchart':    return <OrgChartPage />;
      case 'users':       return user.role === 'admin' ? <UserManagementPage currentUserId={user.id} /> : <DashboardHome />;
      case 'profile':     return <ProfilePage user={user} />;
      case 'payroll':     return <PayrollPage />;
      default:            return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        userRole={user.role}
        user={user}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
      />

      {/* Main area — offset by sidebar width on desktop */}
      <div className="lg:ml-[260px] flex flex-col min-h-screen">

        {/* ── Topbar ── */}
        <header className="sticky top-0 z-20 h-[60px] bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              className="lg:hidden p-1.5 rounded hover:bg-slate-100 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <div className="flex flex-col gap-[5px]">
                <span className="block w-5 h-[2px] bg-slate-700 rounded-full" />
                <span className="block w-5 h-[2px] bg-slate-700 rounded-full" />
                <span className="block w-5 h-[2px] bg-slate-700 rounded-full" />
              </div>
            </button>
            <h2 className="text-lg font-bold text-slate-900">{pageTitles[activePage]}</h2>
          </div>

          <div className="flex items-center gap-3">
            <Avatar firstName={user.username} lastName="" size="sm" />
            <span className="text-sm text-slate-700 hidden sm:block">{user.username}</span>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <Suspense fallback={<Spinner />}>
              <div key={activePage} className="animate-fadeIn">
                {renderPage()}
              </div>
            </Suspense>
          </div>
        </main>

      </div>
    </div>
  );
}

export default Layout;
