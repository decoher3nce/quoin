import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr, guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// Short-Term Rental — Mountain / Ski. Same nightly-revenue engine as str-metro,
// but the demand profile is seasonal and snow-dependent: a higher ADR earned in a
// concentrated peak season against a lower *blended* annual occupancy. Furnishing
// and insurance both run higher (hot-tub, ski storage, wildfire/winter-weather
// exposure). Break-even occupancy is the make-or-break number.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const closingPct = i.closingCostPct ?? 0;

  const adr = i.adr ?? 0;
  const occ = i.occupancyPct ?? 0;
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

  const grossRevenue = (y: number) => adr * 365 * occ * Math.pow(1 + revGrowth, y - 1);
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

  // Break-even occupancy (year 1): the blended occupancy at which cash flow is zero.
  const marginPerRevenue = 1 - platformFee - variablePct;
  const revNeeded = guardDiv(fixedOpex(1) + debtService, marginPerRevenue);
  const breakEvenOccupancy = adr > 0 ? guardDiv(revNeeded, adr * 365) : NaN;
  const revPAN = adr * occ;

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > occ)
    warnings.push(`Modeled blended occupancy ${(occ * 100).toFixed(0)}% is below break-even ${(breakEvenOccupancy * 100).toFixed(0)}% — this configuration loses money.`);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > 0.75)
    warnings.push(`Break-even occupancy ${(breakEvenOccupancy * 100).toFixed(0)}% leaves little cushion for a poor snow year.`);
  if (Number.isFinite(d) && d < 1.2) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.20.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative.');

  return {
    metrics: { ...core, breakEvenOccupancy, revPAN },
    projection,
    warnings,
  };
}

export const strMountain: InvestmentModule = {
  id: 'str-mountain',
  name: 'Short-Term Rental — Mountain / Ski',
  category: 'Hospitality',
  tier: 'creative',
  blurb: 'Seasonal ski-town nightly rental: high ADR, lower blended occupancy, snow-dependent.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 620_000, min: 0, step: 5000, group: 'Financing', verify: true, help: 'Resort-town pricing carries a lifestyle premium. Verify against recent comps in the exact town.' },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.075, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'furnishingCost', label: 'Furnishing & setup', type: 'currency', unit: '$', default: 45_000, min: 0, step: 1000, group: 'Setup', help: 'Mountain guests expect a hot tub, ski storage, and durable furnishings — capex runs above a metro unit.' },
    { key: 'reserveCash', label: 'Operating reserve', type: 'currency', unit: '$', default: 12_000, min: 0, step: 500, group: 'Setup', help: 'Deeper cushion for a highly seasonal cash-flow curve.' },

    { key: 'adr', label: 'Average daily rate', type: 'number', unit: '$/night', default: 340, min: 0, step: 5, group: 'Income', verify: true, help: 'Peak-season ADR is high but sparse. Verify the blended annual rate against AirDNA for the town.' },
    { key: 'occupancyPct', label: 'Blended occupancy', type: 'percent', unit: '%', default: 0.55, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Annual paid-nights / 365. Ski demand is concentrated; shoulder and mud seasons drag the blend down.' },
    { key: 'platformFeePct', label: 'Platform fee', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.2, step: 0.005, group: 'Income' },
    { key: 'revenueGrowthPct', label: 'Revenue growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.006, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true, help: 'Many mountain states have low effective rates; verify with the county assessor.' },
    { key: 'insuranceAnnual', label: 'STR insurance', type: 'currency', unit: '$/yr', default: 3_200, min: 0, step: 100, group: 'Expenses', verify: true, help: 'Wildfire and winter-weather exposure lift premiums well above a metro STR.' },
    { key: 'hoaMonthly', label: 'HOA dues', type: 'currency', unit: '$/mo', default: 250, min: 0, step: 25, group: 'Expenses', verify: true, help: 'Resort condos and gated communities often carry substantial dues.' },
    { key: 'utilitiesMonthly', label: 'Utilities', type: 'currency', unit: '$/mo', default: 420, min: 0, step: 20, group: 'Expenses', help: 'Winter heating and snow-melt loads push utilities higher.' },
    { key: 'suppliesPct', label: 'Supplies & consumables', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.2, step: 0.005, group: 'Expenses' },
    { key: 'managementPct', label: 'Management / co-host', type: 'percent', unit: '%', default: 0.22, min: 0, max: 0.4, step: 0.01, group: 'Expenses', verify: true, help: 'Remote resort towns often require full-service management with snow and hot-tub upkeep. Set to 0 if self-managing locally.' },
    { key: 'maintenancePct', label: 'Maintenance & turnover', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.2, step: 0.005, group: 'Expenses' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'breakEvenOccupancy', label: 'Break-even occupancy', unit: '%', higherIsBetter: false, help: 'Blended occupancy at which year-1 cash flow is zero. Lower is safer — critical in a snow-dependent market.' },
    { key: 'revPAN', label: 'Revenue / available night', unit: '$/night', higherIsBetter: true, help: 'ADR × blended occupancy — the annualized nightly yield.' },
  ],
  compute,
  narrative: {
    strategy:
      'Operate a furnished mountain home as a nightly rental in a ski/resort market. The economics invert the metro STR: a **high peak-season ADR** is earned against a **low blended annual occupancy**, because demand collapses in shoulder and mud seasons. A strong winter can carry the year, but the model is **snow-dependent and seasonally front-loaded** — cash flow arrives in bursts, so break-even occupancy and reserves matter more than the headline ADR.',
    risks: [
      'Snow dependence: a low-snow winter compresses both ADR and occupancy in the one season that drives the year.',
      'Seasonality concentrates cash flow — a soft peak cannot be recovered in the off-season.',
      'Resort towns are among the most aggressive STR regulators: primary-residence rules, permit caps, and HOA nightly-rental bans are common.',
      'Furnishing, insurance (wildfire/winter), and remote management all run higher than a metro STR, thinning margins.',
    ],
    opportunities: [
      'Peak-week ADR can be multiples of metro rates where a marquee resort anchors demand.',
      'Summer recreation (hiking, biking, festivals) can backfill the shoulder and lift blended occupancy.',
      'Ski-in/ski-out or amenity differentiation (hot tub, views) commands durable ADR premiums and repeat guests.',
    ],
    regulatory:
      'STR legality is the make-or-break variable and resort towns regulate hard. Verify town/county permit caps, primary-residence requirements, HOA nightly-rental bans, and lodging taxes BEFORE underwriting. Many desirable ski towns have frozen or capped new STR licenses.',
    dataHooks: ['swe'],
  },
};
