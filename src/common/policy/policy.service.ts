import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PolicyAction, PolicyResource, PolicyRule, PolicySubject } from './policy.types';

/**
 * Base RBAC capability matrix. This is the "الدور يمنح صلاحيات عامة" part
 * of B2 — necessary but NOT sufficient, since the rules below can still
 * veto an action the role would otherwise allow.
 */
const ROLE_CAPABILITIES: Record<Role, PolicyAction[]> = {
  OWNER: ['view', 'create', 'update', 'delete', 'download', 'export'],
  SUPER_ADMIN: ['view', 'create', 'update', 'delete', 'download', 'export'],
  ADMIN: ['view', 'create', 'update', 'delete', 'download', 'export'],
  MEDIA_ADMIN: ['view', 'create', 'update', 'download'],
  RESEARCHER: ['view'],
};

/**
 * Rules run in order. Any rule returning `false` is an IMMEDIATE, final
 * deny — later rules and the role matrix can't override it. This is what
 * lets us honestly implement the spec's example: "لو confidentiality_level
 * = restricted والمستخدم غير مصرح له، يُرفض الطلب حتى لو دوره Admin".
 *
 * A rule returning `undefined` means "not my concern, ask the next rule".
 */
const RULES: PolicyRule[] = [
  // Rule 1 — hard tenant boundary, UNLESS the resource owner has
  // explicitly shared it with the requester's tenant (C4). The Prisma
  // extension already prevents cross-tenant rows from being fetched via
  // the normal `.scoped` path — this branch only ever gets exercised via
  // the dedicated cross-tenant read path that looks up shared_resources
  // itself and passes the result in as `resource.sharedWith`.
  (action, subject, resource) => {
    if (resource.tenantId === subject.tenantId) return undefined;
    const grantedLevel = resource.sharedWith?.[subject.tenantId];
    if (!grantedLevel) return false; // no share on record — hard deny, no exceptions
    if (grantedLevel === 'VIEW' && action !== 'view') return false;
    return undefined; // shared and sufficient — fall through to confidentiality rules below
  },

  // Rule 2 — restricted content: only the OWNING tenant's OWNER/SUPER_ADMIN,
  // full stop. This is the exact scenario named in spec section B2 — and
  // explicitly does NOT extend across tenants even via a share: a
  // SUPER_ADMIN role in tenant B does not entitle them to tenant A's
  // restricted content just because tenant A shared something else.
  (_action, subject, resource) => {
    if (resource.confidentialityLevel !== 'RESTRICTED') return undefined;
    const isSameTenantAdmin =
      resource.tenantId === subject.tenantId && (subject.role === 'OWNER' || subject.role === 'SUPER_ADMIN');
    return isSameTenantAdmin ? undefined : false;
  },

  // Rule 3 — confidential content: RESEARCHER can never see it, even
  // though RESEARCHER otherwise has blanket "view".
  (action, subject, resource) => {
    if (resource.confidentialityLevel !== 'CONFIDENTIAL') return undefined;
    if (subject.role === 'RESEARCHER' && action === 'view') return false;
    return undefined;
  },
];

@Injectable()
export class PolicyService {
  /**
   * Returns true only if the role matrix allows the action AND no rule
   * vetoed it. Throws nothing — callers decide whether a false result
   * becomes a 403 (via PolicyGuard) or a filtered-out list item.
   */
  can(action: PolicyAction, subject: PolicySubject, resource: PolicyResource): boolean {
    for (const rule of RULES) {
      const verdict = rule(action, subject, resource);
      if (verdict === false) return false;
    }
    return ROLE_CAPABILITIES[subject.role]?.includes(action) ?? false;
  }
}
