import { db } from '@/lib/db';

/** Queue a completed response for later delivery; never delay the respondent. */
export async function queueGoogleSheetSync(formId: string, responseId: string): Promise<void> {
  const destination = await db.googleSheetDestination.findUnique({ where: { formId }, select: { id: true, active: true } });
  if (!destination?.active) return;
  await db.googleSheetSyncEvent.upsert({
    where: { destinationId_responseId: { destinationId: destination.id, responseId } },
    create: { destinationId: destination.id, responseId },
    update: {},
  });
}
