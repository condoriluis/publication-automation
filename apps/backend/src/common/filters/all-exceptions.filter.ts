import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppLogger } from '../logger/app-logger.service';

interface ApiErrorBody {
  statusCode: number;
  success: boolean;
  message: string;
  errors?: unknown;
  path: string;
  method: string;
  requestId?: string;
  timestamp: string;
}

/**
 * Filtro global de excepciones.
 * Unifica la forma de error de la API y traduce errores conocidos
 * (Prisma/MySQL, validation) a 4xx legibles sin filtrar información.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly config: ConfigService;
  private readonly logger: AppLogger;

  constructor(
    logger: AppLogger,
    config: ConfigService,
  ) {
    super();
    this.logger = logger;
    this.config = config;
  }

  private get isProd(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<any>();
    const req = ctx.getRequest<any>();
    const requestId = req.headers?.['x-request-id'] ?? req.id;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let errors: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? exception.message;
        if (Array.isArray(b.message)) {
          errors = b.message;
          message = (b.error as string) ?? 'Validación fallida';
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      message = mapped.message;
      errors = mapped.meta;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Datos inválidos para la base de datos';
      errors = this.isProd ? undefined : exception.message;
    } else if (exception instanceof Error) {
      if (exception.name === 'ThrottlerException') {
        status = HttpStatus.TOO_MANY_REQUESTS;
        message = 'Demasiadas peticiones. Intenta de nuevo en un momento.';
      }
    } else if (typeof exception === 'object' && exception !== null) {
      const anyE = exception as Record<string, unknown>;
      if (anyE.type === 'webhook') {
        // Errores de validación de payload (Zod/class-validator)
        status = HttpStatus.BAD_REQUEST;
      }
    }

    // Log de error guardando el error aunque no tengamos stack útil
    if (exception instanceof Error && exception.stack) {
      this.logger.error(`${req.method} ${req.originalUrl} -> ${status}`, exception.stack, 'Filter');
    } else {
      this.logger.error(`${req.method} ${req.originalUrl} -> ${status} :: ${message}`, undefined, 'Filter');
    }

    const body: ApiErrorBody = {
      statusCode: status,
      success: false,
      message,
      errors,
      path: req.originalUrl,
      method: req.method,
      requestId,
      timestamp: new Date().toISOString(),
    };
    if (this.isProd && status >= 500) delete body.errors;

    res.status(status).json(body);
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): { status: number; message: string; meta?: unknown } {
    const code = e.code;
    const meta = (e.meta ?? {}) as Record<string, unknown>;
    switch (code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Conflicto: el registro ya existe (valor duplicado).',
          meta: { fields: meta.target },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'El recurso solicitado no existe.',
          meta: { cause: meta.cause },
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Operación rechazada: depende de un registro inexistente.',
          meta: { constraint: meta.field_name },
        };
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'La relación no permite esta operación.',
        };
      case 'ER_DUP_ENTRY':
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Valor demasiado largo para el campo.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error de base de datos.',
          meta: { code },
        };
    }
  }
}
