import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Self-Storage. Revenue is unit count × rent, plus ancillary income (admin,
// tenant insurance, late fees). Two occupancy haircuts stack: physical
// occupancy (units actually rented) and an economic factor for delinquency and
// promotional discounts. Expenses run as a ratio of effective gross income.
// Management-intensive but low capex; the swings are occupancy ramp and local
// new supply.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 25;
  const appreciation = i.appreciationPct ?? 0;

  const units = i.numberOfUnits ?? 0;
  const rentPerUnit = i.avgMonthlyRentPerUnit ?? 0;
  const physicalOcc = i.physicalOccupancy ?? 0;
  const econFactor = i.economicOccupancyFactor ?? 0;
  const otherIncome = i.otherIncomeAnnual ?? 0;
  const expenseRatioOfEgi = i.expenseRatioOfEgi ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const loanAmount = price * (1 - downPct);
  const totalCashInvested = price * downPct + price * (i.closingCostPct ?? 0);

  const grossRevenue = (y: number) =>
    (units * rentPerUnit * 12 + otherIncome) * Math.pow(1 + rentGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * physicalOcc * econFactor;
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
      economicOccupancy: physicalOcc * econFactor,
      expenseRatio: expenseRatioOfEgi,
      revenuePerUnitAnnual: guardDiv(units * rentPerUnit * 12 + otherIncome, units),
    },
    projection,
    warnings,
  };
}

export const selfStorage: InvestmentModule = {
  id: 'self-storage',
  name: 'Self-Storage',
  category: 'Commercial',
  tier: 'creative',
  blurb: 'Storage facility: unit rents with stacked occupancy haircuts, expense-ratio opex.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 2_600_000, min: 0, step: 25_000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.30, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.072, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Verify against a current commercial rate sheet.' },
    { key: 'loanTermYears', label: 'Loan term / amortization', type: 'integer', unit: 'yr', default: 25, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'numberOfUnits', label: 'Number of units', type: 'integer', unit: 'count', default: 380, min: 1, step: 10, group: 'Income' },
    { key: 'avgMonthlyRentPerUnit', label: 'Avg rent / unit', type: 'currency', unit: '$/mo', default: 105, min: 0, step: 5, group: 'Income', verify: true, help: 'Blended monthly rent across unit sizes. Verify against local competitors.' },
    { key: 'physicalOccupancy', label: 'Physical occupancy', type: 'percent', unit: '%', default: 0.86, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Share of units actually rented.' },
    { key: 'economicOccupancyFactor', label: 'Economic factor', type: 'percent', unit: '%', default: 0.92, min: 0, max: 1, step: 0.01, group: 'Income', help: 'Haircut for delinquency and promotional discounts, applied on top of physical occupancy.' },
    { key: 'otherIncomeAnnual', label: 'Other income', type: 'currency', unit: '$/yr', default: 22_000, min: 0, step: 1_000, group: 'Income', help: 'Admin fees, tenant insurance, late fees, retail.' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'expenseRatioOfEgi', label: 'Expense ratio of EGI', type: 'percent', unit: '%', default: 0.36, min: 0, max: 1, step: 0.01, group: 'Expenses', help: 'Operating expenses as a fraction of effective gross income.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'economicOccupancy', label: 'Economic occupancy', unit: '%', higherIsBetter: true, help: 'Physical occupancy × economic factor — the share of scheduled rent actually collected.' },
    { key: 'expenseRatio', label: 'Expense ratio', unit: '%', higherIsBetter: false, help: 'Operating expenses as a fraction of effective gross income.' },
    { key: 'revenuePerUnitAnnual', label: 'Revenue / unit (annual)', unit: '$/yr', higherIsBetter: true, help: 'Total scheduled revenue divided by unit count.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own and operate a self-storage facility. Revenue is **units × rent plus ancillary income**, and the honest yield sits behind two stacked haircuts — **physical occupancy** (units rented) and an **economic factor** for delinquency and move-in discounts. Storage is **management-intensive but low-capex**: no TI, minimal build-out, and rents that reset monthly. The value-creation levers are occupancy ramp and dynamic pricing; the dominant risk is a burst of local new supply.',
    risks: [
      'Local oversupply: storage is cheap and fast to build, and a new competitor nearby compresses rents quickly.',
      'Occupancy and economic factor are both easy to overstate; move-in discounts mask true street rates.',
      'Demand is tied to household churn (moves, downsizing); a slow housing market softens absorption.',
      'It is an operating business — pricing, delinquency management, and marketing drive the result.',
    ],
    opportunities: [
      'Dynamic pricing and existing-customer rate increases lift revenue with little added cost.',
      'Ancillary income (tenant insurance, admin fees, retail) carries very high margins.',
      'Lease-up of an under-managed facility can re-rate NOI sharply without capital investment.',
    ],
    regulatory:
      'Verify zoning and any local moratoria on new storage; confirm tenant-insurance and lien-sale practices comply with state self-storage statutes.',
  },
};
