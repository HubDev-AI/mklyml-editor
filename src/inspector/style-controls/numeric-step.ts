const NUMERIC_VALUE_RE = /^\s*(-?\d*\.?\d+)\s*([a-z%]*)\s*$/i;

function getStep(unit: string): number {
  switch (unit.toLowerCase()) {
    case 'px':
      return 1;
    case 'rem':
    case 'em':
      return 0.0625;
    case '%':
      return 1;
    default:
      return 0.1;
  }
}

function getStepMultiplier({ shiftKey, altKey }: { shiftKey: boolean; altKey: boolean }): number {
  if (shiftKey) return 10;
  if (altKey) return 0.1;
  return 1;
}

function countDecimals(value: number): number {
  const text = value.toString();
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function formatNumeric(value: number, minDecimals: number): string {
  if (!Number.isFinite(value)) return '';
  const normalized = Object.is(value, -0) ? 0 : value;
  const decimals = Math.max(minDecimals, countDecimals(Math.abs(normalized)));
  return normalized
    .toFixed(decimals)
    .replace(/(\.\d*?[1-9])0+$/u, '$1')
    .replace(/\.0+$/u, '');
}

export function stepNumericValue(
  value: string,
  direction: 1 | -1,
  modifiers: { shiftKey: boolean; altKey: boolean },
): string | null {
  const match = value.match(NUMERIC_VALUE_RE);
  if (!match) return null;

  const current = parseFloat(match[1]);
  const unit = match[2] ?? '';
  if (!Number.isFinite(current)) return null;

  const baseStep = getStep(unit);
  const step = baseStep * getStepMultiplier(modifiers);
  const next = current + direction * step;
  const minDecimals = Math.max(countDecimals(baseStep), countDecimals(step));
  return `${formatNumeric(next, minDecimals)}${unit}`;
}

function detectUnit(sample: string | undefined): string {
  if (!sample) return '';
  const match = sample.match(/-?\d*\.?\d+\s*([a-z%]+)/i);
  return match?.[1] ?? '';
}

export function stepNumericValueOrInit(
  value: string,
  direction: 1 | -1,
  modifiers: { shiftKey: boolean; altKey: boolean },
  options?: { fallbackSample?: string; defaultUnit?: string },
): string | null {
  const stepped = stepNumericValue(value, direction, modifiers);
  if (stepped) return stepped;
  if (value.trim() !== '') return null;

  const unit = options?.defaultUnit ?? detectUnit(options?.fallbackSample);
  const seed = `0${unit}`;
  return stepNumericValue(seed, direction, modifiers);
}
