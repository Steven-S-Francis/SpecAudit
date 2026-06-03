import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  variant: 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md';
  title?: string;
}>;

const variantStyles: Record<Props['variant'], string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  danger: 'bg-red-700 hover:bg-red-600 text-white',
  ghost: 'border border-slate-600 hover:border-slate-400 text-slate-300 light:border-slate-300 light:hover:border-slate-400 light:text-slate-600',
};

const sizeStyles = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({ variant, disabled, onClick, children, className = '', size = 'md', title }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </button>
  );
}
