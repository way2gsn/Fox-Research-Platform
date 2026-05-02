'use client';
import { ReactNode, ButtonHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

// ─── Button ──────────────────────────────────────────────────────────────────
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}
export function Button({ variant = 'primary', size = 'md', loading, children, className, disabled, ...rest }: BtnProps) {
  const base = 'inline-flex items-center gap-2 font-medium transition-all duration-200 rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500/50';
  const variants = {
    primary: 'bg-amber-500 text-black hover:bg-amber-400 active:scale-[.98] shadow-[0_0_15px_rgba(255,92,0,0.3)] hover:shadow-[0_0_20px_rgba(255,92,0,0.5)]',
    ghost:   'text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
    danger:  'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20',
    outline: 'border border-[var(--border-bright)] text-[var(--text-dim)] hover:border-[var(--amber)] hover:text-[var(--amber)]',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  return (
    <button className={clsx(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium', className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued:    'bg-[var(--surface-3)] text-[var(--text-dim)]',
    pending:   'bg-blue-500/10 text-blue-400',
    running:   'bg-amber-500/10 text-amber-400',
    completed: 'bg-emerald-500/10 text-emerald-400',
    failed:    'bg-red-500/10 text-red-400',
    cancelled: 'bg-[var(--surface-3)] text-[var(--text-faint)]',
    ingesting: 'bg-amber-500/10 text-amber-400',
    ingested:  'bg-emerald-500/10 text-emerald-400',
  };
  const cls = map[status?.toLowerCase()] ?? 'bg-[var(--surface-3)] text-[var(--text-dim)]';
  return <Badge className={cls}>{status || 'unknown'}</Badge>;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={clsx('relative bg-[var(--surface-1)] border border-[var(--border-bright)] rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto fade-up', wide ? 'w-full max-w-3xl' : 'w-full max-w-md')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          {title && <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>}
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-[var(--surface-3)] text-[var(--text-dim)]">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Input / Textarea ─────────────────────────────────────────────────────────
export function Input({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{label}</label>}
      <input
        className={clsx(
          'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-md px-3 py-2 text-sm placeholder:text-[var(--text-faint)] focus:outline-none focus:border-amber-500/60 transition-colors',
          className
        )}
        {...props}
      />
    </div>
  );
}

export function Textarea({ label, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs text-[var(--text-dim)] font-medium uppercase tracking-wider">{label}</label>}
      <textarea
        className={clsx(
          'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-md px-3 py-2 text-sm placeholder:text-[var(--text-faint)] focus:outline-none focus:border-amber-500/60 transition-colors resize-none',
          className
        )}
        {...props}
      />
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5', className)}>
      {children}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="text-[var(--text-faint)] mb-4">{icon}</div>}
      <p className="text-sm font-medium text-[var(--text-dim)] mb-1">{title}</p>
      {description && <p className="text-xs text-[var(--text-faint)] mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-dim)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--text-faint)] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function Toast({ message, type = 'info', onClose }: { message: string; type?: 'info'|'success'|'error'; onClose: () => void }) {
  const colors = { info: 'bg-[var(--surface-3)] text-[var(--text)]', success: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', error: 'bg-red-500/20 text-red-300 border border-red-500/30' };
  return (
    <div className={clsx('fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm fade-up', colors[type])}>
      {message}
      <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
