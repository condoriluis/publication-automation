import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Formato de email inválido' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]{3,32}$/, { message: 'Username de 3 a 32 caracteres (letras, números, _ . -)' })
  username!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}