import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, npv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Billboard Easement. Control a billboard easement/permit and earn advertising
// income against modest operating cost. The scarcity comes from regulation: new
// billboards are heavily restricted, so an existing, permitted board is a durable,
// high-margin, near-passive coupon. Unlevered here — dscr is NaN; cap rate is the
// current yield on the easement cost.

function compute(i: Record<string, number>): ComputeResult {
  const easementAcquisitionCost = i.easementAcquisitionCost ?? 0;
  const annualAdRevenueGross = i.annualAdRevenueGross ?? 0;
  const boardOccupancy = i.boardOccupancy ?? 0;
  const operatingCostPct = i.operatingCostPct ?? 0;
  const escalationPct = i.escalationPct ?? 0;
  const permitTermYears = Math.round(i.permitTermYears ?? 20);
  const appreciationPct = i.appreciationPct ?? 0;
  const discountRate = i.discountRate ?? 0;
  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const year1Income = annualAdRevenueGross * boardOccupancy * (1 - operatingCostPct);
  const capital = easementAcquisitionCost;
  const assetPrice = easementAcquisitionCost;

  const annualCashflows = Array.from({ length: 5 }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const terminalValue =
    easementAcquisitionCost * Math.pow(1 + appreciationPct, holdYears) * (1 - sellingCostPct);

  const core = computeIncomeStream({
    capital,
    assetPrice,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: year1Income,
  });

  const fullTermCashflows = Array.from({ length: permitTermYears }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const npvOfIncome = npv(discountRate, [-capital, ...fullTermCashflows, terminalValue]);

  return {
    metrics: {
      ...core,
      currentYield: guardDiv(year1Income, easementAcquisitionCost),
      effectiveOccupancy: boardOccupancy,
      npvOfIncome,
    },
  };
}

export const billboardEasement: InvestmentModule = {
  id: 'billboard-easement',
  name: 'Billboard Easement',
  category: 'Infrastructure',
  tier: 'creative',
  blurb: 'Control a billboard easement earning high-margin advertising income.',
  params: [
    { key: 'easementAcquisitionCost', label: 'Easement acquisition cost', type: 'currency', unit: '$', default: 200_000, min: 0, step: 5_000, group: 'Acquisition', verify: true, help: 'Cost to acquire the easement/permit position.' },
    { key: 'annualAdRevenueGross', label: 'Gross ad revenue', type: 'currency', unit: '$/yr', default: 36_000, min: 0, step: 1_000, group: 'Income', verify: true, help: 'Gross annual advertising revenue at full occupancy. Verify against actual ad contracts.' },
    { key: 'boardOccupancy', label: 'Board occupancy', type: 'percent', unit: '%', default: 0.85, min: 0, max: 1, step: 0.05, group: 'Income', help: 'Fraction of ad faces sold on average.' },
    { key: 'operatingCostPct', label: 'Operating cost', type: 'percent', unit: '%', default: 0.15, min: 0, max: 0.5, step: 0.01, group: 'Income', help: 'Maintenance, electricity, lease-to-landowner, and sales cost as a fraction of revenue.' },
    { key: 'escalationPct', label: 'Revenue escalation', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Income', verify: true },
    { key: 'permitTermYears', label: 'Permit term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 40, step: 1, group: 'Income', verify: true, help: 'Effective permit/lease horizon.' },

    { key: 'appreciationPct', label: 'Position appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'discountRate', label: 'Discount rate', type: 'percent', unit: '%', default: 0.09, min: 0, max: 0.3, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.15, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'currentYield', label: 'Current yield', unit: '%', higherIsBetter: true, help: 'Year-1 net ad income / easement acquisition cost.' },
    { key: 'effectiveOccupancy', label: 'Effective occupancy', unit: '%', higherIsBetter: true, help: 'Average fraction of ad faces sold.' },
    { key: 'npvOfIncome', label: 'NPV of income', unit: '$', higherIsBetter: true, help: 'Present value of full-term net ad income plus reversion, net of acquisition.' },
  ],
  compute,
  narrative: {
    strategy:
      'Control a permitted billboard easement and collect **high-margin advertising income** with light operations. The durable edge is regulatory scarcity: **new billboards are heavily restricted**, so an existing permit is close to irreplaceable and the income behaves like a protected, near-passive coupon. The play is buying that scarcity and, where allowed, upgrading the board to multiply revenue.',
    risks: [
      'Ad-market cyclicality: local advertising spend falls in downturns, dropping occupancy and revenue together.',
      'Permit and lease-renewal risk — many outdoor-advertising permits are non-renewable or tied to a landowner lease that can lapse.',
      'Regulatory tightening or removal orders (scenic/highway-beautification rules) can impair or extinguish a board.',
      'Concentration: a single board’s income depends on one location and a handful of advertisers.',
    ],
    opportunities: [
      'Digital conversion: replacing a static face with a digital board can multiply revenue by rotating multiple advertisers.',
      'Regulatory scarcity means existing permits carry real, defensible value that new supply cannot erode.',
      'High operating margins make incremental occupancy gains fall almost entirely to the bottom line.',
    ],
    regulatory:
      'Outdoor-advertising permits are tightly regulated and often non-renewable — federal Highway Beautification Act rules plus state and local sign codes govern placement, size, digital conversion, and whether a removed board can ever be rebuilt.',
    dataHooks: ['viirs-radiance'],
  },
};
