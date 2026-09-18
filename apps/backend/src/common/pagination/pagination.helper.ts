export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  skip: number;
  take: number;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
/** Cota superior del OFFSET para listas muy grandes: evita "deep pagination".
 *  Conjuntos mayores requieren paginación por cursor. */
export const MAX_OFFSET = 10_000;

/** Normaliza page/limit (clamps) y deriva skip/take para Prisma. */
export function parsePageOptions(query: Record<string, unknown> | undefined): PaginationOptions {
  const rawPage = Number(query?.page ?? DEFAULT_PAGE);
  const rawLimit = Number(query?.limit ?? DEFAULT_LIMIT);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : DEFAULT_PAGE;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;
  const sortBy = typeof query?.sortBy === 'string' && query.sortBy.trim() ? query.sortBy.trim() : undefined;
  const sortOrder: 'asc' | 'desc' = query?.sortOrder === 'asc' ? 'asc' : 'desc';
  const skip = Math.min((page - 1) * limit, MAX_OFFSET);
  return { page, limit, sortBy, sortOrder, skip, take: limit };
}

/** Envuelve resultados + total en un body paginado estable. */
export function buildPaginated<T>(data: T[], total: number, options: PaginationOptions): Paginated<T> {
  const { page, limit } = options;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    data,
    meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  };
}

/** Helper inyectable vía PaginationModule (envuelve las fns puras). */
export class PaginationHelper {
  parsePageOptions(query: Record<string, unknown> | undefined): PaginationOptions {
    return parsePageOptions(query);
  }
  buildPaginated<T>(data: T[], total: number, options: PaginationOptions): Paginated<T> {
    return buildPaginated(data, total, options);
  }
}