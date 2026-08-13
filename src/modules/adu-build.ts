import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Accessory Dwelling Unit (ADU) build. You already own the lot and the main
// house; this models ONLY the incremental delta of adding a second unit —
// incremental build cost against incremental rent and the property-value lift.
// It is an income HOLD on the marginal investment: the "asset" whose value you
// create is the property-value lift, financed with a construction/renovation
// loan, producing incremental NOI. The signature output is yield-on-cost — the
// unlevered return on every dollar of build spend — which is what makes ADUs
// attractive where they are legal.

function compute(i: Record<string, number>): ComputeResult {
  const aduBuildCost = i.aduBuildCost ?? 0;
  const softCostsPct = i.softCostsPct ?? 0;
  const financedPct = i.financedPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 20;

  const monthlyRent = i.incrementalMonthlyRent ?? 0;
  const vacancy = i.vacancyPct ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const taxAnnual = i.incrementalPropertyTaxAnnual ?? 0;
  const insuranceAnnual = i.incrementalInsuranceAnnual ?? 0;
  const maintenancePct = i.maintenancePct ?? 0;
  const managementPct = i.managementPct ?? 0;

  const valueLift = i.propertyValueLift ?? 0;
  const appreciation = i.appreciationPct ?? 0;
  const holdYears = i.holdYears ?? 5;
  const sellingPct = i.sellingCostPct ?? 0;

  // The value created is the asset; the construction loan is sized off all-in cost.
  const allInCost = aduBuildCost * (1 + softCostsPct);
  const loanAmount = allInCost * financedPct;
  const totalCashInvested = allInCost * (1 - financedPct);

  const rentAnnual0 = monthlyRent * 12;
  const grossRevenue = (y: number) => rentAnnual0 * Math.pow(1 + rentGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * (1 - vacancy);
  const operatingExpenses = (y: number) => {
    const eg = Math.pow(1 + expenseGrowth, y - 1);
    return (
      taxAnnual * eg +
      insuranceAnnual * eg +
      grossRevenue(y) * maintenancePct +
      effectiveRevenue(y) * managementPct
    );
  };

  const { core, projection, debtService, noi } = computeHold({
    price: valueLift,
    loanAmount,
    annualRate: rate,
    termYears: term,
    appreciation,
    grossRevenue,
    effectiveRevenue,
    operatingExpenses,
    totalCashInvested,
    sellingPct,
    holdYears,
  });

  // Year-1 incremental NOI drives yield-on-cost and payback.
  const yieldOnCost = guardDiv(noi, allInCost);
  const valueLiftVsCost = guardDiv(valueLift, allInCost);
  const paybackYears = guardDiv(allInCost, Math.max(noi, 1));

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(d) && d < 1.2)
    warnings.push(`Incremental DSCR ${d.toFixed(2)}× is below 1.20 — ADU-specific loan products are scarce and lenders underwrite tightly.`);
  if (core.annualCashFlow < 0)
    warnings.push('Year-1 incremental cash flow is negative at these inputs (depreciation not modeled).');
  if (Number.isFinite(valueLiftVsCost) && valueLiftVsCost < 1)
    warnings.push(`Value lift (${(valueLiftVsCost).toFixed(2)}× of cost) is below the build cost — you would create less appraised value than you spend.`);

  return {
    metrics: {
      ...core,
      yieldOnCost,
      valueLiftVsCost,
      paybackYears,
    },
    projection,
    warnings,
  };
}

