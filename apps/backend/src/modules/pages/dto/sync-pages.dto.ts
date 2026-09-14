import { IsOptional, IsBoolean } from 'class-validator';

/**
 * Body para POST /pages/:id/sync.
 * `force`: re-sincroniza aunque la página no aparezca en /me/accounts
 * y conserva el token/estado local si Meta no lo devuelve.
 */
export class SyncPagesDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}