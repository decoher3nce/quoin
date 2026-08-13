import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr, guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// Experiential STR. Build a unique structure — geodesic dome, A-frame, container
// cabin — on land you own, and charge a premium ADR for the novelty. The catch:
// novelty DECAYS. As the "wow" fades and copycats appear nearby, the ADR premium
// erodes year over year. Photogenic on day one; a commodity by year five.

function compute(i: Record<string, number>): ComputeResult {
  const landCost = i.landCost ?? 0;
  const buildCost = i.buildCost ?? 0;
  const price = landCost + buildCost;

  const financedPct = i.financedPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 20;
  const furnishing = i.furnishingCost ?? 0;

  const adr = i.adr ?? 0;
  const occ = i.occupancyPct ?? 0;
  const platformFee = i.platformFeePct ?? 0;
  const noveltyDecay = i.noveltyDecayPct ?? 0;
  const revGrowth = i.revenueGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;

  const suppliesPct = i.suppliesPct ?? 0;
  const managementPct = i.managementPct ?? 0;
  const maintenancePct = i.maintenancePct ?? 0;
  const variablePct = suppliesPct + managementPct + maintenancePct;

  const loanAmount = price * financedPct;
  const totalCashInvested = price * (1 - financedPct) + furnishing;

  // ADR erodes with novelty decay; an underlying revenue-growth term can partly
  // offset it (better ops, inflation), but decay usually dominates early.
  const grossRevenue = (y: number) =>
    adr * Math.pow(1 - noveltyDecay, y - 1) * 365 * occ * Math.pow(1 + revGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y) * (1 - platformFee);
  const fixedOpex = (y: number) => {
    const eg = Math.pow(1 + expenseGrowth, y - 1);
    const value = price * Math.pow(1 + (i.appreciationPct ?? 0), y - 1);
    return (
      value * (i.propertyTaxPct ?? 0) +
      (i.insuranceAnnual ?? 0) * eg +
      (i.utilitiesMonthly ?? 0) * 12 * eg
    );
  };
  const operatingExpenses = (y: number) => fixedOpex(y) + grossRevenue(y) * variablePct;

  const { core, projection, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation: i.appreciationPct ?? 0,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  // Break-even occupancy (year 1, before decay bites).
  const marginPerRevenue = 1 - platformFee - variablePct;
  const revNeeded = guardDiv(fixedOpex(1) + debtService, marginPerRevenue);
  const breakEvenOccupancy = adr > 0 ? guardDiv(revNeeded, adr * 365) : NaN;
  const revPAN = adr * occ;
  const buildCostRecoveryYears = guardDiv(buildCost, Math.max(noi, 1));

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > occ)
    warnings.push(`Modeled occupancy ${(occ * 100).toFixed(0)}% is below break-even ${(breakEvenOccupancy * 100).toFixed(0)}%.`);
  if (noveltyDecay >= 0.04)
    warnings.push(`Novelty decay ${(noveltyDecay * 100).toFixed(0)}%/yr erodes the ADR premium quickly — later-year cash flow is well below year 1.`);
  if (Number.isFinite(d) && d < 1.2) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.20.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative.');

  return {
    metrics: { ...core, breakEvenOccupancy, revPAN, buildCostRecoveryYears },
    projection,
    warnings,
  };
}

