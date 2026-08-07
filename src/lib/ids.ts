import { randomUUID } from 'node:crypto';

/**
 * Legacy primary keys are text, so new records do not need Prisma/CUID
 * generation. UUID v4 values are opaque, collision-resistant text identifiers
 * and safely coexist with the existing CUID-style rows.
 */
export function createRecordId() {
  return randomUUID();
}
