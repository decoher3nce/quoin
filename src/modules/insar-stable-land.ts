import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv } from '../core/finance';
import { computeHold } from './_shapes';

// InSAR-Stable Land. Buy parcels the market has discounted because they sit
// inside a "sinking region" polygon — but that specific parcel is geotechnically
// stable per InSAR ground-motion data. The thesis is a re-rating: as stability is
// recognized (survey, InSAR track record, a neighbor's failure that spares you),
// part of the subsidence discount closes. No income — a pure carry-and-appreciate
// play, modeled like raw land. cap rate and cash-on-cash are negative by
// construction; the discount-capture upside is shown separately, NOT baked into
// the IRR, to keep the headline honest.

function compute(i: Record<string, number>): ComputeResult {
  const marketComparablePrice = i.marketComparablePrice ?? 0;
  const discountVsComps = i.discountVsComps ?? 0;
  const acres = i.acres ?? 1;
  const closingCostPct = i.closingCostPct ?? 0;
  const annualCarryCost = i.annualCarryCost ?? 0;
  const appreciationPct = i.appreciationPct ?? 0;
  const discountCaptureAtExitPct = i.discountCaptureAtExitPct ?? 0;
  const holdYears = Math.round(i.holdYears ?? 5);
  const sellingCostPct = i.sellingCostPct ?? 0;

  const purchasePrice = marketComparablePrice * (1 - discountVsComps);
  const loanAmount = 0;
  const totalCashInvested = purchasePrice + purchasePrice * closingCostPct;

  const grossRevenue = () => 0;
  const effectiveRevenue = () => 0;
  const operatingExpenses = () => annualCarryCost;

  const outcome = computeHold({
    price: purchasePrice,
    loanAmount,
    annualRate: 0,
    termYears: 1,
    appreciation: appreciationPct,
    grossRevenue,
    effectiveRevenue,
    operatingExpenses,
    totalCashInvested,
    sellingPct: sellingCostPct,
    holdYears,
  });

  // The re-rating upside: a slice of the subsidence discount that the thesis says
  // closes at exit. Reported as a discrete dollar value, deliberately kept OUT of
  // the IRR so the base-case return does not silently assume the thesis is right.
  const discountCapturedValue = marketComparablePrice * discountCaptureAtExitPct;
  const pricePerAcre = guardDiv(purchasePrice, acres);

  // Annual appreciation needed just to recover cash + carry, net of selling costs.
  const breakEvenAppreciation =
    purchasePrice > 0
      ? Math.pow(
          guardDiv(
            totalCashInvested + annualCarryCost * holdYears,
            (1 - sellingCostPct) * purchasePrice,
          ),
          1 / Math.max(holdYears, 1),
        ) - 1
      : NaN;

  const warnings: string[] = [
    'No operating income: cap rate and cash-on-cash are negative by construction — you pay to hold.',
    'The re-rating (discount-capture) upside is speculative and is NOT included in the IRR; the base case assumes only ordinary appreciation.',
  ];
  if (discountVsComps <= 0)
    warnings.push('No discount vs comps modeled — without a discount to capture, the thesis has no edge.');

  return {
    metrics: {
      ...outcome.core,
      pricePerAcre,
      discountCapturedValue,
      breakEvenAppreciation,
    },
    projection: outcome.projection,
    warnings,
  };
}

export const insarStableLand: InvestmentModule = {
  id: 'insar-stable-land',
  name: 'InSAR-Stable Land — Subsidence Re-Rating',
  category: 'Novel',
  tier: 'novel',
  blurb: 'Buy stable parcels discounted inside a "sinking region"; re-rate on recognition.',
  params: [
    { key: 'marketComparablePrice', label: 'Comparable (undiscounted) price', type: 'currency', unit: '$', default: 120_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'What a like parcel OUTSIDE the fear zone trades for. Verify with recent comps.' },
    { key: 'discountVsComps', label: 'Discount vs comps', type: 'percent', unit: '%', default: 0.30, min: 0, max: 0.8, step: 0.01, group: 'Acquisition', verify: true, help: 'How far below comps you buy, due to blanket subsidence fear. Verify the actual discount is real and available.' },
    { key: 'acres', label: 'Parcel size', type: 'number', unit: 'count', default: 10, min: 0.1, step: 1, group: 'Acquisition', help: 'Acres.' },
    { key: 'closingCostPct', label: 'Closing costs', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Acquisition' },

    { key: 'annualCarryCost', label: 'Annual carry cost', type: 'currency', unit: '$/yr', default: 800, min: 0, step: 50, group: 'Carry', help: 'Property tax, liability, and upkeep while holding.' },

    { key: 'appreciationPct', label: 'Appreciation', type: 'percent', unit: '%', default: 0.03, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', verify: true, help: 'Ordinary appreciation, separate from the discount-capture thesis. Verify against parcel comps.' },
    { key: 'discountCaptureAtExitPct', label: 'Discount captured at exit', type: 'percent', unit: '%', default: 0.20, min: 0, max: 0.6, step: 0.01, group: 'Exit', verify: true, help: 'Fraction of the comp price recovered as the stability is recognized. Highly uncertain — verify the mechanism (survey, InSAR record, comparable re-rating).' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
    { key: 'sellingCostPct', label: 'Selling costs', type: 'percent', unit: '%', default: 0.07, min: 0, max: 0.15, step: 0.005, group: 'Exit' },
  ],
  metrics: [
    { key: 'pricePerAcre', label: 'Price per acre', unit: '$', higherIsBetter: false, help: 'Discounted purchase price / acres.' },
    { key: 'discountCapturedValue', label: 'Discount captured at exit', unit: '$', higherIsBetter: true, help: 'Speculative re-rating value: comp price × capture fraction. Shown separately; NOT in the IRR.' },
    { key: 'breakEvenAppreciation', label: 'Break-even appreciation', unit: '%', higherIsBetter: false, help: 'Annual appreciation needed just to recover cash and carry, net of selling costs — ignoring any re-rating.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy parcels that sit inside a region the market has blanket-discounted for **subsidence**, but which InSAR ground-motion data shows are actually **stable**. The edge is measuring an asset the market cannot yet price: **geotechnical stability at the individual-parcel level**, where the market prices at the region level and paints every parcel with the same fear. You buy below comps and wait for the discount to close as stability is recognized. There is no income — this is a carry-and-appreciate bet, and the re-rating is a thesis, not a schedule.',
    risks: [
      'Novelty risk: thin comps, uncertain exit liquidity, the thesis may simply be wrong — the discount may never close, or the whole region may keep its stigma regardless of any one parcel.',
      'InSAR shows past motion, not a guarantee of future stability; a stable track record can end, and localized ground behavior is hard to certify to a buyer or lender.',
      'The market may be discounting for reasons beyond subsidence (water, access, insurability) that stability does not fix.',
      'No income plus a speculative catalyst means a long, uncertain hold with certain carry costs.',
    ],
    opportunities: [
      'Buying meaningfully below comps builds in a margin of safety even if the full re-rating never arrives.',
      'As InSAR and geotechnical data become mainstream in underwriting, parcel-level stability could be recognized and priced.',
      'A documented stability record (survey + InSAR history) can be packaged to de-risk the exit for a specific buyer or lender.',
    ],
    regulatory:
      'Subsidence zones often carry disclosure, insurance, and lending constraints. Confirm hazard-disclosure requirements, whether title/hazard insurance is available, and any groundwater-management-district rules that drive the underlying subsidence before relying on any re-rating.',
    dataHooks: ['insar-velocity'],
  },
};
