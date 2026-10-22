-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "markdown" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "filePath" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "documents_app_slug_key" ON "documents"("app", "slug");
