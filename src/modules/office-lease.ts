import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Multi-Tenant Office. Revenue is rentable area × market rent, hit hard by
// current occupancy. Non-recoverable opex is a per-sqft load, plus management on
// collected rent, plus a persistent TI/LC capital drag: every year some share of
// the space rolls and must be re-leased with tenant improvements and leasing
// commissions. Post-2020 vacancy is the headline risk.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 25;
  const appreciation = i.appreciationPct ?? 0;

  const sqft = i.rentableSqft ?? 0;
  const marketRent = i.marketRentPerSqftAnnual ?? 0;
  const occupancy = i.currentOccupancy ?? 0;
  const opexPerSqft = i.operatingExpensePerSqft ?? 0;
  const rolloverPct = i.annualRolloverPct ?? 0;
  const tiLcPerSqft = i.tiLcPerSqft ?? 0;
  const managementPct = i.managementPct ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const loanAmount = price * (1 - downPct);
  const totalCashInvested = price * downPct + price * (i.closingCostPct ?? 0);

  // Annualized TI/LC drag: rollover sqft × per-sqft TI/LC, treated as a recurring
  // capital cost that never goes away in a multi-tenant building.
  const tiLcDragAnnual = sqft * rolloverPct * tiLcPerSqft;

  const grossRevenue = (y: number) => sqft * marketRent * Math.pow(1 + rentGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * occupancy;
  const operatingExpenses = (y: number) =>
    sqft * opexPerSqft * Math.pow(1 + expenseGrowth, y - 1) +
    effectiveRevenue(y) * managementPct +
    tiLcDragAnnual;

  const { core, projection, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(d) && d < 1.2) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.20 — most lenders would flag this.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative (depreciation not modeled).');

  return {
    metrics: {
      ...core,
      pricePerSqft: guardDiv(price, sqft),
      goingInCapRate: guardDiv(noi, price),
      tiLcDragAnnual,
    },
    projection,
    warnings,
  };
}

export const officeLease: InvestmentModule = {
  id: 'office-lease',
  name: 'Multi-Tenant Office',
  category: 'Commercial',
  tier: 'core',
  blurb: 'Multi-tenant office: occupancy-driven revenue with a recurring TI/LC capital drag.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 4_500_000, min: 0, step: 50_000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.35, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.072, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Verify against a current commercial rate sheet.' },
    { key: 'loanTermYears', label: 'Loan term / amortization', type: 'integer', unit: 'yr', default: 25, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'rentableSqft', label: 'Rentable area', type: 'number', unit: 'count', default: 30_000, min: 0, step: 500, group: 'Income', help: 'Rentable square feet.' },
    { key: 'marketRentPerSqftAnnual', label: 'Market rent / sqft', type: 'currency', unit: '$/yr', default: 28, min: 0, step: 0.5, group: 'Income', verify: true, help: 'Full-service annual asking rent per sqft. Verify against submarket comps.' },
    { key: 'currentOccupancy', label: 'Current occupancy', type: 'percent', unit: '%', default: 0.82, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Leased and paying. The dominant swing input for office today.' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'operatingExpensePerSqft', label: 'Non-recoverable opex / sqft', type: 'currency', unit: '$/yr', default: 11, min: 0, step: 0.5, group: 'Expenses', help: 'Landlord-borne operating expenses per sqft not passed through to tenants.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.15, step: 0.005, group: 'Expenses', help: 'As a fraction of collected rent.' },
    { key: 'annualRolloverPct', label: 'Annual rollover', type: 'percent', unit: '%', default: 0.15, min: 0, max: 0.5, step: 0.01, group: 'Expenses', help: 'Share of the building that re-leases each year and incurs TI/LC.' },
    { key: 'tiLcPerSqft', label: 'TI / LC per rolled sqft', type: 'currency', unit: '$', default: 45, min: 0, step: 5, group: 'Expenses', help: 'Tenant improvements plus leasing commissions per sqft of rolled space.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.0, min: -0.15, max: 0.15, step: 0.005, group: 'Exit', help: 'Flat by default — office values remain under pressure.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'pricePerSqft', label: 'Price per sqft', unit: '$', higherIsBetter: false, help: 'Purchase price / rentable area.' },
    { key: 'goingInCapRate', label: 'Going-in cap rate', unit: '%', higherIsBetter: true, help: 'Year-1 NOI / price.' },
    { key: 'tiLcDragAnnual', label: 'TI/LC drag (annual)', unit: '$/yr', higherIsBetter: false, help: 'Recurring tenant-improvement and leasing-commission cost from annual rollover.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own a multi-tenant office building and live off the spread between market rent and a stubborn cost stack. Revenue is **rentable area × rent × occupancy**, and occupancy is the swing variable — **post-2020 structural vacancy is the headline risk**. Even a leased building bleeds capital through TI/LC on every rollover, so the true yield is well below the face cap rate. The market is bifurcating: trophy space still leases while commodity space does not.',
    risks: [
      'Structural vacancy: remote/hybrid work has permanently reduced office demand in many submarkets.',
      'TI/LC capital drag recurs on every rollover and can consume most of the NOI.',
      'Flight-to-quality bifurcation punishes commodity buildings with widening vacancy and concessions.',
      'Refinancing risk is acute — lenders have pulled back sharply from the office sector.',
    ],
    opportunities: [
      'Deeply discounted basis versus replacement cost can offer asymmetric upside if demand stabilizes.',
      'Well-located, amenitized buildings capture flight-to-quality tenant demand.',
      'Conversion or repositioning (to residential, medical, or lab) can unlock trapped value.',
    ],
    regulatory:
      'Verify in-place leases, rollover schedule, and any co-tenancy or early-termination rights before underwriting; confirm zoning flexibility if a conversion thesis is part of the case.',
  },
};
