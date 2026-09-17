-- Run this ONCE after `prisma migrate dev` has created the base tables
-- (Prisma's schema DSL can't express triggers, so this lives outside the
-- normal migration flow):
--
--   npx prisma db execute --file prisma/sql/fulltext_search.sql --schema prisma/schema.prisma
--
-- NOTE on Arabic: this uses the 'simple' text search config (tokenize +
-- lowercase only), not a language-aware one — Postgres doesn't ship
-- Arabic stemming rules out of the box, so "فيديو" and "الفيديو" are NOT
-- treated as the same root here. That's the honest trade-off of the
-- Postgres-FTS-first proposal; if Arabic-aware ranking becomes a real
-- pain point, that's the concrete signal to migrate to Meilisearch
-- (which ships better Arabic tokenization) behind the same SearchService
-- interface, without touching any calling code.

CREATE OR REPLACE FUNCTION content_items_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.metadata::text, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_items_search_vector_trigger ON content_items;
CREATE TRIGGER content_items_search_vector_trigger
BEFORE INSERT OR UPDATE ON content_items
FOR EACH ROW EXECUTE FUNCTION content_items_search_vector_update();

-- Backfill existing rows (harmless no-op on a fresh DB with no rows yet).
UPDATE content_items SET title = title;
