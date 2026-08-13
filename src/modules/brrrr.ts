import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr } from '../core/finance';
import { computeHold } from './_shapes';

// BRRRR — Buy, Rehab, Rent, Refinance, Repeat. Fund the project (purchase + rehab
// + closing + carry) as all-in cash, then a cash-out refinance at the stabilized
// after-repair value returns capital. Whatever cash is left in the deal becomes
// the basis for the ongoing rental hold. When the refinance pulls out everything
// (cash left in ≤ 0), cash-on-cash and IRR are effectively infinite — we render
// them "—" rather than print a fake number.

function compute(i: Record<string, number>): ComputeResult {
  const purchasePrice = i.purchasePrice ?? 0;
  const rehabBudget = i.rehabBudget ?? 0;
  const arv = i.afterRepairValue ?? 0;

  const totalProjectCost =
    purchasePrice +
    rehabBudget +
    purchasePrice * (i.buyClosingCostPct ?? 0) +
    (i.monthlyCarryDuringRehab ?? 0) * (i.rehabHoldingMonths ?? 0);

  const refiLtv = i.refiLtv ?? 0;
  const refiRate = i.refiRate ?? 0;
  const refiTerm = i.refiTermYears ?? 30;
  const refiLoan = arv * refiLtv;
  const refiClosing = refiLoan * (i.refiClosingCostPct ?? 0);
  const cashOutAtRefi = refiLoan - refiClosing;
  const cashLeftIn = totalProjectCost - cashOutAtRefi;

  const vacancy = i.vacancyPct ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;
  const appreciation = i.appreciationPct ?? 0;
  const rentAnnual0 = (i.monthlyRent ?? 0) * 12;

  const grossRevenue = (y: number) => rentAnnual0 * Math.pow(1 + rentGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * (1 - vacancy);
  const operatingExpenses = (y: number) => {
    const eg = Math.pow(1 + expenseGrowth, y - 1);
    const value = arv * Math.pow(1 + appreciation, y - 1);
    return (
      value * (i.propertyTaxPct ?? 0) +
      (i.insuranceAnnual ?? 0) * eg +
      grossRevenue(y) * (i.maintenancePct ?? 0) +
      effectiveRevenue(y) * (i.managementPct ?? 0)
    );
  };

  const { core, projection, debtService, noi } = computeHold({
    price: arv, loanAmount: refiLoan, annualRate: refiRate, termYears: refiTerm, appreciation,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested: Math.max(cashLeftIn, 0), sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  const metrics: Record<string, number> = {
    ...core,
    cashLeftIn,
    refiCashOut: cashOutAtRefi,
    equityAfterRefi: arv - refiLoan,
  };

  const warnings: string[] = [];
  if (cashLeftIn <= 0) {
    warnings.push('Capital fully recovered at refinance (cash left in ≤ $0) — cash-on-cash and IRR are effectively infinite.');
    metrics.cashOnCash = NaN;
    metrics.irr5yr = NaN;
  }
  const d = dscr(noi, debtService);
  if (Number.isFinite(d) && d < 1.2) warnings.push(`Post-refi DSCR ${d.toFixed(2)}× is below 1.20 — cash-out leverage tightens coverage.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 post-refi cash flow is negative (depreciation not modeled).');

  return { metrics, projection, warnings };
}

export const brrrr: InvestmentModule = {
  id: 'brrrr',
  name: 'BRRRR (Buy, Rehab, Rent, Refinance, Repeat)',
  category: 'Residential',
  tier: 'creative',
  blurb: 'Rehab to force value, refinance to recycle capital, then hold as a rental.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 240_000, min: 0, step: 5000, group: 'Acquisition', verify: true },
    { key: 'buyClosingCostPct', label: 'Buy-side closing', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Acquisition' },
    { key: 'rehabBudget', label: 'Rehab budget', type: 'currency', unit: '$', default: 60_000, min: 0, step: 2500, group: 'Rehab', verify: true, help: 'Scope × cost. The forced appreciation depends on hitting this.' },
    { key: 'rehabHoldingMonths', label: 'Rehab period', type: 'integer', unit: 'count', default: 5, min: 0, max: 24, step: 1, group: 'Rehab', help: 'Months of carry before the property is stabilized and refinanced.' },
    { key: 'monthlyCarryDuringRehab', label: 'Carry during rehab', type: 'currency', unit: '$/mo', default: 1_100, min: 0, step: 100, group: 'Rehab', help: 'Taxes, insurance, utilities, and interest while renovating.' },
    { key: 'afterRepairValue', label: 'After-repair value (ARV)', type: 'currency', unit: '$', default: 360_000, min: 0, step: 5000, group: 'Refinance', verify: true, help: 'Stabilized appraised value that the refinance is sized against. Verify against renovated comps.' },
    { key: 'refiLtv', label: 'Refi loan-to-value', type: 'percent', unit: '%', default: 0.75, min: 0, max: 1, step: 0.01, group: 'Refinance', verify: true, help: 'Cash-out LTV the lender will underwrite on the ARV. Verify current investor-loan terms.' },
    { key: 'refiRate', label: 'Refi interest rate', type: 'percent', unit: '%', default: 0.075, min: 0, max: 0.2, step: 0.001, group: 'Refinance', verify: true },
    { key: 'refiTermYears', label: 'Refi term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Refinance' },
    { key: 'refiClosingCostPct', label: 'Refi closing', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Refinance', help: 'As a fraction of the new loan.' },
    { key: 'monthlyRent', label: 'Monthly rent', type: 'currency', unit: '$/mo', default: 2_600, min: 0, step: 50, group: 'Rental', verify: true, help: 'Stabilized rent after rehab. Verify against comps.' },
    { key: 'vacancyPct', label: 'Vacancy', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.5, step: 0.01, group: 'Rental' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Rental' },
    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.011, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true, help: 'Reassessment after purchase/rehab can raise this. Verify with the assessor.' },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 1_600, min: 0, step: 100, group: 'Expenses', verify: true },
    { key: 'maintenancePct', label: 'Maintenance', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.3, step: 0.01, group: 'Expenses', help: 'Fraction of scheduled rent. A fresh rehab lowers this early on.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.01, group: 'Expenses', help: 'Fraction of collected rent. Set to 0 if self-managing.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },
    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Assumption, not a forecast.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'cashLeftIn', label: 'Cash left in deal', unit: '$', higherIsBetter: false, help: 'Project cost minus refinance proceeds. Negative means you pulled out more than you put in.' },
    { key: 'refiCashOut', label: 'Refi cash-out', unit: '$', higherIsBetter: true, help: 'Net proceeds from the cash-out refinance (new loan minus refi closing).' },
    { key: 'equityAfterRefi', label: 'Equity after refi', unit: '$', higherIsBetter: true, help: 'ARV minus the new loan balance — the equity remaining in the property post-refinance.' },
  ],
  compute,
  narrative: {
    strategy:
      'BRRRR is a flip you keep. You **force value** through rehab, then a **cash-out refinance** at the stabilized ARV returns most (sometimes all) of your capital, which you redeploy into the next deal — the same dollars working repeatedly. The engine is the spread between your all-in project cost and the refinance proceeds: **the ARV appraisal and rehab discipline are the whole game**. Done well, cash left in the deal approaches zero and returns go asymptotic; done carelessly, you over-leverage into a thin-cash-flow rental.',
    risks: [
      'A low appraisal shrinks the cash-out and strands capital you expected to recycle.',
      'Rehab overruns raise total project cost dollar-for-dollar against the refinance proceeds.',
      'Pulling out every dollar maximizes leverage — post-refi DSCR and cash flow can turn dangerously thin.',
      'Refinance rates and LTVs move; the terms you underwrote may not be the terms you get.',
    ],
    opportunities: [
      'Capital recycling: the same down payment can build a portfolio instead of one property.',
      'Forced appreciation creates equity independent of the broader market.',
      'A well-executed refi can recover 100% of invested cash, making incremental returns effectively infinite.',
    ],
    regulatory:
      'Confirm rehab permit requirements and any seasoning period your lender imposes before a cash-out refinance is allowed on the new value.',
    dataHooks: ['viirs-radiance'],
  },
};
