import { describe, it, expect } from 'vitest';
import { MODULES } from './index';
import { defaultsOf } from '../core/types';
import { computeAfterTax, DEFAULT_TAX_SETTINGS } from '../core/tax';

describe('tax profiles', () => {
  const tagged = MODULES.filter((m) => m.taxProfile);

  it('tags a sensible number of depreciable hold modules', () => {
    expect(tagged.length).toBeGreaterThanOrEqual(18);
  });

  for (const m of tagged) {
    describe(m.id, () => {
      const inputs = defaultsOf(m);

      it('has a positive depreciable basis and a real recovery period', () => {
        expect(m.taxProfile!.basis(inputs)).toBeGreaterThan(0);
        expect([27.5, 39]).toContain(m.taxProfile!.recoveryYears);
      });

      it('produces a finite after-tax result with a projection', () => {
        const result = m.compute(inputs);
        const at = computeAfterTax(m, inputs, result, DEFAULT_TAX_SETTINGS);
        expect(at, `${m.id} should be depreciable + have a projection`).not.toBeNull();
        expect(Number.isFinite(at!.annualDepreciation)).toBe(true);
        expect(at!.annualDepreciation).toBeGreaterThan(0);
      });
    });
  }

  it('does NOT tax-tag flips, land, or paper assets', () => {
    const shouldNotHave = [
      'raw-land',
      'entitled-lot-dev',
      'fix-and-flip',
      'adaptive-reuse',
      'condo-conversion',
      'reit',
      'syndication-lp',
      'private-lending',
      'ground-lease',
      'solar-land-lease',
      'mountain-second-home',
      'str-owner-occupied',
    ];
    for (const id of shouldNotHave) {
      const m = MODULES.find((x) => x.id === id);
      expect(m, `${id} registered`).toBeDefined();
      expect(m!.taxProfile, `${id} should NOT have a taxProfile`).toBeUndefined();
    }
  });
});
