import Avatar from './ui/Avatar';
import RoleBadge from './ui/RoleBadge';

const NAV_ITEMS = [
  { key: 'dashboard',   icon: '📊', label: 'Dashboard',       roles: ['employee', 'manager', 'admin'] },
  { key: 'employees',   icon: '👥', label: 'Employees',        roles: ['employee', 'manager', 'admin'] },
  { key: 'departments', icon: '🏢', label: 'Departments',      roles: ['employee', 'manager', 'admin'] },
  { key: 'orgchart',    icon: '🌐', label: 'Org Chart',        roles: ['employee', 'manager', 'admin'] },
  { key: 'payroll',     icon: '💰', label: 'Payroll',          roles: ['employee', 'manager', 'admin'] },
  { key: 'users',       icon: '🔑', label: 'User Management',  roles: ['admin'] },
];

function Sidebar({ activePage, onNavigate, userRole, user, isOpen, onClose, onLogout }) {
  const visible = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  const go = (key) => { onNavigate(key); onClose(); };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 w-[260px] bg-dark-900 flex flex-col z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* ── Logo ── */}
        <div className="flex items-center p-6 pb-4">
          <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-extrabold text-white">N</span>
          </div>
          <span className="text-md font-bold text-white ml-3">Nexus HR</span>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-white/25 px-3 pt-5 pb-2">
            Menu
          </p>
          {visible.map((item) => {
            const active = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => go(item.key)}
                className={`w-full flex items-center gap-3 py-2.5 rounded text-sm transition-all duration-150 cursor-pointer ${
                  active
                    ? 'bg-brand-500/[0.12] text-brand-400 font-semibold border-l-[3px] border-brand-500 pl-[9px] pr-3'
                    : 'px-3 font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06]'
                }`}
              >
                <span className={active ? 'opacity-100' : 'opacity-60'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Account ── */}
        <div className="border-t border-white/[0.08] p-4">
          <button
            className={`w-full flex items-center gap-3 rounded px-2 py-2 transition-all duration-150 ${
              activePage === 'profile' ? 'bg-white/[0.06]' : 'hover:bg-white/[0.06]'
            }`}
            onClick={() => go('profile')}
          >
            <Avatar firstName={user?.username} lastName="" size="sm" />
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm text-white truncate">{user?.username || '—'}</div>
              <RoleBadge role={userRole} />
            </div>
          </button>
          <button
            className="w-full text-left text-xs text-white/40 hover:text-white/70 transition-colors mt-2 px-2 py-1"
            onClick={onLogout}
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
