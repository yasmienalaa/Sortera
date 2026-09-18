-- The hbj-archive tenant's "المحتوى" (Content) sidebar section was
-- seeded without "document_list", so the C2 documents feature had no
-- entry point in that tenant's nav — only the ministry-demo tenant had
-- it. This is a data fix, not a schema change: it updates the existing
-- row's items array directly, since seed.ts's createMany + skipDuplicates
-- only inserts missing rows and never updates ones that already exist.
UPDATE "nav_sections"
SET items = '["video_list","photo_list","document_list","event_clips","event_photos","video_productions"]'::jsonb
WHERE section_name = 'المحتوى'
  AND tenant_id = (SELECT id FROM "tenants" WHERE slug = 'hbj-archive');
