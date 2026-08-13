import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv } from '../core/finance';
import { computeFlip } from './_shapes';

// Entitled Lot Development. Buy raw land, entitle it (rezone / plat / permit) and
// horizontally develop it (grading, roads, water/sewer/dry utilities) into finished
// lots, then sell the lots. This is a FLIP/development play: there is no stabilized
// NOI, so the operating-hold core metrics are NaN and render "—". The return lives
// entirely in the value created by taking land from raw to finished, net of the
// time and capital it takes to get entitlements and absorb the inventory.

function compute(i: Record<string, number>): ComputeResult {
  const landCost = i.landCost ?? 0;
  const lotsCreated = i.lotsCreated ?? 0;
  const entitlementCost = i.entitlementCost ?? 0;
  const horizontalDevCostPerLot = i.horizontalDevCostPerLot ?? 0;

  const financedPct = i.financedPct ?? 0;
  const interestRate = i.interestRate ?? 0;
  const projectMonths = i.projectMonths ?? 1;
  const monthlyCarry = i.monthlyCarry ?? 0;

  const avgLotSalePrice = i.avgLotSalePrice ?? 0;
  const sellThroughPct = i.sellThroughPct ?? 0;
  const sellingCostPct = i.sellingCostPct ?? 0;

  const totalDevCost = landCost + entitlementCost + horizontalDevCostPerLot * lotsCreated;
  const loan = totalDevCost * financedPct;
  const interest = loan * interestRate * (projectMonths / 12);
  const carry = monthlyCarry * projectMonths;
  const cashInvested = totalDevCost * (1 - financedPct) + carry + interest;
  const exitValue = avgLotSalePrice * lotsCreated * sellThroughPct;

  const flip = computeFlip({
    exitValue,
    sellingCostPct,
    loanPayoff: loan,
    cashInvested,
    months: projectMonths,
  });

  const profitPerLot = guardDiv(flip.profit, lotsCreated);
  const costToCompletePerLot = guardDiv(
    entitlementCost + horizontalDevCostPerLot * lotsCreated,
    lotsCreated,
  );

  const warnings: string[] = [
    'Development play: the operating cash-flow metrics (cap rate, DSCR, cash-on-cash) are not applicable and render "—". Judge this on ROI, its annualization, and the margin of safety.',
  ];
  if (Number.isFinite(flip.marginOfSafety) && flip.marginOfSafety < 0.15)
    warnings.push(
      `Margin of safety ${(flip.marginOfSafety * 100).toFixed(0)}% is thin for a multi-year entitlement project — small absorption or lot-price misses can erase the profit.`,
    );
  if (flip.profit < 0) warnings.push('Modeled profit is negative at these assumptions.');

  return {
    metrics: {
      ...flip.core,
      profit: flip.profit,
      roi: flip.roi,
      annualizedRoi: flip.annualizedRoi,
      marginOfSafety: flip.marginOfSafety,
      profitPerLot,
      costToCompletePerLot,
    },
    warnings,
  };
}

