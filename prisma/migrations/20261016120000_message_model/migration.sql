-- Model that generated an assistant answer (primary or fallback provider); NULL for user messages.

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "model" TEXT;
