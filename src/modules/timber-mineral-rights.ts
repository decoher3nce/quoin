import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, npv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Timber / Mineral Rights. Acquire a royalty or severance interest that pays an
// annual stream as the resource (timber stumpage, oil/gas, aggregate) is
// extracted. Unlike a rental, the income DECLINES with depletion: each year the
// remaining reserve — and the royalty it throws off — shrinks. The valuation
// question is the NPV of that declining extraction schedule plus whatever the land
// is worth once the resource is spent. Modeled as an income stream.

function compute(i: Record<string, number>): ComputeResult {
  const acquisitionCost = i.acquisitionCost ?? 0;
  const annualRoyaltyYear1 = i.annualRoyaltyYear1 ?? 0;
  const royaltyDeclinePct = i.royaltyDeclinePct ?? 0;
  const extractionYears = Math.round(i.extractionYears ?? 1);
  const discountRate = i.discountRate ?? 0;
  const residualLandValue = i.residualLandValue ?? 0;

  // Full declining extraction schedule: year y royalty depletes at royaltyDeclinePct.
  const fullSchedule: number[] = [];
  for (let y = 1; y <= extractionYears; y++) {
    fullSchedule.push(annualRoyaltyYear1 * Math.pow(1 - royaltyDeclinePct, y - 1));
  }

  const core = computeIncomeStream({
    capital: acquisitionCost,
    assetPrice: acquisitionCost,
    annualCashflows: fullSchedule,
    terminalValue: residualLandValue,
    debtServiceAnnual: 0,
    noiAnnual: annualRoyaltyYear1,
  });

  // Full-schedule NPV across the entire extraction life (not just the 5-year IRR window).
  const npvAtDiscount = npv(discountRate, [-acquisitionCost, ...fullSchedule, residualLandValue]);
  const royaltyYield = guardDiv(annualRoyaltyYear1, acquisitionCost);

  const warnings: string[] = [
    'Royalty income declines every year as the reserve depletes — this is a wasting asset, not a growing one.',
  ];
  if (npvAtDiscount < 0)
    warnings.push(
      `At a ${(discountRate * 100).toFixed(0)}% discount rate the full-schedule NPV is negative — the acquisition price exceeds the discounted value of the reserve.`,
    );

  return {
    metrics: {
      ...core,
      npvAtDiscount,
      royaltyYield,
      reserveLifeYears: extractionYears,
    },
    warnings,
  };
}

export const timberMineralRights: InvestmentModule = {
  id: 'timber-mineral-rights',
  name: 'Timber / Mineral Rights',
  category: 'Land',
  tier: 'creative',
  blurb: 'Declining royalty/severance stream from a depleting reserve; NPV-driven.',
  params: [
    { key: 'acquisitionCost', label: 'Acquisition cost', type: 'currency', unit: '$', default: 300_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'All-in cost of the royalty/severance interest. Verify against a reserve report and comparable royalty sales.' },
    { key: 'residualLandValue', label: 'Residual land value', type: 'currency', unit: '$', default: 120_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'Terminal value of the surface/land once the resource is depleted. Verify with a land appraisal net of any restoration obligation.' },

    { key: 'annualRoyaltyYear1', label: 'Year-1 royalty', type: 'currency', unit: '$/yr', default: 48_000, min: 0, step: 1000, group: 'Income', verify: true, help: 'First-year royalty/severance income. Verify against the reserve report, contracted royalty rate, and current commodity price.' },
    { key: 'royaltyDeclinePct', label: 'Annual depletion decline', type: 'percent', unit: '%', default: 0.10, min: 0, max: 0.5, step: 0.01, group: 'Income', verify: true, help: 'Annual decline in royalty as the reserve depletes (oil/gas decline curves and timber drawdown are steep — verify with the reserve engineer).' },
    { key: 'extractionYears', label: 'Reserve life', type: 'integer', unit: 'yr', default: 12, min: 1, max: 50, step: 1, group: 'Income', help: 'Years over which the reserve is extracted. Estimated, not certain.' },

    { key: 'discountRate', label: 'Discount rate', type: 'percent', unit: '%', default: 0.10, min: 0, max: 0.4, step: 0.005, group: 'Valuation', help: 'Rate used to discount the extraction schedule to present value. The NPV is highly sensitive to this.' },
  ],
  metrics: [
    { key: 'npvAtDiscount', label: 'NPV at discount rate', unit: '$', higherIsBetter: true, help: 'Net present value of the full extraction schedule plus residual land, less acquisition cost, at the chosen discount rate.' },
    { key: 'royaltyYield', label: 'Year-1 royalty yield', unit: '%', higherIsBetter: true, help: 'Year-1 royalty / acquisition cost. Overstates the true return because income declines thereafter.' },
    { key: 'reserveLifeYears', label: 'Reserve life', unit: 'yr', higherIsBetter: true, help: 'Estimated years of extraction before depletion.' },
  ],
  compute,
  narrative: {
    strategy:
      'Acquire a **royalty or severance interest** — timber stumpage, oil/gas, or aggregate — that pays an annual stream as the resource is extracted. The defining feature is **depletion**: income falls every year as the reserve shrinks, so the year-1 yield flatters the true return. The right way to value it is the **NPV of the declining extraction schedule** plus whatever the land is worth once the resource is spent. Because the payout is tied to commodity extraction, this cash flow is often **uncorrelated** with real-estate cycles.',
    risks: [
      'Depletion: the income stream declines by design, and the reserve estimate driving the schedule can be wrong.',
      'Commodity-price exposure: royalties scale with volatile timber/energy/aggregate prices that no lease can fully fix.',
      'Reserve-estimate uncertainty: recoverable volume and decline rate are engineering estimates with wide error bars.',
      'Discount-rate sensitivity: the NPV swings sharply with the discount rate, so a modest re-rating of risk changes the answer materially.',
    ],
    opportunities: [
      'Diversification: extraction royalties are often uncorrelated with housing and commercial real-estate cycles.',
      'Optionality: higher commodity prices, new extraction technology, or added reserves can extend life and lift royalties above the modeled decline.',
      'Residual land value can provide a floor once the resource is depleted, especially where surface use has independent worth.',
    ],
    regulatory:
      'Verify title to the mineral/timber estate (surface and subsurface can be severed), the royalty rate and deduction terms, extraction permits, and any restoration or reclamation obligations before relying on the schedule.',
    dataHooks: ['ndvi-cropland', 'insar-velocity'],
  },
};
