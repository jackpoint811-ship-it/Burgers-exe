import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950', className)} {...props} />;
}

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide', className)} {...props} />;
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl', className)} {...props} />;
}

export function SectionHeader({ title, subtitle, action, className }: { title: string; subtitle?: string; action?: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}><div><h2 className='text-2xl font-extrabold'>{title}</h2>{subtitle ? <p className='mt-1 text-sm text-zinc-300'>{subtitle}</p> : null}</div>{action}</div>;
}

export function EmptyState({ title, description, className }: { title: string; description: string; className?: string }) {
  return <div className={cn('rounded-xl border border-dashed border-white/20 bg-zinc-900/60 p-4 text-center', className)}><p className='font-semibold'>{title}</p><p className='mt-1 text-sm text-zinc-400'>{description}</p></div>;
}

export function StatusPill({ children, className }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold', className)}>{children}</span>;
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button className={cn('h-8 w-8 rounded-lg border border-white/15 bg-zinc-800 p-0 text-white', className)} {...props} />;
}
