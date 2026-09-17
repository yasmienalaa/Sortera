import { Module } from '@nestjs/common';
import { NavSectionsController } from './nav-sections.controller';
import { NavSectionsService } from './nav-sections.service';

@Module({
  controllers: [NavSectionsController],
  providers: [NavSectionsService],
})
export class NavSectionsModule {}
