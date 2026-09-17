import { PredictionType } from '@prisma/client';
import { IsEnum, IsNumber, IsObject, IsString, Max, Min } from 'class-validator';

export class CreateAiPredictionDto {
  @IsString()
  resourceId!: string;

  @IsEnum(PredictionType)
  predictionType!: PredictionType;

  @IsObject()
  predictedValue!: Record<string, unknown>;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore!: number;
}
