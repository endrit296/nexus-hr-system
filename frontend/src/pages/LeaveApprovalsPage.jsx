import { useEffect, useState, useCallback } from 'react';
import client from '../api/client';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { showSuccess, showError } from '../utils/toast';
import { formatDateShort } from '../utils/formatDate';

const STATUS_STYLE = {
  pending:   'bg-amber-50  text-amber-700',
  approved:  'bg-green-50  text-green-700',
  rejected:  'bg-red-50    text-red-700',
  withdrawn: 'bg-slate-100 text-slate-500',
};

function LeaveStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

function LeaveApprovalsPage({ user }) {
  const [requests,    setRequests]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [rejectId,    setRejectId]    = useState(null);
  const [rejectNote,  setRejectNote]  = useState('');
  const [rejectErr,   setRejectErr]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const role = user?.role;

  const load = useCallback(() => {
    const params = role === 'admin'
      ? '?all=true&status=pending'
      : '?as=manager&status=pending';
    setLoading(true);
    client.get(`/api/v1/leave-requests${params}`)
      .then(({ data }) => setRequests(data?.requests || []))
      .catch(() => showError('Failed to load leave requests.'))
      .finally(() => setLoading(false));
  }, [role]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    setSubmitting(true);
    try {
      await client.post(`/api/v1/leave-requests/${id}/approve`, {});
      showSuccess('Request approved.');
      load();
    } catch (e) {
      showError(e.response?.data?.message || 'Failed to approve.');
    } finally {
      setSubmitting(false);
    }
  };

  const openReject = (id) => { setRejectId(id); setRejectNote(''); setRejectErr(''); };
  const cancelReject = () => { setRejectId(null); setRejectNote(''); setRejectErr(''); };

  const confirmReject = async () => {
    if (!rejectNote.trim()) return setRejectErr('A reason is required to reject a request.');
    setSubmitting(true);
    try {
      await client.post(`/api/v1/leave-requests/${rejectId}/reject`, { decisionNote: rejectNote.trim() });
      showSuccess('Request rejected.');
      cancelReject();
      load();
    } catch (e) {
      setRejectErr(e.response?.data?.message || 'Failed to reject.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Leave Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {requests.length} pending request{requests.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="text-xs text-brand-600 font-semibold hover:underline"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm p-12 text-center">
          <div className="text-3xl mb-3">🎉</div>
          <p className="text-slate-500 font-medium">No pending leave requests.</p>
          <p className="text-sm text-slate-400 mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg ring-1 ring-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {requests.map((req) => (
              <div key={req.id} className="p-5">
                <div className="flex items-start gap-4">
                  {/* Employee avatar + name */}
                  <Avatar
                    firstName={req.employee?.firstName || '?'}
                    lastName={req.employee?.lastName  || ''}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {req.employee ? `${req.employee.firstName} ${req.employee.lastName}` : 'Unknown Employee'}
                      </span>
                      <LeaveStatusBadge status={req.status} />
                    </div>
                    <p className="text-sm text-slate-700 mt-1">
                      <span className="font-medium">{req.leaveType?.name || 'Leave'}</span>
                      {' · '}
                      {req.startDate === req.endDate
                        ? formatDateShort(req.startDate)
                        : `${formatDateShort(req.startDate)} – ${formatDateShort(req.endDate)}`}
                      {' · '}
                      {req.workingDaysCount} day{req.workingDaysCount !== 1 ? 's' : ''}
                    </p>
                    {req.reason && (
                      <p className="text-xs text-slate-400 mt-1 italic">"{req.reason}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  {req.status === 'pending' && rejectId !== req.id && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => approve(req.id)}
                        disabled={submitting}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openReject(req.id)}
                        disabled={submitting}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>

                {/* Inline reject form */}
                {rejectId === req.id && (
                  <div className="mt-4 ml-11 bg-red-50 rounded-lg p-4 border border-red-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                      Rejection Reason
                    </p>
                    <textarea
                      className="w-full h-20 px-3 pt-2 rounded border-[1.5px] bg-white text-sm text-slate-900 focus:outline-none focus:border-red-400 transition-all border-red-200 resize-none"
                      placeholder="Required — explain why this request is being rejected…"
                      value={rejectNote}
                      onChange={(e) => { setRejectNote(e.target.value); setRejectErr(''); }}
                    />
                    {rejectErr && <p className="text-xs text-red-600 mt-1 font-medium">{rejectErr}</p>}
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={confirmReject}
                        disabled={submitting}
                      >
                        {submitting ? 'Rejecting…' : 'Confirm Rejection'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelReject}
                        disabled={submitting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LeaveApprovalsPage;
