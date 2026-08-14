import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Mobile Home Park. Two revenue streams: lot (pad) rent from tenant-owned homes,
// plus a premium on any park-owned homes rented out. Occupancy is already baked
// into the occupied-pad count; a small collections-loss haircut turns gross into
// effective. Expenses run as a ratio of EGI. Tenant-owned homes make turnover
// extremely low; infrastructure capex and lot-rent regulation are the risks.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 25;
  const appreciation = i.appreciationPct ?? 0;

  const totalPads = i.totalPads ?? 0;
  const occupiedPads = i.occupiedPads ?? 0;
  const padRentMonthly = i.padRentMonthly ?? 0;
  const parkOwnedHomes = i.parkOwnedHomes ?? 0;
  const homeRentPremiumMonthly = i.homeRentPremiumMonthly ?? 0;
  const collectionLossPct = i.collectionLossPct ?? 0;
  const expenseRatioOfEgi = i.expenseRatioOfEgi ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const loanAmount = price * (1 - downPct);
  const totalCashInvested = price * downPct + price * (i.closingCostPct ?? 0);

  const grossRevenue = (y: number) =>
    (occupiedPads * padRentMonthly * 12 + parkOwnedHomes * homeRentPremiumMonthly * 12) *
    Math.pow(1 + rentGrowth, y - 1);
  // Occupancy is already in the occupied-pad count; apply a small collections loss.
  const effectiveRevenue = (y: number) => grossRevenue(y) * (1 - collectionLossPct);
  // Expenses anchor at year-1 EGI × ratio, then drift up with expense inflation
  // only (effectiveRevenue(1), not (y) — otherwise opex compounds rent growth too).
  const operatingExpenses = (y: number) =>
    effectiveRevenue(1) * expenseRatioOfEgi * Math.pow(1 + expenseGrowth, y - 1);

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
      pricePerPad: guardDiv(price, totalPads),
      occupancy: guardDiv(occupiedPads, totalPads),
      expenseRatio: expenseRatioOfEgi,
    },
    projection,
    warnings,
  };
}

export const mobileHomePark: InvestmentModule = {
  id: 'mobile-home-park',
  name: 'Mobile Home Park',
  category: 'Commercial',
  tier: 'creative',
  blurb: 'Lot-rent park: tenant-owned homes, very low turnover, expense-ratio opex.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 2_200_000, min: 0, step: 25_000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.30, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.073, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Verify against a current commercial rate sheet.' },
    { key: 'loanTermYears', label: 'Loan term / amortization', type: 'integer', unit: 'yr', default: 25, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'totalPads', label: 'Total pads', type: 'integer', unit: 'count', default: 90, min: 1, step: 1, group: 'Income' },
    { key: 'occupiedPads', label: 'Occupied pads', type: 'integer', unit: 'count', default: 80, min: 0, step: 1, group: 'Income', verify: true, help: 'Pads currently paying lot rent.' },
    { key: 'padRentMonthly', label: 'Lot (pad) rent', type: 'currency', unit: '$/mo', default: 425, min: 0, step: 10, group: 'Income', verify: true, help: 'Monthly lot rent for a tenant-owned home. Verify against local park comps.' },
    { key: 'parkOwnedHomes', label: 'Park-owned homes', type: 'integer', unit: 'count', default: 12, min: 0, step: 1, group: 'Income', help: 'Homes the park owns and rents out (counted within occupied pads).' },
    { key: 'homeRentPremiumMonthly', label: 'Home rent premium', type: 'currency', unit: '$/mo', default: 350, min: 0, step: 10, group: 'Income', help: 'Extra monthly rent above lot rent for a park-owned home.' },
    { key: 'collectionLossPct', label: 'Collections loss', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.2, step: 0.005, group: 'Income', help: 'Small vacancy/bad-debt haircut on scheduled rent.' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.035, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'expenseRatioOfEgi', label: 'Expense ratio of EGI', type: 'percent', unit: '%', default: 0.38, min: 0, max: 1, step: 0.01, group: 'Expenses', help: 'Operating expenses as a fraction of effective gross income.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.025, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'pricePerPad', label: 'Price per pad', unit: '$', higherIsBetter: false, help: 'Purchase price / total pads.' },
    { key: 'occupancy', label: 'Occupancy', unit: '%', higherIsBetter: true, help: 'Occupied pads / total pads.' },
    { key: 'expenseRatio', label: 'Expense ratio', unit: '%', higherIsBetter: false, help: 'Operating expenses as a fraction of effective gross income.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own the land under a mobile home park and collect **lot rent** from tenant-owned homes, plus a premium on any homes the park itself rents. Because residents own their homes and moving one costs thousands of dollars, turnover is **extremely low and rent is remarkably sticky** — a defensive, recession-resilient cash flow. The catch is the **infrastructure**: private water, sewer, and roads are the landlord’s to maintain and replace, and lot-rent increases are increasingly regulated.',
    risks: [
      'Infrastructure capex: aging private water/sewer and roads are expensive, lumpy, and non-optional.',
      'Lot-rent regulation and rent control are spreading and can cap the primary growth lever.',
      'Park-owned homes add operational and maintenance burden that pure lot-rent parks avoid.',
      'Financing and buyer pool can thin for older parks with master-metered utilities or deferred maintenance.',
    ],
    opportunities: [
      'Tenant-owned homes make the income base exceptionally sticky and low-turnover.',
      'Converting master-metered utilities to sub-metered (billing back water/sewer) lifts NOI materially.',
      'Selling park-owned homes to residents shifts them to lot-rent tenants, cutting the maintenance burden.',
    ],
    regulatory:
      'Verify utility metering and responsibility, any local rent-control or lot-rent notice rules, and the status of private water/sewer permits before underwriting rent growth.',
  },
};
