const styles = {
  active:   { pill: 'bg-green-50 text-green-700',  dot: 'bg-green-500' },
  on_leave: { pill: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-500' },
  inactive: { pill: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

function StatusBadge({ status = 'active' }) {
  const s = styles[status] ?? styles.inactive;
  const label = status.replace('_', ' ');
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label}
    </span>
  );
}

export default StatusBadge;
