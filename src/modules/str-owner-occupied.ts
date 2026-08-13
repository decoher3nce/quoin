import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr, guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// Owner-occupied STR. You live in the property part of the year and monetize only
// the nights it would otherwise sit empty. Available nights = 365 − personal-use
// nights, and revenue is earned only on the occupancy OF THOSE available nights.
// Personal use has real value, but it is unmonetized — only vacant nights earn.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const closingPct = i.closingCostPct ?? 0;

  const adr = i.adr ?? 0;
  const personalUseNights = i.personalUseNights ?? 0;
  const availableNights = Math.max(365 - personalUseNights, 0);
  const occ = i.occupancyOfAvailable ?? 0;
  const platformFee = i.platformFeePct ?? 0;
  const revGrowth = i.revenueGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const suppliesPct = i.suppliesPct ?? 0;
  const managementPct = i.managementPct ?? 0;
  const maintenancePct = i.maintenancePct ?? 0;
  const variablePct = suppliesPct + managementPct + maintenancePct;

  const loanAmount = price * (1 - downPct);
  const furnishing = i.furnishingCost ?? 0;
  const reserve = i.reserveCash ?? 0;
  const totalCashInvested = price * downPct + price * closingPct + furnishing + reserve;

  const grossRevenue = (y: number) => adr * availableNights * occ * Math.pow(1 + revGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * (1 - platformFee);
  const fixedOpex = (y: number) => {
    const eg = Math.pow(1 + expenseGrowth, y - 1);
    const value = price * Math.pow(1 + (i.appreciationPct ?? 0), y - 1);
    return (
      value * (i.propertyTaxPct ?? 0) +
      (i.insuranceAnnual ?? 0) * eg +
      (i.hoaMonthly ?? 0) * 12 * eg +
      (i.utilitiesMonthly ?? 0) * 12 * eg
    );
  };
  const operatingExpenses = (y: number) => fixedOpex(y) + grossRevenue(y) * variablePct;

  const { core, projection, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation: i.appreciationPct ?? 0,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  // Break-even occupancy is measured against AVAILABLE nights (not 365): the
  // fraction of vacant nights that must be booked for year-1 cash flow to be zero.
  const marginPerRevenue = 1 - platformFee - variablePct;
  const revNeeded = guardDiv(fixedOpex(1) + debtService, marginPerRevenue);
  const breakEvenOccupancy = adr > 0 && availableNights > 0 ? guardDiv(revNeeded, adr * availableNights) : NaN;
  const revPAN = adr * occ;

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > 1)
    warnings.push('Break-even exceeds 100% of available nights — vacant-night income cannot cover carry at these inputs; the personal-use decision is subsidizing the property.');
  else if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > occ)
    warnings.push(`Modeled occupancy of available nights ${(occ * 100).toFixed(0)}% is below break-even ${(breakEvenOccupancy * 100).toFixed(0)}%.`);
  if (Number.isFinite(d) && d < 1.2) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.20.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative — expected when you reserve many nights for personal use.');

  return {
    metrics: { ...core, breakEvenOccupancy, personalUseNights, revPAN },
    projection,
    warnings,
  };
}

