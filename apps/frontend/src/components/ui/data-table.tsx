'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingRows } from '@/components/pagination';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  /** Devuelve true para las filas que pueden desplegar contenido extra. */
  getRowCanExpand?: (row: Row<TData>) => boolean;
  /** Contenido extra que se muestra debajo de la fila al expandirla. */
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactNode;
  /**
   * Modo remoto: la paginación y la búsqueda las sirve el backend. El
   * componente muestra la página actual y avisa al padre de los cambios.
   */
  manualPagination?: boolean;
  /** Total de filas en el servidor (para la paginación remota). */
  rowCount?: number;
  /** Se dispara al cambiar de página o tamaño de página (índice 0-based). */
  onPaginationChange?: (pageIndex: number, pageSize: number) => void;
  /** Se dispara al escribir en el buscador (modo remoto). */
  onSearchChange?: (value: string) => void;
  /** Oculta el buscador y el selector de tamaño de página. */
  hideToolbar?: boolean;
  /** Oculta el bloque de paginación (ideal para tablas resumen). */
  hidePagination?: boolean;
}

const expanderColumn: ColumnDef<unknown, unknown> = {
  id: 'expander',
  enableSorting: false,
  header: () => null,
  cell: ({ row }) =>
    row.getCanExpand() ? (
      <button
        type="button"
        onClick={() => row.toggleExpanded()}
        aria-label={row.getIsExpanded() ? 'Contraer' : 'Expandir'}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        {row.getIsExpanded() ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
    ) : null,
};

export function DataTable<TData, TValue>({
  columns,
  data,
  loading,
  getRowCanExpand,
  renderSubComponent,
  manualPagination,
  rowCount,
  onPaginationChange,
  onSearchChange,
  hideToolbar,
  hidePagination,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const isRemote = manualPagination === true;

  const mergedColumns = React.useMemo<ColumnDef<TData, TValue>[]>(
    () => (renderSubComponent ? ([expanderColumn, ...columns] as ColumnDef<TData, TValue>[]) : columns),
    [columns, renderSubComponent],
  );

  const table = useReactTable({
    data,
    columns: mergedColumns,
    state: { sorting, globalFilter, expanded, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      const reset = next.pageSize !== pagination.pageSize;
      const resolved = reset ? { ...next, pageIndex: 0 } : next;
      setPagination(resolved);
      if (isRemote) onPaginationChange?.(resolved.pageIndex, resolved.pageSize);
    },
    getRowCanExpand,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: isRemote ? undefined : getFilteredRowModel(),
    getSortedRowModel: isRemote ? undefined : getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    ...(isRemote
      ? { pageCount: Math.max(1, Math.ceil((rowCount ?? 0) / pagination.pageSize)), rowCount }
      : {}),
  });

  const totalRows = isRemote ? rowCount ?? 0 : table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const firstRowIndex = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRowIndex = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="space-y-4">
      {/* 🔎 Filtros y selector */}
      {!hideToolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Input
            placeholder="Buscar..."
            value={globalFilter ?? ''}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              if (isRemote) onSearchChange?.(e.target.value);
            }}
            className="pr-8"
          />
          {globalFilter && (
            <button
              onClick={() => {
                setGlobalFilter('');
                if (isRemote) onSearchChange?.('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted-foreground)] sm:text-sm">Mostrar:</span>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-9 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-[var(--muted-foreground)] sm:text-sm">registros</span>
        </div>
      </div>
      )}

      {/* 🔎 Tabla scrollable en móvil */}
      <div className="overflow-x-auto rounded-md border bg-[var(--card)] shadow-sm">
        <Table className="min-w-[600px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-[var(--muted)]/50">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={!isRemote && header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    className={!isRemote && header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                  >
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: ' ↑',
                        desc: ' ↓',
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={mergedColumns.length} className="h-24 text-center">
                  <LoadingRows rows={3} />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && renderSubComponent ? (
                    <TableRow>
                      <TableCell colSpan={row.getVisibleCells().length} className="bg-muted/20 p-0">
                        {renderSubComponent({ row })}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={mergedColumns.length} className="h-24 text-center text-sm text-[var(--muted-foreground)]">
                  No hay registros disponibles
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 🔎 Paginación */}
      {!hidePagination && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-[var(--muted-foreground)] sm:text-sm">
          Mostrando {totalRows > 0 ? firstRowIndex : 0} - {totalRows > 0 ? lastRowIndex : 0} de {totalRows}
        </span>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-center text-xs text-[var(--muted-foreground)] sm:text-left sm:text-sm">
            Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
          </span>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="mr-1 size-4" /> Inicio
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              Fin <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
