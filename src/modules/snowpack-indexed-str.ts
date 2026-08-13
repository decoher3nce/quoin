import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Snowpack-Indexed STR. A ski-town short-term rental acquired and underwritten
// off a snow-water-equivalent (SWE) demand signal: occupancy is driven by a snow
// index rather than assumed flat. A high-SWE forecast means a strong season and
// higher occupancy; a low-snow year cuts it. Modeled as a financed STR income
// hold with the effective occupancy scaled by a snow-index factor, and the same
// signature output as any STR: break-even occupancy. The novelty is treating a
// snowpack forecast as a leading demand signal the market underweights.

function compute(i: Record<string, number>): ComputeResult {
  const purchasePrice = i.purchasePrice ?? 0;
  const downPaymentPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const closingCostPct = i.closingCostPct ?? 0;
  const furnishingCost = i.furnishingCost ?? 0;

  const adr = i.adr ?? 0;
  const baseOccupancy = i.baseOccupancy ?? 0;
  const snowIndexFactor = i.snowIndexFactor ?? 1;
  const platformFee = i.platformFeePct ?? 0;
  const revGrowth = i.revGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;
  const appreciation = i.appreciationPct ?? 0;

  const suppliesPct = i.suppliesPct ?? 0;
  const managementPct = i.managementPct ?? 0;
  const maintenancePct = i.maintenancePct ?? 0;
  const variablePct = suppliesPct + managementPct + maintenancePct;

  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const effectiveOccupancy = Math.min(baseOccupancy * snowIndexFactor, 0.95);

  const price = purchasePrice;
  const loanAmount = price * (1 - downPaymentPct);
  const totalCashInvested = price * downPaymentPct + price * closingCostPct + furnishingCost;

  const grossRevenue = (year: number) => adr * 365 * effectiveOccupancy * Math.pow(1 + revGrowth, year - 1);
  const effectiveRevenue = (year: number) => grossRevenue(year) * (1 - platformFee);
  const fixedOpex = (year: number) => {
    const eg = Math.pow(1 + expenseGrowth, year - 1);
    const value = price * Math.pow(1 + appreciation, year - 1);
    const tax = value * (i.propertyTaxPct ?? 0);
    const insurance = (i.insuranceAnnual ?? 0) * eg;
    const hoa = (i.hoaMonthly ?? 0) * 12 * eg;
    const utilities = (i.utilitiesMonthly ?? 0) * 12 * eg;
    return tax + insurance + hoa + utilities;
  };
  const operatingExpenses = (year: number) => fixedOpex(year) + grossRevenue(year) * variablePct;

  const outcome = computeHold({
    price,
    loanAmount,
    annualRate: rate,
    termYears: term,
    appreciation,
    grossRevenue,
    effectiveRevenue,
    operatingExpenses,
    totalCashInvested,
    sellingPct: sellingCostPct,
    holdYears,
  });

  // Break-even occupancy (year 1): solve cashFlow(occ) = 0.
  const marginPerRevenue = 1 - platformFee - variablePct;
  const fixedPlusDebt = fixedOpex(1) + outcome.debtService;
  const revNeeded = guardDiv(fixedPlusDebt, marginPerRevenue);
  const breakEvenOccupancy = adr > 0 ? guardDiv(revNeeded, adr * 365) : NaN;
  const revPAN = adr * effectiveOccupancy;

  const warnings: string[] = [
    'Occupancy here is scaled by a snow-index factor — a low-snow year compresses revenue directly. Stress the factor below 1.0 before underwriting.',
  ];
  const dscrVal = dscr(outcome.noi, outcome.debtService);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > effectiveOccupancy)
    warnings.push(`Snow-adjusted occupancy ${(effectiveOccupancy * 100).toFixed(0)}% is below break-even ${(breakEvenOccupancy * 100).toFixed(0)}% — this configuration loses money.`);
  if (Number.isFinite(dscrVal) && dscrVal < 1.2) warnings.push(`DSCR ${dscrVal.toFixed(2)}× is below 1.20.`);
  if (outcome.core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative.');

  return {
    metrics: {
      ...outcome.core,
      breakEvenOccupancy,
      effectiveOccupancy,
      revPAN,
    },
    projection: outcome.projection,
    warnings,
  };
}

