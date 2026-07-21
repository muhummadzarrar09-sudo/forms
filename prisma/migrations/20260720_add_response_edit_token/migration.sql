-- Adds a bearer credential for resuming anonymous partial responses.
-- Apply only after the production database has been backed up and its existing
-- schema has been baselined. Existing responses remain NULL and cannot be
-- resumed through the public partial-response endpoint.
ALTER TABLE "Response" ADD COLUMN "editToken" TEXT;
CREATE UNIQUE INDEX "Response_editToken_key" ON "Response"("editToken");
