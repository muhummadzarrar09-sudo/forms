-- Preserve one answer per response/question before enforcing the application invariant.
-- CUIDs are unique; retaining the lexicographically greatest ID is deterministic for
-- legacy duplicate rows where no answer timestamp exists.
DELETE FROM "Answer" AS older
USING "Answer" AS newer
WHERE older."responseId" = newer."responseId"
  AND older."questionId" = newer."questionId"
  AND older.id < newer.id;

CREATE UNIQUE INDEX "Answer_responseId_questionId_key"
  ON "Answer"("responseId", "questionId");

-- Shared, durable fixed-window counters for unauthenticated public endpoints.
CREATE TABLE "PublicRateLimit" (
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicRateLimit_pkey" PRIMARY KEY ("key")
);
