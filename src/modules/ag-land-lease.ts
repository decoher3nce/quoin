import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// Agricultural Land — Cash Rent Lease. Buy farmland and lease it to an operator
// for annual cash rent, holding for the rent stream plus long-run land
// appreciation. This is a low-yield, inflation-hedged store of value: the cash
// return on cost is modest and most of the total return is expected to come from
// the land itself appreciating. Modeled as a financed income hold.

function compute(i: Record<string, number>): ComputeResult {
  const purchasePrice = i.purchasePrice ?? 0;
  const acres = i.acres ?? 1;
  const cashRentPerAcreAnnual = i.cashRentPerAcreAnnual ?? 0;
  const leaseEscalationPct = i.leaseEscalationPct ?? 0;

  const financedPct = i.financedPct ?? 0;
  const interestRate = i.interestRate ?? 0;
  const loanTermYears = i.loanTermYears ?? 20;
  const closingCostPct = i.closingCostPct ?? 0;

  const propertyTaxPct = i.propertyTaxPct ?? 0;
  const insuranceAnnual = i.insuranceAnnual ?? 0;
  const managementPct = i.managementPct ?? 0;

  const appreciationPct = i.appreciationPct ?? 0;
  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const loanAmount = purchasePrice * financedPct;
  const totalCashInvested = purchasePrice * (1 - financedPct) + purchasePrice * closingCostPct;

  const grossRevenue = (year: number) =>
    cashRentPerAcreAnnual * acres * Math.pow(1 + leaseEscalationPct, year - 1);
  const effectiveRevenue = grossRevenue; // cash-rent lease: no vacancy or credit loss modeled
  const operatingExpenses = (year: number) => {
    const value = purchasePrice * Math.pow(1 + appreciationPct, year - 1);
    const tax = value * propertyTaxPct;
    const management = grossRevenue(year) * managementPct;
    return tax + insuranceAnnual + management;
  };

  const outcome = computeHold({
    price: purchasePrice,
    loanAmount,
    annualRate: interestRate,
    termYears: loanTermYears,
    appreciation: appreciationPct,
    grossRevenue,
    effectiveRevenue,
    operatingExpenses,
    totalCashInvested,
    sellingPct: sellingCostPct,
    holdYears,
  });

  const yieldOnCost = guardDiv(outcome.noi, purchasePrice);
  const pricePerAcre = guardDiv(purchasePrice, acres);

  const warnings: string[] = [
    'Farmland is a low-yield asset: most of the expected total return comes from appreciation, not the cash-rent yield.',
  ];
  const dscrVal = outcome.core.dscr;
  if (Number.isFinite(dscrVal) && dscrVal < 1.2)
    warnings.push(`DSCR ${dscrVal.toFixed(2)}× is below 1.20 — cash rent barely covers financed debt service.`);
  if (outcome.core.annualCashFlow < 0)
    warnings.push('Year-1 pre-tax cash flow is negative; financed farmland often carries until the exit.');

  return {
    metrics: {
      ...outcome.core,
      yieldOnCost,
      rentPerAcre: cashRentPerAcreAnnual,
      pricePerAcre,
    },
    projection: outcome.projection,
    warnings,
  };
}

export const agLandLease: InvestmentModule = {
  id: 'ag-land-lease',
  name: 'Agricultural Land — Cash Rent Lease',
  category: 'Land',
  tier: 'core',
  blurb: 'Farmland leased for annual cash rent, held for appreciation.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 600_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'All-in farmland acquisition. Verify against county farmland sales and NASS land-value data for the region.' },
    { key: 'acres', label: 'Acres', type: 'number', unit: 'count', default: 160, min: 1, step: 10, group: 'Acquisition', help: 'A quarter section is 160 acres.' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Acquisition' },

    { key: 'cashRentPerAcreAnnual', label: 'Cash rent / acre', type: 'currency', unit: '$/yr', default: 220, min: 0, step: 5, group: 'Income', verify: true, help: 'Annual cash rent per acre. Verify against USDA-NASS county cash-rent surveys and local FSA data.' },
    { key: 'leaseEscalationPct', label: 'Lease escalation', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Income', help: 'Annual rent escalation per the lease. Cash rents move slowly.' },
    { key: 'managementPct', label: 'Management', type: 'percent', unit: '%', default: 0.05, min: 0, max: 0.2, step: 0.01, group: 'Income', help: 'Farm-manager fee as a fraction of gross rent. Set to 0 if self-managing the lease.' },

    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0.5, min: 0, max: 0.9, step: 0.05, group: 'Financing', help: 'Farmland loans (e.g. Farm Credit) typically require substantial equity.' },
    { key: 'interestRate', label: 'Farm loan rate', type: 'percent', unit: '%', default: 0.075, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true, help: 'Verify against a current farmland lender rate sheet.' },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 20, min: 1, max: 30, step: 1, group: 'Financing' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.007, min: 0, max: 0.05, step: 0.001, group: 'Expenses', verify: true, help: 'Ag-use assessment is often below improved-property rates. Verify with the county assessor.' },
    { key: 'insuranceAnnual', label: 'Insurance', type: 'currency', unit: '$/yr', default: 1_200, min: 0, step: 100, group: 'Expenses', help: 'Owner liability / umbrella; the operator typically carries crop insurance.' },

    { key: 'appreciationPct', label: 'Land appreciation', type: 'percent', unit: '%', default: 0.04, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', verify: true, help: 'The main return driver. Verify against long-run NASS farmland-value trends, not a single boom year.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 40, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.06, min: 0, max: 0.12, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'yieldOnCost', label: 'Yield on cost', unit: '%', higherIsBetter: true, help: 'Year-1 NOI / purchase price — the unlevered cash yield on the land.' },
    { key: 'rentPerAcre', label: 'Rent per acre', unit: '$/yr', higherIsBetter: true, help: 'Annual cash rent per acre.' },
    { key: 'pricePerAcre', label: 'Price per acre', unit: '$', higherIsBetter: false, help: 'Purchase price / acres.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy farmland and lease it to an operator for annual **cash rent**, holding for the modest income stream and long-run land **appreciation**. Farmland behaves like a low-yield, inflation-hedged store of value: the cash-on-cash return is thin, and most of the total return is expected to come from the land itself. A cash-rent lease shifts operating and commodity risk to the tenant — the owner trades upside for a predictable check, unlike a crop-share arrangement that keeps the owner exposed to yields and prices.',
    risks: [
      'Low current yield: cash rent barely covers financed debt service, so levered deals often carry negative cash flow until the exit.',
      'Appreciation dependence: the thesis rests on land values, which have had flat and declining stretches, not only booms.',
      'Commodity and water exposure: rents ultimately track crop prices and water availability, both volatile and, for water, increasingly contested.',
      'Illiquidity and concentration: farmland transacts slowly and a single parcel is undiversified across weather and soil quality.',
    ],
    opportunities: [
      'Inflation hedge: land and cash rents have historically tracked or outpaced inflation over long holds.',
      'Cash-rent leases offload operating and commodity risk to the tenant for a steadier owner return.',
      'Optionality: appreciation can be amplified by future rezoning, solar/wind lease overlays, or path-of-growth conversion.',
    ],
    regulatory:
      'Confirm the ag-use tax assessment, any conservation-program enrollments (which can restrict use), water and mineral rights, and lease terms before relying on the rent or appreciation assumptions.',
    dataHooks: ['ndvi-cropland', 'insar-velocity'],
  },
};
