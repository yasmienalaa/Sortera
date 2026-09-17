import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  researcherId!: string;

  @IsString()
  contentItemId!: string;

  @IsString()
  taskType!: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
