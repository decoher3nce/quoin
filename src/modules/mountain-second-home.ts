import type { InvestmentModule, ComputeResult } from '../core/types';
import { dscr } from '../core/finance';
import { computeHold } from './_shapes';

// Mountain Second Home. Primarily a lifestyle (consumption) asset, partially
// offset by renting it out on the nights you are not there. Modeled honestly as
// a hold with a rental offset: the carry (mortgage, tax, insurance, HOA,
// utilities) is real every year and rarely fully covered by rental income, so
// pre-tax cash flow is expected to be negative. The return, if any, is
// appreciation plus the value of your own use — not cash yield.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const downPct = i.downPaymentPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 30;
  const appreciation = i.appreciationPct ?? 0;

  const personalUseNights = i.personalUseNights ?? 0;
  const availableNights = Math.max(365 - personalUseNights, 0);
  const adr = i.rentalAdr ?? 0;
  const occ = i.rentalOccupancyOfAvailable ?? 0;
  const mgmtPct = i.mgmtPct ?? 0;
  const maintenancePct = i.maintenancePct ?? 0;

  const loanAmount = price * (1 - downPct);
  const totalCashInvested = price * downPct + price * (i.closingCostPct ?? 0);

  const grossRevenue0 = adr * availableNights * occ;

  const grossRevenue = (_y: number) => grossRevenue0;
  // Platform / management take reduces what actually lands in the owner's pocket.
  const effectiveRevenue = (y: number) => grossRevenue(y) * (1 - mgmtPct);
  const operatingExpenses = (y: number) => {
    const value = price * Math.pow(1 + appreciation, y - 1);
    const tax = value * (i.propertyTaxPct ?? 0);
    const insurance = i.insuranceAnnual ?? 0;
    const hoa = (i.hoaMonthly ?? 0) * 12;
    const utilities = (i.utilitiesMonthly ?? 0) * 12;
    const maintenance = grossRevenue(y) * maintenancePct; // turnover cleaning/repairs scale with rental use
    return tax + insurance + hoa + utilities + maintenance;
  };

  const { core, projection, debtService, noi } = computeHold({
    price, loanAmount, annualRate: rate, termYears: term, appreciation,
    grossRevenue, effectiveRevenue, operatingExpenses,
    totalCashInvested, sellingPct: i.sellingCostPct ?? 0, holdYears: i.holdYears ?? 5,
  });

  const opportunityCostAnnual = totalCashInvested * (i.opportunityCostRate ?? 0);
  const netAnnualCarryCost = -core.annualCashFlow; // positive = out-of-pocket to hold
  const rentalOffset = noi; // annual rental NOI, i.e. what the rental contributes toward carry

  const warnings: string[] = [
    'This is primarily a lifestyle purchase. Rental income offsets carry but rarely covers it — expect to pay to hold it.',
  ];
  if (core.annualCashFlow < 0)
    warnings.push(`Year-1 pre-tax cash flow is negative (about $${Math.round(netAnnualCarryCost).toLocaleString()}/yr out of pocket before your own use).`);
  const d = dscr(noi, debtService);
  if (Number.isFinite(d) && d < 1) warnings.push(`Rental NOI covers only ${(d).toFixed(2)}× of debt service — the rest is on you.`);

  return {
    metrics: {
      ...core,
      netAnnualCarryCost,
      opportunityCostAnnual,
      rentalOffset,
    },
    projection,
    warnings,
  };
}

