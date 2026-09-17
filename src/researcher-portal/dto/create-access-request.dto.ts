import { IsString } from 'class-validator';

export class CreateAccessRequestDto {
  @IsString()
  resourceId!: string; // content_item id
}
