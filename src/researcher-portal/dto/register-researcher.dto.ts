import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterResearcherDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  // Which tenant's archive this researcher wants access to — the portal
  // is per-tenant (a real deployment would resolve this from the
  // subdomain, e.g. researchers.hbjarchive.com, instead of asking for it
  // explicitly; kept explicit here since this scaffold has no subdomain
  // routing set up).
  @IsString()
  tenantSlug!: string;
}
