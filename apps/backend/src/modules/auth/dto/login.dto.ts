import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf((o) => !o.username)
  @IsEmail({}, { message: 'Email inválido' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  @MaxLength(32)
  username?: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password!: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}