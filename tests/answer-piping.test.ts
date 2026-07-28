import { describe, expect, test } from 'bun:test';
import { pipeAnswerText } from '../src/lib/answer-piping';

describe('answer piping', () => {
  test('inserts previous answers into plain text templates', () => {
    expect(pipeAnswerText('Welcome back, {{answer:name}}!', { name: 'Ayesha' })).toBe('Welcome back, Ayesha!');
  });

  test('does not interpret unmatched or unsafe tokens', () => {
    expect(pipeAnswerText('Hi {{answer:missing}} {{answer:<script>}}', {})).toBe('Hi  {{answer:<script>}}');
  });
});
