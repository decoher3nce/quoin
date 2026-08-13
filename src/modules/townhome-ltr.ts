import type { InvestmentModule, ComputeResult } from '../core/types';
import { grm, dscr } from '../core/finance';
import { computeHold } from './_shapes';

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const vacancy = i.vacancyPct ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;
  const appreciation = i.appreciationPct ?? 0;

  const loanAmount = price * (1 - downPct);
  const totalCashInvested = price * downPct + price * (i.closingCostPct ?? 0);
  const rentAnnual0 = (i.monthlyRent ?? 0) * 12;

  const grossRevenue = (y: number) => rentAnnual0 * Math.pow(1 + rentGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * (1 - vacancy);
  const operatingExpenses = (y: number) => {
    const eg = Math.pow(1 + expenseGrowth, y - 1);
    const value = price * Math.pow(1 + appreciation, y - 1);
    return (
      value * (i.propertyTaxPct ?? 0) +
      (i.insuranceAnnual ?? 0) * eg +
      (i.hoaMonthly ?? 0) * 12 * eg +
      grossRevenue(y) * (i.maintenancePct ?? 0) +
      effectiveRevenue(y) * (i.managementPct ?? 0)
    );
  };

  const { core, projection, y1, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(d) && d < 1.2) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.20.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative (depreciation not modeled).');

  return {
    metrics: {
      ...core,
      grm: grm(price, grossRevenue(1)),
      opexRatio: y1.effectiveRevenue > 0 ? y1.operatingExpenses / y1.effectiveRevenue : NaN,
    },
    projection,
    warnings,
  };
}

export const townhomeLtr: InvestmentModule = {
  id: 'townhome-ltr',
  name: 'Townhome — Long-Term Rental',
  category: 'Residential',
  tier: 'core',
  blurb: 'Financed townhome held for annual rent. Lower HOA than a condo, some exterior upkeep.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 450_000, min: 0, step: 5000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },
    { key: 'monthlyRent', label: 'Monthly rent', type: 'currency', unit: '$/mo', default: 2_850, min: 0, step: 50, group: 'Income', verify: true },
    { key: 'vacancyPct', label: 'Vacancy', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.5, step: 0.01, group: 'Income' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Income' },
    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.011, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 1_600, min: 0, step: 100, group: 'Expenses', verify: true },
    { key: 'hoaMonthly', label: 'HOA dues', type: 'currency', unit: '$/mo', default: 200, min: 0, step: 25, group: 'Expenses', verify: true, help: 'Townhome HOAs typically cover less exterior than a condo.' },
    { key: 'maintenancePct', label: 'Maintenance', type: 'percent', unit: '%', default: 0.09, min: 0, max: 0.3, step: 0.01, group: 'Expenses', help: 'Fraction of scheduled rent. Higher than a condo — you own more of the exterior.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.01, group: 'Expenses' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },
    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.035, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'grm', label: 'Gross rent multiplier', unit: 'x', higherIsBetter: false, help: 'Price / gross annual rent.' },
    { key: 'opexRatio', label: 'Operating expense ratio', unit: '%', higherIsBetter: false },
  ],
  compute,
  narrative: {
    strategy:
      'A middle path between condo and single-family: more space and a private entrance than a condo, lower HOA and a smaller footprint than a detached house. Same four return levers as any long-term rental (cash flow, amortization, appreciation, unmodeled tax), with **shared-wall and HOA exposure** smaller than a condo but real.',
    risks: [
      'You own more exterior than a condo — budget more maintenance and eventual capex (roof, siding).',
      'HOA still governs rentals and can levy special assessments.',
      'Rent and appreciation are assumptions; a soft submarket compresses both.',
    ],
    opportunities: [
      'Broader tenant pool (families) than a one-bedroom condo, often lower turnover.',
      'Amortization builds equity even in a flat market.',
      'Lower HOA than a condo improves cash flow at a similar price point.',
    ],
    regulatory: 'Confirm the HOA permits long-term rentals and check any rental cap or minimum-lease term.',
    dataHooks: ['viirs-radiance'],
  },
};
