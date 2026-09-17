import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit } from '../common/audit/audit.decorator';
import { RolesGuard } from '../common/policy/roles.guard';
import { MediaService } from './media.service';
import { UploadMediaDto } from './dto/upload-media.dto';

@Controller('media')
@UseGuards(RolesGuard)
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } })) // 500MB — video
  @Audit('media', 'create')
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadMediaDto) {
    return this.service.upload(file, dto);
  }
}
