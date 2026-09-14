import type { ReactNode } from 'react';

export function EmptyState({ icon, title, description, children }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      {icon ? <div className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground/60">{icon}</div> : null}
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="mt-1 text-sm text-foreground/60">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}