import { Role } from '@prisma/client';

export type PolicyAction = 'view' | 'create' | 'update' | 'delete' | 'download' | 'export';

export interface PolicySubject {
  userId: string;
  tenantId: string;
  role: Role;
}

/**
 * Minimal shape a resource needs to expose to be evaluated. ContentItem
 * satisfies this directly; other resource types just need a small adapter.
 */
export interface PolicyResource {
  tenantId: string;
  confidentialityLevel?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  // C4: populated only when the caller has already looked up
  // shared_resources for this item — keyed by the tenant that was granted
  // access. PolicyService never queries this table itself (that would
  // make it depend on Prisma, and SharedResource is deliberately excluded
  // from the mandatory-tenant-scoping extension — see prisma.service.ts),
  // so the caller (ContentItemsService's cross-tenant read path) is
  // responsible for fetching and passing this in.
  sharedWith?: Record<string, 'VIEW' | 'EDIT'>;
}

export type PolicyRule = (
  action: PolicyAction,
  subject: PolicySubject,
  resource: PolicyResource,
) => boolean | undefined; // undefined = "no opinion, defer to the next rule"
