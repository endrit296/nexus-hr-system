import { useState } from 'react';
import Login from './components/Login';
import EmployeeList from './components/EmployeeList';

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    return token ? { username: 'User' } : null;
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      
      {/* 🌟 Glass container */}
      <div className="w-full max-w-5xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6">
        
        {/* 🧠 Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold tracking-tight">
            Nexus HR System
          </h1>

          {user && (
            <button
              onClick={() => setUser(null)}
              className="text-sm bg-red-500/80 hover:bg-red-500 px-3 py-1 rounded-lg transition"
            >
              Logout
            </button>
          )}
        </div>

        {/* 🔁 Original logic untouched */}
        {!user ? (
          <Login onLogin={setUser} />
        ) : (
          <EmployeeList user={user} onLogout={() => setUser(null)} />
        )}
      </div>
    </div>
  );
}

export default App;