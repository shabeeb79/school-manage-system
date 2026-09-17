import { MoreHorizontal, TrendingDown, TrendingUp } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export type BadgeTone = 'slate' | 'blue' | 'green' | 'red' | 'amber';
export type AvatarSize = 'sm' | 'md' | 'lg';

const AVATAR_COLORS = ['bg-blue-600', 'bg-indigo-600', 'bg-cyan-600', 'bg-teal-600'];

export function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-800',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: AvatarSize }) {
  const sizes: Record<AvatarSize, string> = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-10 w-10 text-sm',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        sizes[size],
        avatarColor(name),
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  trend,
  subtext,
  icon,
}: {
  label: string;
  value: string;
  trend?: { direction: 'up' | 'down'; percent: string };
  subtext?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="relative p-4 md:p-5">
      {icon && <span className="absolute right-4 top-4 text-gray-400">{icon}</span>}
      <p className="pr-8 text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600',
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {trend.percent}
          </span>
        )}
        {subtext && <span className="text-xs text-gray-400">{subtext}</span>}
      </div>
    </Card>
  );
}

export function TableShell({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-4 py-3 font-medium text-gray-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  icon,
  onClick,
  type = 'button',
  className,
  disabled,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function IconButton({
  label,
  children,
  onClick,
  className,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 active:bg-gray-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Modal({
  children,
  onClose,
  className,
  size = 'md',
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const widths = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-xl',
    lg: 'sm:max-w-2xl',
  };

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <Card
        className={cn(
          'relative z-10 flex w-full max-h-[min(92dvh,40rem)] flex-col overflow-hidden',
          'rounded-t-2xl border-b-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg',
          'sm:rounded-xl sm:border sm:p-6 sm:pb-6',
          widths[size],
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-gray-200 sm:hidden" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </Card>
    </div>
  );
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={busy ? () => undefined : onClose} size="sm">
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 sm:text-lg">{title}</h2>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-gray-500">{description}</p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50',
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
            )}
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function OverflowMenu() {
  return (
    <IconButton label="More actions">
      <MoreHorizontal className="h-4 w-4" />
    </IconButton>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200/80', className)}
      aria-hidden
    />
  );
}

export function PortalSkeleton() {
  return (
    <div className="flex min-h-dvh bg-gray-50">
      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white p-4 md:block">
        <Skeleton className="mb-6 h-8 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-6 h-4 w-72 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </main>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PostMedia({
  src,
  mediaType,
  className,
}: {
  src?: string | null;
  mediaType?: string | null;
  className?: string;
}) {
  if (!src) return null;

  const isVideo =
    mediaType === 'VIDEO' || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(src);

  return (
    <div
      className={cn(
        'mt-3 flex justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50',
        className,
      )}
    >
      {isVideo ? (
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="h-auto max-h-56 w-auto max-w-full object-contain sm:max-h-72 md:max-h-80"
        />
      ) : (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-auto max-h-56 w-auto max-w-full object-contain sm:max-h-72 md:max-h-80"
        />
      )}
    </div>
  );
}

export function PersonCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} />
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{name}</p>
        {sub && <p className="truncate text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}
