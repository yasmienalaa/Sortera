import { ConfidentialityLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UploadDocumentDto {
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
