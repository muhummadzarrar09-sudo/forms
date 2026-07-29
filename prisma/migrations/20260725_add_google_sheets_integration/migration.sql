CREATE TABLE "GoogleConnection" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "encryptedRefreshToken" TEXT NOT NULL,
  "encryptedAccessToken" TEXT, "accessTokenExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GoogleConnection_userId_key" ON "GoogleConnection"("userId");
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "GoogleSheetDestination" (
  "id" TEXT NOT NULL, "formId" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "spreadsheetId" TEXT NOT NULL, "sheetName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "lastSyncedAt" TIMESTAMP(3), "lastError" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleSheetDestination_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GoogleSheetDestination_formId_key" ON "GoogleSheetDestination"("formId");
CREATE INDEX "GoogleSheetDestination_connectionId_idx" ON "GoogleSheetDestination"("connectionId");
ALTER TABLE "GoogleSheetDestination" ADD CONSTRAINT "GoogleSheetDestination_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleSheetDestination" ADD CONSTRAINT "GoogleSheetDestination_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "GoogleSheetSyncEvent" (
  "id" TEXT NOT NULL, "destinationId" TEXT NOT NULL, "responseId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending', "attempts" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleSheetSyncEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GoogleSheetSyncEvent_destinationId_responseId_key" ON "GoogleSheetSyncEvent"("destinationId", "responseId");
CREATE INDEX "GoogleSheetSyncEvent_status_updatedAt_idx" ON "GoogleSheetSyncEvent"("status", "updatedAt");
ALTER TABLE "GoogleSheetSyncEvent" ADD CONSTRAINT "GoogleSheetSyncEvent_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "GoogleSheetDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleSheetSyncEvent" ADD CONSTRAINT "GoogleSheetSyncEvent_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
