import {
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';

/**
 * Models that carry a tenant_id column and must NEVER be queried without
 * it. This is the enforcement point instruction #4 calls for: "middleware
 * الفلترة الإجباري" — implemented here at the ORM layer via a Prisma
 * Client Extension, not per-endpoint, so a controller/service literally
 * cannot forget to scope a query. Add every new tenant-scoped model here
 * as Phase 2/3/4 introduce it (ai_predictions, tasks, retention_policies…).
 */
const TENANT_SCOPED_MODELS = new Set([
  'User',
  'ContentItem',
  'AuditLog',
  'ContentRelation',
  'StatusTransition',
  'AiPrediction',
  'PendingMergeSuggestion',
  'EventType',
  'NavSection',
  'Task',
  'EventRevision',
  'ActiveSession',
  'DashboardSnapshot',
  'SavedSearch',
  'DocumentFile',
  'RetentionPolicy',
  'MediaFile',
  'ResearcherAccount',
  'AccessRequest',
  'WatermarkJob',
  'Character',
  'Brand',
  // SharedResource is DELIBERATELY NOT in this set. Its tenant_id column
  // means "the tenant granted access" (the recipient), not "the owning
  // tenant" — the usual assumption this extension makes everywhere else.
  // Auto-injecting tenantId = current tenant on every query would silently
  // turn "what have I shared OUT to others" into "what's shared WITH me",
  // which is a real security-relevant footgun, not a convenience. Every
  // query against SharedResource must filter explicitly and deliberately —
  // see SharedResourcesService, the one place that's allowed to touch it.
]);

/** append-only per spec B2 — no update/delete, not even for SuperAdmin. */
const APPEND_ONLY_MODELS = new Set(['AuditLog', 'StatusTransition', 'EventRevision']);

const MUTATING_WITH_WHERE = new Set(['update', 'updateMany', 'delete', 'deleteMany', 'upsert']);
const READ_OPS = new Set(['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy']);
const CREATE_OPS = new Set(['create', 'createMany']);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly tenantContext: TenantContextService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * The tenant-scoped, request-safe client. Every service in the app
   * should use `prisma.forRequest()` (or just `prisma` if you've wired
   * the extension at the root — see below) rather than a raw
   * `PrismaClient`, so this extension is always in the loop.
   *
   * We expose it as a getter that builds the extended client lazily so
   * `this.tenantContext` (injected above) is in scope inside the
   * extension's closures.
   */
  private extendedClient = this.buildExtendedClient();

  get scoped() {
    return this.extendedClient;
  }

  private buildExtendedClient() {
    const tenantContext = this.tenantContext;

    return this.$extends({
      name: 'mandatory-tenant-scoping',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_SCOPED_MODELS.has(model)) {
              return query(args);
            }

            if (
              APPEND_ONLY_MODELS.has(model) &&
              (MUTATING_WITH_WHERE.has(operation) ||
                operation === 'update' ||
                operation === 'delete')
            ) {
              throw new ForbiddenException(
                `${model} is append-only. ${operation} is not permitted, ` +
                  `even for SuperAdmin — see spec section B2.`,
              );
            }

            // Throws if there's no request context at all — refusing to
            // run rather than silently returning/writing unscoped data.
            const tenantId = tenantContext.requireTenantId();
            const a = args as Record<string, any>;

            if (READ_OPS.has(operation)) {
              a.where = { ...(a.where ?? {}), tenantId };
            } else if (CREATE_OPS.has(operation)) {
              if (operation === 'createMany' && Array.isArray(a.data)) {
                a.data = a.data.map((d: any) => ({ ...d, tenantId }));
              } else {
                a.data = { ...(a.data ?? {}), tenantId };
              }
            } else if (MUTATING_WITH_WHERE.has(operation)) {
              a.where = { ...(a.where ?? {}), tenantId };
              if (operation === 'upsert') {
                a.create = { ...(a.create ?? {}), tenantId };
              }
            }

            return query(a as any);
          },
        },
      },
    });
  }
}

export type ScopedPrismaClient = ReturnType<PrismaService['buildExtendedClient']>;
