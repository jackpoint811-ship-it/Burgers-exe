import type { ReactNode } from 'react';
import { cn } from './cn';

type ShellCardProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
};

export function ShellCard({ title, subtitle, children, className }: ShellCardProps) {
  return (
    <section className={cn('rounded-2xl border border-white/15 bg-white/5 p-4 shadow-xl backdrop-blur', className)}>
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-zinc-300">{subtitle}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
