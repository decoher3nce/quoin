import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Industrial / Flex. Same math shape as multi-tenant office, but far stronger
// fundamentals: mostly-NNN leases push landlord opex low, occupancy runs high,
// tenants are sticky, and TI/LC on rollover is a fraction of office. Demand is
// underpinned by e-commerce logistics and onshoring. The residual risk is
// functional obsolescence and single-tenant rollover.

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

export const industrialFlex: InvestmentModule = {
  id: 'industrial-flex',
  name: 'Industrial / Flex',
  category: 'Commercial',
  tier: 'core',
  blurb: 'Warehouse / flex space: low opex, high occupancy, sticky tenants, modest TI/LC.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 3_200_000, min: 0, step: 50_000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.30, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Verify against a current commercial rate sheet.' },
    { key: 'loanTermYears', label: 'Loan term / amortization', type: 'integer', unit: 'yr', default: 25, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'rentableSqft', label: 'Rentable area', type: 'number', unit: 'count', default: 40_000, min: 0, step: 500, group: 'Income', help: 'Rentable square feet.' },
    { key: 'marketRentPerSqftAnnual', label: 'Market rent / sqft', type: 'currency', unit: '$/yr', default: 10, min: 0, step: 0.25, group: 'Income', verify: true, help: 'Triple-net annual rent per sqft. Verify against submarket comps.' },
    { key: 'currentOccupancy', label: 'Current occupancy', type: 'percent', unit: '%', default: 0.95, min: 0, max: 1, step: 0.01, group: 'Income', verify: true },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.035, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'operatingExpensePerSqft', label: 'Non-recoverable opex / sqft', type: 'currency', unit: '$/yr', default: 2, min: 0, step: 0.25, group: 'Expenses', help: 'Mostly NNN — landlord-borne opex is small.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.15, step: 0.005, group: 'Expenses', help: 'As a fraction of collected rent.' },
    { key: 'annualRolloverPct', label: 'Annual rollover', type: 'percent', unit: '%', default: 0.12, min: 0, max: 0.5, step: 0.01, group: 'Expenses', help: 'Share of the building that re-leases each year and incurs TI/LC.' },
    { key: 'tiLcPerSqft', label: 'TI / LC per rolled sqft', type: 'currency', unit: '$', default: 8, min: 0, step: 1, group: 'Expenses', help: 'Industrial TI/LC is a fraction of office.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
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
      'Own warehouse or flex space and ride durable demand from **e-commerce logistics and onshoring**. Leases are largely NNN, so landlord operating expenses are thin; occupancy runs high and tenants are sticky because relocating operations is disruptive and costly. TI/LC on rollover is a fraction of office. The result is a comparatively clean, resilient NOI — the residual risks are **functional obsolescence** and the binary exposure of any single large tenant rolling.',
    risks: [
      'Functional obsolescence: low clear heights, shallow bays, or poor truck access can strand a building.',
      'Single-tenant rollover in a big box is a binary occupancy event with a long re-lease timeline.',
      'Cap-rate compression has already priced in much of the sector strength; entry basis matters.',
      'Rent growth assumptions can overshoot after a multi-year run in industrial rents.',
    ],
    opportunities: [
      'Onshoring and last-mile logistics keep structural demand ahead of new supply in many markets.',
      'Low opex and sticky tenants produce a clean, financeable NOI.',
      'Mark-to-market on below-market in-place rents can lift NOI sharply at renewal.',
    ],
    regulatory:
      'Confirm zoning permits the intended industrial use, check clear-height and dock configuration against tenant demand, and verify any environmental history on the parcel.',
  },
};
