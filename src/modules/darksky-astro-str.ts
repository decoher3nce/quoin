import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Dark-Sky Astro STR. An observatory-cabin short-term rental where the scarce
// asset is DARKNESS: a genuinely dark site (low VIIRS radiance / low Bortle
// class) that lets you charge a premium nightly rate to astrophotographers and
// stargazers. Modeled as a financed STR income hold, mirroring the metro-STR
// shape, with the same signature output: break-even occupancy, the demand floor
// below which the cabin bleeds. The novelty is that the ADR premium rests on a
// measurable sky-quality fact rather than location or amenities.

function compute(i: Record<string, number>): ComputeResult {
  const landCost = i.landCost ?? 0;
  const buildCost = i.buildCost ?? 0;
  const financedPct = i.financedPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 20;
  const furnishingCost = i.furnishingCost ?? 0;

  const adr = i.adr ?? 0;
  const occ = i.occupancy ?? 0;
  const platformFee = i.platformFeePct ?? 0;
  const revGrowth = i.revGrowthPct ?? 0;
  const expenseGrowth = i.expenseGrowthPct ?? 0;
  const appreciation = i.appreciationPct ?? 0;

  const suppliesPct = i.suppliesPct ?? 0;
  const managementPct = i.managementPct ?? 0;
  const maintenancePct = i.maintenancePct ?? 0;
  const variablePct = suppliesPct + managementPct + maintenancePct;

  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const price = landCost + buildCost;
  const loanAmount = price * financedPct;
  const totalCashInvested = price * (1 - financedPct) + furnishingCost;

  const grossRevenue = (year: number) => adr * 365 * occ * Math.pow(1 + revGrowth, year - 1);
  const effectiveRevenue = (year: number) => grossRevenue(year) * (1 - platformFee);
  const fixedOpex = (year: number) => {
    const eg = Math.pow(1 + expenseGrowth, year - 1);
    const value = price * Math.pow(1 + appreciation, year - 1);
    const tax = value * (i.propertyTaxPct ?? 0);
    const insurance = (i.insuranceAnnual ?? 0) * eg;
    const utilities = (i.utilitiesMonthly ?? 0) * 12 * eg;
    return tax + insurance + utilities;
  };
  const operatingExpenses = (year: number) => fixedOpex(year) + grossRevenue(year) * variablePct;

  const outcome = computeHold({
    price,
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

  // Break-even occupancy (year 1): solve cashFlow(occ) = 0.
  const marginPerRevenue = 1 - platformFee - variablePct;
  const fixedPlusDebt = fixedOpex(1) + outcome.debtService;
  const revNeeded = guardDiv(fixedPlusDebt, marginPerRevenue);
  const breakEvenOccupancy = adr > 0 ? guardDiv(revNeeded, adr * 365) : NaN;
  const revPAN = adr * occ;
  const skyQualityPremiumNote = adr; // the nightly rate itself IS the dark-sky premium

  const warnings: string[] = [
    'The ADR premium is the thesis: it assumes travelers will pay materially more for sky quality. Verify against actual booked comps, not aspiration.',
  ];
  const dscrVal = dscr(outcome.noi, outcome.debtService);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > occ)
    warnings.push(`Modeled occupancy ${(occ * 100).toFixed(0)}% is below break-even ${(breakEvenOccupancy * 100).toFixed(0)}% — this configuration loses money.`);
  if (Number.isFinite(dscrVal) && dscrVal < 1.2) warnings.push(`DSCR ${dscrVal.toFixed(2)}× is below 1.20.`);
  if (outcome.core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative.');

  return {
    metrics: {
      ...outcome.core,
      breakEvenOccupancy,
      revPAN,
      skyQualityPremiumNote,
    },
    projection: outcome.projection,
    warnings,
  };
}

export const darkskyAstroStr: InvestmentModule = {
  id: 'darksky-astro-str',
  name: 'Dark-Sky Astro STR',
  category: 'Novel',
  tier: 'novel',
  blurb: 'Observatory-cabin STR where darkness is the scarce, premium-ADR asset.',
  params: [
    { key: 'landCost', label: 'Land cost', type: 'currency', unit: '$', default: 70_000, min: 0, step: 5000, group: 'Acquisition', help: 'Remote dark-sky parcels are cheap — the value is the sky, not the dirt.' },
    { key: 'buildCost', label: 'Cabin build cost', type: 'currency', unit: '$', default: 180_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'All-in build for an off-grid-capable observatory cabin. Remote builds run over budget — verify with a local builder.' },
    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.6, min: 0, max: 0.9, step: 0.05, group: 'Financing', help: 'Raw-land construction financing is harder and more expensive than a metro mortgage.' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.085, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'furnishingCost', label: 'Furnishing & telescope setup', type: 'currency', unit: '$', default: 20_000, min: 0, step: 1000, group: 'Setup', help: 'Furniture, a mounted scope or pier, dark-adapted lighting, listing setup. Up-front capex.' },

    { key: 'adr', label: 'Average daily rate (premium)', type: 'number', unit: '$/night', default: 240, min: 0, step: 5, group: 'Income', verify: true, help: 'The dark-sky premium nightly rate. Verify against actual booked dark-sky cabin comps.' },
    { key: 'occupancy', label: 'Occupancy', type: 'percent', unit: '%', default: 0.5, min: 0, max: 1, step: 0.01, group: 'Income', verify: true, help: 'Remote astro-tourism demand is seasonal and moon-phase-sensitive; keep this conservative.' },
    { key: 'platformFeePct', label: 'Platform fee', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.2, step: 0.005, group: 'Income' },
    { key: 'revGrowthPct', label: 'Revenue growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Income' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.009, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true },
    { key: 'insuranceAnnual', label: 'STR insurance', type: 'currency', unit: '$/yr', default: 2_200, min: 0, step: 100, group: 'Expenses', verify: true, help: 'Remote / wildland exposure can raise premiums.' },
    { key: 'utilitiesMonthly', label: 'Utilities', type: 'currency', unit: '$/mo', default: 180, min: 0, step: 20, group: 'Expenses', help: 'Off-grid power, propane, satellite internet, water.' },
    { key: 'suppliesPct', label: 'Supplies & consumables', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.2, step: 0.005, group: 'Expenses', help: 'As a fraction of gross revenue.' },
    { key: 'managementPct', label: 'Management / co-host', type: 'percent', unit: '%', default: 0.18, min: 0, max: 0.4, step: 0.01, group: 'Expenses', verify: true, help: 'Remote management is harder to staff; verify a real quote.' },
    { key: 'maintenancePct', label: 'Maintenance & turnover', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.2, step: 0.005, group: 'Expenses', help: 'As a fraction of gross revenue.' },
    { key: 'expenseGrowthPct', label: 'Expense growth', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.15, step: 0.005, group: 'Expenses' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', verify: true, help: 'Modest by assumption — remote single-purpose cabins are illiquid.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.15, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'breakEvenOccupancy', label: 'Break-even occupancy', unit: '%', higherIsBetter: false, help: 'Occupancy at which year-1 cash flow is zero. Lower is safer.' },
    { key: 'revPAN', label: 'Revenue / available night', unit: '$/night', higherIsBetter: true, help: 'ADR × occupancy — the blended nightly yield.' },
    { key: 'skyQualityPremiumNote', label: 'Dark-sky premium ADR', unit: '$/night', higherIsBetter: true, help: 'The premium nightly rate itself — sky quality is what justifies charging it. Verify the premium is real.' },
  ],
  compute,
  narrative: {
    strategy:
      'Build and operate a remote observatory cabin as a short-term rental where the product is not the cabin but the **sky above it**. The edge is measuring an asset the market cannot yet price: **darkness** — a genuinely dark site (low night-lights radiance, low Bortle class) that supports a premium nightly rate from astrophotographers and stargazers who cannot get a dark sky near a city at any price. Like any STR the deal lives or dies on **break-even occupancy**, but here demand is thin, seasonal, and moon-phase-sensitive, and the whole premium rests on a sky-quality claim you must actually verify.',
    risks: [
      'Novelty risk: thin comps, uncertain exit liquidity, the thesis may simply be wrong — the dark-sky ADR premium and occupancy may not materialize outside a handful of marquee sites.',
      'Remote operating intensity: cleaning, maintenance, and guest support are far harder and costlier far from a metro, and off-grid systems fail.',
      'Light-pollution creep: nearby development, a new highway, or a mine can erase the exact darkness you underwrote, with no way to get it back.',
      'Wildfire, smoke seasons, road access, and weather can close the site or cloud the very skies the premium depends on.',
    ],
    opportunities: [
      'Truly dark sites are a shrinking resource — protected dark-sky designations nearby can create durable scarcity and marketing.',
      'A verified sky-quality claim (VIIRS / Bortle) differentiates the listing in a way ordinary cabins cannot copy.',
      'Astro-tourism, eclipse events, and a mounted-telescope amenity can lift both ADR and repeat bookings.',
    ],
    regulatory:
      'Remote-site STRs face their own permitting: county short-term-rental rules, septic/well approvals and capacity, fire-defensible-space codes, and off-grid utility compliance. Confirm all of these — and any dark-sky-ordinance lighting restrictions (which help the thesis but constrain the build) — before underwriting.',
    dataHooks: ['viirs-radiance', 'bortle-class'],
  },
};
