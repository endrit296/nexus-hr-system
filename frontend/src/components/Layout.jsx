import { useState } from 'react';
import Sidebar from './Sidebar';
import DashboardHome from '../pages/DashboardHome';
import EmployeesPage from '../pages/EmployeesPage';
import DepartmentsPage from '../pages/DepartmentsPage';
import OrgChartPage from '../pages/OrgChartPage';
import UserManagementPage from '../pages/UserManagementPage';
import ProfilePage from '../pages/ProfilePage';
import './Layout.css';

const pageTitles = {
  dashboard:   'Dashboard',
  employees:   'Employees',
  departments: 'Departments',
  orgchart:    'Organization Chart',
  users:       'User Management',
  profile:     'My Profile',
};

const roleBadge = {
  admin:    { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' },
  manager:  { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
  employee: { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' },
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
      default:            return <DashboardHome />;
    }
  };

  const badge = roleBadge[user.role] || roleBadge.employee;

  return (
    <div className="layout">
      <Sidebar activePage={activePage} onNavigate={setActivePage} userRole={user.role} user={user} />
      <div className="layout-main">
        <header className="topbar">
          <h2 className="topbar-title">{pageTitles[activePage]}</h2>
          <div className="topbar-right">
            <span style={{
              ...badge,
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {user.role || 'employee'}
            </span>
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
        <main className="page-content">{renderPage()}</main>
      </div>
    </div>
  );
}

export default Layout;
