-- AlterTable
ALTER TABLE "Period" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Office"
ADD COLUMN "modernInput" TEXT,
ADD COLUMN "candidateIndex" INTEGER,
ADD COLUMN "similarity" DOUBLE PRECISION,
ADD COLUMN "confidence" TEXT,
ADD COLUMN "evidenceLevel" TEXT,
ADD COLUMN "sourceIds" JSONB;

-- CreateTable
CREATE TABLE "MatrixEntry" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "legalStructure" TEXT NOT NULL,
    "actualOperation" TEXT NOT NULL,
    "reformsRisks" TEXT NOT NULL,
    "evidenceGrade" TEXT NOT NULL,
    "sourceIds" JSONB NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrixEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatrixEntry_periodId_dimension_key" ON "MatrixEntry"("periodId", "dimension");

-- CreateIndex
CREATE INDEX "MatrixEntry_periodId_status_idx" ON "MatrixEntry"("periodId", "status");

-- AddForeignKey
ALTER TABLE "MatrixEntry" ADD CONSTRAINT "MatrixEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
