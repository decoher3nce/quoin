import { describe, it, expect } from 'vitest';
import {
  pmt,
  annualDebtService,
  loanBalance,
  npv,
  irr,
  capRate,
  cashOnCash,
  dscr,
  grm,
  guardDiv,
} from './finance';

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

describe('pmt', () => {
  it('matches the reference 240k @ 7% / 30yr ≈ 1596.73/mo', () => {
    expect(pmt(0.07, 30, 240_000)).toBeCloseTo(1596.73, 2);
  });

  it('handles a zero interest rate as straight-line principal / months', () => {
    expect(pmt(0, 10, 120_000)).toBeCloseTo(1000, 6);
  });

  it('returns 0 for a zero or negative principal', () => {
    expect(pmt(0.07, 30, 0)).toBe(0);
    expect(pmt(0.07, 30, -5000)).toBe(0);
  });

  it('annualDebtService is 12× the monthly payment', () => {
    expect(annualDebtService(0.07, 30, 240_000)).toBeCloseTo(pmt(0.07, 30, 240_000) * 12, 9);
  });
});

describe('loanBalance', () => {
  it('equals the full principal at month 0', () => {
    expect(loanBalance(240_000, 0.07, 30, 0)).toBeCloseTo(240_000, 6);
  });

  it('reaches ~0 at the final payment', () => {
    expect(loanBalance(240_000, 0.07, 30, 360)).toBeCloseTo(0, 2);
  });

  it('is monotonically decreasing over the term', () => {
    let prev = Infinity;
    for (let m = 0; m <= 360; m += 12) {
      const b = loanBalance(240_000, 0.07, 30, m);
      expect(b).toBeLessThanOrEqual(prev + 1e-6);
      prev = b;
    }
  });

  it('matches a known 30yr @ 7% balance after 5 years (60 payments)', () => {
    // Standard amortization: 225,915.82 remaining after 60 of 360 payments.
    expect(loanBalance(240_000, 0.07, 30, 60)).toBeCloseTo(225_915.82, 1);
  });

  it('clamps monthsElapsed beyond the term to zero', () => {
    expect(loanBalance(240_000, 0.07, 30, 500)).toBeCloseTo(0, 2);
  });

  it('zero-rate loan amortizes linearly', () => {
    expect(loanBalance(120_000, 0, 10, 60)).toBeCloseTo(60_000, 6);
  });
});

describe('npv', () => {
  it('sums undiscounted cashflows at rate 0', () => {
    expect(npv(0, [-100, 50, 50, 50])).toBeCloseTo(50, 9);
  });

  it('discounts a single future dollar correctly', () => {
    expect(npv(0.1, [0, 110])).toBeCloseTo(100, 9);
  });

  it('is zero at the IRR of a stream', () => {
    const cf = [-100_000, 12_000, 12_000, 12_000, 12_000, 112_000];
    expect(near(npv(0.12, cf), 0, 1e-3)).toBe(true);
  });
});

describe('irr', () => {
  it('recovers 12% from a bond-like stream', () => {
    const cf = [-100_000, 12_000, 12_000, 12_000, 12_000, 112_000];
    expect(irr(cf)).toBeCloseTo(0.12, 5);
  });

  it('returns NaN when there is no sign change', () => {
    expect(Number.isNaN(irr([100, 200, 300]))).toBe(true);
    expect(Number.isNaN(irr([-100, -200, -300]))).toBe(true);
  });

  it('recovers a simple doubling in one period', () => {
    expect(irr([-100, 200])).toBeCloseTo(1.0, 6);
  });

  it('handles a high-return stream via the bisection fallback range', () => {
    // -1000 now, 5000 in a year → 400% IRR.
    expect(irr([-1000, 5000])).toBeCloseTo(4.0, 6);
  });

  it('finds a negative IRR when the venture loses money', () => {
    const r = irr([-1000, 100, 100, 100]);
    expect(r).toBeLessThan(0);
    expect(Number.isFinite(r)).toBe(true);
  });
});

describe('ratio helpers', () => {
  it('capRate = NOI / price', () => {
    expect(capRate(60_000, 1_000_000)).toBeCloseTo(0.06, 9);
  });

  it('cashOnCash = annual cash flow / cash invested', () => {
    expect(cashOnCash(8_000, 100_000)).toBeCloseTo(0.08, 9);
  });

  it('dscr = NOI / annual debt service', () => {
    expect(dscr(60_000, 48_000)).toBeCloseTo(1.25, 9);
  });

  it('grm = price / gross annual rent', () => {
    expect(grm(500_000, 50_000)).toBeCloseTo(10, 9);
  });

  it('guardDiv returns NaN on a zero denominator', () => {
    expect(Number.isNaN(guardDiv(1, 0))).toBe(true);
    expect(Number.isNaN(capRate(60_000, 0))).toBe(true);
    expect(Number.isNaN(cashOnCash(8_000, 0))).toBe(true);
  });
});
