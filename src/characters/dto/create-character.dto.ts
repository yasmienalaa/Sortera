import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateCharacterDto {
  @IsString() name!: string;
  @IsString() @IsOptional() currentStatus?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() nationality?: string;
  @IsString() @IsOptional() personalWebsite?: string;
  @IsArray() @IsOptional() additionalPhotos?: string[];
}
