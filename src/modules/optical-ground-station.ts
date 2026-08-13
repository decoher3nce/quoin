import type { InvestmentModule, ComputeResult } from '../core/types';
import { guardDiv, npv } from '../core/finance';
import { computeIncomeStream } from './_shapes';

// Optical Ground Station Site Lease. Acquire a clear-sky, low-RF-interference
// parcel and lease it to a LEO optical-downlink (laser-comm) operator, who needs
// a quiet horizon and many clear-sky nights to close a link. The return is a
// contractually escalating ground lease plus the land reversion. This is a
// speculative, novel play: the market of optical-downlink tenants is thin and
// young, and the asset's value rests on a physical fact — cloud-cover
// climatology and RF quiet — that conventional land comps do not price.

function compute(i: Record<string, number>): ComputeResult {
  const acreage = i.acreage ?? 1;
  const landCost = i.landCost ?? 0;
  const annualLease = i.annualLease ?? 0;
  const buildoutCost = i.buildoutCost ?? 0;
  const leaseTermYears = Math.round(i.leaseTermYears ?? 15);
  const escalationPct = i.escalationPct ?? 0;
  const appreciationPct = i.appreciationPct ?? 0;
  const discountRate = i.discountRate ?? 0;

  const capital = landCost + buildoutCost;
  const year1Income = annualLease;

  // Five modeled years of escalating ground rent for the standardized 5-yr core.
  const annualCashflows = Array.from({ length: 5 }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const terminalValue = landCost * Math.pow(1 + appreciationPct, 5);

  const core = computeIncomeStream({
    capital,
    assetPrice: capital,
    annualCashflows,
    terminalValue,
    debtServiceAnnual: 0,
    noiAnnual: year1Income,
  });

  // Full lease-term NPV: every escalating payment across the primary term plus
  // the land reversion, discounted at the (high, speculative) discount rate.
  const fullTermCashflows = Array.from({ length: leaseTermYears }, (_, k) =>
    year1Income * Math.pow(1 + escalationPct, k),
  );
  const npvOfLease = npv(discountRate, [-capital, ...fullTermCashflows, terminalValue]);

  const yieldOnCost = guardDiv(annualLease, capital);
  const leasePerAcre = guardDiv(annualLease, acreage);

  const warnings: string[] = [
    'Speculative tenant base: optical-downlink ground stations are an emerging market with few operators and little leasing precedent.',
  ];
  if (year1Income <= 0)
    warnings.push('No lease income modeled — a site with no signed tenant is a raw-land carry with a specialized thesis.');
  if (npvOfLease < 0)
    warnings.push('Full-term lease NPV is negative at this discount rate — the modeled rent does not clear the cost of capital.');

  return {
    metrics: {
      ...core,
      yieldOnCost,
      npvOfLease,
      leasePerAcre,
    },
    warnings,
  };
}

export const opticalGroundStation: InvestmentModule = {
  id: 'optical-ground-station',
  name: 'Optical Ground Station — Site Lease',
  category: 'Novel',
  tier: 'novel',
  blurb: 'Lease a clear-sky, low-RF parcel to a LEO optical-downlink operator.',
  params: [
    { key: 'acreage', label: 'Parcel size', type: 'number', unit: 'count', default: 40, min: 1, step: 5, group: 'Acquisition', help: 'Acres. An optical ground station needs a clear horizon buffer, not a large footprint.' },
    { key: 'landCost', label: 'Land cost', type: 'currency', unit: '$', default: 180_000, min: 0, step: 5000, group: 'Acquisition', verify: true, help: 'All-in cost to buy the parcel. Verify against local comps AND against the scarcity of clear-sky / low-RF sites.' },
    { key: 'buildoutCost', label: 'Site buildout', type: 'currency', unit: '$', default: 120_000, min: 0, step: 5000, group: 'Acquisition', help: 'Pad, power, fiber backhaul, security, and access the tenant requires. Up-front capex.' },

    { key: 'annualLease', label: 'Annual ground lease', type: 'currency', unit: '$/yr', default: 60_000, min: 0, step: 2500, group: 'Income', verify: true, help: 'The whole thesis. Verify against an actual signed or letter-of-intent lease — there is little public comparable data.' },
    { key: 'escalationPct', label: 'Lease escalation', type: 'percent', unit: '%', default: 0.02, min: 0, max: 0.1, step: 0.005, group: 'Income', verify: true, help: 'Contractual annual escalator.' },
    { key: 'leaseTermYears', label: 'Lease term', type: 'integer', unit: 'yr', default: 15, min: 1, max: 40, step: 1, group: 'Income', verify: true, help: 'Primary term. Nascent-market tenants may resist long terms.' },

    { key: 'appreciationPct', label: 'Land appreciation', type: 'percent', unit: '%', default: 0.02, min: -0.1, max: 0.15, step: 0.005, group: 'Exit', verify: true, help: 'Modest by assumption — a specialized site may not command a general-market premium at resale.' },
    { key: 'discountRate', label: 'Discount rate', type: 'percent', unit: '%', default: 0.10, min: 0, max: 0.3, step: 0.005, group: 'Exit', help: 'High, reflecting tenant-market and exit-liquidity uncertainty.' },
    { key: 'holdYears', label: 'Hold period', type: 'integer', unit: 'yr', default: 5, min: 1, max: 30, step: 1, group: 'Exit' },
  ],
  metrics: [
    { key: 'yieldOnCost', label: 'Yield on cost', unit: '%', higherIsBetter: true, help: 'Year-1 ground lease / (land + buildout).' },
    { key: 'npvOfLease', label: 'NPV of lease', unit: '$', higherIsBetter: true, help: 'Present value of the full-term escalating rent plus land reversion, net of capital, at the discount rate.' },
    { key: 'leasePerAcre', label: 'Lease per acre', unit: '$/yr', higherIsBetter: true, help: 'Annual ground lease / acreage — a rough intensity comparison.' },
  ],
  compute,
  narrative: {
    strategy:
      'Buy a parcel and lease it to a LEO optical-downlink (free-space laser-comm) operator that needs a **clear-sky, RF-quiet horizon** to close its links, collecting an escalating ground lease while keeping the land. The edge is measuring an asset the market cannot yet price: **clear-sky availability and a quiet RF background** — a physical, site-specific fact that ordinary land comps ignore. If optical downlink scales as satellite data volumes outrun radio spectrum, a proven-clear site with power and fiber becomes scarce infrastructure; if it does not, you own a specialized parcel with a thin tenant base.',
    risks: [
      'Novelty risk: thin comps, uncertain exit liquidity, the thesis may simply be wrong — optical-downlink ground networks are early and may consolidate around a few operator-owned sites.',
      'Single-purpose tenant: the lease value depends on a small number of laser-comm operators; losing the tenant strands a specialized site.',
      'The clear-sky and RF-quiet advantage can erode — new development, RF sources, or wildfire smoke seasons degrade the exact physical property you underwrote.',
      'Technology substitution: improved radio downlink, inter-satellite optical relay, or mobile/ship-based ground terminals could reduce demand for fixed land sites.',
    ],
    opportunities: [
      'If optical downlink scales, verified clear-sky sites with power and fiber are scarce and hard to replicate quickly.',
      'A signed, escalating, long-term lease to a credible operator is a bond-like coupon on top of land you continue to own.',
      'The same physical attributes (dark, quiet, clear) can support secondary tenants — astronomy, RF monitoring, or backup station siting.',
    ],
    regulatory:
      'Confirm zoning for a communications-tower/ground-station use, FCC/FAA and any laser-safety or aviation-hazard permitting the tenant relies on, and access/utility easements. The tenant may need spectrum or laser-operation authorizations whose absence can stall the lease.',
    dataHooks: ['cloud-cover-climatology', 'rf-noise', 'elevation-horizon-mask'],
  },
};
