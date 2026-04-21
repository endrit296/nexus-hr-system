import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import DashboardHome from '../pages/DashboardHome';
import EmployeesPage from '../pages/EmployeesPage';
import DepartmentsPage from '../pages/DepartmentsPage';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/employees': 'Employees',
  '/departments': 'Departments',
};

function Layout({ user, onLogout }) {
  const location = useLocation();
  const currentTitle = pageTitles[location.pathname] || 'Nexus HR';

  return (
    <div className="flex h-screen bg-slate-900 text-white font-sans">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-8 shadow-lg">
          <h2 className="text-xl font-semibold text-blue-400">{currentTitle}</h2>
          
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-slate-300 bg-slate-700 px-3 py-1 rounded-full border border-slate-600">
              👤 {user.username}
            </span>
            <button 
              onClick={onLogout} 
              className="text-sm bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-4 py-2 rounded-lg transition-all duration-200 border border-red-500/20"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 bg-slate-900">
          <Routes>
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="departments" element={<DepartmentsPage />} />
            {/* Redirect automatik te dashboard */}
            <Route path="/" element={<Navigate replace to="dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default Layout;