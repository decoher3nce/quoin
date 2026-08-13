import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv } from '../core/finance';
import { computeFlip } from './_shapes';

// Condo Conversion. Buy an apartment building as a single rental asset, legally
// subdivide it into for-sale condominium units (HOA formation, mapping/subdivision
// approval, unit upgrades), and sell per-door at retail. This is a FLIP play: the
// building is not held for stabilized NOI, so the operating-hold core metrics are
// NaN and render "—". The return lives in the "retail-vs-wholesale" spread — the
// premium of selling individual condos to owner-occupants over the whole-building
// value to a rental investor — net of the legal conversion cost and market-timing
// risk of absorbing the units.

function compute(i: Record<string, number>): ComputeResult {
  const acquisitionCost = i.acquisitionCost ?? 0;
  const numberOfUnits = i.numberOfUnits ?? 0;
  const conversionCostPerUnit = i.conversionCostPerUnit ?? 0;

  const financedPct = i.financedPct ?? 0;
  const rate = i.interestRate ?? 0;
  const projectMonths = Math.max(i.projectMonths ?? 1, 1);
  const monthlyCarry = i.monthlyCarry ?? 0;

  const avgCondoSalePrice = i.avgCondoSalePrice ?? 0;
  const sellingPct = i.sellingCostPct ?? 0;

  const conversionCost = conversionCostPerUnit * numberOfUnits;
  const totalCost = acquisitionCost + conversionCost;
  const loan = totalCost * financedPct;
  const interest = loan * rate * (projectMonths / 12); // interest-only bridge debt
  const carry = monthlyCarry * projectMonths;
  const cashInvested = totalCost * (1 - financedPct) + carry + interest;
  const exitValue = avgCondoSalePrice * numberOfUnits;

  const flip = computeFlip({
    exitValue,
    sellingCostPct: sellingPct,
    loanPayoff: loan,
    cashInvested,
    months: projectMonths,
  });

  const allInCostPerDoor = guardDiv(totalCost, numberOfUnits);
  const upliftPerDoor = avgCondoSalePrice - allInCostPerDoor;

  const warnings: string[] = [
    'Conversion play: the operating cash-flow metrics (cap rate, DSCR, cash-on-cash) are not applicable and render "—". Judge this on ROI, its annualization, and the margin of safety.',
  ];
  if (Number.isFinite(flip.marginOfSafety) && flip.marginOfSafety < 0.15)
    warnings.push(
      `Margin of safety ${(flip.marginOfSafety * 100).toFixed(0)}% is thin — a slow sell-through or a soft per-door price erases the retail premium.`,
    );
  if (flip.profit < 0) warnings.push('Modeled profit is negative at these assumptions.');
  warnings.push('Absorption matters: the model assumes all units sell at the average price. A stalled sell-through extends carry and compresses the annualized return.');

  return {
    metrics: {
      ...flip.core,
      profit: flip.profit,
      roi: flip.roi,
      annualizedRoi: flip.annualizedRoi,
      marginOfSafety: flip.marginOfSafety,
      upliftPerDoor,
      allInCostPerDoor,
    },
    warnings,
  };
}

