import { IsObject, IsString } from 'class-validator';

export class CreateSavedSearchDto {
  @IsString()
  name!: string;

  @IsObject()
  queryParams!: Record<string, unknown>;
}
