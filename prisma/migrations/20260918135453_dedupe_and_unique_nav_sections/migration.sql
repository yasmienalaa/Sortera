-- Dedupe first: seed.ts's `skipDuplicates: true` on navSection.createMany
-- had no unique key to check against, so every re-run of `prisma:seed`
-- (e.g. after a Railway redeploy) silently inserted a fresh copy of every
-- section — the "sidebar section repeated N times" bug. This keeps exactly
-- one row per (tenant_id, section_name), discarding the rest, before the
-- unique index below is added (which would otherwise fail to create on a
-- table that still has duplicates).
DELETE FROM "nav_sections" a
USING "nav_sections" b
WHERE a.tenant_id = b.tenant_id
  AND a.section_name = b.section_name
  AND a.id > b.id;

-- CreateIndex
CREATE UNIQUE INDEX "nav_sections_tenant_id_section_name_key" ON "nav_sections"("tenant_id", "section_name");
