import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginRequestDto {
  @IsEmail(
    {},
    {
      message: 'El correo electrónico no es válido.',
    },
  )
  @MaxLength(150)
  email!: string;

  @IsString()
  @IsNotEmpty({
    message: 'La contraseña es obligatoria.',
  })
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres.',
  })
  @MaxLength(100)
  password!: string;
}