export const condoConversion: InvestmentModule = {
  id: 'condo-conversion',
  name: 'Condo Conversion',
  category: 'ValueAdd',
  tier: 'creative',
  blurb: 'Buy an apartment building, legally convert to for-sale condos, sell per-door at retail.',
  params: [
    { key: 'acquisitionCost', label: 'Acquisition cost', type: 'currency', unit: '$', default: 3_000_000, min: 0, step: 25_000, group: 'Acquisition', verify: true, help: 'All-in purchase of the apartment building as a rental asset. Verify against comparable whole-building (per-unit rental) sales.' },
    { key: 'numberOfUnits', label: 'Number of units', type: 'integer', unit: 'count', default: 20, min: 1, step: 1, group: 'Acquisition', help: 'Doors in the building — the count you will convert and sell individually.' },

    { key: 'conversionCostPerUnit', label: 'Conversion cost / unit', type: 'currency', unit: '$', default: 45_000, min: 0, step: 1_000, group: 'Conversion', verify: true, help: 'Legal, subdivision/mapping, HOA formation, and per-unit upgrades. Verify with land-use counsel and a GC — legal and entitlement work drives this as much as construction.' },

    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.65, min: 0, max: 0.9, step: 0.05, group: 'Financing', help: 'Share of total project cost covered by bridge debt.' },
    { key: 'interestRate', label: 'Loan rate (interest-only)', type: 'percent', unit: '%', default: 0.095, min: 0, max: 0.3, step: 0.001, group: 'Financing', verify: true, help: 'Bridge rate, interest-only over the project. Verify current terms and points.' },
    { key: 'projectMonths', label: 'Project duration', type: 'integer', unit: 'count', default: 20, min: 1, max: 120, step: 1, group: 'Financing', help: 'Months from acquisition through full sell-through. Subdivision approval and absorption pace are the biggest swing variables.' },
    { key: 'monthlyCarry', label: 'Monthly carry', type: 'currency', unit: '$/mo', default: 12_000, min: 0, step: 500, group: 'Financing', help: 'Taxes, insurance, and building operating costs (net of any interim rent) while units are prepared and sold.' },

    { key: 'avgCondoSalePrice', label: 'Avg condo sale price', type: 'currency', unit: '$', default: 260_000, min: 0, step: 5_000, group: 'Exit', verify: true, help: 'Average retail price per converted unit to an owner-occupant. Verify against resale comps for comparable condos in the submarket.' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.15, step: 0.005, group: 'Exit', help: 'Brokerage, marketing, and closing across the individual unit sales.' },
  ],
  metrics: [
    { key: 'profit', label: 'Project profit', unit: '$', higherIsBetter: true, help: 'Aggregate net unit-sale proceeds minus all cash invested (equity + carry + interest).' },
    { key: 'roi', label: 'Return on investment', unit: '%', higherIsBetter: true, help: 'Profit / cash invested over the whole project.' },
    { key: 'annualizedRoi', label: 'Annualized ROI', unit: '%', higherIsBetter: true, help: 'ROI annualized over the project duration — comparable to a yearly return.' },
    { key: 'marginOfSafety', label: 'Margin of safety', unit: '%', higherIsBetter: true, help: 'Cushion between the aggregate modeled exit and the break-even exit, as a fraction of the exit.' },
    { key: 'upliftPerDoor', label: 'Uplift per door', unit: '$', higherIsBetter: true, help: 'Average condo sale price minus all-in cost per door — the retail-vs-wholesale premium per unit.' },
    { key: 'allInCostPerDoor', label: 'All-in cost / door', unit: '$', higherIsBetter: false, help: 'Total project cost / number of units — the basis to compare against the per-unit retail price.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy an apartment building at its **whole-building (rental) value**, legally convert the units into for-sale condominiums, and sell them **per-door at retail** to owner-occupants. The profit is the **retail-vs-wholesale spread**: a stack of individually owned condos is worth more than the same building valued on its rental cap rate. That spread is earned by navigating a heavy legal conversion — subdivision approval, HOA formation, tenant-protection compliance — and then absorbing the units into the market before carry eats the premium.',
    risks: [
      'Legal conversion process: subdivision/mapping approval and HOA formation are slow, and tenant-protection laws (relocation, right of first refusal) add cost and time in many cities.',
      'Absorption and sell-through: the model assumes every unit sells at the average price; a slow market strands unsold inventory and extends carry.',
      'Market-timing risk — the exit spans the full sell-through window, so a mid-project downturn hits both per-door price and pace.',
      'Per-door retail pricing can compress if new condo supply or high mortgage rates thin the owner-occupant buyer pool.',
    ],
    opportunities: [
      'The per-door retail premium over whole-building rental value is the core value-creation lever — a real arbitrage where the spread is wide.',
      'Phased sales pull cash forward and let you pay down the bridge loan as units close, de-risking the back half.',
      'A fallback to rent unsold units backstops absorption risk if the for-sale market softens mid-project.',
    ],
    regulatory:
      'Condo conversion is heavily regulated in many cities — tenant relocation assistance, right of first refusal for sitting tenants, notice periods, and subdivision/map approval can all gate the project. Verify the specific local conversion ordinance and tenant-protection rules with land-use counsel BEFORE underwriting; they can add cost, add years, or bar conversion outright.',
    dataHooks: ['viirs-radiance'],
  },
};