export const entitledLotDev: InvestmentModule = {
  id: 'entitled-lot-dev',
  name: 'Entitled Lot Development',
  category: 'Land',
  tier: 'creative',
  blurb: 'Raw land → entitle + horizontally develop → sell finished lots.',
  params: [
    { key: 'landCost', label: 'Raw land cost', type: 'currency', unit: '$', default: 400_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'All-in acquisition of the raw parcel. Verify against recent raw-land comps in the exact submarket.' },
    { key: 'acres', label: 'Parcel size', type: 'number', unit: 'count', default: 20, min: 0.1, step: 1, group: 'Acquisition', help: 'Acres. Yield (lots/acre) depends on zoning, topography, and required open space.' },

    { key: 'lotsCreated', label: 'Finished lots created', type: 'integer', unit: 'count', default: 40, min: 1, step: 1, group: 'Development', help: 'Sellable finished lots after entitlement — net of roads, detention, and open space.' },
    { key: 'entitlementCost', label: 'Entitlement cost', type: 'currency', unit: '$', default: 350_000, min: 0, step: 5000, group: 'Development', verify: true, help: 'Rezoning, platting, engineering, impact/permit fees, legal. Verify with the jurisdiction; timelines and fees vary widely.' },
    { key: 'horizontalDevCostPerLot', label: 'Horizontal dev cost / lot', type: 'currency', unit: '$', default: 35_000, min: 0, step: 1000, group: 'Development', verify: true, help: 'Grading, roads, water/sewer/storm, dry utilities per lot. Verify against a civil engineer estimate.' },

    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.55, min: 0, max: 0.9, step: 0.05, group: 'Financing', help: 'Acquisition & development (A&D) loans typically fund a portion of total project cost.' },
    { key: 'interestRate', label: 'A&D loan rate', type: 'percent', unit: '%', default: 0.10, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Land development loans price above stabilized mortgages. Verify against a current rate sheet.' },
    { key: 'projectMonths', label: 'Project duration (months)', type: 'integer', default: 30, min: 1, max: 120, step: 1, group: 'Financing', help: 'Months from acquisition through full sell-through. Entitlement time is the biggest swing variable.' },
    { key: 'monthlyCarry', label: 'Monthly carry', type: 'currency', unit: '$/mo', default: 4_000, min: 0, step: 250, group: 'Financing', help: 'Taxes, insurance, overhead, and soft carry while the project runs.' },

    { key: 'avgLotSalePrice', label: 'Avg finished lot price', type: 'currency', unit: '$', default: 85_000, min: 0, step: 1000, group: 'Exit', verify: true, help: 'Verify against recent finished-lot sales to builders in the submarket, not retail home prices.' },
    { key: 'sellThroughPct', label: 'Sell-through', type: 'percent', unit: '%', default: 1.0, min: 0, max: 1, step: 0.05, group: 'Exit', help: 'Fraction of lots absorbed within the project window. Absorption pace is a core risk.' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.15, step: 0.005, group: 'Exit', help: 'Brokerage and closing on lot sales.' },
  ],
  metrics: [
    { key: 'profit', label: 'Project profit', unit: '$', higherIsBetter: true, help: 'Net sale proceeds minus all cash invested (equity + carry + interest).' },
    { key: 'roi', label: 'Return on investment', unit: '%', higherIsBetter: true, help: 'Profit / cash invested over the whole project.' },
    { key: 'annualizedRoi', label: 'Annualized ROI', unit: '%', higherIsBetter: true, help: 'ROI annualized over the project duration — comparable to a yearly return.' },
    { key: 'marginOfSafety', label: 'Margin of safety', unit: '%', higherIsBetter: true, help: 'Cushion between the modeled exit and the break-even exit, as a fraction of the exit.' },
    { key: 'profitPerLot', label: 'Profit per lot', unit: '$', higherIsBetter: true, help: 'Project profit / lots created.' },
    { key: 'costToCompletePerLot', label: 'Cost to complete / lot', unit: '$', higherIsBetter: false, help: 'Entitlement plus horizontal development cost per lot — the spend to turn raw land into a finished lot.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy raw land, take it through **entitlement** (rezoning, platting, permits) and **horizontal development** (grading, roads, utilities), and sell the resulting finished lots — typically to homebuilders. The profit is pure **value creation**: a finished, entitled lot is worth far more than its pro-rata share of raw dirt. But that value is unlocked only after a long, uncertain approval process and a heavy capital outlay, so this is a capital-intensive, cyclical development bet, not a passive hold.',
    risks: [
      'Entitlement time and outcome are the dominant risk — approvals can stretch for years or be denied, and carry accrues the entire time.',
      'Cost-to-complete overruns: civil work (utilities, detention, offsite improvements) routinely comes in above estimate.',
      'Absorption risk: if builders slow their lot takedowns, sell-through stretches and the annualized return collapses.',
      'Cyclicality: lot demand tracks the housing cycle and rates, so the exit market can soften mid-project.',
    ],
    opportunities: [
      'The raw-to-finished spread is the largest single value-creation lever in land — a successful entitlement re-rates the parcel sharply.',
      'Phasing and builder takedown contracts can de-risk absorption and pull cash forward.',
      'Securing entitlements before fully deploying development capital lets you sell paper (an entitled but unbuilt project) at a markup.',
    ],
    regulatory:
      'Zoning, plat approval, impact fees, and utility availability drive both the cost and the timeline. Verify the entitlement path, fee schedule, and realistic approval timeline with the jurisdiction before underwriting — these assumptions swing the return more than lot price does.',
    dataHooks: ['insar-velocity', 'viirs-radiance'],
  },
};
