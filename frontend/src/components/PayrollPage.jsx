import { useEffect, useState, useCallback, useMemo } from 'react';
import client from '../api/client';
import Spinner from './ui/Spinner';
import { showSuccess, showError } from '../utils/toast';
import { formatDateTime, formatDateShort, formatRelative } from '../utils/formatDate';

// ── Local helpers ──────────────────────────────────────────────────────────────

function fmtElapsed(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return [
    Math.floor(s / 3600),
    Math.floor((s % 3600) / 60),
    s % 60,
  ].map((n) => String(n).padStart(2, '0')).join(':');
}

function fmtTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getLocalDateKey(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, hours }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-xs uppercase tracking-wide font-semibold text-slate-400">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="text-3xl font-bold text-slate-900 tabular-nums">{hours.toFixed(2)}</span>
        <span className="text-base text-slate-400">hrs</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
  const [elapsed,     setElapsed]     = useState(0);

  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  // ── Live timer ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeLog) { setElapsed(0); return; }
    const initial = Math.max(0, Math.floor((Date.now() - new Date(activeLog.checkIn).getTime()) / 1000));
    setElapsed(initial);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [activeLog]);

  // ── Data fetching ────────────────────────────────────────────────────────────

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

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleClockIn = async () => {
    if (!employee) return;
    setClocking(true);
    try {
      await client.post('/api/v1/payroll/time/clock-in', { employeeId: employee.id });
      showSuccess('Clocked in. Good luck!');
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

  // ── Computed values ──────────────────────────────────────────────────────────

  const todayKey     = getLocalDateKey(new Date());
  const yesterdayKey = getLocalDateKey(new Date(Date.now() - 86400000));

  const todayHours = useMemo(() => {
    const tk = getLocalDateKey(new Date());
    const completed = timelogs
      .filter((l) => l.status !== 'Active' && getLocalDateKey(l.checkIn) === tk)
      .reduce((s, l) => s + (l.hoursWorked || 0), 0);
    return completed + (activeLog ? elapsed / 3600 : 0);
  }, [timelogs, activeLog, elapsed]);

  const weekHours = useMemo(() => {
    const now = new Date();
    const dow = now.getDay();
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMon);
    monday.setHours(0, 0, 0, 0);
    const completed = timelogs
      .filter((l) => l.status !== 'Active' && new Date(l.checkIn) >= monday)
      .reduce((s, l) => s + (l.hoursWorked || 0), 0);
    const activeInWeek = activeLog && new Date(activeLog.checkIn) >= monday ? elapsed / 3600 : 0;
    return completed + activeInWeek;
  }, [timelogs, activeLog, elapsed]);

  // totalHours from the API sums completed-session hoursWorked; active session has hoursWorked=0
  const monthHours = totalHours + (activeLog ? elapsed / 3600 : 0);

  const lastCheckOut = useMemo(() =>
    timelogs
      .filter((l) => l.status === 'Completed' && l.checkOut)
      .map((l) => l.checkOut)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null
  , [timelogs]);

  const groupedEntries = useMemo(() => {
    const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const recent = timelogs.filter((l) => new Date(l.checkIn) >= cutoff);
    const map = {};
    recent.forEach((log) => {
      const key = getLocalDateKey(log.checkIn);
      if (!map[key]) map[key] = [];
      map[key].push(log);
    });
    return Object.keys(map)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ key, logs: map[key] }));
  }, [timelogs]);

  const dayLabel = (key) => {
    if (key === todayKey)     return 'Today';
    if (key === yesterdayKey) return 'Yesterday';
    return formatDateShort(key + 'T12:00:00');
  };

  const hourlyRate = parseFloat(employee?.hourlyRate);
  const hasRate    = Number.isFinite(hourlyRate) && hourlyRate > 0;

  const handleGenerateReport = async () => {
    if (!employee) return;
    if (!hasRate) {
      showError('No hourly rate on file. Ask a manager to set it.');
      return;
    }
    setCalculating(true);
    try {
      const { data } = await client.get(
        `/api/v1/payroll/employee/${employee.id}?hourlyRate=${hourlyRate}&hoursWorked=${monthHours}`
      );
      setReport(data);
      showSuccess('Monthly payroll report generated.');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to generate report.');
    } finally {
      setCalculating(false);
    }
  };

  // ── Guard states ─────────────────────────────────────────────────────────────

  if (loading) return <Spinner />;

  if (noRecord) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="border-[1.5px] border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-400">
          <div className="text-3xl mb-2">🔗</div>
          <div className="font-semibold text-slate-500 mb-1">No employee record linked</div>
          <div className="text-sm">Ask an admin to create your employee record before using time tracking.</div>
        </div>
      </div>
    );
  }

  const elapsedOvertime = elapsed > 12 * 3600;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── 1. Hero Card ── */}
      <div className="bg-white rounded-2xl shadow-md p-8 relative">

        {/* Status indicator — top right */}
        <div className="absolute top-6 right-8 flex items-center gap-1.5">
          {activeLog ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span className="text-xs font-medium text-emerald-600">Active</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
              <span className="text-xs text-slate-400">Inactive</span>
            </>
          )}
        </div>

        {activeLog ? (
          <>
            <p className="font-mono tabular-nums text-6xl font-bold text-slate-900 leading-none">
              {fmtElapsed(elapsed)}
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Clocked in at {formatDateTime(activeLog.checkIn)}
            </p>

            {elapsedOvertime && (
              <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-2 rounded text-sm text-amber-800 mt-4">
                Session running for {Math.floor(elapsed / 3600)} hours — did you forget to clock out?
              </div>
            )}

            <button
              onClick={handleClockOut}
              disabled={clocking}
              className="mt-6 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <span className="mr-1.5 text-xs">■</span>
              {clocking ? 'Clocking out…' : 'Clock Out'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-slate-900">
              You&apos;re not currently clocked in
            </h2>
            {lastCheckOut && (
              <p className="text-slate-500 text-sm mt-1">
                Last session ended {formatRelative(lastCheckOut)}
              </p>
            )}
            <button
              onClick={handleClockIn}
              disabled={clocking}
              className="mt-6 bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-lg shadow-brand text-base font-semibold transition-colors disabled:opacity-50"
            >
              {clocking ? 'Clocking in…' : 'Clock In'}
            </button>
          </>
        )}
      </div>

      {/* ── 2. Stat Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Today"       hours={todayHours} />
        <StatCard label="This Week"   hours={weekHours}  />
        <StatCard label="Last 30 Days" hours={monthHours} />
      </div>

      {/* ── 3. Hourly Rate ── */}
      {hasRate && (
        <div className="bg-slate-50 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-400">Hourly Rate</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-slate-900">€{hourlyRate.toFixed(2)}</span>
              <span className="text-sm text-slate-500">/ hour</span>
            </div>
          </div>
          <span className="text-xs italic text-slate-400">
            {isAdminOrManager ? 'Edit via Employee record' : 'Set by your manager'}
          </span>
        </div>
      )}

      {/* ── 4. Monthly Payroll Report ── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <p className="text-xs uppercase tracking-wide font-semibold text-slate-400">Monthly Payroll Report</p>

        {hasRate ? (
          <p className="text-slate-700 my-3 text-sm">
            Based on {monthHours.toFixed(1)} hrs logged this month at €{hourlyRate.toFixed(2)}/hr
            {' → '}
            <span className="font-semibold">€{(monthHours * hourlyRate).toFixed(2)}</span>
          </p>
        ) : (
          <p className="text-slate-400 text-sm my-3">
            No hourly rate set.{' '}
            {isAdminOrManager
              ? 'Edit the employee record to add one.'
              : 'Contact your manager to set it.'}
          </p>
        )}

        <button
          onClick={handleGenerateReport}
          disabled={calculating || !hasRate}
          className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {calculating ? 'Generating…' : '↓ Generate Report (.pdf)'}
        </button>
      </div>

      {/* Report result — rendering unchanged from original */}
      {report && (
        <div className="bg-white ring-1 ring-slate-200 shadow-sm rounded-xl p-6 animate-fadeIn">
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

      {/* ── 5. Recent Entries ── */}
      {groupedEntries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-2">Recent entries</h3>

          {groupedEntries.map(({ key, logs }) => {
            const dailyTotal = logs.reduce((s, l) =>
              s + (l.status === 'Active' ? elapsed / 3600 : (l.hoursWorked || 0)), 0
            );

            return (
              <div key={key}>
                <p className="text-sm font-semibold text-slate-700 mt-4 mb-2">{dayLabel(key)}</p>

                {logs.map((log) => {
                  const isActive  = log.status === 'Active';
                  const duration  = isActive ? elapsed / 3600 : (log.hoursWorked || 0);
                  const isLong    = !isActive && (log.hoursWorked || 0) > 16;

                  return (
                    <div
                      key={log._id}
                      className="flex justify-between items-center py-2"
                      title={isLong ? 'Verify with HR' : undefined}
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        {isLong && (
                          <span className="bg-amber-50 text-amber-800 text-xs px-2 py-0.5 rounded flex-shrink-0">
                            ⚠ Long session
                          </span>
                        )}
                        <span>
                          {fmtTime(log.checkIn)}
                          {' → '}
                          {isActive
                            ? <span className="italic text-slate-400">in progress</span>
                            : fmtTime(log.checkOut)
                          }
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-900 tabular-nums">
                        {duration.toFixed(2)} hrs
                      </span>
                    </div>
                  );
                })}

                <div className="text-xs uppercase tracking-wide text-slate-400 mt-1 border-t border-slate-100 pt-1">
                  Daily total: {dailyTotal.toFixed(2)} hrs
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default PayrollPage;
