import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Wildfire-Hardened Arbitrage. Buy a wildland-urban-interface (WUI) home
// discounted for fire risk, retrofit it to a hardened standard (Class-A roof,
// ember-resistant vents, defensible space, non-combustible siding), and capture
// an insurability/rentability premium as comparable UN-hardened homes in the
// same area become uninsurable and un-rentable. Long-term rental income hold.
// The thesis is that "hardened + insurable" is a distinct, scarcer, higher-value
// asset than "same house, un-hardened" — and that the market has not yet split
// the two.

function compute(i: Record<string, number>): ComputeResult {
  const purchasePrice = i.purchasePrice ?? 0;
  const hardeningRetrofitCost = i.hardeningRetrofitCost ?? 0;
  const downPaymentPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const closingCostPct = i.closingCostPct ?? 0;

  const monthlyRent = i.monthlyRent ?? 0;
  const rentPremiumPct = i.rentPremiumFromInsurabilityPct ?? 0;
  const vacancy = i.vacancyPct ?? 0;
  const rentGrowth = i.rentGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;
  const appreciation = i.appreciationPct ?? 0;

  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const effectiveRent = monthlyRent * (1 + rentPremiumPct);
  const rentAnnual0 = effectiveRent * 12;

  const loanAmount = purchasePrice * (1 - downPaymentPct);
  const totalCashInvested =
    purchasePrice * downPaymentPct + purchasePrice * closingCostPct + hardeningRetrofitCost;

  const grossRevenue = (year: number) => rentAnnual0 * Math.pow(1 + rentGrowth, year - 1);
  const effectiveRevenue = (year: number) => grossRevenue(year) * (1 - vacancy);
  const operatingExpenses = (year: number) => {
    const eg = Math.pow(1 + expenseGrowth, year - 1);
    const value = purchasePrice * Math.pow(1 + appreciation, year - 1);
    const tax = value * (i.propertyTaxPct ?? 0);
    const insurance = (i.insuranceAnnual ?? 0) * eg; // elevated WUI premium
    const maintenance = grossRevenue(year) * (i.maintenancePct ?? 0);
    const management = effectiveRevenue(year) * (i.managementPct ?? 0);
    return tax + insurance + maintenance + management;
  };

  const outcome = computeHold({
    price: purchasePrice,
    loanAmount,
    annualRate: rate,
    termYears: term,
    appreciation,
    grossRevenue,
    effectiveRevenue,
    operatingExpenses,
    totalCashInvested,
    sellingPct: sellingCostPct,
    holdYears,
  });

  const yieldOnCost = guardDiv(outcome.noi, purchasePrice + hardeningRetrofitCost);
  const insurabilityRentPremium = rentPremiumPct;
  // Year-1 annualized dollar premium from insurability, and the payback on the retrofit.
  const annualRentPremium = monthlyRent * rentPremiumPct * 12;
  const retrofitPaybackYears = guardDiv(hardeningRetrofitCost, Math.max(annualRentPremium, 1));

  const warnings: string[] = [
    'The insurability premium is the thesis: it assumes hardened homes stay insurable and rentable while un-hardened comps do not. Verify current insurance availability before underwriting.',
  ];
  const dscrVal = dscr(outcome.noi, outcome.debtService);
  if (Number.isFinite(dscrVal) && dscrVal < 1.2) warnings.push(`DSCR ${dscrVal.toFixed(2)}× is below 1.20.`);
  if (outcome.core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative — elevated WUI insurance is a heavy line item.');

  return {
    metrics: {
      ...outcome.core,
      yieldOnCost,
      insurabilityRentPremium,
      retrofitPaybackYears,
    },
    projection: outcome.projection,
    warnings,
  };
}

export const wildfireHardenedArb: InvestmentModule = {
  id: 'wildfire-hardened-arb',
  name: 'Wildfire-Hardened Arbitrage',
  category: 'Novel',
  tier: 'novel',
  blurb: 'Buy a fire-discounted WUI home, harden it, capture an insurability premium.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price (fire-discounted)', type: 'currency', unit: '$', default: 360_000, min: 0, step: 5000, group: 'Financing', verify: true, help: 'A WUI home marked down for fire risk. Verify the discount vs. non-WUI comps is real and the risk is retrofittable.' },
    { key: 'hardeningRetrofitCost', label: 'Hardening retrofit cost', type: 'currency', unit: '$', default: 55_000, min: 0, step: 2500, group: 'Financing', verify: true, help: 'Class-A roof, ember-resistant vents, non-combustible siding, defensible space. Verify with a wildfire-mitigation contractor.' },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.25, min: 0, max: 1, step: 0.01, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.075, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },

    { key: 'monthlyRent', label: 'Base monthly rent', type: 'currency', unit: '$/mo', default: 2_600, min: 0, step: 50, group: 'Income', verify: true, help: 'Market rent BEFORE the insurability premium. Verify against comps.' },
    { key: 'rentPremiumFromInsurabilityPct', label: 'Insurability rent premium', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.3, step: 0.01, group: 'Income', verify: true, help: 'Extra rent a hardened, insurable home commands as un-hardened comps become uninsurable. The core thesis — verify it exists.' },
    { key: 'vacancyPct', label: 'Vacancy', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.5, step: 0.01, group: 'Income' },
    { key: 'rentGrowthPct', label: 'Rent growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.010, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true },
    { key: 'insuranceAnnual', label: 'Insurance (elevated WUI)', type: 'currency', unit: '$/yr', default: 4_200, min: 0, step: 100, group: 'Expenses', verify: true, help: 'WUI fire insurance is expensive and volatile — and may only be available via a FAIR plan. Verify a current, bindable quote.' },
    { key: 'maintenancePct', label: 'Maintenance', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.3, step: 0.01, group: 'Expenses', help: 'As a fraction of scheduled rent. Includes ongoing defensible-space upkeep.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.2, step: 0.01, group: 'Expenses', help: 'As a fraction of collected rent. Set to 0 if self-managing.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.2, step: 0.005, group: 'Expenses', help: 'WUI insurance can grow faster than general expenses — stress this input.' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', verify: true, help: 'Modest by assumption — WUI markets can de-rate sharply after a fire season.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'yieldOnCost', label: 'Yield on cost', unit: '%', higherIsBetter: true, help: 'Year-1 NOI / (purchase price + retrofit) — the unlevered yield on all-in cost.' },
    { key: 'insurabilityRentPremium', label: 'Insurability rent premium', unit: '%', higherIsBetter: true, help: 'Assumed rent uplift from being hardened and insurable vs. un-hardened comps.' },
    { key: 'retrofitPaybackYears', label: 'Retrofit payback', unit: 'yr', higherIsBetter: false, help: 'Retrofit cost / the year-1 annualized rent premium it unlocks. Ignores the insurability (loss-avoidance) benefit.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy a wildland-urban-interface home **discounted for fire risk**, retrofit it to a hardened standard, and hold it as a rental. The edge is measuring an asset the market cannot yet price: **insurability** — as insurers withdraw and un-hardened neighbors become uninsurable (and therefore un-sellable and un-rentable), a genuinely hardened, insurable home is a distinct and scarcer asset that the market still prices as just another WUI house. You pay for the risk on the way in, spend to remove it, and capture the spread in rent, occupancy, and eventual re-sale as the two asset classes visibly diverge.',
    risks: [
      'Novelty risk: thin comps, uncertain exit liquidity, the thesis may simply be wrong — the market may never split hardened from un-hardened pricing, or may de-rate the whole WUI regardless of hardening.',
      'Insurance is the binding constraint: premiums can spike, carriers can exit entirely, and FAIR-plan coverage may be capped or costly — a single renewal can turn the deal negative.',
      'Physical fire risk remains: hardening reduces but does not eliminate loss; a major fire can destroy the home or crater the local market even if your house survives.',
      'Retrofit scope and cost are uncertain, and hardening standards (and any premium credit for them) can change under you.',
    ],
    opportunities: [
      'The discount-in / premium-out spread can be large where insurers are actively withdrawing and buyers/renters increasingly screen for insurability.',
      'Hardening may unlock lower premiums, mitigation credits, or eligibility that un-hardened comps cannot get at any price.',
      'As disclosure of fire risk and insurability becomes standard, a documented hardened home differentiates cleanly at resale.',
    ],
    regulatory:
      'Insurance availability is driven by state regulation and FAIR-plan dynamics that change frequently — verify a current, bindable policy, not a historical premium. Confirm local wildfire-mitigation codes, defensible-space ordinances, and any mitigation-credit programs, and re-check insurability at every renewal before relying on the premium thesis.',
    dataHooks: ['fire-perimeter-history', 'insurer-withdrawal'],
  },
};
