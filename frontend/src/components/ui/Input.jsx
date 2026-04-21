import { forwardRef } from 'react';

const Input = forwardRef(function Input({ label, error, id, className = '', ...rest }, ref) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full h-[46px] px-3 rounded border-[1.5px] bg-slate-50 text-base text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:outline-none focus:shadow-focus focus:bg-white ${
          error
            ? 'border-red-400 focus:border-red-500'
            : 'border-slate-200 focus:border-brand-500'
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
});

export default Input;
