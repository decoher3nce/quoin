// Core plugin contract. Every investment type implements InvestmentModule and is
// registered in src/modules/index.ts. The UI is generic and renders any module from
// its params / metrics / narrative — no investment-specific UI code exists.

export type Unit = '$' | '%' | 'x' | '$/mo' | '$/yr' | '$/night' | 'yr' | 'count';

export type ParamType = 'currency' | 'percent' | 'number' | 'integer';

export interface ParamSpec {
  key: string; // stable id, e.g. 'purchasePrice'
  label: string;
  type: ParamType;
  unit?: Unit;
  default: number; // percents stored as fractions (0.07 === 7%)
  min?: number;
  max?: number;
  step?: number;
  group: string; // 'Financing' | 'Income' | 'Expenses' | 'Exit' | module-specific
  verify?: boolean; // render a "verify against a primary source" affordance
  help?: string;
}

export interface MetricSpec {
  key: string;
  label: string;
  unit: Unit;
  higherIsBetter: boolean | null; // null = neutral/context (e.g. cash invested)
  help?: string;
}

export interface YearRow {
  year: number;
  grossRevenue: number;
  effectiveRevenue: number;
  operatingExpenses: number; // excludes debt service
  noi: number;
  debtService: number;
  interest: number; // portion of debt service that is deductible interest
  cashFlow: number;
  cumulativeCashFlow: number;
  propertyValue: number;
  loanBalance: number;
  equity: number;
}

export interface Narrative {
  strategy: string; // markdown
  risks: string[];
  opportunities: string[];
  regulatory?: string; // callout; e.g. STR legality
  dataHooks?: string[]; // future geo/time-series signals this module WANTS
}

export interface ComputeResult {
  metrics: Record<string, number>; // MUST include every CORE_METRIC key
  projection?: YearRow[]; // optional but expected for hold strategies
  warnings?: string[]; // surfaced in UI (e.g. "DSCR < 1.20: lender risk")
}

export type InvestmentCategory =
  | 'Land'
  | 'Residential'
  | 'Commercial'
  | 'Hospitality'
  | 'Paper'
  | 'ValueAdd'
  | 'Infrastructure'
  | 'Novel';

export type Tier = 'core' | 'creative' | 'novel';

/**
 * Opt-in tax treatment for depreciable, held real property. A module declares a
 * taxProfile ONLY if straight-line depreciation + recapture + capital-gains at
 * sale is the correct model for it — i.e. it holds a depreciable building and
 * produces a projection. Flips (ordinary income), raw land (no depreciation),
 * notes / REITs / LP interests (different regimes), and personal-use property are
 * intentionally left without one, so the after-tax toggle does not appear for them.
 */
export interface TaxProfile {
  /** MACRS straight-line recovery period: 27.5 (residential) or 39 (commercial / transient). */
  recoveryYears: number;
  /** Depreciable acquisition basis (purchase price of the improvable asset) from inputs. */
  basis: (inputs: Record<string, number>) => number;
  /** Optional land-fraction default for land-heavy assets (parks, campgrounds); else the global setting. */
  landFractionDefault?: number;
}

export interface InvestmentModule {
  id: string; // 'metro-condo-ltr'
  name: string; // 'Metro Condo — Long-Term Rental'
  category: InvestmentCategory;
  tier: Tier;
  blurb: string; // one line for the tab/registry
  params: ParamSpec[];
  metrics: MetricSpec[]; // module-specific metrics BEYOND the core set
  compute: (inputs: Record<string, number>) => ComputeResult;
  narrative: Narrative;
  taxProfile?: TaxProfile; // present only on depreciable buy-and-hold real property
}

/** Convenience: default input map derived from a module's param specs. */
export function defaultsOf(module: InvestmentModule): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of module.params) out[p.key] = p.default;
  return out;
}
