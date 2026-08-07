import { test, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function resetDatabase() {
  await db.answer.deleteMany();
  await db.response.deleteMany();
  await db.question.deleteMany();
  await db.formEnding.deleteMany();
  await db.form.deleteMany();
  await db.workspace.deleteMany();
  await db.user.deleteMany();
}

async function sessionCookie(user: { id: string; email: string }) {
  const value = await encode({
    secret: process.env.NEXTAUTH_SECRET!,
    token: { sub: user.id, id: user.id, email: user.email, sessionVersion: 0 },
    maxAge: 60 * 60,
  });
  return { name: 'next-auth.session-token', value, url: 'http://127.0.0.1:3001' };
}

test.beforeEach(resetDatabase);
test.afterAll(async () => db.$disconnect());

test('all 14 supported input types store a valid public response', async ({ request }) => {
  const owner = await db.user.create({ data: { email: 'types-owner@example.test', password: 'test-only-hash' } });
  const form = await db.form.create({
    data: {
      userId: owner.id,
      slug: 'all-input-types',
      title: 'All input types',
      published: true,
      questions: {
        create: [
          { type: 'short_text', title: 'Short', order: 0 },
          { type: 'long_text', title: 'Long', order: 1 },
          { type: 'multiple_choice', title: 'Choice', order: 2, options: JSON.stringify([{ id: 'choice-a', label: 'A' }]) },
          { type: 'picture_choice', title: 'Picture', order: 3, options: JSON.stringify([{ id: 'picture-a', label: 'A' }]) },
          { type: 'dropdown', title: 'Dropdown', order: 4, options: JSON.stringify([{ id: 'drop-a', label: 'A' }]) },
          { type: 'yes_no', title: 'Yes No', order: 5 },
          { type: 'email', title: 'Email', order: 6 },
          { type: 'phone', title: 'Phone', order: 7 },
          { type: 'number', title: 'Number', order: 8, settings: JSON.stringify({ min: 1, max: 10 }) },
          { type: 'website', title: 'Website', order: 9 },
          { type: 'date', title: 'Date', order: 10 },
          { type: 'rating', title: 'Rating', order: 11, settings: JSON.stringify({ min: 1, max: 5 }) },
          { type: 'opinion_scale', title: 'Scale', order: 12, settings: JSON.stringify({ min: 0, max: 10 }) },
          { type: 'legal', title: 'Legal', order: 13, required: true },
        ],
      },
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  });

  const values = ['Ada', 'Long answer', 'choice-a', 'picture-a', 'drop-a', 'yes', 'ada@example.test', '+1 555 0100', '5', 'https://example.test', '2026-07-21', '4', '8', 'true'];
  const response = await request.post(`/api/forms/${form.id}/responses`, {
    data: { answers: form.questions.map((question, index) => ({ questionId: question.id, value: values[index] })) },
  });

  expect(response.status()).toBe(201);
  const stored = await db.response.findFirst({ where: { formId: form.id }, include: { answers: true } });
  expect(stored?.answers).toHaveLength(14);
});

test('invalid email, website, number and legal values are rejected server-side', async ({ request }) => {
  const owner = await db.user.create({ data: { email: 'validation-owner@example.test', password: 'test-only-hash' } });
  const form = await db.form.create({
    data: { userId: owner.id, slug: 'validation-form', published: true, questions: { create: { type: 'email', title: 'Email', order: 0 } } },
    include: { questions: true },
  });
  const response = await request.post(`/api/forms/${form.id}/responses`, {
    data: { answers: [{ questionId: form.questions[0].id, value: 'not-an-email' }] },
  });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/email/i) });
});

test('an authenticated user cannot update another user’s form, ending, or workspace', async ({ page }) => {
  const attacker = await db.user.create({ data: { email: 'attacker@example.test', password: 'test-only-hash' } });
  const victim = await db.user.create({ data: { email: 'victim@example.test', password: 'test-only-hash' } });
  const workspace = await db.workspace.create({ data: { userId: victim.id, name: 'Victim workspace' } });
  const form = await db.form.create({ data: { userId: victim.id, title: 'Victim form' } });
  const ending = await db.formEnding.create({ data: { formId: form.id, title: 'Victim ending', order: 0 } });

  await page.context().addCookies([await sessionCookie(attacker)]);

  expect((await page.request.put(`/api/forms/${form.id}`, { data: { title: 'Hacked' } })).status()).toBe(403);
  expect((await page.request.put(`/api/forms/${form.id}/endings/${ending.id}`, { data: { title: 'Hacked' } })).status()).toBe(403);
  expect((await page.request.put(`/api/workspaces/${workspace.id}`, { data: { name: 'Hacked' } })).status()).toBe(403);

  expect((await db.form.findUniqueOrThrow({ where: { id: form.id } })).title).toBe('Victim form');
  expect((await db.formEnding.findUniqueOrThrow({ where: { id: ending.id } })).title).toBe('Victim ending');
  expect((await db.workspace.findUniqueOrThrow({ where: { id: workspace.id } })).name).toBe('Victim workspace');
});
