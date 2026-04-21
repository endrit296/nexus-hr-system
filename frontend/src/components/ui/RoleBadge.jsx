const styles = {
  admin:    'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  manager:  'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
  employee: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

function RoleBadge({ role = 'employee' }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${styles[role] ?? styles.employee}`}>
      {role}
    </span>
  );
}

export default RoleBadge;
