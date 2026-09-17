import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Audit } from '../common/audit/audit.decorator';
import { RolesGuard } from '../common/policy/roles.guard';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Controller('documents')
@UseGuards(RolesGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } })) // 50MB
  @Audit('document', 'create')
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadDocumentDto) {
    return this.service.upload(file, dto);
  }

  @Get(':contentItemId/status')
  @Audit('document', 'view')
  status(@Param('contentItemId') contentItemId: string) {
    return this.service.status(contentItemId);
  }
}
