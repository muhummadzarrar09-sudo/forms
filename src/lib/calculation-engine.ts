export type CalculationResult = { value: number } | { error: string };

/** Safe arithmetic evaluator: numbers, parentheses, + - * /. Never executes JS. */
export function evaluateCalculation(expression: string, values: Record<string, string | number>): CalculationResult {
  const substituted = expression.replace(/{{(?:answer|variable):([A-Za-z0-9_-]{1,100})}}/g, (_token, key: string) => {
    const numeric = Number(values[key]);
    return Number.isFinite(numeric) ? String(numeric) : 'NaN';
  });
  if (!/^[\d.\s()+\-*/NaIn]+$/.test(substituted) || substituted.includes('NaN')) return { error: 'Formula contains a missing or invalid numeric value' };
  let index = 0;
  const skip = () => { while (/\s/.test(substituted[index] || '')) index += 1; };
  const factor = (): number => {
    skip();
    if (substituted[index] === '(') { index += 1; const value = sum(); skip(); if (substituted[index++] !== ')') throw new Error('Missing closing parenthesis'); return value; }
    const match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/.exec(substituted.slice(index));
    if (!match) throw new Error('Expected a number'); index += match[0].length; return Number(match[0]);
  };
  const product = (): number => { let value = factor(); while (true) { skip(); const op = substituted[index]; if (op !== '*' && op !== '/') return value; index += 1; const right = factor(); if (op === '/' && right === 0) throw new Error('Division by zero'); value = op === '*' ? value * right : value / right; } };
  const sum = (): number => { let value = product(); while (true) { skip(); const op = substituted[index]; if (op !== '+' && op !== '-') return value; index += 1; const right = product(); value = op === '+' ? value + right : value - right; } };
  try { const value = sum(); skip(); if (index !== substituted.length || !Number.isFinite(value)) return { error: 'Invalid formula' }; return { value }; } catch (error) { return { error: error instanceof Error ? error.message : 'Invalid formula' }; }
}

export function resolveCalculatedVariables(definitions: Array<{ name: string; formula: string }>, answers: Record<string, string>): Record<string, number> {
  const variables: Record<string, number> = {};
  for (const definition of definitions) {
    const result = evaluateCalculation(definition.formula, { ...answers, ...variables });
    if ('value' in result) variables[definition.name] = result.value;
  }
  return variables;
}

export function interpolateCalculatedText(template: string, answers: Record<string, string>, variables: Record<string, number>, score = 0): string {
  return template
    .replace(/{{score}}/g, String(score))
    .replace(/{{variable:([A-Za-z0-9_-]{1,100})}}/g, (_token, key: string) => String(variables[key] ?? ''))
    .replace(/{{answer:([A-Za-z0-9_-]{1,100})}}/g, (_token, key: string) => answers[key]?.trim() || '');
}