export const snowpackIndexedStr: InvestmentModule = {
  id: 'snowpack-indexed-str',
  name: 'Snowpack-Indexed STR',
  category: 'Novel',
  tier: 'novel',
  blurb: 'Ski-town STR whose occupancy is driven by a snow-water-equivalent signal.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 620_000, min: 0, step: 5000, group: 'Financing', verify: true, help: 'Ski-town property. Verify against comps AND against snow-reliability of the specific mountain.' },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.30, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.075, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },
    { key: 'furnishingCost', label: 'Furnishing & setup', type: 'currency', unit: '$', default: 40_000, min: 0, step: 1000, group: 'Setup', help: 'Ski-property furnishing runs high (gear storage, hot tub, durable finishes). Up-front capex.' },

    { key: 'adr', label: 'Average daily rate', type: 'number', unit: '$/night', default: 320, min: 0, step: 5, group: 'Income', verify: true, help: 'Blended peak/off-peak ski-town ADR. Verify against booked comps.' },
    { key: 'baseOccupancy', label: 'Base occupancy (average snow year)', type: 'percent', unit: '%', default: 0.5, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Occupancy in a normal-snow year, before the snow-index adjustment.' },
    { key: 'snowIndexFactor', label: 'Snow-index factor', type: 'number', unit: 'x', default: 1.0, min: 0.4, max: 1.3, step: 0.05, group: 'Income', verify: true, help: 'Multiplier on occupancy from the SWE forecast. 1.0 = average snow year; below 1.0 = weak season. Verify against SNOTEL/SWE data.' },
    { key: 'platformFeePct', label: 'Platform fee', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.2, step: 0.005, group: 'Income' },
    { key: 'revGrowthPct', label: 'Revenue growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.010, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true },
    { key: 'insuranceAnnual', label: 'STR insurance', type: 'currency', unit: '$/yr', default: 3_000, min: 0, step: 100, group: 'Expenses', verify: true },
    { key: 'hoaMonthly', label: 'HOA dues', type: 'currency', unit: '$/mo', default: 250, min: 0, step: 25, group: 'Expenses', help: 'Ski condos and resort communities often carry substantial HOA dues.' },
    { key: 'utilitiesMonthly', label: 'Utilities', type: 'currency', unit: '$/mo', default: 300, min: 0, step: 20, group: 'Expenses', help: 'Winter heating in a ski town is a heavy line.' },
    { key: 'suppliesPct', label: 'Supplies & consumables', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.2, step: 0.005, group: 'Expenses', help: 'As a fraction of gross revenue.' },
    { key: 'managementPct', label: 'Management / co-host', type: 'percent', unit: '%', default: 0.20, min: 0, max: 0.4, step: 0.01, group: 'Expenses', verify: true },
    { key: 'maintenancePct', label: 'Maintenance & turnover', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.2, step: 0.005, group: 'Expenses', help: 'As a fraction of gross revenue.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', verify: true, help: 'Modest by assumption — ski-town values are cyclical and snow-dependent.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'breakEvenOccupancy', label: 'Break-even occupancy', unit: '%', higherIsBetter: false, help: 'Occupancy at which year-1 cash flow is zero. Lower is safer.' },
    { key: 'effectiveOccupancy', label: 'Snow-adjusted occupancy', unit: '%', higherIsBetter: true, help: 'Base occupancy × snow-index factor, capped at 95%.' },
    { key: 'revPAN', label: 'Revenue / available night', unit: '$/night', higherIsBetter: true, help: 'ADR × snow-adjusted occupancy — the blended nightly yield.' },
  ],
  compute,
  narrative: {
    strategy:
      'Operate a ski-town short-term rental, but underwrite occupancy off a **snow-water-equivalent (SWE) signal** rather than a flat guess: a strong snowpack forecast means a strong season, a weak one means empty weeks. The edge is measuring an asset the market cannot yet price: **a snowpack forecast read as a leading demand signal** — SNOTEL/SWE data that the market underweights when it prices ski properties on last year\'s bookings. Like any STR, the deal turns on **break-even occupancy**; here that break-even is measured against a snow-adjusted occupancy that a low-snow year can pull straight through the floor.',
    risks: [
      'Novelty risk: thin comps, uncertain exit liquidity, the thesis may simply be wrong — a snowpack signal may not translate cleanly into bookings, and the market may already price snow reliability.',
      'Climate and low-snow-year downside: warming trends and volatile seasons can structurally lower snowpack, shortening seasons and permanently compressing occupancy and value.',
      'Ski-town operating costs are high (HOA, winter utilities, remote management) and STR regulation in resort towns is tightening.',
      'Concentration and cyclicality: a single mountain\'s fortunes, resort ownership changes, or a bad snow year drive both income and resale at once.',
    ],
    opportunities: [
      'Underwriting to snow data can flag mountains with reliable snowpack (or snowmaking) that the market lumps in with marginal ones.',
      'Snowmaking capacity, high base elevation, and north-facing aspect can buffer low-snow years and support a premium.',
      'Off-season (summer) mountain tourism can diversify demand away from pure snow dependence.',
    ],
    regulatory:
      'Resort-town STR rules are among the strictest and fastest-changing — permit caps, primary-residence requirements, and outright bans are common. Verify the specific municipal and HOA rules, occupancy taxes, and any snowmaking/water-rights context before underwriting the snow thesis.',
    dataHooks: ['swe', 'snotel'],
  },
};
