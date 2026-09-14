import { cn } from '@/lib/utils';

type Variant = 'success' | 'warning' | 'destructive' | 'secondary' | 'default';

const MAP: Record<string, Variant> = {
  DRAFT: 'secondary',
  SCHEDULED: 'default',
  PUBLISHING: 'warning',
  PUBLISHED: 'success',
  PARTIALLY_FAILED: 'warning',
  FAILED: 'destructive',
  CANCELLED: 'destructive',
  RUNNING: 'success',
  PAUSED: 'warning',
  COMPLETED: 'default',
  ACTIVE: 'success',
  EXPIRED: 'warning',
  REVOKED: 'destructive',
  DISCONNECTED: 'secondary',
  DISABLED: 'warning',
  VISIBLE: 'success',
  HIDDEN: 'warning',
  DELETED: 'destructive',
  RESPONSED: 'success',
  PENDING: 'secondary',
  NONE: 'secondary',
  LOW: 'default',
  MEDIUM: 'warning',
  HIGH: 'destructive',
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const variant = MAP[value] ?? 'secondary';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variant === 'success' && 'border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        variant === 'warning' && 'border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400',
        variant === 'destructive' && 'border-transparent bg-destructive/10 text-destructive',
        variant === 'default' && 'border-transparent bg-primary/10 text-primary',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {value}
    </span>
  );
}