import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr, guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// Glamping / RV Park. Develop land into rentable sites (RV pads, safari tents,
// yurts, cabins) and earn revenue per site-night. Lower capital per key than
// building cabins, but highly seasonal and weather-exposed, and revenue is spread
// thin across many low-rate sites. The signature metric is revenue per available
// site-night.

function compute(i: Record<string, number>): ComputeResult {
  const landCost = i.landCost ?? 0;
  const siteDevelopmentCostPerSite = i.siteDevelopmentCostPerSite ?? 0;
  const numberOfSites = i.numberOfSites ?? 0;
  const price = landCost + siteDevelopmentCostPerSite * numberOfSites;

  const financedPct = i.financedPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 20;

  const avgNightlyRatePerSite = i.avgNightlyRatePerSite ?? 0;
  const annualizedOccupancy = i.annualizedOccupancy ?? 0;
  const opexRatio = i.opexRatioOfRevenue ?? 0;
  const amenitiesFixedCostAnnual = i.amenitiesFixedCostAnnual ?? 0;
  const revGrowth = i.revGrowthPct ?? 0;

  const loanAmount = price * financedPct;
  const totalCashInvested = price * (1 - financedPct);

  const grossRevenue = (y: number) =>
    numberOfSites * avgNightlyRatePerSite * 365 * annualizedOccupancy * Math.pow(1 + revGrowth, y - 1);
  const effectiveRevenue = (y: number) => grossRevenue(y);
  const operatingExpenses = (y: number) =>
    grossRevenue(y) * opexRatio + amenitiesFixedCostAnnual * Math.pow(1 + revGrowth, y - 1);

  const { core, projection, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation: i.appreciationPct ?? 0,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  const revPASN = avgNightlyRatePerSite * annualizedOccupancy; // revenue per available site-night
  const pricePerSite = guardDiv(price, numberOfSites);
  const capacitySiteNights = numberOfSites * avgNightlyRatePerSite * 365 * (1 - opexRatio);
  const breakEvenOccupancy = guardDiv(amenitiesFixedCostAnnual + debtService, capacitySiteNights);

  const warnings: string[] = [];
  const d = dscr(noi, debtService);
  if (Number.isFinite(breakEvenOccupancy) && breakEvenOccupancy > annualizedOccupancy)
    warnings.push(`Modeled occupancy ${(annualizedOccupancy * 100).toFixed(0)}% is below break-even ${(breakEvenOccupancy * 100).toFixed(0)}%.`);
  if (Number.isFinite(d) && d < 1.25) warnings.push(`DSCR ${d.toFixed(2)}× is below 1.25.`);
  if (core.annualCashFlow < 0) warnings.push('Year-1 pre-tax cash flow is negative.');
  if (annualizedOccupancy > 0.55) warnings.push(`Annualized occupancy ${(annualizedOccupancy * 100).toFixed(0)}% is high for a seasonal camping product.`);

  return {
    metrics: { ...core, revPASN, pricePerSite, breakEvenOccupancy },
    projection,
    warnings,
  };
}

export const glampingRv: InvestmentModule = {
  id: 'glamping-rv',
  name: 'Glamping / RV Park',
  category: 'Hospitality',
  tier: 'creative',
  blurb: 'Develop land into rentable sites; revenue per site-night. Lower capital than cabins, highly seasonal.',
  params: [
    { key: 'landCost', label: 'Land cost', type: 'currency', unit: '$', default: 250_000, min: 0, step: 10_000, group: 'Acquisition', verify: true, help: 'Verify zoning permits campground/RV use and that water/septic/power can be brought to the sites.' },
    { key: 'numberOfSites', label: 'Number of sites', type: 'integer', unit: 'count', default: 20, min: 1, step: 1, group: 'Acquisition' },
    { key: 'siteDevelopmentCostPerSite', label: 'Site development cost', type: 'currency', unit: '$', default: 30_000, min: 0, step: 1000, group: 'Acquisition', verify: true, help: 'Per-site: pad, hookups (water/sewer/electric), septic, or a furnished tent/structure. Verify against real site-work bids.' },

    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.6, min: 0, max: 0.9, step: 0.05, group: 'Financing' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.085, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 30, step: 1, group: 'Financing' },

    { key: 'avgNightlyRatePerSite', label: 'Avg nightly rate per site', type: 'number', unit: '$/night', default: 120, min: 0, step: 5, group: 'Operations', verify: true, help: 'Blended across site types. Verify against comparable parks/glamping listings in the area.' },
    { key: 'annualizedOccupancy', label: 'Annualized occupancy', type: 'percent', unit: '%', default: 0.32, min: 0, max: 1, step: 0.01, group: 'Operations', verify: true, help: 'Site-nights sold / (sites × 365). Camping is strongly seasonal; the annualized figure is low by nature.' },
    { key: 'opexRatioOfRevenue', label: 'Operating expense ratio', type: 'percent', unit: '%', default: 0.52, min: 0, max: 1, step: 0.01, group: 'Operations', help: 'Cleaning, grounds, reservations, utilities, OTA fees, seasonal staffing — as a fraction of revenue.' },
    { key: 'amenitiesFixedCostAnnual', label: 'Fixed amenities cost', type: 'currency', unit: '$/yr', default: 30_000, min: 0, step: 2500, group: 'Operations', help: 'Bathhouse, wifi, common areas, insurance, base staffing — largely fixed regardless of occupancy.' },
    { key: 'revGrowthPct', label: 'Revenue growth', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Operations' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.15, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'revPASN', label: 'Revenue / available site-night', unit: '$/night', higherIsBetter: true, help: 'Nightly rate × annualized occupancy — the blended yield per site per night.' },
    { key: 'pricePerSite', label: 'All-in cost per site', unit: '$', higherIsBetter: false, help: '(Land + site development) ÷ sites. The capital efficiency of the build.' },
    { key: 'breakEvenOccupancy', label: 'Break-even occupancy', unit: '%', higherIsBetter: false, help: 'Annualized occupancy at which fixed amenities cost and debt are covered. Lower is safer.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy land and develop it into rentable sites — RV pads with hookups, safari tents, yurts, or simple cabins — earning revenue **per site-night**. Capital per key is far lower than building hard-sided cabins, and demand for outdoor/experiential stays has grown. But the model spreads a modest nightly rate across many sites and a **short, weather-dependent season**, so the annualized occupancy is inherently low and fixed amenity costs must be covered by a concentrated peak. Underwrite the season, not the sunny-Saturday snapshot.',
    risks: [
      'Seasonality and weather: revenue concentrates in a few months, and a rainy or smoky season directly cuts bookings.',
      'Low rate per site means fixed amenity and debt costs dominate — break-even occupancy can be surprisingly demanding.',
      'Zoning and permitting for campgrounds/RV parks are restrictive, and septic/water capacity caps how many sites are legal.',
      'Ramp risk: a new park has no reviews or repeat base, and site development frequently overruns on utility work.',
    ],
    opportunities: [
      'Lower capital per site than cabins or motels, with staged buildout — add sites as demand proves out.',
      'Strong and growing experiential/outdoor-recreation demand, especially near parks and natural attractions.',
      'Amenity and premium-site upsells (glamping tents, hot tubs, events) lift blended rate well above a bare RV pad.',
    ],
    regulatory:
      'Campground and RV-park use is zoning-gated and health-department regulated. Verify the parcel is zoned for it (or can be), that septic/well or municipal capacity supports the site count, and confirm building/health permits for bathhouses and hookups. Occupancy/lodging taxes typically apply to site-nights. Many rural counties cap sites or require a conditional-use permit — confirm the legal site count before modeling revenue.',
    dataHooks: ['viirs-radiance'],
  },
};
