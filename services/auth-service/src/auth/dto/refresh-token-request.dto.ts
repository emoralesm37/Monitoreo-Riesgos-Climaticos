import {
  IsJWT,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class RefreshTokenRequestDto {
  @IsString()
  @IsNotEmpty({
    message: 'El refresh token es obligatorio.',
  })
  @IsJWT({
    message: 'El refresh token no tiene un formato válido.',
  })
  refreshToken!: string;
}