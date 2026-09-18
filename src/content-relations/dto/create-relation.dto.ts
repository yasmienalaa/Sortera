import { RelationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateRelationDto {
  @IsString() sourceId!: string;
  @IsString() targetId!: string;
  @IsEnum(RelationType) relationType!: RelationType;
  @IsOptional() confidenceScore?: number;
}
