import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  tenantId: string;
  userId: string;
  role: string;
  ipAddress?: string;
  actorType: 'STAFF' | 'RESEARCHER' | 'SYSTEM';
}

/**
 * Holds the current request's tenant/user identity in an AsyncLocalStorage
 * store, so any service (in particular PrismaService's query extension)
 * can read "who is asking" without the caller having to pass tenantId
 * through every function signature — which is exactly the kind of thing
 * that gets forgotten and causes a cross-tenant leak.
 *
 * This is populated once, by TenantMiddleware, at the very start of the
 * request lifecycle — before any controller/service code runs.
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Use only when a tenant-scoped query is genuinely required (e.g. inside
   * PrismaService). Throws instead of silently running an unscoped query,
   * which is the whole point of making tenant_id mandatory at the ORM
   * layer rather than trusting every endpoint to remember it.
   */
  requireTenantId(): string {
    const ctx = this.storage.getStore();
    if (!ctx?.tenantId) {
      throw new Error(
        'No tenant context available for this query. Refusing to run an ' +
          'unscoped query against a tenant-isolated table.',
      );
    }
    return ctx.tenantId;
  }
}
