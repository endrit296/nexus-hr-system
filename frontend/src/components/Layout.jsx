import { useState } from 'react';
import Sidebar from './Sidebar';
import DashboardHome from '../pages/DashboardHome';
import EmployeesPage from '../pages/EmployeesPage';
import DepartmentsPage from '../pages/DepartmentsPage';
import './Layout.css';

const pageTitles = {
  dashboard:   'Dashboard',
  employees:   'Employees',
  departments: 'Departments',
};

function Layout({ user, onLogout }) {
  const [activePage, setActivePage] = useState('dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':   return <DashboardHome />;
      case 'employees':   return <EmployeesPage />;
      case 'departments': return <DepartmentsPage />;
      default:            return <DashboardHome />;
    }
  };

  return (
    <div className="layout">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="layout-main">
        <header className="topbar">
          <h2 className="topbar-title">{pageTitles[activePage]}</h2>
          <div className="topbar-right">
            <span className="topbar-user">👤 {user.username}</span>
            <button onClick={onLogout} className="topbar-logout">Sign out</button>
          </div>
        </header>
        <main className="page-content">{renderPage()}</main>
      </div>
    </div>
  );
}

export default Layout;