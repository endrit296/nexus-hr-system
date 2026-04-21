import Avatar from './ui/Avatar';
import RoleBadge from './ui/RoleBadge';
import './Layout.css';

const NAV_ITEMS = [
  { key: 'dashboard',   icon: '📊', label: 'Dashboard',       roles: ['employee', 'manager', 'admin'] },
  { key: 'employees',   icon: '👥', label: 'Employees',        roles: ['employee', 'manager', 'admin'] },
  { key: 'departments', icon: '🏢', label: 'Departments',      roles: ['employee', 'manager', 'admin'] },
  { key: 'orgchart',    icon: '🌐', label: 'Org Chart',        roles: ['employee', 'manager', 'admin'] },
  { key: 'users',       icon: '🔑', label: 'User Management',  roles: ['admin'] },
];

function Sidebar({ activePage, onNavigate, userRole, user }) {
  const visible = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

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
          <Avatar firstName={user?.username} lastName="" size="sm" />
          <div className="sidebar-account-info">
            <div className="sidebar-account-name">{user?.username || '—'}</div>
            <RoleBadge role={userRole} />
          </div>
          <span className="sidebar-account-arrow">›</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
