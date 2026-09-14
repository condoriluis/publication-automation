'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const TabsContext = React.createContext<{ active: string; setActive: (v: string) => void } | null>(null);

export function Tabs({ defaultValue, className, children }: {
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [active, setActive] = React.useState(defaultValue);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={cn('flex flex-col gap-4', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ value, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = React.useContext(TabsContext)!;
  return (
    <button
      onClick={() => ctx.setActive(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none',
        ctx.active === value
          ? 'bg-background text-foreground shadow'
          : 'hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ value, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const ctx = React.useContext(TabsContext)!;
  if (ctx.active !== value) return null;
  return <div className={cn('animate-in fade-in-0 duration-200', className)} {...props} />;
}
