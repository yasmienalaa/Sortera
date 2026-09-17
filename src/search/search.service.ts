import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../common/tenant-context/tenant-context.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * B1: "البحث يُوجَّه للفهرس، والنتيجة تُرجع IDs فقط، ثم تُجلب التفاصيل
   * من القاعدة الرئيسية." Here "الفهرس" is content_items.search_vector
   * itself rather than a separate Elasticsearch/Meilisearch cluster (see
   * README for the trade-off) — but the two-step shape is the same, so
   * swapping the index implementation later doesn't change this method's
   * contract.
   *
   * $queryRaw bypasses the mandatory-tenant-scoping Prisma extension
   * entirely (extensions only intercept Prisma Client's model methods,
   * not raw SQL) — tenantId is injected manually and explicitly below.
   * This is the third and last sanctioned bypass in the app, alongside
   * login and the session-revocation check; flagging it the same way.
   */
  async search(params: SearchQueryDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];
    if (params.contentType) conditions.push(Prisma.sql`content_type = ${params.contentType}::"ContentType"`);
    if (params.eventTypeId) conditions.push(Prisma.sql`event_type_id = ${params.eventTypeId}`);
    if (params.lifecycleStatus) {
      conditions.push(Prisma.sql`lifecycle_status = ${params.lifecycleStatus}::"LifecycleStatus"`);
    }
    if (params.dateFrom) conditions.push(Prisma.sql`created_at >= ${new Date(params.dateFrom)}`);
    if (params.dateTo) conditions.push(Prisma.sql`created_at <= ${new Date(params.dateTo)}`);

    let orderBy = Prisma.sql`ORDER BY created_at DESC`;
    if (params.q?.trim()) {
      conditions.push(Prisma.sql`search_vector @@ plainto_tsquery('simple', ${params.q})`);
      orderBy = Prisma.sql`ORDER BY ts_rank(search_vector, plainto_tsquery('simple', ${params.q})) DESC`;
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM content_items WHERE ${whereClause} ${orderBy} LIMIT 50`,
    );
    const orderedIds = rows.map((r) => r.id);
    if (orderedIds.length === 0) return [];

    // Step 2: hydrate full rows through the normal, policy-aware,
    // tenant-scoped Prisma path — never return raw-SQL rows directly to
    // the caller.
    const items = await this.prisma.scoped.contentItem.findMany({ where: { id: { in: orderedIds } } });
    const byId = new Map(items.map((i) => [i.id, i]));
    return orderedIds.map((id) => byId.get(id)).filter(Boolean);
  }

  /** Called after content_items writes and after an AI TEXT prediction is
   * approved, so approved transcript text becomes searchable (B1's "النص
   * المستخرج من AI" requirement) without waiting for another edit to the
   * content_item row itself to re-fire the DB trigger. */
  async reindex(contentItemId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.prisma.$executeRaw`
      UPDATE content_items ci
      SET search_vector =
        setweight(to_tsvector('simple', coalesce(ci.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce((
          SELECT string_agg(ap.predicted_value->>'text', ' ')
          FROM ai_predictions ap
          WHERE ap.resource_id = ci.id
            AND ap.prediction_type = 'TEXT'
            AND ap.status = 'APPROVED'
        ), '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(ci.metadata::text, '')), 'C')
      WHERE ci.id = ${contentItemId} AND ci.tenant_id = ${tenantId}
    `;
  }
}
