import { useEffect, useState } from 'react';
import client from '../api/client';
import SystemInfo from './SystemInfo';
import './EmployeeList.css';

function EmployeeList({ user, onLogout }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    client
      .get('/api/employees')
      .then(({ data }) => setEmployees(data.employees))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load employees.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    onLogout();
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Nexus HR System</h1>
        <div className="header-right">
          <span>Signed in as {user.username}</span>
          <button onClick={handleLogout} className="logout-btn">Sign out</button>
        </div>
      </header>

      <main className="dashboard-main">
        <SystemInfo />

        <h2>Employees</h2>

        {loading && <p className="status-msg">Loading…</p>}
        {error && <p className="error-msg">{error}</p>}
        {!loading && !error && employees.length === 0 && (
          <p className="status-msg">No employees found.</p>
        )}

        {!loading && !error && employees.length > 0 && (
          <div className="employee-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Email</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>{emp.id}</td>
                    <td>{emp.firstName}</td>
                    <td>{emp.lastName}</td>
                    <td>{emp.email}</td>
                    <td>{emp.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default EmployeeList;
