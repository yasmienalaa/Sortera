import { IsOptional, IsString } from 'class-validator';

export class CreateBrandDto {
  @IsString() name!: string;
  @IsString() @IsOptional() logoPath?: string;
}
