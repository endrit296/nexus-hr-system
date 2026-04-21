const variantMap = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 hover:shadow-brand active:scale-[0.98]',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
  danger:    'bg-red-600 text-white hover:bg-red-700',
  ghost:     'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700',
};

const sizeMap = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

function Button({ variant = 'primary', size = 'md', children, className = '', ...rest }) {
  return (
    <button
      className={`rounded font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantMap[variant]} ${sizeMap[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
