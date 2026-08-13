import type { InvestmentModule, ComputeResult } from '../core/types';
import { capRate, cashOnCash, dscr, irr, guardDiv, annualDebtService } from '../core/finance';
import { buildProjection, holdCashflows } from './_projection';

// Raw Land. No NOI — carry costs (tax, maintenance, insurance, optional interest)
// run against appreciation. The whole return lives in the exit. cap rate and
// cash-on-cash come out negative here, which is the honest picture of a pure
// carry asset: you pay to hold it.

function compute(i: Record<string, number>): ComputeResult {
  const price = i.purchasePrice ?? 0;
  const acres = i.acres ?? 1;
  const closingPct = i.closingCostPct ?? 0;

  const financedPct = i.financedPct ?? 0;
  const rate = i.interestRate ?? 0;
  const term = i.loanTermYears ?? 15;

  const appreciation = i.appreciationPct ?? 0;
  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingPct = i.sellingCostPct ?? 0;

  const loanAmount = price * financedPct;
  const downPayment = price - loanAmount;
  const closing = price * closingPct;
  const totalCashInvested = downPayment + closing;

  const grossRevenue = () => 0;
  const effectiveRevenue = () => 0;
  const operatingExpenses = (year: number) => {
    const value = price * Math.pow(1 + appreciation, year - 1);
    const tax = value * (i.propertyTaxPct ?? 0);
    const maintenance = i.annualMaintenance ?? 0; // weed abatement, road, liability
    const insurance = i.annualInsurance ?? 0;
    return tax + maintenance + insurance;
  };

  const horizon = Math.max(holdYears, 5);
  const full = buildProjection(
    { price, loanAmount, annualRate: rate, termYears: term, appreciation, grossRevenue, effectiveRevenue, operatingExpenses },
    horizon,
  );

  const y1 = full[0]!;
  const debtService = loanAmount > 0 ? annualDebtService(rate, term, loanAmount) : 0;
  const noi = y1.noi; // negative: carry only
  const annualCashFlow = y1.cashFlow;

  const irr5yr = irr(holdCashflows(full, totalCashInvested, 5, sellingPct));
  const projection = full.slice(0, holdYears);

  // Appreciation rate required over the hold just to break even net of carry + selling.
  const totalCarry = full.slice(0, holdYears).reduce((s, r) => s - r.cashFlow, 0);
  const needExit = totalCashInvested + totalCarry;
  const grossExitNeeded = guardDiv(needExit, 1 - sellingPct) + loanBalanceAtHold(full, holdYears);
  const breakEvenAppreciation = price > 0 ? Math.pow(guardDiv(grossExitNeeded, price), 1 / Math.max(holdYears, 1)) - 1 : NaN;

  const warnings: string[] = [
    'No operating income: the entire return depends on appreciation and a successful exit.',
  ];
  if (loanAmount > 0) warnings.push('Financed land carries negative cash flow every month until sale — size reserves accordingly.');

  return {
    metrics: {
      annualCashFlow,
      monthlyCashFlow: annualCashFlow / 12,
      cashOnCash: cashOnCash(annualCashFlow, totalCashInvested),
      capRate: capRate(noi, price),
      dscr: dscr(noi, debtService),
      irr5yr,
      totalCashInvested,
      pricePerAcre: guardDiv(price, acres),
      breakEvenAppreciation,
    },
    projection,
    warnings,
  };
}

function loanBalanceAtHold(rows: ReturnType<typeof buildProjection>, holdYears: number): number {
  const row = rows[Math.min(holdYears, rows.length) - 1];
  return row ? row.loanBalance : 0;
}

export const rawLand: InvestmentModule = {
  id: 'raw-land',
  name: 'Raw Land — Buy & Hold',
  category: 'Land',
  tier: 'core',
  blurb: 'Undeveloped parcel: carry costs vs. appreciation. No NOI.',
  params: [
    { key: 'purchasePrice', label: 'Purchase price', type: 'currency', unit: '$', default: 90_000, min: 0, step: 2500, group: 'Acquisition', verify: true },
    { key: 'acres', label: 'Parcel size', type: 'number', unit: 'count', default: 5, min: 0.1, step: 0.5, group: 'Acquisition', help: 'Acres.' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Acquisition' },

    { key: 'financedPct', label: 'Financed portion', type: 'percent', unit: '%', default: 0, min: 0, max: 0.9, step: 0.05, group: 'Financing', help: 'Land loans are expensive and short. 0 = all cash.' },
    { key: 'interestRate', label: 'Land loan rate', type: 'percent', unit: '%', default: 0.09, min: 0, max: 0.2, step: 0.001, group: 'Financing', verify: true },
    { key: 'loanTermYears', label: 'Loan term', type: 'integer', unit: 'yr', default: 15, min: 1, max: 30, step: 1, group: 'Financing' },

    { key: 'propertyTaxPct', label: 'Property tax', type: 'percent', unit: '%', default: 0.008, min: 0, max: 0.05, step: 0.001, group: 'Carry', verify: true, help: 'Vacant-land assessment differs from improved. Verify with the assessor.' },
    { key: 'annualMaintenance', label: 'Maintenance / abatement', type: 'currency', unit: '$/yr', default: 400, min: 0, step: 50, group: 'Carry', help: 'Weed control, road, fencing, liability upkeep.' },
    { key: 'annualInsurance', label: 'Liability insurance', type: 'currency', unit: '$/yr', default: 200, min: 0, step: 50, group: 'Carry' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.04, min: -0.1, max: 0.2, step: 0.005, group: 'Exit', verify: true, help: 'The whole thesis. Verify against recent parcel comps, not metro housing indices.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.15, step: 0.005, group: 'Exit', help: 'Raw land often carries higher brokerage than housing.' },
  ],
  metrics: [
    { key: 'pricePerAcre', label: 'Price per acre', unit: '$', higherIsBetter: false, help: 'Purchase price / acres.' },
    { key: 'breakEvenAppreciation', label: 'Break-even appreciation', unit: '%', higherIsBetter: false, help: 'Annual appreciation needed over the hold just to recover cash and carry, net of selling costs.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy an undeveloped parcel and hold it, betting that appreciation outruns carry. There is **no income** — cap rate and cash-on-cash are negative by construction because you pay taxes and upkeep every year for nothing until you sell. The edge is buying below intrinsic value (mispriced parcel, path-of-growth location, or a future entitlement/utility catalyst) and having the balance sheet to wait.',
    risks: [
      'Illiquidity: land can take many months to sell, and financing for buyers is scarce.',
      'Carry is certain; appreciation is not. A flat decade is a real loss after carry.',
      'Entitlement, access, water, and utility assumptions can be wrong and are expensive to fix.',
      'Land loans are short-term and high-rate; financed carry compounds the downside.',
    ],
    opportunities: [
      'Path-of-growth parcels can re-rate sharply when infrastructure or zoning arrives.',
      'Splitting, entitling, or adding access/utilities can create value beyond passive appreciation.',
      'All-cash buyers face little competition in tight-credit markets.',
    ],
    regulatory:
      'Zoning, buildable status, access easements, and water rights drive value far more than the housing market. Verify each with the county before relying on any appreciation assumption.',
    dataHooks: ['insar-velocity'],
  },
};
