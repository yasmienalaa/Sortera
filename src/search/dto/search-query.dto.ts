import { ContentType, LifecycleStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsEnum(ContentType)
  @IsOptional()
  contentType?: ContentType;

  @IsString()
  @IsOptional()
  eventTypeId?: string;

  @IsEnum(LifecycleStatus)
  @IsOptional()
  lifecycleStatus?: LifecycleStatus;

  @IsISO8601()
  @IsOptional()
  dateFrom?: string;

  @IsISO8601()
  @IsOptional()
  dateTo?: string;
}
