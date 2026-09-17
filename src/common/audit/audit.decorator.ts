import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit:resource-type';

/**
 * Marks a controller method as auditable. The global AuditInterceptor
 * (registered once in app.module.ts, not per-endpoint) reads this
 * metadata and writes the audit_logs row automatically — the handler
 * itself never calls AuditService directly. This keeps B2's requirement
 * ("Interceptor مركزي... بدلاً من تسجيل يدوي في كل endpوint") honest:
 * the only per-endpoint work is a one-line decorator, not a log call
 * buried in business logic that's easy to forget.
 *
 * @param resourceType e.g. "content_item", "user"
 * @param actionSuffix defaults to the HTTP method (view/create/update/delete);
 *        override for actions that don't map 1:1 to a verb, e.g. "download".
 */
export const Audit = (resourceType: string, actionSuffix?: string) =>
  SetMetadata(AUDIT_METADATA_KEY, { resourceType, actionSuffix });