export const strExperiential: InvestmentModule = {
  id: 'str-experiential',
  name: 'Experiential STR — Unique Structure',
  category: 'Hospitality',
  tier: 'creative',
  blurb: 'Build a dome/A-frame/container on your land; premium ADR that decays as novelty fades.',
  params: [
    { key: 'landCost', label: 'Land cost', type: 'currency', unit: '$', default: 90_000, min: 0, step: 2500, group: 'Acquisition', verify: true, help: 'Verify buildable status, access, and utilities before assuming any structure can go up.' },
    { key: 'buildCost', label: 'Build cost', type: 'currency', unit: '$', default: 160_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'Non-standard structures carry cost and schedule risk. Verify a real contractor quote, not a kit price.' },
    { key: 'furnishingCost', label: 'Furnishing & setup', type: 'currency', unit: '$', default: 15_000, min: 0, step: 500, group: 'Acquisition', help: 'Interior, deck, hot tub, photography — the experience is the product.' },

    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.6, min: 0, max: 0.9, step: 0.05, group: 'Financing', help: 'Financing a non-conforming structure is hard; lenders discount or decline unusual builds.' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.085, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Construction/portfolio loans on novel structures price above conventional mortgages.' },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 40, step: 1, group: 'Financing' },

    { key: 'adr', label: 'Average daily rate', type: 'number', unit: '$/night', default: 260, min: 0, step: 5, group: 'Income', verify: true, help: 'The novelty premium. Verify against comparable experiential stays — and remember it is a year-1 figure.' },
    { key: 'occupancyPct', label: 'Occupancy', type: 'percent', unit: '%', default: 0.5, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Remote experiential stays are often seasonal; verify blended annual occupancy.' },
    { key: 'noveltyDecayPct', label: 'Novelty decay', type: 'percent', unit: '%', default: 0.04, min: 0, max: 0.2, step: 0.005, group: 'Income', verify: true, help: 'Annual erosion of the ADR premium as the wow fades and copycats appear. The signature risk of this model.' },
    { key: 'platformFeePct', label: 'Platform fee', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.2, step: 0.005, group: 'Income' },
    { key: 'revenueGrowthPct', label: 'Underlying revenue growth', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Income', help: 'Ops/inflation tailwind applied before novelty decay. Decay usually dominates early.' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.009, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 2_800, min: 0, step: 100, group: 'Expenses', verify: true, help: 'Non-standard structures and rural/wildfire exposure raise premiums.' },
    { key: 'utilitiesMonthly', label: 'Utilities', type: 'currency', unit: '$/mo', default: 260, min: 0, step: 20, group: 'Expenses', help: 'Off-grid or well/septic sites can run higher than a metro unit.' },
    { key: 'suppliesPct', label: 'Supplies & consumables', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.2, step: 0.005, group: 'Expenses' },
    { key: 'managementPct', label: 'Management / co-host', type: 'percent', unit: '%', default: 0.2, min: 0, max: 0.4, step: 0.01, group: 'Expenses', verify: true, help: 'Remote sites often need full-service management. Set to 0 if self-managing nearby.' },
    { key: 'maintenancePct', label: 'Maintenance & turnover', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.2, step: 0.005, group: 'Expenses', help: 'Unusual structures can be costlier to maintain — special glazing, custom parts.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Land appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Land may appreciate; the structure itself depreciates. A conservative blended figure.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.15, step: 0.005, group: 'Exit', help: 'Niche structures appraise poorly and sell to a thin buyer pool — higher frictions.' },
  ],
  metrics: [
    { key: 'breakEvenOccupancy', label: 'Break-even occupancy', unit: '%', higherIsBetter: false, help: 'Year-1 occupancy at which cash flow is zero, before novelty decay bites.' },
    { key: 'revPAN', label: 'Revenue / available night', unit: '$/night', higherIsBetter: true, help: 'Year-1 ADR × occupancy — the peak nightly yield, which decays thereafter.' },
    { key: 'buildCostRecoveryYears', label: 'Build-cost recovery', unit: 'yr', higherIsBetter: false, help: 'Build cost ÷ year-1 NOI — years of stabilized income to earn back the structure spend.' },
  ],
  compute,
  narrative: {
    strategy:
      'Build a photogenic, one-of-a-kind structure on land you own and charge a **novelty premium** for the experience. Early ADR can be exceptional because there is nothing else like it — but that premium is a **decaying asset**. As the novelty fades and copycats appear on nearby parcels, the achievable rate erodes year over year, so the model front-loads its returns. Underwrite the later, decayed years, not the launch-week Instagram numbers.',
    risks: [
      'Novelty decay: the ADR premium erodes annually, and nothing stops a neighbor from building the same dome next door.',
      'Permitting for non-standard structures is uncertain — county building departments may not have a code path, delaying or blocking the build.',
      'Financing and appraisal are hard: no comparable sales means lenders discount the asset and an exit buyer pool is thin.',
      'Higher build, insurance, and maintenance costs on unusual structures compress margins versus a conventional cabin.',
    ],
    opportunities: [
      'Peak-novelty ADR can far exceed a standard rural rental and drives outsized organic/social marketing.',
      'A distinctive, well-branded property can build a direct-booking following that outlives the novelty premium.',
      'Land retains value independent of the structure, providing a floor and optionality (add sites, re-theme, sell the parcel).',
    ],
    regulatory:
      'Two gates precede any revenue. First, LAND USE: verify zoning permits both the structure type and short-term lodging, plus septic/well and access. Second, STR legality: county permits, caps, and lodging taxes apply as they do to any nightly rental. A novel structure with no code path or no STR permit is an expensive lawn ornament — verify both before building.',
    dataHooks: ['viirs-radiance'],
  },
};
