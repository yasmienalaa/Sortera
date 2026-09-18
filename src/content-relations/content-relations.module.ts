import { Module } from '@nestjs/common';
import { ContentRelationsController } from './content-relations.controller';
import { ContentRelationsService } from './content-relations.service';

@Module({ controllers: [ContentRelationsController], providers: [ContentRelationsService] })
export class ContentRelationsModule {}
