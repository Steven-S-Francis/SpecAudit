import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  variant: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}>;

const variantStyles: Record<Props['variant'], string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  danger: 'bg-red-700 hover:bg-red-600 text-white',
  ghost: 'border border-slate-600 hover:border-slate-400 text-slate-300',
};

export function Button({ variant, disabled, onClick, children, className = '' }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
