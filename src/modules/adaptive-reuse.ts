import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv } from '../core/finance';
import { computeFlip } from './_shapes';

// Adaptive Reuse. Buy an existing building and convert it to a higher and better
// use — office to residential, warehouse to lofts, retail to medical — then sell
// or refinance at the stabilized value. This is a FLIP/development play: there is
// no stabilized NOI while the work is underway, so the operating-hold core metrics
// are NaN and render "—". The return lives in the spread between all-in cost
// (acquisition + conversion + carry) and the stabilized value, and entitlement
// risk dominates everything else.

function compute(i: Record<string, number>): ComputeResult {
  const acquisitionCost = i.acquisitionCost ?? 0;
  const conversionCostPerSqft = i.conversionCostPerSqft ?? 0;
  const buildingSqft = i.buildingSqft ?? 0;

  const financedPct = i.financedPct ?? 0;
  const rate = i.interestRate ?? 0;
  const projectMonths = Math.max(i.projectMonths ?? 1, 1);
  const monthlyCarry = i.monthlyCarry ?? 0;

  const stabilizedValue = i.stabilizedValue ?? 0;
  const sellingPct = i.sellingCostPct ?? 0;

  const conversionCost = conversionCostPerSqft * buildingSqft;
  const totalCost = acquisitionCost + conversionCost;
  const loan = totalCost * financedPct;
  const interest = loan * rate * (projectMonths / 12); // interest-only construction debt
  const carry = monthlyCarry * projectMonths;
  const cashInvested = totalCost * (1 - financedPct) + carry + interest;

  const flip = computeFlip({
    exitValue: stabilizedValue,
    sellingCostPct: sellingPct,
    loanPayoff: loan,
    cashInvested,
    months: projectMonths,
  });

  const costPerSqft = guardDiv(totalCost, buildingSqft);

  const warnings: string[] = [
    'Conversion play: the operating cash-flow metrics (cap rate, DSCR, cash-on-cash) are not applicable and render "—". Judge this on ROI, its annualization, and the margin of safety.',
  ];
  if (Number.isFinite(flip.marginOfSafety) && flip.marginOfSafety < 0.15)
    warnings.push(
      `Margin of safety ${(flip.marginOfSafety * 100).toFixed(0)}% is thin for a multi-year conversion — a modest cost overrun or a soft stabilized-value assumption can erase the profit.`,
    );
  if (flip.profit < 0) warnings.push('Modeled profit is negative at these assumptions.');
  warnings.push('Structural surprises behind the walls of an old building are common — carry a contingency above the modeled conversion cost.');

  return {
    metrics: {
      ...flip.core,
      profit: flip.profit,
      roi: flip.roi,
      annualizedRoi: flip.annualizedRoi,
      marginOfSafety: flip.marginOfSafety,
      costPerSqft,
    },
    warnings,
  };
}

