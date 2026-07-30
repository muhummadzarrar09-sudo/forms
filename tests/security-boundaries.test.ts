import { describe, expect, test } from 'bun:test';
import { hashResponseEditToken, verifyResponseEditToken } from '../src/lib/crypto';
import { createEndingSchema, saveQuestionsSchema, submitResponseSchema } from '../src/lib/validations';

describe('security boundary validation', () => {
  test('stores and verifies opaque bearer-token hashes without accepting a different token', () => {
    const token = 'A'.repeat(43);
    const hash = hashResponseEditToken(token);
    expect(hash).not.toBe(token);
    expect(verifyResponseEditToken(token, hash)).toBe(true);
    expect(verifyResponseEditToken(`${'A'.repeat(42)}B`, hash)).toBe(false);
  });

  test('allows only bounded HTTPS ending redirects', () => {
    expect(createEndingSchema.safeParse({ redirectUrl: 'https://example.com/next' }).success).toBe(true);
    expect(createEndingSchema.safeParse({ redirectUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(createEndingSchema.safeParse({ redirectUrl: 'data:text/html,hello' }).success).toBe(false);
    expect(createEndingSchema.safeParse({ redirectUrl: 'http://example.com' }).success).toBe(false);
    expect(saveQuestionsSchema.safeParse({
      questions: [{ id: 'q1', type: 'picture_choice', title: 'Pick', imageUrls: ['data:image/svg+xml,<svg/>'] }],
    }).success).toBe(false);
  });

  test('rejects unsupported question types and oversized settings', () => {
    expect(saveQuestionsSchema.safeParse({ questions: [{ id: 'q1', type: 'shell', title: 'Nope' }] }).success).toBe(false);
    expect(saveQuestionsSchema.safeParse({
      questions: [{ id: 'q1', type: 'short_text', title: 'Safe', settings: { data: 'x'.repeat(20_001) } }],
    }).success).toBe(false);
  });

  test('requires valid ISO completion timestamps and bounds metadata', () => {
    expect(submitResponseSchema.safeParse({
      answers: [{ questionId: 'q1', value: 'answer' }], completedAt: 'not-a-date',
    }).success).toBe(false);
    expect(submitResponseSchema.safeParse({
      answers: [{ questionId: 'q1', value: 'answer' }], metadata: { blob: 'x'.repeat(20_001) },
    }).success).toBe(false);
  });
});
