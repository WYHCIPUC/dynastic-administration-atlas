-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "regimeGroup" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" JSONB NOT NULL,
    "institutionLevel" TEXT NOT NULL,
    "functionDomains" JSONB NOT NULL,
    "legalDuties" JSONB NOT NULL,
    "authorityBoundaries" JSONB NOT NULL,
    "actualOperation" JSONB NOT NULL,
    "appointmentAndCareer" JSONB NOT NULL,
    "rankOrGrade" TEXT,
    "rankComparability" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "periodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifestyleProfile" (
    "id" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "typicalTasks" JSONB NOT NULL,
    "scheduleOrWorkCycle" JSONB NOT NULL,
    "officeAndResidence" JSONB NOT NULL,
    "attire" JSONB NOT NULL,
    "transport" TEXT,
    "foodAndConsumption" TEXT,
    "salaryAndAllowances" TEXT,
    "healthAndMedicine" TEXT,
    "ritualsAndHolidays" TEXT,
    "familyAndSocial" TEXT,
    "leisure" TEXT,
    "risks" JSONB NOT NULL,
    "uncertaintyNotes" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifestyleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorOrInstitution" TEXT,
    "year" TEXT,
    "sourceType" TEXT NOT NULL,
    "authorityGrade" "EvidenceLevel" NOT NULL,
    "locator" TEXT,
    "url" TEXT,
    "coverage" TEXT,
    "notes" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceClaim" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "citationLocator" TEXT,
    "evidenceLevel" "EvidenceLevel" NOT NULL,
    "uncertaintyType" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "periodId" TEXT,
    "officeId" TEXT,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MappingRule" (
    "id" TEXT NOT NULL,
    "keywordPatterns" JSONB NOT NULL,
    "functionDomains" JSONB NOT NULL,
    "institutionLevels" JSONB NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "officeId" TEXT NOT NULL,

    CONSTRAINT "MappingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchQuery" (
    "id" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Period_slug_key" ON "Period"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Office_slug_key" ON "Office"("slug");

-- CreateIndex
CREATE INDEX "Office_periodId_status_idx" ON "Office"("periodId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LifestyleProfile_officeId_key" ON "LifestyleProfile"("officeId");

-- CreateIndex
CREATE INDEX "Source_authorityGrade_status_idx" ON "Source"("authorityGrade", "status");

-- CreateIndex
CREATE INDEX "EvidenceClaim_entityType_status_idx" ON "EvidenceClaim"("entityType", "status");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_createdAt_idx" ON "AdminAuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchQuery_createdAt_idx" ON "MatchQuery"("createdAt");

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifestyleProfile" ADD CONSTRAINT "LifestyleProfile_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MappingRule" ADD CONSTRAINT "MappingRule_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

