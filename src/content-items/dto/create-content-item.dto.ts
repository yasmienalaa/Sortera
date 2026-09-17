import { ContentType, ConfidentialityLevel } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateContentItemDto {
  @IsEnum(ContentType)
  contentType!: ContentType;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsEnum(ConfidentialityLevel)
  @IsOptional()
  confidentialityLevel?: ConfidentialityLevel;

  @IsString()
  @IsOptional()
  eventId?: string;

  @IsString()
  @IsOptional()
  eventTypeId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