export const aduBuild: InvestmentModule = {
  id: 'adu-build',
  name: 'ADU Build — Incremental Unit',
  category: 'ValueAdd',
  tier: 'creative',
  blurb: 'Add an accessory dwelling unit to a lot you already own. Analyzes only the incremental delta.',
  params: [
    { key: 'aduBuildCost', label: 'ADU build cost', type: 'currency', unit: '$', default: 150_000, min: 0, step: 5000, group: 'Build', verify: true, help: 'Hard construction cost for a detached/attached ADU. Verify against local contractor bids — varies widely by size, site, and region.' },
    { key: 'softCostsPct', label: 'Soft costs', type: 'percent', unit: '%', default: 0.15, min: 0, max: 0.5, step: 0.01, group: 'Build', help: 'Permits, design, engineering, impact fees, and utility connections as a fraction of hard cost.' },
    { key: 'propertyValueLift', label: 'Property value lift', type: 'currency', unit: '$', default: 200_000, min: 0, step: 5000, group: 'Build', verify: true, help: 'Appraised value the finished ADU adds to the property. Verify with an appraiser or ADU-comp sales — this is the asset you create.' },

    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.6, min: 0, max: 0.9, step: 0.05, group: 'Financing', help: 'Share of all-in cost covered by a construction/renovation or HELOC-style loan. ADU financing products are limited.' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Renovation/construction loan rate. Verify against a current rate sheet for the product.' },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 40, step: 1, group: 'Financing' },

    { key: 'incrementalMonthlyRent', label: 'Incremental monthly rent', type: 'currency', unit: '$/mo', default: 1_500, min: 0, step: 50, group: 'Income', verify: true, help: 'Market rent the ADU alone commands. Verify against comparable ADU/small-unit rentals in the submarket.' },
    { key: 'vacancyPct', label: 'Vacancy', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.5, step: 0.01, group: 'Income' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'incrementalPropertyTaxAnnual', label: 'Incremental property tax', type: 'currency', unit: '$/yr', default: 1_200, min: 0, step: 100, group: 'Expenses', verify: true, help: 'Added annual tax from the reassessed improvement. Verify with the county assessor — some states cap ADU reassessment.' },
    { key: 'incrementalInsuranceAnnual', label: 'Incremental insurance', type: 'currency', unit: '$/yr', default: 500, min: 0, step: 50, group: 'Expenses' },
    { key: 'maintenancePct', label: 'Maintenance', type: 'percent', unit: '%', default: 0.10, min: 0, max: 0.3, step: 0.01, group: 'Expenses', help: 'As a fraction of scheduled rent.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.01, group: 'Expenses', help: 'As a fraction of collected rent. Set to 0 if self-managing.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Applied to the value-lift asset over the hold.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.0, min: 0, max: 0.12, step: 0.005, group: 'Exit', help: 'Default 0: you keep the property. The modeled exit value is the value lift itself, not a sale.' },
  ],
  metrics: [
    { key: 'yieldOnCost', label: 'Yield on cost', unit: '%', higherIsBetter: true, help: 'Year-1 incremental NOI / all-in build cost. The unlevered return on the build spend — the headline ADU metric.' },
    { key: 'valueLiftVsCost', label: 'Value lift vs. cost', unit: 'x', higherIsBetter: true, help: 'Property value lift / all-in cost. Above 1.0× means the build creates more appraised value than it costs.' },
    { key: 'paybackYears', label: 'Payback period', unit: 'yr', higherIsBetter: false, help: 'All-in cost / year-1 incremental NOI. Years of net income to recoup the build.' },
  ],
  compute,
  narrative: {
    strategy:
      'Add an **accessory dwelling unit** to a lot you already own and analyze only the **incremental delta** — the build cost against the new rent stream and the appraised value it creates. Because you skip land acquisition entirely, a well-run ADU posts a high **yield on cost**: you densify an existing parcel and manufacture both cash flow and equity. The economics turn on three verified numbers — the all-in build cost, the incremental rent, and the property-value lift — and on whether your jurisdiction lets you build one at all.',
    risks: [
      'Permitting and zoning vary enormously by state and city — some jurisdictions are permissive, many still effectively prohibit ADUs.',
      'Build risk: construction cost overruns and delays hit the all-in cost directly and compress yield on cost.',
      'ADU-specific financing products are scarce; you may be forced into a HELOC or cash, changing the levered return.',
      'The value lift is an appraisal assumption — appraisers in thin-ADU markets may not fully credit the added unit.',
    ],
    opportunities: [
      'High yield on cost where ADUs are legal — you add a rentable unit without buying more land.',
      'Manufactured equity: the property-value lift often exceeds the build cost in supply-constrained metros.',
      'Optionality — house family, rent long-term, or (where permitted) rent short-term, and reprice the whole property on exit.',
    ],
    regulatory:
      'ADU legality is jurisdiction-specific and the make-or-break variable. States like California have forced permissive ADU rules statewide; many other states leave it to local zoning that restricts or bans them. Verify the specific local rules — size caps, setback and parking requirements, owner-occupancy mandates, and the reassessment treatment — BEFORE underwriting.',
    dataHooks: ['viirs-radiance'],
  },
};
