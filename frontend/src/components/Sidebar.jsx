import './Layout.css';

const navItems = [
  { key: 'dashboard',   icon: '📊', label: 'Dashboard' },
  { key: 'employees',   icon: '👥', label: 'Employees' },
  { key: 'departments', icon: '🏢', label: 'Departments' },
];

function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">🏢</span>
        <span className="sidebar-logo-text">Nexus HR</span>
      </div>
      <div className="sidebar-section">
        <p className="sidebar-section-label">Menu</p>
        {navItems.map((item) => (
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
    </aside>
  );
}

export default Sidebar;
