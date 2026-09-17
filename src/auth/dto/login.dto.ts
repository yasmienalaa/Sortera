import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  // Returned by a previous /auth/2fa/verify call with rememberDevice=true.
  // If present and valid, and still within its trust window, login skips
  // straight to a full access token instead of prompting for a code again.
  @IsString()
  @IsOptional()
  deviceToken?: string;
}
