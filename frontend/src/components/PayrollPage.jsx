import { useEffect, useState, useCallback } from 'react';
import client from '../api/client';
import Spinner from './ui/Spinner';
import { showSuccess, showError } from '../utils/toast';

function formatHours(h) {
  return Number.isFinite(h) ? h.toFixed(2) : '0.00';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

function formatCurrency(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? `€${n.toFixed(2)}` : '—';
}

function PayrollPage({ user }) {
  const [employee,    setEmployee]    = useState(null);
  const [activeLog,   setActiveLog]   = useState(null);
  const [timelogs,    setTimelogs]    = useState([]);
  const [totalHours,  setTotalHours]  = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [clocking,    setClocking]    = useState(false);
  const [noRecord,    setNoRecord]    = useState(false);

  const [report,      setReport]      = useState(null);
  const [calculating, setCalculating] = useState(false);

  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const fetchTimeLogs = useCallback(async (emp) => {
    const { data } = await client.get(`/api/v1/payroll/time/my?employeeId=${emp.id}`);
    setTimelogs(data.timelogs || []);
    setTotalHours(data.totalHours || 0);
    const open = (data.timelogs || []).find((l) => l.status === 'Active');
    setActiveLog(open || null);
  }, []);

  useEffect(() => {
    client.get('/api/employees/me')
      .then(async ({ data: emp }) => {
        setEmployee(emp);
        await fetchTimeLogs(emp);
      })
      .catch((err) => {
        if (err.response?.status === 404) setNoRecord(true);
        else showError('Failed to load payroll data.');
      })
      .finally(() => setLoading(false));
  }, [fetchTimeLogs]);

  const handleClockIn = async () => {
    if (!employee) return;
    setClocking(true);
    try {
      await client.post('/api/v1/payroll/time/clock-in', { employeeId: employee.id });
      showSuccess('Clocked in. Good work!');
      await fetchTimeLogs(employee);
    } catch (err) {
      showError(err.response?.data?.message || 'Clock-in failed.');
    } finally {
      setClocking(false);
    }
  };

  const handleClockOut = async () => {
    if (!employee) return;
    setClocking(true);
    try {
      await client.post('/api/v1/payroll/time/clock-out', { employeeId: employee.id });
      showSuccess('Clocked out. Enjoy your break!');
      await fetchTimeLogs(employee);
    } catch (err) {
      showError(err.response?.data?.message || 'Clock-out failed.');
    } finally {
      setClocking(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!employee) return;
    const rate = parseFloat(employee.hourlyRate);
    if (!rate || rate <= 0) {
      showError('No hourly rate on file. Ask a manager to set it.');
      return;
    }
    setCalculating(true);
    try {
      const { data } = await client.get(
        `/api/v1/payroll/employee/${employee.id}?hourlyRate=${rate}&hoursWorked=${totalHours}`
      );
      setReport(data);
      showSuccess('Monthly payroll report generated.');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to generate report.');
    } finally {
      setCalculating(false);
    }
  };

  if (loading) return <Spinner />;

  if (noRecord) {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-900 mb-6">Payroll</h1>
        <div className="border-[1.5px] border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-400">
          <div className="text-3xl mb-2">🔗</div>
          <div className="font-semibold text-slate-500 mb-1">No employee record linked</div>
          <div className="text-sm">Ask an admin to create your employee record before using time tracking.</div>
        </div>
      </div>
    );
  }

  const isClockedIn  = activeLog !== null;
  const hourlyRate   = parseFloat(employee?.hourlyRate);
  const hasRate      = Number.isFinite(hourlyRate) && hourlyRate > 0;

  return (
    <div className="max-w-lg mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Payroll</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Time tracking and payroll for {employee?.firstName} {employee?.lastName}.
        </p>
      </div>

      {/* Clock toggle */}
      <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-6 mb-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Time Tracking</p>
        {isClockedIn ? (
          <button
            onClick={handleClockOut}
            disabled={clocking}
            className="px-6 py-2.5 rounded-full font-bold text-white bg-red-500 hover:bg-red-600 transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50"
          >
            {clocking ? '…' : '🛑 Clock Out'}
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            disabled={clocking}
            className="px-6 py-2.5 rounded-full font-bold text-white bg-green-500 hover:bg-green-600 transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50"
          >
            {clocking ? '…' : '🕒 Clock In'}
          </button>
        )}
        {isClockedIn && (
          <p className="text-xs text-slate-400 mt-3">
            Clocked in at {formatDate(activeLog.checkIn)}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Hours This Month</p>
          <p className="text-2xl font-extrabold text-slate-900">{formatHours(totalHours)}</p>
          <p className="text-xs text-slate-500">hrs (last 30 days)</p>
        </div>
        <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
          <p className={`text-2xl font-extrabold ${isClockedIn ? 'text-green-600' : 'text-slate-400'}`}>
            {isClockedIn ? '●' : '○'}
          </p>
          <p className="text-xs text-slate-500">{isClockedIn ? 'Active Now' : 'Offline'}</p>
        </div>
      </div>

      {/* Hourly rate card */}
      <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Hourly Rate</p>
        {hasRate ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-extrabold text-slate-900">{formatCurrency(employee.hourlyRate)}</p>
              <p className="text-xs text-slate-500 mt-0.5">per hour</p>
            </div>
            {!isAdminOrManager && (
              <p className="text-xs text-slate-400 italic">Set by your manager</p>
            )}
            {isAdminOrManager && (
              <p className="text-xs text-slate-400 italic">Edit via Employee record</p>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-400">
            {isAdminOrManager
              ? 'No hourly rate set. Edit the employee record to add one.'
              : 'No hourly rate on file. Contact your manager to set it.'}
          </div>
        )}
      </div>

      {/* Monthly report generator */}
      <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Monthly Payroll Report</p>
        <p className="text-xs text-slate-400 mb-3">
          Based on {formatHours(totalHours)} hrs logged in the last 30 days
          {hasRate ? ` at ${formatCurrency(employee.hourlyRate)}/hr.` : '.'}
        </p>
        <button
          onClick={handleGenerateReport}
          disabled={calculating || !hasRate}
          className="w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {calculating ? 'Generating…' : 'Generate Report'}
        </button>
        {!hasRate && (
          <p className="text-xs text-red-500 mt-2">
            A hourly rate must be set before a report can be generated.
          </p>
        )}
      </div>

      {/* Report card */}
      {report && (
        <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-6 mb-5 animate-fadeIn">
          <div className="border-b border-slate-100 mb-4 pb-4">
            <h3 className="text-base font-bold text-slate-900">{report.header.company}</h3>
            <p className="text-sm text-slate-500">{report.header.report_type} — {report.header.date}</p>
          </div>
          <div className="space-y-1 text-sm mb-4">
            <p className="text-slate-700"><span className="font-semibold">Employee:</span> {report.employee_profile.full_name}</p>
            <p className="text-slate-700"><span className="font-semibold">Position:</span> {report.employee_profile.position}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Hours Logged</span>
              <span className="font-medium text-slate-900">{report.financial_summary.hours_logged}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Gross Pay</span>
              <span className="font-medium text-slate-900">{report.financial_summary.gross_total}</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>Deductions</span>
              <span className="font-medium">{report.financial_summary.deductions}</span>
            </div>
            <div className="flex justify-between text-green-600 font-bold text-base pt-2 border-t border-slate-200">
              <span>Net Pay</span>
              <span>{report.financial_summary.final_net_salary}</span>
            </div>
          </div>
          <div className="text-center mt-4">
            <span className="inline-block bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-full">
              {report.status}
            </span>
          </div>
        </div>
      )}

      {/* Recent time log entries */}
      {timelogs.length > 0 && (
        <div className="bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden rounded-lg">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Recent Entries</h3>
          </div>
          <ul className="divide-y divide-slate-50">
            {timelogs.slice(0, 10).map((log) => (
              <li key={log._id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-slate-900">{formatDate(log.checkIn)}</span>
                  {log.checkOut && (
                    <span className="text-slate-400 ml-2">→ {formatDate(log.checkOut)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {log.status === 'Active' ? (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                  ) : (
                    <span className="text-xs text-slate-500">{formatHours(log.hoursWorked)} hrs</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default PayrollPage;
