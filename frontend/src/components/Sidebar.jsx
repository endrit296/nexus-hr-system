import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/employees', icon: '👥', label: 'Employees' },
  { path: '/departments', icon: '🏢', label: 'Departments' },
];

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col shadow-2xl">
      <div className="p-6 flex items-center gap-3 border-b border-slate-700/50">
        <span className="text-2xl bg-blue-500/20 p-2 rounded-lg">🏢</span>
        <span className="text-xl font-bold tracking-tight text-white">Nexus <span className="text-blue-500">HR</span></span>
      </div>

      <div className="flex-1 py-6 px-4 space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-3 mb-4">Main Menu</p>
        
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <span className={`text-lg transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-700/50">
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 text-center font-medium">CSE PROJECT 2026</p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;