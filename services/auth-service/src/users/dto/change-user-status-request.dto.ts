import { IsBoolean } from 'class-validator';

export class ChangeUserStatusRequestDto {
  @IsBoolean()
  isActive!: boolean;
}