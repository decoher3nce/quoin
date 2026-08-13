import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, npv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Datacenter Land. Land positioned for a data center, where value is driven far
// more by POWER availability and fiber proximity than by any ground rent. Pre-lease,
// the income is thin or zero; the thesis lives in a sharp re-rating if power and
// interconnection get secured. Modest lease income, dominant terminal value.
// Unlevered here — dscr is NaN; cap rate is the (small) yield on cost.

function compute(i: Record<string, number>): ComputeResult {
  const landPurchasePrice = i.landPurchasePrice ?? 0;
  const acres = i.acres ?? 1;
  const groundLeaseAnnualIfLeased = i.groundLeaseAnnualIfLeased ?? 0;
  const escalationPct = i.escalationPct ?? 0;
  const leaseTermYears = Math.round(i.leaseTermYears ?? 20);
  const powerEntitlementAppreciationPct = i.powerEntitlementAppreciationPct ?? 0;
  const discountRate = i.discountRate ?? 0;
  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const year1Income = groundLeaseAnnualIfLeased;
  const capital = landPurchasePrice;
  const assetPrice = landPurchasePrice;

  const annualCashflows = Array.from({ length: 5 }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  // Terminal value is the thesis: power/interconnection entitlement re-rates the land.
  const terminalValue =
    landPurchasePrice * Math.pow(1 + powerEntitlementAppreciationPct, holdYears) * (1 - sellingCostPct);

  const core = computeIncomeStream({
    capital,
    assetPrice,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: year1Income,
  });

  const fullTermCashflows = Array.from({ length: leaseTermYears }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const npvOfLease = npv(discountRate, [-capital, ...fullTermCashflows, terminalValue]);

  const warnings: string[] = [
    'The return is dominated by the power-entitlement appreciation assumption, not the lease income — re-rate it only if grid interconnection is credibly secured.',
  ];

  return {
    metrics: {
      ...core,
      yieldOnCost: guardDiv(year1Income, landPurchasePrice),
      pricePerAcre: guardDiv(landPurchasePrice, acres),
      npvOfLease,
    },
    warnings,
  };
}

export const datacenterLand: InvestmentModule = {
  id: 'datacenter-land',
  name: 'Datacenter Land',
  category: 'Infrastructure',
  tier: 'creative',
  blurb: 'Land positioned for a data center; value driven by power and fiber access.',
  params: [
    { key: 'landPurchasePrice', label: 'Land purchase price', type: 'currency', unit: '$', default: 1_500_000, min: 0, step: 25_000, group: 'Acquisition', verify: true, help: 'All-in cost to buy the parcel.' },
    { key: 'acres', label: 'Parcel size', type: 'number', unit: 'count', default: 50, min: 1, step: 5, group: 'Acquisition', help: 'Acres.' },
    { key: 'groundLeaseAnnualIfLeased', label: 'Ground lease income', type: 'currency', unit: '$/yr', default: 90_000, min: 0, step: 5_000, group: 'Income', verify: true, help: 'Annual ground rent if/when leased — may be low or zero pre-lease.' },
    { key: 'escalationPct', label: 'Rent escalation', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.1, step: 0.005, group: 'Income', verify: true },
    { key: 'leaseTermYears', label: 'Lease term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 40, step: 1, group: 'Income', verify: true },

    { key: 'powerEntitlementAppreciationPct', label: 'Power-entitlement appreciation', type: 'percent', unit: '%', default: 0.10, min: -0.1, max: 0.3, step: 0.01, group: 'Exit', verify: true, help: 'The thesis: re-rate this up sharply only if power/interconnection is secured; down if it is not.' },
    { key: 'discountRate', label: 'Discount rate', type: 'percent', unit: '%', default: 0.10, min: 0, max: 0.3, step: 0.005, group: 'Exit', help: 'High to reflect speculative timing and entitlement risk.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.15, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'yieldOnCost', label: 'Yield on cost', unit: '%', higherIsBetter: true, help: 'Year-1 ground rent / land purchase price. Thin or zero pre-lease.' },
    { key: 'pricePerAcre', label: 'Price per acre', unit: '$', higherIsBetter: false, help: 'Land purchase price / acres.' },
    { key: 'npvOfLease', label: 'NPV of lease', unit: '$', higherIsBetter: true, help: 'Present value of full-term ground rent plus power-entitled land reversion, net of purchase.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy land positioned for a data center, where the value is driven by **power availability and fiber proximity** far more than by ground rent. The scarce asset is grid interconnection — a queue position for large-load power, plus fiber routes and cooling water — and securing it can re-rate the land dramatically. Pre-lease income is modest, so the **appreciation thesis dominates** and the modeled lease is almost incidental to the return.',
    risks: [
      'Speculative timing: without secured power, the land can sit for years earning little while carrying cost accrues.',
      'Entitlement risk — interconnection-queue position, zoning, water, and fiber access can all fail to materialize.',
      'Concentration in a single large thesis: the outcome hinges on one power/interconnection catalyst, not a diversified income base.',
      'Hyperscaler demand is real but lumpy; a shift in siting preferences or a grid-capacity constraint can strand a parcel.',
    ],
    opportunities: [
      'Hyperscaler and AI compute demand is a powerful, durable tailwind for well-sited, power-adjacent land.',
      'Securing grid interconnection or a power entitlement can re-rate the land far beyond passive appreciation.',
      'Fiber proximity and cooling-water access compound scarcity, widening the buyer pool at exit.',
    ],
    regulatory:
      'Value hinges on utility interconnection-queue rules, large-load power-availability studies, zoning for data-center use, and water rights — verify each with the utility and county before relying on the entitlement re-rating.',
    dataHooks: ['fiber-distance'],
  },
};
