import { useState } from 'react';
import { showSuccess, showError, showInfo } from '../utils/toast';

function PayrollPage({ user }) {
  const [report,      setReport]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(true);
  const [totalHours]                  = useState(142);

  const handleClockToggle = () => {
    const next = !isClockedIn;
    setIsClockedIn(next);
    if (next) showSuccess('Clocked in. Good work!');
    else      showInfo('Clocked out. Enjoy your break!');
  };

  const calculate = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3005/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: user?.username || 'Employee',
          role: 'Software Developer',
          hourlyRate: 15,
          hoursWorked: totalHours,
        }),
      });
      if (!res.ok) throw new Error('Server error');
      setReport(await res.json());
      showSuccess('Payroll report generated successfully!');
    } catch {
      showError('Failed to calculate payroll. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Payroll</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage time tracking and generate payroll reports.</p>
      </div>

      {/* Clock toggle */}
      <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-6 mb-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Time Tracking</p>
        <button
          onClick={handleClockToggle}
          className={`px-6 py-2.5 rounded-full font-bold text-white transition-all shadow-md hover:shadow-lg active:scale-95 ${
            isClockedIn ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isClockedIn ? '🛑 Clock Out' : '🕒 Clock In'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Hours This Month</p>
          <p className="text-2xl font-extrabold text-slate-900">{totalHours}</p>
          <p className="text-xs text-slate-500">hrs</p>
        </div>
        <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
          <p className={`text-2xl font-extrabold ${isClockedIn ? 'text-green-600' : 'text-slate-400'}`}>
            {isClockedIn ? '●' : '○'}
          </p>
          <p className="text-xs text-slate-500">{isClockedIn ? 'Active Now' : 'Offline'}</p>
        </div>
      </div>

      {/* Generate report */}
      <button
        onClick={calculate}
        disabled={loading}
        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
      >
        {loading ? 'Calculating…' : 'Generate Payroll Report'}
      </button>

      {/* Report card */}
      {report && (
        <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-lg p-6 animate-fadeIn">
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
    </div>
  );
}

export default PayrollPage;