export const strOwnerOccupied: InvestmentModule = {
  id: 'str-owner-occupied',
  name: 'Short-Term Rental — Owner-Occupied',
  category: 'Hospitality',
  tier: 'creative',
  blurb: 'Live there part-year; rent only the vacant nights. Revenue earns on 365 − personal-use nights.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 540_000, min: 0, step: 5000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.2, min: 0, max: 1, step: 0.01, group: 'Financing', help: 'Owner-occupant financing can allow a lower down payment than an investment loan.' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'furnishingCost', label: 'Furnishing & setup', type: 'currency', unit: '$', default: 30_000, min: 0, step: 1000, group: 'Setup', help: 'A dual-use home still needs guest-grade furnishings, linens, and a lockable owner closet.' },
    { key: 'reserveCash', label: 'Operating reserve', type: 'currency', unit: '$', default: 8_000, min: 0, step: 500, group: 'Setup' },

    { key: 'personalUseNights', label: 'Personal-use nights', type: 'integer', unit: 'count', default: 90, min: 0, max: 365, step: 5, group: 'Income', help: 'Nights you block for your own use. These earn nothing and shrink the rentable pool to 365 − this.' },
    { key: 'adr', label: 'Average daily rate', type: 'number', unit: '$/night', default: 240, min: 0, step: 5, group: 'Income', verify: true, help: 'Verify against comparable active listings for the nights you actually make available.' },
    { key: 'occupancyOfAvailable', label: 'Occupancy of available nights', type: 'percent', unit: '%', default: 0.6, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Paid nights / available (non-personal) nights. Blocking peak dates for yourself lowers achievable occupancy.' },
    { key: 'platformFeePct', label: 'Platform fee', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.2, step: 0.005, group: 'Income' },
    { key: 'revenueGrowthPct', label: 'Revenue growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.011, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 2_400, min: 0, step: 100, group: 'Expenses', verify: true, help: 'Mixed personal/short-term-rental use needs a policy that covers both — verify coverage, not just price.' },
    { key: 'hoaMonthly', label: 'HOA dues', type: 'currency', unit: '$/mo', default: 0, min: 0, step: 25, group: 'Expenses' },
    { key: 'utilitiesMonthly', label: 'Utilities', type: 'currency', unit: '$/mo', default: 300, min: 0, step: 20, group: 'Expenses' },
    { key: 'suppliesPct', label: 'Supplies & consumables', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.2, step: 0.005, group: 'Expenses' },
    { key: 'managementPct', label: 'Management / co-host', type: 'percent', unit: '%', default: 0.15, min: 0, max: 0.4, step: 0.01, group: 'Expenses', verify: true, help: 'Owner-occupants often self-manage. Set to 0 if you handle turnovers yourself.' },
    { key: 'maintenancePct', label: 'Maintenance & turnover', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.2, step: 0.005, group: 'Expenses' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.035, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'breakEvenOccupancy', label: 'Break-even occupancy (available nights)', unit: '%', higherIsBetter: false, help: 'Fraction of AVAILABLE (non-personal) nights that must book for year-1 cash flow to be zero.' },
    { key: 'personalUseNights', label: 'Personal-use nights', unit: 'count', higherIsBetter: null, help: 'Nights reserved for your own use — real value to you, but unmonetized in this model.' },
    { key: 'revPAN', label: 'Revenue / available night', unit: '$/night', higherIsBetter: true, help: 'ADR × occupancy of available nights.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own a home you use part of the year and rent out the nights it would otherwise sit empty. The rentable pool is **365 − personal-use nights**, and income is earned only on the occupancy of that pool — so every night you keep for yourself is a night that earns nothing. The right way to read this model is as **offsetting the cost of a home you wanted anyway**, not as a pure investment: the personal-use value is real but never appears in the cash flow.',
    risks: [
      'Blocking the best weeks for personal use removes exactly the highest-ADR, highest-demand nights, so achievable occupancy on the remainder is lower than a pure-rental comp.',
      'Mixed-use insurance and lender terms can be tricky — an owner-occupant loan may restrict rental activity.',
      'The mortgage-interest and expense deductibility split between personal and rental use is a tax nuance NOT modeled here; consult a professional.',
      'STR regulation still applies to the rented nights even in an owner-occupied home.',
    ],
    opportunities: [
      'Vacant-night income can meaningfully offset the carrying cost of a second home or primary residence.',
      'Primary-residence STR carve-outs in restrictive markets often permit exactly this owner-occupied pattern where investor STRs are banned.',
      'Flexibility: you can dial personal-use nights up or down each year as your needs and the market change.',
    ],
    regulatory:
      'STR legality governs the rented nights. Many cities that ban or cap investor STRs specifically PERMIT owner-occupied / primary-residence short-term rentals — verify the local primary-residence rule, night caps, permit, and lodging-tax obligations, because this structure is often the one carve-out that remains legal.',
    dataHooks: ['viirs-radiance'],
  },
};
