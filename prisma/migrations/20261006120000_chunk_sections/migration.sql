-- Section paths ("Post › Section") of every paragraph in a chunk; search expands a hit to the
-- widest section that fits the prompt budget. Empty until the content is re-seeded.

-- AlterTable
ALTER TABLE "chunks" ADD COLUMN "sections" TEXT[] DEFAULT ARRAY[]::TEXT[];
