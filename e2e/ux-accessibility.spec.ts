import { test, expect, type Page } from '@playwright/test';
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

async function addOwnerSession(page: Page, user: { id: string; email: string }) {
  const value = await encode({
    secret: process.env.NEXTAUTH_SECRET!,
    token: { sub: user.id, id: user.id, email: user.email },
    maxAge: 60 * 60,
  });
  await page.context().addCookies([{ name: 'next-auth.session-token', value, url: 'http://127.0.0.1:3001' }]);
}

test.beforeEach(resetDatabase);
test.afterAll(async () => db.$disconnect());

test('mobile public filler supports keyboard completion with a dark form theme', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const owner = await db.user.create({ data: { email: 'mobile-owner@example.test', password: 'test-only-hash' } });
  const form = await db.form.create({
    data: {
      userId: owner.id,
      slug: 'mobile-dark-filler',
      title: 'Mobile dark filler',
      published: true,
      backgroundColor: '#1A1A2E',
      textColor: '#FFFFFF',
      buttonColor: '#E94560',
      buttonTextColor: '#FFFFFF',
      questions: { create: { type: 'short_text', title: 'Your name', required: true, order: 0 } },
    },
  });

  await page.goto(`/f/${form.slug}`);
  await page.getByRole('button', { name: /start/i }).click();
  await page.locator('input').fill('Keyboard respondent');
  await page.locator('input').press('Enter');
  await expect(page.getByText(/thank you/i)).toBeVisible();
  await expect(page.locator('div.fixed.inset-0').first()).toHaveCSS('background-color', 'rgb(26, 26, 46)');
  await page.screenshot({ path: 'test-results/mobile-dark-filler.png', fullPage: true });
});

test('mobile builder starts focused and opens its settings drawer without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const owner = await db.user.create({ data: { email: 'builder-owner@example.test', password: 'test-only-hash' } });
  const form = await db.form.create({
    data: { userId: owner.id, title: 'Mobile builder', questions: { create: { type: 'short_text', title: 'Question', order: 0 } } },
  });
  await addOwnerSession(page, owner);

  await page.goto(`/?view=builder&form=${form.id}`);
  await expect(page.getByRole('button', { name: 'Open settings panel' })).toBeVisible();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open settings panel' }).click();
  await expect(page.getByText(/conditional logic/i)).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-builder-settings.png', fullPage: true });

  await page.getByRole('button', { name: 'Switch to embedded preview' }).click();
  await expect(page.getByLabel('Embedded form preview')).toBeVisible();
  await page.getByRole('button', { name: 'Switch to editor' }).click();
  await expect(page.getByRole('button', { name: 'Open settings panel' })).toBeVisible();
});
