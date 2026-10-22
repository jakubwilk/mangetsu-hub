-- Requires `pnpm rag:backfill` (etap 3a) on this database first: SET NOT NULL fails on any document
-- still without slug/markdown/hash, before filePath is dropped.

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "contentHash" SET NOT NULL,
ALTER COLUMN "markdown" SET NOT NULL,
ALTER COLUMN "slug" SET NOT NULL,
DROP COLUMN "filePath";
