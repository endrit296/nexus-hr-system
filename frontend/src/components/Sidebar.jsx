import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/employees', icon: '👥', label: 'Employees' },
  { path: '/departments', icon: '🏢', label: 'Departments' },
];

function Sidebar({ activePage, onNavigate, userRole }) {
  const visible = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col shadow-2xl">
      <div className="p-6 flex items-center gap-3 border-b border-slate-700/50">
        <span className="text-2xl bg-blue-500/20 p-2 rounded-lg">🏢</span>
        <span className="text-xl font-bold tracking-tight text-white">Nexus <span className="text-blue-500">HR</span></span>
      </div>
      <div className="sidebar-section">
        <p className="sidebar-section-label">Menu</p>
        {visible.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${activePage === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Account area — pinned to bottom */}
      <div className="sidebar-account">
        <button
          className={`sidebar-account-btn ${activePage === 'profile' ? 'active' : ''}`}
          onClick={() => onNavigate('profile')}
          title="My Profile"
        >
          <div className="sidebar-account-avatar">{initials}</div>
          <div className="sidebar-account-info">
            <div className="sidebar-account-name">{user?.username || '—'}</div>
            <div className="sidebar-account-role" style={badge}>{userRole}</div>
          </div>
          <span className="sidebar-account-arrow">›</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;