export const adaptiveReuse: InvestmentModule = {
  id: 'adaptive-reuse',
  name: 'Adaptive Reuse — Conversion',
  category: 'ValueAdd',
  tier: 'creative',
  blurb: 'Convert an existing building to a higher use, then sell or refi at stabilized value.',
  params: [
    { key: 'acquisitionCost', label: 'Acquisition cost', type: 'currency', unit: '$', default: 2_200_000, min: 0, step: 25_000, group: 'Acquisition', verify: true, help: 'All-in purchase of the existing building. Verify against comparable as-is sales for the current use.' },
    { key: 'buildingSqft', label: 'Building size', type: 'number', unit: 'count', default: 24_000, min: 100, step: 500, group: 'Acquisition', help: 'Gross square feet subject to conversion.' },

    { key: 'conversionCostPerSqft', label: 'Conversion cost / sqft', type: 'currency', unit: '$', default: 180, min: 0, step: 5, group: 'Conversion', verify: true, help: 'Hard + soft cost to convert per square foot. Verify against a GC estimate — change-of-use construction routinely runs above ground-up-adjacent budgets.' },

    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.65, min: 0, max: 0.9, step: 0.05, group: 'Financing', help: 'Share of total project cost covered by construction/bridge debt.' },
    { key: 'interestRate', label: 'Loan rate (interest-only)', type: 'percent', unit: '%', default: 0.095, min: 0, max: 0.3, step: 0.001, group: 'Financing', verify: true, help: 'Construction/bridge rate, interest-only over the project. Verify current terms and points.' },
    { key: 'projectMonths', label: 'Project duration', type: 'integer', unit: 'count', default: 24, min: 1, max: 120, step: 1, group: 'Financing', help: 'Months from acquisition through stabilization/sale. Entitlement and permitting time is the biggest swing variable.' },
    { key: 'monthlyCarry', label: 'Monthly carry', type: 'currency', unit: '$/mo', default: 9_000, min: 0, step: 500, group: 'Financing', help: 'Taxes, insurance, security, and soft carry while the project runs.' },

    { key: 'stabilizedValue', label: 'Stabilized value', type: 'currency', unit: '$', default: 8_400_000, min: 0, step: 50_000, group: 'Exit', verify: true, help: 'Value at the higher-and-better use once complete and leased/sold. Verify against comps for the target use — the whole deal rests on this. A viable conversion must clear total cost by a developer margin.' },
    { key: 'sellingCostPct', label: 'Selling / refi costs', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.15, step: 0.005, group: 'Exit', help: 'Disposition or refinance costs on the stabilized asset.' },
  ],
  metrics: [
    { key: 'profit', label: 'Project profit', unit: '$', higherIsBetter: true, help: 'Net proceeds at stabilized value minus all cash invested (equity + carry + interest).' },
    { key: 'roi', label: 'Return on investment', unit: '%', higherIsBetter: true, help: 'Profit / cash invested over the whole project.' },
    { key: 'annualizedRoi', label: 'Annualized ROI', unit: '%', higherIsBetter: true, help: 'ROI annualized over the project duration — comparable to a yearly return.' },
    { key: 'marginOfSafety', label: 'Margin of safety', unit: '%', higherIsBetter: true, help: 'Cushion between the modeled stabilized value and the break-even exit, as a fraction of the exit.' },
    { key: 'costPerSqft', label: 'All-in cost / sqft', unit: '$', higherIsBetter: false, help: 'Total project cost / building square feet — the basis to compare against stabilized value per sqft.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy an obsolete or underused building and convert it to a **higher and better use** — office to residential, warehouse to lofts, retail to medical — then sell or refinance at the **stabilized value**. The profit is pure value creation: you are repricing the same shell from a declining use to a demanded one. But that value is unlocked only after a **rezoning/entitlement gauntlet** and a heavy construction spend into an existing structure, so this is a capital-intensive, execution-heavy development bet, not a passive hold.',
    risks: [
      'Zoning and entitlement risk is dominant — a change of use often needs rezoning, variances, or code relief that can stall for years or be denied outright, with carry accruing the entire time.',
      'Construction cost overruns and structural surprises: old buildings hide asbestos, undersized systems, and non-conforming structure that inflate the conversion budget.',
      'The stabilized value is an assumption about a use the building does not yet serve — a soft target-use market erodes the exit.',
      'Long project duration compounds interest and carry against a return that only arrives at completion.',
    ],
    opportunities: [
      'Supply-constrained upside: converting to a demanded use in a market that cannot easily add new stock can command a premium.',
      'Historic and adaptive-reuse tax credits and local incentives can materially improve the return where the building qualifies.',
      'Buying an obsolete asset at a distressed as-is basis creates a wide spread to the stabilized value if execution holds.',
    ],
    regulatory:
      'Rezoning, use variances, and building-code compliance for the new occupancy are make-or-break. Verify the entitlement path, the realistic approval timeline, and code-upgrade triggers (egress, fire, ADA, seismic) with the jurisdiction before underwriting — these swing the return more than the exit value does.',
    dataHooks: ['viirs-radiance', 'insar-velocity'],
  },
};
