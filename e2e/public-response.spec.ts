import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function resetDatabase() {
  // The Docker test DB is disposable. Keep test state deterministic without
  // ever connecting this suite to a client database.
  await db.answer.deleteMany();
  await db.response.deleteMany();
  await db.question.deleteMany();
  await db.formEnding.deleteMany();
  await db.form.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();
}

async function createPublishedForm(options: { slug: string; maxResponses?: number; title?: string } ) {
  const owner = await db.user.create({
    data: { email: `${options.slug}@example.test`, password: 'test-only-hash', name: 'E2E owner' },
  });
  return db.form.create({
    data: {
      userId: owner.id,
      title: options.title ?? 'E2E public form',
      slug: options.slug,
      published: true,
      maxResponses: options.maxResponses ?? 0,
      questions: {
        create: { type: 'short_text', title: 'Your name', required: true, order: 0 },
      },
    },
    include: { questions: true },
  });
}

test.beforeEach(resetDatabase);
test.afterAll(async () => db.$disconnect());

test('public slug filler submits a valid response end to end', async ({ page }) => {
  const form = await createPublishedForm({ slug: 'public-e2e' });
  await page.goto(`/f/${form.slug}`);
  await page.getByRole('button', { name: /start/i }).click();
  await page.locator('input').fill('Ada Lovelace');
  await page.locator('input').press('Enter');
  await expect(page.getByText(/thank you/i)).toBeVisible();

  const response = await db.response.findFirst({ include: { answers: true } });
  expect(response?.completedAt).not.toBeNull();
  expect(response?.answers).toHaveLength(1);
  expect(response?.answers[0]?.value).toBe('Ada Lovelace');
});

test('public API rejects a question ID belonging to another form', async ({ request }) => {
  const first = await createPublishedForm({ slug: 'first-form' });
  const second = await createPublishedForm({ slug: 'second-form' });

  const response = await request.post(`/api/forms/${first.id}/responses`, {
    data: { answers: [{ questionId: second.questions[0].id, value: 'cross-form injection' }] },
  });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/do not belong/i) });
  expect(await db.response.count({ where: { formId: first.id } })).toBe(0);
});

test('response limit accepts exactly one of twenty concurrent submissions', async ({ request }) => {
  const form = await createPublishedForm({ slug: 'capped-form', maxResponses: 1 });
  const body = { answers: [{ questionId: form.questions[0].id, value: 'parallel response' }] };
  const responses = await Promise.all(Array.from({ length: 20 }, () => request.post(`/api/forms/${form.id}/responses`, { data: body })));
  const statuses = responses.map((response) => response.status());

  expect(statuses.filter((status) => status === 201)).toHaveLength(1);
  expect(statuses.filter((status) => status === 403)).toHaveLength(19);
  expect(await db.response.count({ where: { formId: form.id, isPartial: false } })).toBe(1);
});

test('unpublished forms reject anonymous partial-response creation', async ({ request }) => {
  const owner = await db.user.create({ data: { email: 'draft-owner@example.test', password: 'test-only-hash' } });
  const form = await db.form.create({ data: { userId: owner.id, title: 'Draft', slug: 'draft-form', published: false } });

  const response = await request.post(`/api/forms/${form.id}/responses`, {
    data: { isPartial: true, answers: [] },
  });
  expect(response.status()).toBe(400);
  expect(await db.response.count({ where: { formId: form.id } })).toBe(0);
});
