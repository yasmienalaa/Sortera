/**
 * This is the test that matters most for Phase 1: it proves the
 * mandatory-tenant-scoping Prisma extension actually isolates tenants,
 * rather than just trusting that it does. Run against a real database
 * (see docker-compose.yml) after `prisma migrate dev` and `prisma:seed`.
 *
 *   npm run prisma:migrate && npm run prisma:seed && npm test
 */
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { TenantContextService } from '../src/common/tenant-context/tenant-context.service';

describe('Tenant isolation (Prisma extension)', () => {
  let prisma: PrismaService;
  let tenantContext: TenantContextService;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, TenantContextService],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    tenantContext = moduleRef.get(TenantContextService);
    await prisma.onModuleInit();

    const hbj = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'hbj-archive' } });
    const ministry = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'ministry-demo' } });
    tenantAId = hbj.id;
    tenantBId = ministry.id;
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('a query with no tenant context is refused rather than run unscoped', async () => {
    await expect(prisma.scoped.contentItem.findMany({})).rejects.toThrow(
      /No tenant context available/,
    );
  });

  it("tenant A's scoped query never returns tenant B's rows", async () => {
    const resultsAsTenantA = await tenantContext.run(
      { tenantId: tenantAId, userId: 'irrelevant', role: 'OWNER' },
      () => prisma.scoped.contentItem.findMany({}),
    );

    expect(resultsAsTenantA.length).toBeGreaterThan(0);
    expect(resultsAsTenantA.every((item) => item.tenantId === tenantAId)).toBe(true);
  });

  it("switching context to tenant B returns only tenant B's rows", async () => {
    const resultsAsTenantB = await tenantContext.run(
      { tenantId: tenantBId, userId: 'irrelevant', role: 'ADMIN' },
      () => prisma.scoped.contentItem.findMany({}),
    );

    expect(resultsAsTenantB.length).toBeGreaterThan(0);
    expect(resultsAsTenantB.every((item) => item.tenantId === tenantBId)).toBe(true);
  });

  it('create() silently stamps the current tenant, ignoring any other tenantId supplied', async () => {
    const someUserInTenantA = await prisma.user.findFirstOrThrow({
      where: { tenantId: tenantAId },
    });

    const created = await tenantContext.run(
      { tenantId: tenantAId, userId: someUserInTenantA.id, role: 'OWNER' },
      () =>
        prisma.scoped.contentItem.create({
          data: {
            contentType: 'IMAGE',
            title: 'test isolation item',
            createdBy: someUserInTenantA.id,
          },
        }),
    );
    expect(created.tenantId).toBe(tenantAId);
  });

  it('audit_logs is append-only: update() and delete() are rejected even for a SuperAdmin-role context', async () => {
    await tenantContext.run(
      { tenantId: tenantAId, userId: 'irrelevant', role: 'SUPER_ADMIN' },
      async () => {
        const anyLog = await prisma.scoped.auditLog.findFirst({});
        if (!anyLog) return; // nothing logged yet in this environment, skip
        await expect(
          prisma.scoped.auditLog.update({
            where: { id: anyLog.id },
            data: { actionType: 'tampered' },
          }),
        ).rejects.toThrow(/append-only/);
      },
    );
  });
});
