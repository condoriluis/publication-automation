import { Button } from '@/components/ui/button';
import type { Paginated } from '@/lib/types';

export function Pagination({ data, onPage }: { data: Pick<Paginated<unknown>, 'meta'>; onPage: (page: number) => void }) {
  const { page, totalPages, hasNext, hasPrev, total } = data.meta;
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-foreground/60">
      <span>
        {total} registro{total === 1 ? '' : 's'} · página {page} de {Math.max(totalPages, 1)}
      </span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={!hasPrev} onClick={() => onPage(page - 1)}>
          Anterior
        </Button>
        <Button size="sm" variant="outline" disabled={!hasNext} onClick={() => onPage(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}