import { useState, useEffect, useMemo } from 'react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import client from '../api/client';
import { showSuccess, showError } from '../utils/toast';

function wdc(start, end) {
  if (!start || !end || end < start) return 0;
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  let count = 0;
  const cursor = new Date(sy, sm - 1, sd);
  const finish = new Date(ey, em - 1, ed);
  while (cursor <= finish) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

const labelCls  = 'block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1';
const inputCls  = 'w-full h-[38px] px-3 rounded border-[1.5px] bg-slate-50 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-500 transition-all border-slate-200';

function LeaveModal({ isOpen, onClose, leaveBalance = [], onSuccess }) {
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [reason,      setReason]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (!isOpen) {
      setLeaveTypeId('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setError('');
    } else if (leaveBalance.length > 0 && !leaveTypeId) {
      setLeaveTypeId(String(leaveBalance[0].leave_type.id));
    }
  }, [isOpen]);

  const days    = useMemo(() => wdc(startDate, endDate), [startDate, endDate]);
  const balance = leaveBalance.find((b) => String(b.leave_type.id) === leaveTypeId);
  const today   = new Date().toISOString().slice(0, 10);

  const handleSubmit = async () => {
    if (!leaveTypeId)               return setError('Please select a leave type.');
    if (!startDate || !endDate)     return setError('Please select start and end dates.');
    if (endDate < startDate)        return setError('End date must be on or after start date.');
    if (days === 0)                 return setError('Selected range contains no working days (Mon–Fri).');
    if (balance && balance.available < days)
      return setError(`Insufficient balance — ${balance.available} day${balance.available !== 1 ? 's' : ''} available, ${days} requested.`);

    setError('');
    setSubmitting(true);
    try {
      await client.post('/api/v1/leave-requests', {
        leaveTypeId: Number(leaveTypeId),
        startDate,
        endDate,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      showSuccess('Leave request submitted.');
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">

        {/* Leave type */}
        <div>
          <label className={labelCls}>Leave Type</label>
          <select
            className={`w-full h-[38px] px-3 rounded border-[1.5px] bg-slate-50 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-500 transition-all border-slate-200`}
            value={leaveTypeId}
            onChange={(e) => { setLeaveTypeId(e.target.value); setError(''); }}
          >
            <option value="">Select type…</option>
            {leaveBalance.map((b) => (
              <option key={b.leave_type.id} value={String(b.leave_type.id)}>
                {b.leave_type.name} — {b.available} day{b.available !== 1 ? 's' : ''} available
              </option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Start Date</label>
            <input
              type="date"
              className={inputCls}
              value={startDate}
              min={today}
              onChange={(e) => { setStartDate(e.target.value); setError(''); }}
            />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input
              type="date"
              className={inputCls}
              value={endDate}
              min={startDate || today}
              onChange={(e) => { setEndDate(e.target.value); setError(''); }}
            />
          </div>
        </div>

        {/* Working days + balance preview */}
        {startDate && endDate && (
          <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3 text-sm border border-slate-200">
            <span className="font-semibold text-slate-800">
              {days} working day{days !== 1 ? 's' : ''}
            </span>
            {balance && (
              <span className={`${balance.available < days ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                · {balance.available} available
              </span>
            )}
          </div>
        )}

        {/* Reason */}
        <div>
          <label className={labelCls}>
            Reason <span className="normal-case font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            className="w-full h-20 px-3 pt-2 rounded border-[1.5px] bg-slate-50 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-500 transition-all border-slate-200 resize-none"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe the reason…"
          />
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
      </div>
    </Modal>
  );
}

export default LeaveModal;
