import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AUDIT_METADATA_KEY } from './audit.decorator';
import { AuditService } from './audit.service';

const METHOD_TO_ACTION: Record<string, string> = {
  GET: 'view',
  POST: 'create',
  PATCH: 'update',
  PUT: 'update',
  DELETE: 'delete',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<{
      resourceType: string;
      actionSuffix?: string;
    }>(AUDIT_METADATA_KEY, context.getHandler());

    if (!meta) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const action = meta.actionSuffix ?? METHOD_TO_ACTION[req.method] ?? req.method.toLowerCase();
    const resourceId = req.params?.id;

    return next.handle().pipe(
      tap(() => {
        void this.auditService.record({
          actionType: `${meta.resourceType}.${action}`,
          resourceType: meta.resourceType,
          resourceId,
          metadata: { path: req.path, method: req.method, outcome: 'success' },
        });
      }),
      catchError((err) => {
        void this.auditService.record({
          actionType: `${meta.resourceType}.${action}`,
          resourceType: meta.resourceType,
          resourceId,
          metadata: {
            path: req.path,
            method: req.method,
            outcome: 'failed',
            error: err?.message,
          },
        });
        throw err;
      }),
    );
  }
}
