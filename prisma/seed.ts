import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Deliberately uses the RAW PrismaClient, not PrismaService.scoped — a
// seed script runs outside any request/tenant context by definition, so
// there's nothing for the tenant extension to key off. This mirrors the
// login flow's justified bypass.
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const hbj = await prisma.tenant.upsert({
    where: { slug: 'hbj-archive' },
    update: {},
    create: { name: 'HBJ Archive (internal)', slug: 'hbj-archive' },
  });

  const ministry = await prisma.tenant.upsert({
    where: { slug: 'ministry-demo' },
    update: {},
    create: { name: 'Ministry Demo Tenant', slug: 'ministry-demo' },
  });

  const hbjAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: hbj.id, email: 'khadija@sortera.inc' } },
    update: {},
    create: {
      tenantId: hbj.id,
      email: 'khadija@sortera.inc',
      passwordHash,
      fullName: 'Khadija Seif',
      role: 'OWNER',
    },
  });

  const hbjResearcher = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: hbj.id, email: 'researcher@hbjarchive.com' } },
    update: {},
    create: {
      tenantId: hbj.id,
      email: 'researcher@hbjarchive.com',
      passwordHash,
      fullName: 'باحث تجريبي',
      role: 'RESEARCHER',
    },
  });

  const ministryAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: ministry.id, email: 'admin@ministry-demo.gov' } },
    update: {},
    create: {
      tenantId: ministry.id,
      email: 'admin@ministry-demo.gov',
      passwordHash,
      fullName: 'Ministry Admin',
      role: 'ADMIN',
    },
  });

  await prisma.contentItem.createMany({
    data: [
      {
        tenantId: hbj.id,
        contentType: 'VIDEO',
        title: 'مقطع عام - مؤتمر صحفي',
        confidentialityLevel: 'PUBLIC',
        createdBy: hbjAdmin.id,
      },
      {
        tenantId: hbj.id,
        contentType: 'VIDEO',
        title: 'اجتماع مغلق - حساس',
        confidentialityLevel: 'RESTRICTED',
        createdBy: hbjAdmin.id,
      },
      {
        tenantId: ministry.id,
        contentType: 'DOCUMENT',
        title: 'قرار وزاري رقم 12 لسنة 2026',
        confidentialityLevel: 'INTERNAL',
        metadata: { ministerial_decree_number: '12/2026' },
        createdBy: ministryAdmin.id,
      },
    ],
    skipDuplicates: true,
  });

  // A3: grouped sidebar for the internal (HBJ) tenant. The ministry tenant
  // intentionally gets no "الأشخاص والعلامات" section at all — it's
  // configuration, not a frontend if/else on tenant type.
  await prisma.navSection.createMany({
    data: [
      { tenantId: hbj.id, sectionName: 'المحتوى', items: ['video_list', 'photo_list', 'document_list', 'event_clips', 'event_photos', 'video_productions'], sortOrder: 1 },
      { tenantId: hbj.id, sectionName: 'الذكاء الاصطناعي', items: ['ai_brands', 'ai_clip_characters', 'ai_clip_text'], sortOrder: 2 },
      { tenantId: hbj.id, sectionName: 'الأشخاص والعلامات', items: ['characters', 'brands'], sortOrder: 3 },
      { tenantId: hbj.id, sectionName: 'الإدارة', items: ['researcher_list', 'event_type', 'settings'], sortOrder: 4 },
      { tenantId: ministry.id, sectionName: 'المحتوى', items: ['document_list'], sortOrder: 1 },
      { tenantId: ministry.id, sectionName: 'الإدارة', items: ['researcher_list', 'settings'], sortOrder: 2 },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete:');
  console.log({ hbj: hbj.slug, ministry: ministry.slug, hbjResearcher: hbjResearcher.email });
  console.log('All seeded users share the password: Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
