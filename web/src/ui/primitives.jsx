import { useEffect, useRef } from 'react';
import { readableOn } from '../data/colors.js';

const cx = (...c) => c.filter(Boolean).join(' ');

export function buttonStyles(variant = 'secondary', className) {
  const base = 'inline-flex min-h-[40px] items-center justify-center gap-2 whitespace-nowrap rounded-sm border-2 px-3.5 py-2 text-sm font-bold transition-colors duration-fast active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0';
  const tone = variant === 'primary'
    ? 'border-accent bg-accent text-on-accent hover:brightness-90'
    : variant === 'danger'
      ? 'border-danger bg-bg text-danger hover:bg-surface'
      : 'border-text bg-bg text-text hover:bg-surface';
  return cx(base, tone, className);
}

export function Button({ variant = 'secondary', loading, className, children, ...rest }) {
  return (
    <button type="button" className={buttonStyles(variant, className)} aria-busy={loading || undefined} disabled={loading || rest.disabled} {...rest}>
      {loading && <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

export function Pill({ pressed, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cx(
        'min-h-[40px] rounded-full border-control px-3 py-1.5 text-sm transition-colors duration-fast',
        pressed ? 'border-accent bg-accent text-on-accent' : 'border-text bg-bg text-text hover:bg-surface',
        className,
      )}
      {...rest}
    >
      {pressed && <span aria-hidden="true">✓&nbsp;</span>}
      {children}
    </button>
  );
}

export function Chip({ on = true, accent, children }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded-full border-control px-2.5 py-[3px] text-[13px] font-semibold',
      accent ? 'border-accent bg-accent text-on-accent' : on ? 'border-text' : 'border-dashed border-border-input text-muted',
    )}>
      {!accent && <span aria-hidden="true" className={cx('h-2 w-2 rounded-full', on ? 'bg-accent' : 'bg-border-input')} />}
      {children}
    </span>
  );
}

export function Field({ label, error, id, children }) {
  return (
    <div className="grid gap-1 text-[13px] font-semibold">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span id={`${id}-err`} className="text-danger">{error}</span>}
    </div>
  );
}

export const inputClass = 'w-full rounded-sm border-control border-border-input bg-bg p-2 font-normal text-text disabled:opacity-50 aria-[invalid=true]:border-danger';

export const Skeleton = ({ className }) => <div aria-hidden="true" className={cx('skeleton', className)} />;

export function EmptyState({ title, body, action }) {
  return (
    <div className="frame px-6 py-8">
      <div className="label">{title}</div>
      <p className="mt-1 max-w-prose text-body-sm text-muted">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-md bg-surface p-4">
      <p className="font-semibold text-danger">{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && <Button className="mt-3" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Avatar({ name, size = 42, empty, color }) {
  const filled = !empty && color;
  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.36), ...(filled && { background: color, color: readableOn(color) }) }}
      className={cx('grid flex-none place-items-center rounded-full font-bold', empty ? 'border-2 border-dashed border-border-input text-muted' : filled ? 'border border-border-input' : 'bg-text text-bg')}
    >
      {empty ? '+' : name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function Dialog({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="w-[calc(100%-32px)] max-w-dialog rounded-lg border-[3px] border-text bg-bg p-[22px] text-text backdrop:bg-black/60"
    >
      <h2 id="dialog-title" className="text-lg">{title}</h2>
      <div className="mt-3">{children}</div>
    </dialog>
  );
}

export const errorMessage = (e) => e?.message ?? 'Something went wrong. Try again.';
