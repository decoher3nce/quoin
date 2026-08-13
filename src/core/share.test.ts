import { describe, it, expect } from 'vitest';
import { encodeScenario, decodeScenario, type Scenario } from './share';

describe('scenario codec', () => {
  it('round-trips a module scenario with deltas and tax', () => {
    const s: Scenario = {
      k: 'm',
      id: 'metro-condo-ltr',
      d: { purchasePrice: 450_000, interestRate: 0.065 },
      t: { m: 0.32, c: 0.15, r: 0.25, l: 0.2 },
    };
    const out = decodeScenario(encodeScenario(s));
    expect(out).toEqual(s);
  });

  it('round-trips a module scenario without tax', () => {
    const s: Scenario = { k: 'm', id: 'raw-land', d: {} };
    expect(decodeScenario(encodeScenario(s))).toEqual(s);
  });

  it('round-trips a comparison scenario', () => {
    const s: Scenario = {
      k: 'c',
      ids: ['metro-condo-ltr', 'str-metro'],
      di: { 'metro-condo-ltr': { monthlyRent: 2800 }, 'str-metro': {} },
    };
    expect(decodeScenario(encodeScenario(s))).toEqual(s);
  });

  it('produces a URL-safe string (no +, /, or =)', () => {
    const enc = encodeScenario({ k: 'm', id: 'x'.repeat(40), d: { a: 1.23456789 } });
    expect(enc).not.toMatch(/[+/=]/);
  });

  it('returns null for garbage and for the wrong shape', () => {
    expect(decodeScenario('not-base64-$$$')).toBeNull();
    expect(decodeScenario(encodeScenario({ k: 'x' } as unknown as Scenario))).toBeNull();
    expect(decodeScenario('')).toBeNull();
  });
});
