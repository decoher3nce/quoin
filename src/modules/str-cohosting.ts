import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Co-Hosting. A SERVICE business, not a real-estate investment: you manage other
// owners' STR listings for a percentage of their revenue. Capital is near zero, but
// so is passivity — it is a job that scales with your labor, not your balance sheet.
// Labor is tracked as an opportunity cost (a metric), not booked as a cash expense.

function compute(i: Record<string, number>): ComputeResult {
  const numberOfProperties = i.numberOfProperties ?? 0;
  const avgPropertyAnnualRevenue = i.avgPropertyAnnualRevenue ?? 0;
  const cohostFeePct = i.cohostFeePct ?? 0;
  const setupCostPerProperty = i.setupCostPerProperty ?? 0;
  const monthlyToolsCost = i.monthlyToolsCost ?? 0;
  const hoursPerWeek = i.hoursPerWeek ?? 0;
  const hourlyOpportunityValue = i.hourlyOpportunityValue ?? 0;

  const annualRevenue = numberOfProperties * avgPropertyAnnualRevenue * cohostFeePct;
  // Cash costs only: software/tools. Labor is an opportunity cost, tracked below.
  const annualCF = annualRevenue - monthlyToolsCost * 12;
  const capital = setupCostPerProperty * numberOfProperties;

  const annualCashflows = Array.from({ length: 5 }, () => annualCF);

  const core = computeIncomeStream({
    capital,
    assetPrice: capital,
    annualCashflows,
    terminalValue: 0,
    debtServiceAnnual: 0,
    noiAnnual: annualCF,
  });

  const annualHours = hoursPerWeek * 52;
  const effectiveHourlyRate = guardDiv(annualCF, annualHours);
  const roicOnSetup = guardDiv(annualCF, capital);

  const warnings: string[] = [
    'Returns here are labor-bound, not capital-bound. With near-zero capital, cash-on-cash and IRR are not meaningful (they render "—") — judge this by effective hourly rate and total fee income, not a capital return.',
  ];
  if (Number.isFinite(effectiveHourlyRate) && effectiveHourlyRate < hourlyOpportunityValue)
    warnings.push(`Effective hourly rate $${effectiveHourlyRate.toFixed(0)} is below your $${hourlyOpportunityValue.toFixed(0)} opportunity value — the time is worth more elsewhere.`);
  if (annualCF < 0) warnings.push('Tools and software cost more than the fee income at this scale.');
  if (numberOfProperties < 3) warnings.push('Client concentration: with few properties, losing one owner is a large revenue hit.');

  return {
    // A cohosting business runs on labor, not capital. The capital-based core
    // metrics are astronomically high only because the capital base is trivial;
    // that is misleading in the comparison view, so we suppress them (→ "—") and
    // let effectiveHourlyRate / roicOnSetup carry the real signal.
    metrics: {
      ...core,
      cashOnCash: NaN,
      capRate: NaN,
      irr5yr: NaN,
      annualRevenueShare: annualRevenue,
      effectiveHourlyRate,
      roicOnSetup,
    },
    warnings,
  };
}

export const strCohosting: InvestmentModule = {
  id: 'str-cohosting',
  name: 'STR Co-Hosting — Management Service',
  category: 'Hospitality',
  tier: 'creative',
  blurb: "Manage other owners' listings for a % of revenue. Near-zero capital, but it's a job.",
  params: [
    { key: 'numberOfProperties', label: 'Properties managed', type: 'integer', unit: 'count', default: 6, min: 0, step: 1, group: 'Portfolio', help: 'Active listings under management. Revenue and workload both scale with this.' },
    { key: 'avgPropertyAnnualRevenue', label: 'Avg property annual revenue', type: 'currency', unit: '$/yr', default: 55_000, min: 0, step: 1000, group: 'Portfolio', verify: true, help: 'Gross nightly revenue per managed property. Verify against the owners’ actual statements, not projections.' },
    { key: 'cohostFeePct', label: 'Co-host fee', type: 'percent', unit: '%', default: 0.2, min: 0, max: 0.5, step: 0.01, group: 'Portfolio', verify: true, help: 'Your share of each property’s gross revenue. Full-service co-hosting typically runs 15–25%.' },

    { key: 'setupCostPerProperty', label: 'Setup cost per property', type: 'currency', unit: '$', default: 800, min: 0, step: 50, group: 'Setup', help: 'Onboarding: photography, listing build, lockbox, initial supplies. Your only real capital.' },
    { key: 'monthlyToolsCost', label: 'Tools & software', type: 'currency', unit: '$/mo', default: 250, min: 0, step: 25, group: 'Expenses', help: 'Channel manager, dynamic pricing, messaging automation, insurance.' },

    { key: 'hoursPerWeek', label: 'Hours per week', type: 'number', unit: 'count', default: 25, min: 0, step: 1, group: 'Labor', help: 'Your time across the whole portfolio. This is a job — the hours are the product.' },
    { key: 'hourlyOpportunityValue', label: 'Your hourly opportunity value', type: 'currency', unit: '$', default: 40, min: 0, step: 5, group: 'Labor', help: 'What an hour of your time is worth elsewhere. Used to sanity-check the effective hourly rate.' },
  ],
  metrics: [
    { key: 'annualRevenueShare', label: 'Annual revenue share', unit: '$/yr', higherIsBetter: true, help: 'Properties × avg revenue × fee — your gross annual take before tools.' },
    { key: 'effectiveHourlyRate', label: 'Effective hourly rate', unit: '$', higherIsBetter: true, help: 'Annual cash flow ÷ annual hours worked. The honest wage of this "business".' },
    { key: 'roicOnSetup', label: 'Return on setup capital', unit: '%', higherIsBetter: true, help: 'Annual cash flow ÷ setup capital. Large by construction — capital is tiny, labor is the real input.' },
  ],
  compute,
  narrative: {
    strategy:
      'Manage other people’s short-term rentals for a percentage of their gross revenue. Capital is almost nothing — the "investment" is your **time and operational skill**, not a down payment. That makes the return-on-capital numbers look spectacular and slightly beside the point: the honest metric is the **effective hourly rate**, because this is a job that scales with labor, not a passive asset. It is a real, cash-flowing business, but read it as buying yourself a wage, not a rent roll.',
    risks: [
      'It is a job, not passive income: revenue stops the moment you stop working, and it scales only by adding hours or hiring.',
      'Client concentration — a handful of owners means losing one is a material revenue hit, and owners can leave at will.',
      'Platform risk flows straight through: a ban or account suspension on a client’s listing cuts your fee with it.',
      'Low barrier to entry invites competition and fee compression; owners can also simply self-manage once they learn the ropes.',
    ],
    opportunities: [
      'Near-zero capital and no financing bottleneck — you can start this week and grow one client at a time.',
      'Systemize and hire, and the effective hourly rate can rise as you move from operator to owner of the process.',
      'A managed portfolio is itself a sellable book of business, and a natural funnel into owning or arbitraging units later.',
    ],
    regulatory:
      "You inherit every client property's STR exposure without owning any of it. A city ban, permit cap, or primary-residence rule that hits your owners' listings cuts your fees directly. Confirm each managed property is properly permitted and taxed, and be clear on who bears liability — some jurisdictions hold the manager, not just the owner, responsible for compliance and occupancy-tax remittance.",
    dataHooks: ['viirs-radiance'],
  },
};
