import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { PolicyModule } from './common/policy/policy.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { TenantMiddleware } from './common/tenant-context/tenant.middleware';
import { AuthModule } from './auth/auth.module';
import { ContentItemsModule } from './content-items/content-items.module';
import { NavSectionsModule } from './nav-sections/nav-sections.module';
import { AiPredictionsModule } from './ai-predictions/ai-predictions.module';
import { MergeSuggestionsModule } from './merge-suggestions/merge-suggestions.module';
import { TasksModule } from './tasks/tasks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventTypesModule } from './event-types/event-types.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { DocumentsModule } from './documents/documents.module';
import { RetentionModule } from './retention/retention.module';
import { SharingModule } from './sharing/sharing.module';
import { MediaModule } from './media/media.module';
import { ResearcherPortalModule } from './researcher-portal/researcher-portal.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // powers DashboardService's hourly cron (A2)
    // Registered again here (not just inside AuthModule) so
    // TenantMiddleware — which needs JwtService — can be instantiated at
    // the app-module level, independent of AuthModule's internal wiring.
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
      }),
    }),
    PrismaModule,
    AuditModule,
    PolicyModule,
    RateLimitModule,
    AuthModule,
    ContentItemsModule,
    NavSectionsModule,
    AiPredictionsModule,
    MergeSuggestionsModule,
    TasksModule,
    DashboardModule,
    EventTypesModule,
    SearchModule,
    StorageModule,
    DocumentsModule,
    RetentionModule,
    SharingModule,
    MediaModule,
    ResearcherPortalModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Applied to every route. TenantMiddleware itself exempts the small
    // public-path allowlist (/auth/login, /health) — see its source.
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
