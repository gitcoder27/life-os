ALTER TYPE "TaskOriginType" ADD VALUE 'TEMPLATE';

CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templatePayloadJson" JSONB NOT NULL,
    "lastAppliedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskTemplate_userId_archivedAt_updatedAt_idx"
ON "TaskTemplate"("userId", "archivedAt", "updatedAt");

ALTER TABLE "TaskTemplate"
ADD CONSTRAINT "TaskTemplate_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
