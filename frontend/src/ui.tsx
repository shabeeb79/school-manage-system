import { MoreHorizontal, TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

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
}: {
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800"
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

export function OverflowMenu() {
  return (
    <IconButton label="More actions">
      <MoreHorizontal className="h-4 w-4" />
    </IconButton>
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
