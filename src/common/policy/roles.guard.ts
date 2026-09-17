import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * This only answers "is this role ever allowed to hit this route at all".
 * It does NOT know about confidentiality_level or any other attribute of
 * the specific resource being touched — that check happens inside the
 * service, via PolicyService.can(), once the resource has actually been
 * loaded (see ContentItemsService). Splitting it this way avoids the
 * guard having to speculatively fetch the resource before the handler
 * even runs.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<Role[] | undefined>(ROLES_KEY, context.getHandler());
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    return !!user && required.includes(user.role);
  }
}
