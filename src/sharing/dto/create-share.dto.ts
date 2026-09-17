import { SharePermission } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class CreateShareDto {
  @IsString()
  contentItemId!: string;

  @IsString()
  targetTenantId!: string;

  @IsEnum(SharePermission)
  permissionLevel!: SharePermission;
}
