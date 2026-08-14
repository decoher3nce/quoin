import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr } from '../core/finance';
import { computeHold } from './_shapes';

// NNN Retail — Single Tenant. A triple-net lease shifts taxes, insurance, and
// maintenance to the tenant, so the landlord's operating expenses are near-zero
// (only small non-recoverable admin / reserves). The income is bond-like: a
// contractual rent with fixed escalations for the remaining lease term. Tenant
// CREDIT and lease term are the whole thesis; value tracks the cap rate, so
// appreciation is modeled low.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 25;
  const appreciation = i.appreciationPct ?? 0;

  const baseRent = i.baseAnnualRent ?? 0;
  const escalation = i.rentEscalationPct ?? 0;
  const nonRecoverable = i.nonRecoverableAnnual ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const loanAmount = price * (1 - downPct);
  const totalCashInvested = price * downPct + price * (i.closingCostPct ?? 0);

  // Rent bumps by the contractual escalation each year. Vacancy is 0 while the
  // lease is in place; rollover risk lives in the narrative, not the base case.
  const grossRevenue = (y: number) => baseRent * Math.pow(1 + escalation, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y);
  const operatingExpenses = (y: number) => nonRecoverable * Math.pow(1 + expenseGrowth, y - 1);

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
      leaseYearsRemaining: i.leaseYearsRemaining ?? 0,
      rentEscalation: escalation,
    },
    projection,
    warnings,
  };
}

export const nnnRetail: InvestmentModule = {
  id: 'nnn-retail',
  name: 'NNN Retail (Single Tenant)',
  category: 'Commercial',
  tier: 'core',
  blurb: 'Single-tenant triple-net lease: bond-like rent, near-zero landlord opex.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 1_800_000, min: 0, step: 25_000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.35, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.068, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Verify against a current commercial rate sheet for the tenant credit and term.' },
    { key: 'loanTermYears', label: 'Loan term / amortization', type: 'integer', unit: 'yr', default: 25, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'baseAnnualRent', label: 'Base annual rent', type: 'currency', unit: '$/yr', default: 112_000, min: 0, step: 1_000, group: 'Lease', verify: true, help: 'Contract rent in the current lease year. Verify against the lease abstract.' },
    { key: 'rentEscalationPct', label: 'Rent escalation', type: 'percent', unit: '%', default: 0.015, min: 0, max: 0.1, step: 0.005, group: 'Lease', help: 'Contractual annual rent bump.' },
    { key: 'leaseYearsRemaining', label: 'Lease years remaining', type: 'integer', unit: 'yr', default: 8, min: 0, max: 30, step: 1, group: 'Lease', verify: true, help: 'Years of term left. Beyond this, rollover / re-tenanting risk applies.' },

    { key: 'nonRecoverableAnnual', label: 'Non-recoverable expenses', type: 'currency', unit: '$/yr', default: 3_000, min: 0, step: 250, group: 'Expenses', help: 'Landlord admin, legal, and reserves not passed through to the tenant.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.01, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Value tracks the cap rate, not housing indices. Kept deliberately low.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'leaseYearsRemaining', label: 'Lease years remaining', unit: 'yr', higherIsBetter: true, help: 'Remaining contractual term. Longer term = more durable income.' },
    { key: 'rentEscalation', label: 'Rent escalation', unit: '%', higherIsBetter: true, help: 'Contractual annual rent bump baked into the lease.' },
  ],
  compute,
  narrative: {
    strategy:
      'Own a single-tenant building on a **triple-net lease**: the tenant pays taxes, insurance, and maintenance, leaving the landlord with a near-passive, bond-like income stream. Return is almost entirely the **contract rent** and its escalations for the remaining term — so **tenant credit and lease length are everything**. Value moves inversely with the market cap rate, which makes this a rate-sensitive, spread-driven asset more than an appreciation play.',
    risks: [
      'Tenant credit is the whole deal — a single default or bankruptcy zeroes the income overnight.',
      'Rollover / dark-store risk at lease end: re-tenanting a purpose-built box is slow and capital-intensive.',
      'Cap-rate and interest-rate moves swing the exit value more than any operational lever.',
      'Single-tenant means binary occupancy — 100% or 0%, with no diversification.',
    ],
    opportunities: [
      'Bond-like, near-passive income with minimal landlord operating burden.',
      'Long lease with contractual escalations gives a predictable, financeable cash flow.',
      'Credit-tenant leases can be financed and sold to a deep pool of 1031 exchange buyers.',
    ],
    regulatory:
      'Read the lease abstract carefully: confirm the net structure is truly triple-net, and check any co-tenancy, renewal-option, or early-termination clauses that could shorten the effective term.',
  },
};
