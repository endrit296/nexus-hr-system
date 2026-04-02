import { useState } from 'react';
import Login from './components/Login';
import EmployeeList from './components/EmployeeList';

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    return token ? { username: 'User' } : null;
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 px-4">
      
      {/* 🌟 Glass container */}
      <div className="w-full max-w-5xl bg-white/10 backdrop-blur-3xl border border-white/20 rounded-3xl shadow-2xl p-8">
        
        {/* 🧠 Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Nexus HR System
          </h1>

          {user && (
            <button
              onClick={() => setUser(null)}
              className="text-sm font-semibold bg-red-600/80 hover:bg-red-600 transition-colors px-4 py-2 rounded-xl shadow-sm"
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