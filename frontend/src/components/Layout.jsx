import { lazy, Suspense, useState } from 'react';
import RoleBadge from './ui/RoleBadge';
import Spinner from './ui/Spinner';
import Sidebar from './Sidebar';
import PayrollPage from './PayrollPage'; // 1. Importojmë modulin e ri
import './Layout.css';

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
  payroll:     'Payroll Module', // 2. Shtojmë titullin për Payroll
};

function Layout({ user, onLogout }) {
  const [activePage, setActivePage] = useState('dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':   return <DashboardHome />;
      case 'employees':   return <EmployeesPage user={user} />;
      case 'departments': return <DepartmentsPage user={user} />;
      case 'orgchart':    return <OrgChartPage />;
      case 'users':       return user.role === 'admin' ? <UserManagementPage currentUserId={user.id} /> : <DashboardHome />;
      case 'profile':     return <ProfilePage user={user} />;
      case 'payroll':     return <PayrollPage />; // 3. Shtojmë rastin për Payroll
      default:            return <DashboardHome />;
    }
  };

  return (
    <div className="layout">
      {/* 4. Kalojmë funksionet te Sidebar që ta kuptojë klikimin e ri */}
      <Sidebar activePage={activePage} onNavigate={setActivePage} userRole={user.role} user={user} />
      <div className="layout-main">
        <header className="topbar">
          <h2 className="topbar-title">{pageTitles[activePage]}</h2>
          <div className="topbar-right">
            <RoleBadge role={user.role || 'employee'} />
            <button
              className="topbar-user"
              onClick={() => setActivePage('profile')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              👤 {user.username}
            </button>
            <button onClick={onLogout} className="topbar-logout">Sign out</button>
          </div>
        </header>
        <main className="page-content">
          <Suspense fallback={<Spinner />}>{renderPage()}</Suspense>
        </main>
      </div>
    </div>
  );
}

export default Layout;