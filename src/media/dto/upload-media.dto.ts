import { ContentType, ConfidentialityLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UploadMediaDto {
  @IsEnum(ContentType)
  contentType!: ContentType; // VIDEO or IMAGE

  @IsString()
  @MinLength(1)
  title!: string;

  @IsEnum(ConfidentialityLevel)
  @IsOptional()
  confidentialityLevel?: ConfidentialityLevel;

  @IsString()
  @IsOptional()
  eventId?: string;
}
