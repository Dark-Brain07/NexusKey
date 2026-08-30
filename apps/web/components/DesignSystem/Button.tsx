import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-surface-tint text-on-primary hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
  secondary:
    'bg-transparent border border-outline-variant text-on-surface-variant hover:text-white hover:border-white disabled:opacity-40 disabled:pointer-events-none',
  danger:
    'bg-status-error text-white hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
  ghost: 'bg-transparent text-on-surface-variant hover:text-white disabled:opacity-40 disabled:pointer-events-none',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-label-caps font-label-caps uppercase transition-all duration-150 ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4Z" />
        </svg>
      )}
      {children}
    </button>
  );
}
