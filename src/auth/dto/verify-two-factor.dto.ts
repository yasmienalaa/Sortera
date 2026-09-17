import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  @Length(6, 6)
  code!: string;

  @IsBoolean()
  @IsOptional()
  rememberDevice?: boolean;
}
