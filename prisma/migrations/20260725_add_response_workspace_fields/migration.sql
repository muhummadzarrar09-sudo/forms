ALTER TABLE "Response" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "Response" ADD COLUMN "internalNote" TEXT NOT NULL DEFAULT '';
CREATE INDEX "Response_formId_status_idx" ON "Response"("formId", "status");
