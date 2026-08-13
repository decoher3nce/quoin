import type { Unit, ParamType } from './types';

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const num2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Format a computed metric value for display, given its Unit. */
export function formatMetric(value: number, unit: Unit): string {
  if (!Number.isFinite(value)) return '—';
  switch (unit) {
    case '$':
    case '$/yr':
    case '$/mo':
    case '$/night':
      return usd0.format(value);
    case '%':
      return `${num2.format(value * 100)}%`;
    case 'x':
      return `${num2.format(value)}×`;
    case 'yr':
      return `${num2.format(value)} yr`;
    case 'count':
      return num2.format(value);
    default:
      return num2.format(value);
  }
}

/** Format a raw input parameter value for an editable field's display sibling. */
export function formatParam(value: number, type: ParamType, unit?: Unit): string {
  if (!Number.isFinite(value)) return '';
  switch (type) {
    case 'currency':
      return usd2.format(value);
    case 'percent':
      return `${num2.format(value * 100)}%`;
    case 'integer':
      return String(Math.round(value));
    case 'number':
      return unit === '$/night' ? usd0.format(value) : num2.format(value);
    default:
      return String(value);
  }
}

/**
 * The editable numeric value shown in an <input>. Percents are stored as
 * fractions internally but edited as whole percents (7 not 0.07).
 */
export function toEditable(value: number, type: ParamType): number {
  if (type === 'percent') return round(value * 100, 4);
  return value;
}

/** Inverse of toEditable: convert an edited field value back to internal storage. */
export function fromEditable(edited: number, type: ParamType): number {
  if (type === 'percent') return edited / 100;
  if (type === 'integer') return Math.round(edited);
  return edited;
}

export function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
