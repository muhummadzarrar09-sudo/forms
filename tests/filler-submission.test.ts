import { afterEach, describe, expect, test } from 'bun:test';
import { submitFillerResponse } from '../src/lib/filler-submission';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('shared filler submission', () => {
  test('creates a completed response with hidden fields in metadata', async () => {
    let request: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      request = new Request(typeof input === 'string' && input.startsWith('/') ? `http://test.local${input}` : input, init);
      return new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    await expect(submitFillerResponse('form id', { q1: 'answer' }, { campaign: 'summer' })).resolves.toEqual({ ok: true });
    expect(request?.method).toBe('POST');
    expect(request?.url).toContain('/api/forms/form%20id/responses');
    await expect(request?.json()).resolves.toEqual({
      answers: [{ questionId: 'q1', value: 'answer' }],
      metadata: { submittedAt: expect.any(String), hiddenFields: { campaign: 'summer' } },
    });
  });

  test('completes a secured partial instead of creating a duplicate response', async () => {
    let request: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      request = new Request(typeof input === 'string' && input.startsWith('/') ? `http://test.local${input}` : input, init);
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    await expect(submitFillerResponse('form1', { q1: 'answer' }, {}, { responseId: 'draft1', editToken: 'token' })).resolves.toEqual({ ok: true });
    expect(request?.method).toBe('PUT');
    await expect(request?.json()).resolves.toMatchObject({
      responseId: 'draft1', editToken: 'token', isPartial: false,
      answers: [{ questionId: 'q1', value: 'answer' }],
    });
  });

  test('normalizes a rejected API response into a filler-safe error', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'Response cap reached' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;

    await expect(submitFillerResponse('form1', { q1: 'answer' })).resolves.toEqual({ ok: false, error: 'Response cap reached' });
  });
});
