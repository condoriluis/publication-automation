import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Query params para GET /pages/:id/metrics.
 * El rango por defecto (30 días antes de hoy → ahora) lo aplica el controlador.
 */
export class QueryMetricsDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}