import { db } from '@/lib/db';
import { googleAccessToken } from '@/lib/google-sheets';

function cell(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

export async function deliverPendingGoogleSheetEvents(limit = 25) {
  const events = await db.googleSheetSyncEvent.findMany({
    where: { status: 'pending', attempts: { lt: 5 }, destination: { active: true } },
    orderBy: { createdAt: 'asc' }, take: limit,
    include: {
      destination: {
        include: {
          form: { include: { questions: { orderBy: { order: 'asc' } } } },
        },
      },
      response: { include: { answers: true } },
    },
  });
  let delivered = 0;
  for (const event of events) {
    try {
      await db.googleSheetSyncEvent.update({ where: { id: event.id }, data: { status: 'processing', attempts: { increment: 1 }, lastError: '' } });
      const token = await googleAccessToken(event.destination.connectionId);
      const answers = new Map<string, string>(event.response.answers.map((answer) => [answer.questionId, answer.value]));
      const row = [event.response.id, event.response.completedAt?.toISOString() || '', ...event.destination.form.questions.map((question) => cell(answers.get(question.id) || ''))];
      const range = `${event.destination.sheetName}!A1`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(event.destination.spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [row] }), cache: 'no-store' });
      if (!response.ok) throw new Error(`Google Sheets append failed (${response.status})`);
      // Use sequential updates inside interactive tx for Supabase PgBouncer compatibility
      await db.$transaction(async (tx) => {
        await tx.googleSheetSyncEvent.update({ where: { id: event.id }, data: { status: 'delivered', lastError: '' } });
        await tx.googleSheetDestination.update({ where: { id: event.destinationId }, data: { lastSyncedAt: new Date(), lastError: '' } });
      });
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Google Sheets sync failed';
      await db.$transaction(async (tx) => {
        await tx.googleSheetSyncEvent.update({ where: { id: event.id }, data: { status: event.attempts + 1 >= 5 ? 'failed' : 'pending', lastError: message } });
        await tx.googleSheetDestination.update({ where: { id: event.destinationId }, data: { lastError: message } });
      });
    }
  }
  return { processed: events.length, delivered };
}
