import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Medical Office (MOB). Same math shape as multi-tenant office, but the tenant
// base is very different: healthcare practices with expensive, purpose-built
// space are sticky and renew heavily. Low rollover, but very high TI/LC per
// rolled sqft when a suite does turn (imaging, plumbing, lead-lined rooms).
// Demographics are a durable tailwind; reimbursement and consolidation are the
// structural risks.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 25;
  const appreciation = i.appreciationPct ?? 0;

  const sqft = i.rentableSqft ?? 0;
  const marketRent = i.marketRentPerSqftAnnual ?? 0;
  const occupancy = i.currentOccupancy ?? 0;
  const opexPerSqft = i.operatingExpensePerSqft ?? 0;
  const rolloverPct = i.annualRolloverPct ?? 0;
  const tiLcPerSqft = i.tiLcPerSqft ?? 0;
  const managementPct = i.managementPct ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const loanAmount = price * (1 - downPct);
  const totalCashInvested = price * downPct + price * (i.closingCostPct ?? 0);

  const tiLcDragAnnual = sqft * rolloverPct * tiLcPerSqft;

  const grossRevenue = (y: number) => sqft * marketRent * Math.pow(1 + rentGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * occupancy;
  const operatingExpenses = (y: number) =>
    sqft * opexPerSqft * Math.pow(1 + expenseGrowth, y - 1) +
    effectiveRevenue(y) * managementPct +
    tiLcDragAnnual;

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
      pricePerSqft: guardDiv(price, sqft),
      tiLcDragAnnual,
    },
    projection,
    warnings,
  };
}

export const medicalOffice: InvestmentModule = {
  id: 'medical-office',
  name: 'Medical Office (MOB)',
  category: 'Commercial',
  tier: 'core',
  blurb: 'Medical office: sticky healthcare tenants, low rollover, very high TI build-out.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 5_000_000, min: 0, step: 50_000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.35, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.071, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Verify against a current commercial rate sheet.' },
    { key: 'loanTermYears', label: 'Loan term / amortization', type: 'integer', unit: 'yr', default: 25, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'rentableSqft', label: 'Rentable area', type: 'number', unit: 'count', default: 32_000, min: 0, step: 500, group: 'Income', help: 'Rentable square feet.' },
    { key: 'marketRentPerSqftAnnual', label: 'Market rent / sqft', type: 'currency', unit: '$/yr', default: 26, min: 0, step: 0.5, group: 'Income', verify: true, help: 'Annual rent per sqft. Verify against MOB comps, ideally on/near a hospital campus.' },
    { key: 'currentOccupancy', label: 'Current occupancy', type: 'percent', unit: '%', default: 0.92, min: 0, max: 1, step: 0.01, group: 'Income', verify: true },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.025, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'operatingExpensePerSqft', label: 'Non-recoverable opex / sqft', type: 'currency', unit: '$/yr', default: 9, min: 0, step: 0.5, group: 'Expenses', help: 'Landlord-borne opex per sqft.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.15, step: 0.005, group: 'Expenses', help: 'As a fraction of collected rent.' },
    { key: 'annualRolloverPct', label: 'Annual rollover', type: 'percent', unit: '%', default: 0.10, min: 0, max: 0.5, step: 0.01, group: 'Expenses', help: 'Low — medical tenants renew heavily.' },
    { key: 'tiLcPerSqft', label: 'TI / LC per rolled sqft', type: 'currency', unit: '$', default: 60, min: 0, step: 5, group: 'Expenses', help: 'Very high — medical build-out (plumbing, imaging, lead-lined rooms) is expensive.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.025, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.015, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'pricePerSqft', label: 'Price per sqft', unit: '$', higherIsBetter: false, help: 'Purchase price / rentable area.' },
    { key: 'tiLcDragAnnual', label: 'TI/LC drag (annual)', unit: '$/yr', higherIsBetter: false, help: 'Recurring tenant-improvement and leasing-commission cost from rollover. High per-sqft in medical.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own a medical office building leased to healthcare practices. The tenancy is **exceptionally sticky**: purpose-built suites, referral networks, and patient familiarity keep practices in place for renewal after renewal, and an aging population is a **durable demand tailwind**. The trade-off is that when a suite does turn, the **build-out is very expensive** (specialized plumbing, imaging, shielding). The structural risks are reimbursement policy and health-system consolidation shifting where care is delivered.',
    risks: [
      'Reimbursement risk: changes to Medicare/Medicaid or payer mix can pressure tenant practice economics.',
      'Health-system consolidation can relocate practices into system-owned campuses, vacating independent MOBs.',
      'TI build-out on any rollover is very high, so even low turnover carries real capital cost.',
      'Off-campus, unaffiliated buildings command weaker demand than on-campus, system-aligned space.',
    ],
    opportunities: [
      'Demographics: an aging population drives secular growth in outpatient care demand.',
      'Sticky, high-renewal tenants produce durable, low-volatility occupancy.',
      'Health-system or credit-tenant affiliation can materially compress the exit cap rate.',
    ],
    regulatory:
      'Confirm tenant affiliations, referral relationships, and any hospital ground-lease terms; verify that leases and TI obligations comply with healthcare regulations (e.g., Stark/anti-kickback) before underwriting.',
  },
};
