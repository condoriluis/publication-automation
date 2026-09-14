import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

/**
 * Asigna/correlaciona un `X-Request-Id` por petición.
 * - Reutiliza el header entrante (correlación con proxies/LB).
 * - Si no viene, lo genera y lo propaga en la respuesta para trazar logs.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { id?: string }>();
    const res = context.switchToHttp().getResponse<Response>();

    const incoming = Array.isArray(req.headers['x-request-id'])
      ? req.headers['x-request-id'][0]
      : (req.headers['x-request-id'] as string | undefined);

    const requestId = incoming?.trim() || randomBytes(8).toString('hex');
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);

    return next.handle();
  }
}