import type { InvestmentModule, ComputeResult } from '../core/types';
import { grm, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Single-Family Home — Long-Term Rental. Same four return levers as any LTR, but
// you own the whole building: no HOA to offload exterior capex, higher
// maintenance, and a full-property insurance policy. One tenant means a single
// vacancy is 100% vacancy.

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

export const sfrLtr: InvestmentModule = {
  id: 'sfr-ltr',
  name: 'Single-Family Home — Long-Term Rental',
  category: 'Residential',
  tier: 'core',
  blurb: 'Financed detached house held for annual rent. No HOA — you own everything.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 380_000, min: 0, step: 5000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Verify against a current rate sheet for the product and credit profile.' },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },
    { key: 'monthlyRent', label: 'Monthly rent', type: 'currency', unit: '$/mo', default: 2_500, min: 0, step: 50, group: 'Income', verify: true, help: 'Verify against current comps for the home and submarket.' },
    { key: 'vacancyPct', label: 'Vacancy', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.5, step: 0.01, group: 'Income', help: 'One tenant: when it is empty, it is 100% empty.' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Income' },
    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.011, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true, help: 'Annual, as a fraction of assessed value. Verify with the county assessor.' },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 1_800, min: 0, step: 100, group: 'Expenses', verify: true, help: 'Full-property landlord policy — you insure the whole structure, not just the interior.' },
    { key: 'maintenancePct', label: 'Maintenance', type: 'percent', unit: '%', default: 0.1, min: 0, max: 0.3, step: 0.01, group: 'Expenses', help: 'Fraction of scheduled rent. Higher than a condo/townhome — roof, HVAC, and grounds are all yours.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.01, group: 'Expenses', help: 'Fraction of collected rent. Set to 0 if self-managing.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },
    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.035, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Assumption, not a forecast.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'grm', label: 'Gross rent multiplier', unit: 'x', higherIsBetter: false, help: 'Price / gross annual rent. Lower is cheaper per dollar of rent.' },
    { key: 'opexRatio', label: 'Operating expense ratio', unit: '%', higherIsBetter: false, help: 'Operating expenses / effective revenue.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy a financed detached house and hold it for rent plus appreciation. The single-family rental has the **broadest tenant pool** (families who stay longer) and **full control** — no HOA telling you whether you can rent, and no shared-wall neighbors. The trade-off is that you own **all of the capex**: roof, HVAC, water heater, foundation, and grounds are entirely your line item, and there is no association to smooth them. And with one unit, a single vacancy is 100% vacancy.',
    risks: [
      'You own every system: a roof or HVAC replacement is a lumpy five-figure hit with no HOA to spread it.',
      'One tenant means binary occupancy — a turnover or eviction zeroes revenue while the mortgage keeps running.',
      'Rent and appreciation are assumptions; a soft submarket compresses both at once.',
      'Pre-tax cash flow can be thin or negative even when the deal is sound after tax.',
    ],
    opportunities: [
      'Widest tenant demand and typically lower turnover than condos or apartments.',
      'Full control: no HOA rental caps, assessments, or approval to rent.',
      'Land component of a detached house tends to carry the appreciation upside.',
    ],
    regulatory:
      'Confirm local landlord-tenant rules, rental-license or registration requirements, and any occupancy limits before closing.',
    dataHooks: ['viirs-radiance'],
  },
};