export const mountainSecondHome: InvestmentModule = {
  id: 'mountain-second-home',
  name: 'Mountain Second Home',
  category: 'Residential',
  tier: 'core',
  blurb: 'Lifestyle mountain home, partially offset by rental. Expect negative cash flow.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 750_000, min: 0, step: 10000, group: 'Financing', verify: true },
    { key: 'downPaymentPct', label: 'Down payment', type: 'percent', unit: '%', default: 0.3, min: 0, max: 1, step: 0.01, group: 'Financing', help: 'Second-home loans typically require more down than a primary residence.' },
    { key: 'interestRate', label: 'Interest rate', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 30, min: 1, max: 40, step: 1, group: 'Financing' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.03, min: 0, max: 0.1, step: 0.005, group: 'Financing' },
    { key: 'personalUseNights', label: 'Personal-use nights', type: 'integer', unit: 'count', default: 60, min: 0, max: 365, step: 5, group: 'Rental', help: 'Nights you use it yourself. These are unavailable for rent.' },
    { key: 'rentalAdr', label: 'Rental ADR', type: 'number', unit: '$/night', default: 250, min: 0, step: 10, group: 'Rental', verify: true, help: 'Average nightly rate on the nights you rent. Verify against comparable mountain listings.' },
    { key: 'rentalOccupancyOfAvailable', label: 'Occupancy of available', type: 'percent', unit: '%', default: 0.45, min: 0, max: 1, step: 0.01, group: 'Rental', verify: true, help: 'Fraction of the AVAILABLE (non-personal) nights that actually book. Resort demand is seasonal.' },
    { key: 'mgmtPct', label: 'Platform / management', type: 'percent', unit: '%', default: 0.2, min: 0, max: 0.4, step: 0.01, group: 'Rental', help: 'Remote mountain homes usually need full-service management. Fraction of gross rental revenue.' },
    { key: 'maintenancePct', label: 'Maintenance & turnover', type: 'percent', unit: '%', default: 0.08, min: 0, max: 0.3, step: 0.01, group: 'Expenses', help: 'Fraction of gross rental revenue — cleaning and wear scale with guest nights.' },
    { key: 'utilitiesMonthly', label: 'Utilities', type: 'currency', unit: '$/mo', default: 300, min: 0, step: 25, group: 'Expenses', help: 'Heat, power, water, internet — paid year-round even when empty.' },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 2_400, min: 0, step: 100, group: 'Expenses', verify: true, help: 'Mountain/wildfire zones can carry elevated premiums. Verify availability and cost.' },
    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.009, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true },
    { key: 'hoaMonthly', label: 'HOA dues', type: 'currency', unit: '$/mo', default: 150, min: 0, step: 25, group: 'Expenses' },
    { key: 'opportunityCostRate', label: 'Opportunity cost rate', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.2, step: 0.005, group: 'Exit', help: 'Return your down payment + closing could earn elsewhere. Used to value the tied-up equity.' },
    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', help: 'Assumption, not a forecast.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'netAnnualCarryCost', label: 'Net annual carry cost', unit: '$/yr', higherIsBetter: false, help: 'Out-of-pocket per year to hold after rental offset (year-1). Higher is worse.' },
    { key: 'opportunityCostAnnual', label: 'Opportunity cost of equity', unit: '$/yr', higherIsBetter: false, help: 'What the down payment + closing could have earned elsewhere at the opportunity-cost rate.' },
    { key: 'rentalOffset', label: 'Rental offset (NOI)', unit: '$/yr', higherIsBetter: true, help: 'Annual rental net operating income applied against the carry.' },
  ],
  compute,
  narrative: {
    strategy:
      'A mountain second home is mostly **consumption, not investment** — and the honest model says so. You are buying nights of your own use; renting it on the other nights offsets some of the carry but, at realistic resort occupancy and full-service management costs, rarely covers the mortgage, tax, insurance, HOA, and utilities. Pre-tax cash flow is **negative by design**. The real return, if it materializes, is appreciation plus the personal value of the use — weighed against the **opportunity cost** of the equity you have locked into it.',
    risks: [
      'Negative cash flow every year: this asset costs money to hold, before any downturn.',
      'Resort rental demand is seasonal and volatile; a soft winter or event cancellation hits occupancy hard.',
      'Mountain-specific costs — wildfire/flood insurance, snow removal, remote-management premiums — run high and rise fast.',
      'Second homes are illiquid and cyclical; they often sell slowest exactly when you most need to.',
    ],
    opportunities: [
      'Genuine personal use has real value that a pure spreadsheet return understates.',
      'Rental income can meaningfully blunt the carry on the nights you are away.',
      'Desirable, supply-constrained mountain markets can appreciate well over a long hold.',
    ],
    regulatory:
      'Many mountain towns restrict or cap short-term rentals and levy lodging taxes. Confirm STR legality, permit availability, and any personal-use / rental-mix rules before assuming any rental offset.',
    dataHooks: ['viirs-radiance'],
  },
};
