import './Layout.css';

const NAV_ITEMS = [
  { key: 'dashboard',   icon: '📊', label: 'Dashboard',       roles: ['employee', 'manager', 'admin'] },
  { key: 'employees',   icon: '👥', label: 'Employees',        roles: ['employee', 'manager', 'admin'] },
  { key: 'departments', icon: '🏢', label: 'Departments',      roles: ['employee', 'manager', 'admin'] },
  { key: 'orgchart',    icon: '🌐', label: 'Org Chart',        roles: ['employee', 'manager', 'admin'] },
  { key: 'users',       icon: '🔑', label: 'User Management',  roles: ['admin'] },
];

const roleBadgeStyle = {
  admin:    { background: 'rgba(253,211,77,0.15)',  color: '#fcd34d' },
  manager:  { background: 'rgba(147,197,253,0.15)', color: '#93c5fd' },
  employee: { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
};

function Sidebar({ activePage, onNavigate, userRole, user }) {
  const visible = NAV_ITEMS.filter((item) => item.roles.includes(userRole));
  const initials = user?.username?.[0]?.toUpperCase() || '?';
  const badge = roleBadgeStyle[userRole] || roleBadgeStyle.employee;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">🏢</span>
        <span className="sidebar-logo-text">Nexus HR</span>
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
