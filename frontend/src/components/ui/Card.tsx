import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  className?: string;
}>;

export function Card({ className = '', children }: Props) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 ${className}`}>
      {children}
    </div>
  );
}
