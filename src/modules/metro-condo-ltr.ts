import type { InvestmentModule, ComputeResult } from '../core/types';
import { capRate, cashOnCash, dscr, grm, irr, annualDebtService } from '../core/finance';
import { buildProjection, holdCashflows } from './_projection';

// Metro Condo — Long-Term Rental. The base amortized-rental model: financing,
// rent with vacancy, opex incl. HOA, NOI, cap rate, cash-on-cash, DSCR, a
// multi-year projection, and a standardized 5-year IRR.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const closingPct = i.closingCostPct ?? 0;

  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;
  const vacancy = i.vacancyPct ?? 0;

  const loanAmount = price * (1 - downPct);
  const downPayment = price * downPct;
  const closing = price * closingPct;
  const totalCashInvested = downPayment + closing;

  const rentAnnual0 = (i.monthlyRent ?? 0) * 12;
  const otherAnnual0 = (i.otherMonthlyIncome ?? 0) * 12;

  const grossRevenue = (year: number) => {
    const g = Math.pow(1 + rentGrowth, year - 1);
    return rentAnnual0 * g + otherAnnual0 * g;
  };
  const effectiveRevenue = (year: number) => grossRevenue(year) * (1 - vacancy);
  const operatingExpenses = (year: number) => {
    const eg = Math.pow(1 + expenseGrowth, year - 1);
    const value = price * Math.pow(1 + (i.appreciationPct ?? 0), year - 1);
    const tax = value * (i.propertyTaxPct ?? 0);
    const insurance = (i.insuranceAnnual ?? 0) * eg;
    const hoa = (i.hoaMonthly ?? 0) * 12 * eg;
    const maintenance = rentAnnual0 * Math.pow(1 + rentGrowth, year - 1) * (i.maintenancePct ?? 0);
    const management = effectiveRevenue(year) * (i.managementPct ?? 0);
    return tax + insurance + hoa + maintenance + management;
  };

  const horizon = Math.max(Math.round(i.holdYears ?? 5), 5);
  const full = buildProjection(
    { price, loanAmount, annualRate: rate, termYears: term, appreciation: i.appreciationPct ?? 0, grossRevenue, effectiveRevenue, operatingExpenses },
    horizon,
  );

  const y1 = full[0]!;
  const debtService = loanAmount > 0 ? annualDebtService(rate, term, loanAmount) : 0;
  const noi = y1.noi;
  const annualCashFlow = y1.cashFlow;

  // Standardized 5-year IRR for cross-module comparison.
  const irr5yr = irr(holdCashflows(full, totalCashInvested, 5, i.sellingCostPct ?? 0));

  const projection = full.slice(0, Math.round(i.holdYears ?? 5));

  const warnings: string[] = [];
  const dscrVal = dscr(noi, debtService);
  if (Number.isFinite(dscrVal) && dscrVal < 1.2) warnings.push(`DSCR ${dscrVal.toFixed(2)}× is below 1.20 — most lenders would flag this.`);
  if (annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative. After-tax may differ (depreciation not modeled).');

  return {
    metrics: {
      annualCashFlow,
      monthlyCashFlow: annualCashFlow / 12,
      cashOnCash: cashOnCash(annualCashFlow, totalCashInvested),
      capRate: capRate(noi, price),
      dscr: dscrVal,
      irr5yr,
      totalCashInvested,
      grm: grm(price, grossRevenue(1)),
      opexRatio: y1.effectiveRevenue > 0 ? y1.operatingExpenses / y1.effectiveRevenue : NaN,
    },
    projection,
    warnings,
  };
}

export const metroCondoLtr: InvestmentModule = {
  id: 'metro-condo-ltr',
  name: 'Metro Condo — Long-Term Rental',
  category: 'Residential',
  tier: 'core',
  blurb: 'Financed condo held for annual rent. The base rental model.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 420_000, min: 0, step: 5000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Verify against a current rate sheet for the product and credit profile.' },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'monthlyRent', label: 'Monthly rent', type: 'currency', unit: '$/mo', default: 2_600, min: 0, step: 50, group: 'Income', verify: true, help: 'Verify against current comps for the unit and submarket.' },
    { key: 'otherMonthlyIncome', label: 'Other monthly income', type: 'currency', unit: '$/mo', default: 0, min: 0, step: 25, group: 'Income', help: 'Parking, storage, pet rent.' },
    { key: 'vacancyPct', label: 'Vacancy', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.5, step: 0.01, group: 'Income' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.011, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true, help: 'Annual, as a fraction of assessed value. Verify with the county assessor.' },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 1_400, min: 0, step: 100, group: 'Expenses', verify: true },
    { key: 'hoaMonthly', label: 'HOA dues', type: 'currency', unit: '$/mo', default: 350, min: 0, step: 25, group: 'Expenses', verify: true, help: 'Condos live and die by HOA. Verify current dues and pending special assessments.' },
    { key: 'maintenancePct', label: 'Maintenance', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.3, step: 0.01, group: 'Expenses', help: 'As a fraction of scheduled rent.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.01, group: 'Expenses', help: 'As a fraction of collected rent. Set to 0 if self-managing.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.035, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Assumption, not a forecast.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'grm', label: 'Gross rent multiplier', unit: 'x', higherIsBetter: false, help: 'Price / gross annual rent. Lower is cheaper per dollar of rent.' },
    { key: 'opexRatio', label: 'Operating expense ratio', unit: '%', higherIsBetter: false, help: 'Operating expenses / effective revenue.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy a financed metro condo and hold it for rental income plus appreciation. Returns come from four levers: **cash flow** (rent minus expenses and debt service), **amortization** (the tenant retires your loan), **appreciation**, and **tax benefits** (not modeled here). The condo form trades a lower entry price and exterior-maintenance offload for **HOA dependency** — dues and special assessments are the swing variable.',
    risks: [
      'HOA special assessments can erase a year of cash flow overnight.',
      'Condo financing is more restrictive (owner-occupancy ratios, litigation, non-warrantable projects).',
      'Rent and appreciation are assumptions; a soft submarket compresses both at once.',
      'Pre-tax cash flow can be thin or negative even when the deal is sound after tax.',
    ],
    opportunities: [
      'Amortization builds equity even in a flat-price market.',
      'HOA covers exterior capex, smoothing the maintenance line.',
      'Rate buydowns or assumable loans can materially improve DSCR.',
    ],
    regulatory:
      'Confirm the HOA permits long-term rentals and check any rental cap or minimum-lease rule before closing.',
    dataHooks: ['viirs-radiance'],
  },
};
