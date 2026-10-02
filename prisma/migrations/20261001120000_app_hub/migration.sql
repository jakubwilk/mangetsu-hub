-- Hub of mini-apps: per-app roles, global ROOT flag, app scoping for content, conversations
-- and rate limits. Existing data belongs to the only app so far: 'tutorials'.

-- CreateTable
CREATE TABLE "app_roles" (
    "userId" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "app_roles_pkey" PRIMARY KEY ("userId","app")
);

-- AddForeignKey
ALTER TABLE "app_roles" ADD CONSTRAINT "app_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate global USER/EDITOR roles to the tutorials app (GUEST gets no entry = pending)
INSERT INTO "app_roles" ("userId", "app", "role")
SELECT "id", 'tutorials', "role"::text FROM "users" WHERE "role" IN ('USER', 'EDITOR');

-- AlterTable: ROOT becomes a global flag
ALTER TABLE "users" ADD COLUMN "isRoot" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "isRoot" = true WHERE "role" = 'ROOT';
ALTER TABLE "users" DROP COLUMN "role";

-- DropEnum
DROP TYPE "Role";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "app" TEXT NOT NULL DEFAULT 'tutorials';
ALTER TABLE "documents" ALTER COLUMN "app" DROP DEFAULT;

-- Content moved from content/<category>/ to content/tutorials/<category>/ — keep filePath (the
-- seed's upsert key) in sync so re-seeding updates these rows instead of duplicating them.
UPDATE "documents" SET "filePath" = regexp_replace("filePath", '^content/', 'content/tutorials/')
WHERE "filePath" NOT LIKE 'content/tutorials/%';

-- Conversations were keyed by client sessionId only — no owner can be recovered, so they go.
-- Cascades to "messages".
DELETE FROM "conversations";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "app" TEXT NOT NULL,
ADD COLUMN "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "rate_limits_userId_requestDate_key";

-- AlterTable
ALTER TABLE "rate_limits" ADD COLUMN "app" TEXT NOT NULL DEFAULT 'tutorials';
ALTER TABLE "rate_limits" ALTER COLUMN "app" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_userId_app_requestDate_key" ON "rate_limits"("userId", "app", "requestDate");

-- CreateIndex
CREATE INDEX "chunks_documentId_idx" ON "chunks"("documentId");

-- CreateIndex (restores the trigram index dropped by 20260917072904_new_initial_run; now tracked in schema.prisma)
CREATE INDEX "chunks_content_trgm_idx" ON "chunks" USING GIN ("content" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "conversations_userId_app_sessionId_idx" ON "conversations"("userId", "app", "sessionId");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");
