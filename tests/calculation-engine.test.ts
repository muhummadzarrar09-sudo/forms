import { describe, expect, test } from 'bun:test';
import { evaluateCalculation, interpolateCalculatedText } from '../src/lib/calculation-engine';

describe('calculation engine', () => {
  test('evaluates arithmetic and answer references without JavaScript execution', () => {
    expect(evaluateCalculation('({{answer:quantity}} * 49) + 500', { quantity: '2' })).toEqual({ value: 598 });
  });
  test('rejects invalid values and dangerous syntax', () => {
    expect(evaluateCalculation('process.exit()', {})).toEqual({ error: 'Formula contains a missing or invalid numeric value' });
    expect(evaluateCalculation('1 / 0', {})).toEqual({ error: 'Division by zero' });
  });
  test('interpolates score, variables, and answers', () => {
    expect(interpolateCalculatedText('Hi {{answer:name}} — ${{variable:quote}} / {{score}}', { name: 'Ayesha' }, { quote: 250 }, 8)).toBe('Hi Ayesha — $250 / 8');
  });
});
