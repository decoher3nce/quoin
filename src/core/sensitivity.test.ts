import { describe, it, expect } from 'vitest';
import { tornado, grid, sensitiveParams } from './sensitivity';
import { MODULES } from '../modules';
import { defaultsOf } from '../core/types';

const condo = MODULES.find((m) => m.id === 'metro-condo-ltr')!;
const inputs = defaultsOf(condo);

describe('tornado', () => {
  const t = tornado(condo, inputs, 'irr5yr', 0.1);

  it('base equals the module’s own metric', () => {
    expect(t.base).toBeCloseTo(condo.compute(inputs).metrics.irr5yr!, 9);
  });

  it('is sorted by swing, largest first', () => {
    const swings = t.bars.map((b) => (Number.isFinite(b.swing) ? b.swing : -1));
    for (let i = 1; i < swings.length; i++) {
      expect(swings[i - 1]).toBeGreaterThanOrEqual(swings[i]!);
    }
  });

  it('ranks a high-impact driver above a trivial one', () => {
    const rank = (k: string) => t.bars.findIndex((b) => b.key === k);
    // Appreciation should move a 5-yr IRR far more than the vacancy rate does.
    expect(rank('appreciationPct')).toBeLessThan(rank('vacancyPct'));
  });

  it('skips zero-valued inputs (no relative signal)', () => {
    // otherMonthlyIncome defaults to 0 → not a bar.
    expect(t.bars.find((b) => b.key === 'otherMonthlyIncome')).toBeUndefined();
  });

  it('higher appreciation yields higher IRR (correct direction)', () => {
    const bar = t.bars.find((b) => b.key === 'appreciationPct')!;
    expect(bar.high).toBeGreaterThan(bar.low);
  });
});

describe('grid', () => {
  const g = grid(condo, inputs, 'appreciationPct', 'monthlyRent', 'irr5yr', 5, 0.2);

  it('is steps × steps', () => {
    expect(g.xs.length).toBe(5);
    expect(g.ys.length).toBe(5);
    expect(g.cells.length).toBe(5);
    expect(g.cells.every((row) => row.length === 5)).toBe(true);
  });

  it('tracks finite min/max bounds', () => {
    expect(Number.isFinite(g.min)).toBe(true);
    expect(Number.isFinite(g.max)).toBe(true);
    expect(g.max).toBeGreaterThan(g.min);
  });

  it('is monotonic in appreciation (x) at a fixed rent row', () => {
    const row = g.cells[2]!; // middle rent
    for (let i = 1; i < row.length; i++) {
      expect(row[i]!).toBeGreaterThan(row[i - 1]!);
    }
  });
});

describe('sensitiveParams', () => {
  it('excludes zero-valued inputs and includes real drivers', () => {
    const keys = sensitiveParams(condo, inputs).map((p) => p.key);
    expect(keys).toContain('purchasePrice');
    expect(keys).toContain('interestRate');
    expect(keys).not.toContain('otherMonthlyIncome'); // 0 by default
  });
});
