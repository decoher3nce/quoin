import { describe, it, expect } from 'vitest';
import { computeAfterTax, type TaxSettings } from './tax';
import type { InvestmentModule, YearRow, ComputeResult } from './types';

// A synthetic 2-year hold with round numbers so every figure can be checked by
// hand. Purchase 1,000,000; 800k building (20% land) over 40 years → 20k/yr
// depreciation. Each year NOI 60k, interest 30k, cash flow 20k. Sells year 2 at
// 1,100,000, 5% selling cost, loan balance 500k at exit. Cash invested 250k.
function fixtureRow(year: number, over: Partial<YearRow> = {}): YearRow {
  return {
    year,
    grossRevenue: 100_000,
    effectiveRevenue: 95_000,
    operatingExpenses: 35_000,
    noi: 60_000,
    debtService: 40_000,
    interest: 30_000,
    cashFlow: 20_000,
    cumulativeCashFlow: 20_000 * year,
    propertyValue: 1_100_000,
    loanBalance: 500_000,
    equity: 600_000,
    ...over,
  };
}

const result: ComputeResult = {
  metrics: { totalCashInvested: 250_000 },
  projection: [fixtureRow(1), fixtureRow(2)],
};

const module = {
  id: 'synthetic',
  taxProfile: { recoveryYears: 40, basis: () => 1_000_000, landFractionDefault: 0.2 },
} as unknown as InvestmentModule;

const settings: TaxSettings = {
  marginalRate: 0.3,
  capGainsRate: 0.15,
  recaptureRate: 0.25,
  landFraction: 0.2,
};

describe('computeAfterTax', () => {
  const at = computeAfterTax(module, { sellingCostPct: 0.05 }, result, settings)!;

  it('depreciates only the building basis over the recovery period', () => {
    // 1,000,000 × (1 − 0.20) = 800,000 building ÷ 40 = 20,000/yr.
    expect(at.annualDepreciation).toBeCloseTo(20_000, 6);
  });

  it('computes taxable income as NOI − interest − depreciation', () => {
    // 60,000 − 30,000 − 20,000 = 10,000 taxable → tax 3,000 at 30%.
    expect(at.years[0]!.taxableIncome).toBeCloseTo(10_000, 6);
    expect(at.years[0]!.incomeTax).toBeCloseTo(3_000, 6);
    // After-tax cash flow = 20,000 − 3,000 = 17,000.
    expect(at.years[0]!.afterTaxCashFlow).toBeCloseTo(17_000, 6);
  });

  it('produces a tax benefit when the paper loss is negative', () => {
    const loss = computeAfterTax(
      module,
      { sellingCostPct: 0.05 },
      { metrics: { totalCashInvested: 250_000 }, projection: [fixtureRow(1, { noi: 40_000 })] },
      settings,
    )!;
    // 40,000 − 30,000 − 20,000 = −10,000 → tax −3,000 (a benefit that shelters
    // other income). After-tax cash flow = cash flow 20,000 − (−3,000) = 23,000.
    expect(loss.years[0]!.incomeTax).toBeCloseTo(-3_000, 6);
    expect(loss.years[0]!.afterTaxCashFlow).toBeCloseTo(23_000, 6);
  });

  it('splits the sale gain into recapture and capital gains', () => {
    // accumulated depreciation = 20,000 × 2 = 40,000; adjusted basis = 960,000.
    // amount realized = 1,100,000 − 55,000 (5%) = 1,045,000.
    // total gain = 1,045,000 − 960,000 = 85,000.
    // recapture = min(40,000, 85,000) = 40,000 → 25% = 10,000.
    // capital gain = 45,000 → 15% = 6,750. sale tax = 16,750.
    expect(at.accumulatedDepreciation).toBeCloseTo(40_000, 6);
    expect(at.adjustedBasis).toBeCloseTo(960_000, 6);
    expect(at.totalGain).toBeCloseTo(85_000, 6);
    expect(at.recaptureTax).toBeCloseTo(10_000, 6);
    expect(at.capitalGainsTax).toBeCloseTo(6_750, 6);
    expect(at.saleTax).toBeCloseTo(16_750, 6);
  });

  it('nets sale tax out of the pre-tax sale proceeds', () => {
    // pre-tax proceeds = 1,100,000 − 55,000 − 500,000 = 545,000.
    // after-tax = 545,000 − 16,750 = 528,250.
    expect(at.preTaxSaleProceeds).toBeCloseTo(545_000, 6);
    expect(at.afterTaxSaleProceeds).toBeCloseTo(528_250, 6);
  });

  it('returns null for a module without a taxProfile', () => {
    const noProfile = { ...module, taxProfile: undefined } as InvestmentModule;
    expect(computeAfterTax(noProfile, {}, result, settings)).toBeNull();
  });

  it('after-tax IRR is finite and below nothing-is-broken sanity bounds', () => {
    expect(Number.isFinite(at.metrics.afterTaxIrr)).toBe(true);
    expect(at.metrics.afterTaxIrr).toBeGreaterThan(0);
    expect(at.metrics.afterTaxIrr).toBeLessThan(1);
  });
});
