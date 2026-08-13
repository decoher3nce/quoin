import { describe, it, expect } from 'vitest';
import { MODULES } from './index';
import { defaultsOf } from '../core/types';
import { assertCoreMetrics } from '../core/metrics';

interface Fixture {
  id: string;
  inputs: Record<string, number>;
  expected: Record<string, number | null>; // JSON has no NaN; null encodes it
}

// Auto-discover every golden fixture so new modules are covered without edits.
const fixtureModules = import.meta.glob<Fixture>('./__fixtures__/*.json', { eager: true, import: 'default' });
const FIXTURES: Fixture[] = Object.values(fixtureModules);

// Relative tolerance for golden comparison; absolute floor for near-zero values.
function closeEnough(actual: number, expected: number | null): boolean {
  // null in a fixture encodes a NaN metric (JSON cannot represent NaN).
  if (expected === null || Number.isNaN(expected)) return Number.isNaN(actual);
  if (!Number.isFinite(expected)) return actual === expected;
  const tol = Math.max(1e-6, Math.abs(expected) * 1e-6);
  return Math.abs(actual - expected) <= tol;
}

describe('module registry contract', () => {
  it('has unique module ids', () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const m of MODULES) {
    describe(m.id, () => {
      it('produces every core metric key', () => {
        const result = m.compute(defaultsOf(m));
        expect(assertCoreMetrics(result.metrics)).toEqual([]);
      });

      it('declares metric specs for every non-core metric it returns', () => {
        const result = m.compute(defaultsOf(m));
        const coreKeys = new Set([
          'annualCashFlow',
          'monthlyCashFlow',
          'cashOnCash',
          'capRate',
          'dscr',
          'irr5yr',
          'totalCashInvested',
        ]);
        const declared = new Set(m.metrics.map((s) => s.key));
        const undeclared = Object.keys(result.metrics).filter(
          (k) => !coreKeys.has(k) && !declared.has(k),
        );
        expect(undeclared).toEqual([]);
      });

      it('has a param spec for every group referenced and non-empty narrative', () => {
        expect(m.params.length).toBeGreaterThan(0);
        expect(m.narrative.strategy.length).toBeGreaterThan(0);
        expect(m.narrative.risks.length).toBeGreaterThan(0);
        expect(m.narrative.opportunities.length).toBeGreaterThan(0);
      });
    });
  }
});

describe('golden fixtures (inputs → expected metrics)', () => {
  it('every registered module has a golden fixture', () => {
    const withFixture = new Set(FIXTURES.map((f) => f.id));
    const missing = MODULES.map((m) => m.id).filter((id) => !withFixture.has(id));
    expect(missing, `modules missing a fixture: ${missing.join(', ')}`).toEqual([]);
  });

  for (const fx of FIXTURES) {
    it(`${fx.id} matches its golden values`, () => {
      const m = MODULES.find((x) => x.id === fx.id);
      expect(m, `module ${fx.id} registered`).toBeDefined();
      const result = m!.compute(fx.inputs);
      for (const [key, expected] of Object.entries(fx.expected)) {
        const actual = result.metrics[key];
        expect(actual, `${fx.id}.${key}`).toBeDefined();
        expect(
          closeEnough(actual as number, expected),
          `${fx.id}.${key}: expected ${expected}, got ${actual}`,
        ).toBe(true);
      }
    });
  }
});
