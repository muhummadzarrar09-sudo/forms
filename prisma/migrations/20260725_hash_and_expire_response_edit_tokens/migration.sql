-- Existing plaintext draft tokens cannot be safely transformed without knowing
-- their original value. Expire them on migration and issue hashed 24-hour tokens
-- only for newly created drafts.
DROP INDEX IF EXISTS "Response_editToken_key";
ALTER TABLE "Response" DROP COLUMN IF EXISTS "editToken";
ALTER TABLE "Response" ADD COLUMN "editTokenHash" TEXT;
ALTER TABLE "Response" ADD COLUMN "editTokenExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Response_editTokenHash_key" ON "Response"("editTokenHash");
