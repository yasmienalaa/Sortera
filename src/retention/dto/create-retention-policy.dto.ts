import { ContentType, RetentionAction } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';

export class CreateRetentionPolicyDto {
  @IsEnum(ContentType)
  contentType!: ContentType;

  @IsInt()
  @Min(1)
  retentionPeriodDays!: number;

  @IsEnum(RetentionAction)
  actionOnExpiry!: RetentionAction;
}
