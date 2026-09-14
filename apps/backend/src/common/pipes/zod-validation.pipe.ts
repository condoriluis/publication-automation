import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Pipe de validación clásico basado en class-validator + class-transformer.
 * Configurable por ruta; el global de Nest ya cubre DTOs, este es para
 * casos puntuales que requieren instancias transformadas explícitas.
 */
@Injectable()
export class DtoValidationPipe<T extends object> implements PipeTransform<unknown, Promise<T>> {
  constructor(private readonly metatype: new () => T) {}

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<T> {
    const dto = plainToInstance(this.metatype, value);

    if (!metadata.metatype) return value as T;
    if (!this.toValidate(metadata.metatype)) return value as T;

    const errors = await validate(dto);
    if (errors.length > 0) {
      const formatted = errors.map((e) => ({
        field: e.property,
        errors: Object.values(e.constraints ?? {}),
      }));
      throw new BadRequestException({
        message: 'Validación fallida',
        errors: formatted,
      });
    }
    return dto;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
