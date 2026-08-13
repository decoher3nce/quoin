// Reusable math archetypes shared across modules. Every module still owns its
// params/metrics/narrative; these helpers just keep the recurring compute shapes
// (income hold, flip/development, income stream) DRY and consistent, and compose
// the tested primitives in core/finance.ts. No module re-implements amortization,
// IRR, or the core-metric assembly.

import { capRate, cashOnCash, dscr, irr, guardDiv, annualDebtService } from '../core/finance';
import { buildProjection, holdCashflows, type HoldModel } from './_projection';
import type { YearRow } from '../core/types';

/** The seven CORE_METRICS as a typed record. */
export interface CoreMetrics {
  annualCashFlow: number;
  monthlyCashFlow: number;
  cashOnCash: number;
  capRate: number;
  dscr: number;
  irr5yr: number;
  totalCashInvested: number;
}

// ── Income hold ────────────────────────────────────────────────────────────
// A financed (or cash) asset producing annual NOI, held then sold. Covers LTR
// variants, commercial leases, storage, MHP, ag-lease, mid-term, seasonal STR.

export interface HoldSpec extends HoldModel {
  totalCashInvested: number;
  sellingPct: number;
  holdYears: number;
}

export interface HoldOutcome {
  core: CoreMetrics;
  full: YearRow[];
  projection: YearRow[];
  y1: YearRow;
  debtService: number;
  noi: number;
}

export function computeHold(h: HoldSpec): HoldOutcome {
  const horizon = Math.max(Math.round(h.holdYears), 5);
  const full = buildProjection(h, horizon);
  const y1 = full[0]!;
  const debtService =
    h.loanAmount > 0 ? annualDebtService(h.annualRate, h.termYears, h.loanAmount) : 0;
  const noi = y1.noi;
  const annualCashFlow = y1.cashFlow;
  const irr5yr = irr(holdCashflows(full, h.totalCashInvested, 5, h.sellingPct));

  return {
    core: {
      annualCashFlow,
      monthlyCashFlow: annualCashFlow / 12,
      cashOnCash: cashOnCash(annualCashFlow, h.totalCashInvested),
      capRate: capRate(noi, h.price),
      dscr: dscr(noi, debtService),
      irr5yr,
      totalCashInvested: h.totalCashInvested,
    },
    full,
    projection: full.slice(0, Math.round(h.holdYears)),
    y1,
    debtService,
    noi,
  };
}

// ── Flip / development ───────────────────────────────────────────────────────
// Buy, spend, sell. No stabilized NOI, so the operating-hold core metrics are
// NaN (they render "—" and are honestly not comparable to a rental's). The
// return lives in project ROI and its annualization.

export interface FlipSpec {
  /** Value the project sells for (ARV / aggregate lot sales / stabilized value). */
  exitValue: number;
  sellingCostPct: number;
  /** Loan repaid from the sale (0 if all-cash). */
  loanPayoff: number;
  /** All out-of-pocket cash: equity in purchase + rehab + closing + carry + interest. */
  cashInvested: number;
  months: number;
}

export interface FlipOutcome {
  core: CoreMetrics;
  netSaleProceeds: number;
  profit: number;
  roi: number;
  annualizedRoi: number;
  marginOfSafety: number;
}

export function computeFlip(f: FlipSpec): FlipOutcome {
  const netSaleProceeds = f.exitValue * (1 - f.sellingCostPct) - f.loanPayoff;
  const profit = netSaleProceeds - f.cashInvested;
  const roi = guardDiv(profit, f.cashInvested);
  const months = Math.max(f.months, 1);
  const annualizedRoi =
    f.cashInvested > 0 && netSaleProceeds > 0
      ? Math.pow(netSaleProceeds / f.cashInvested, 12 / months) - 1
      : NaN;
  // Exit value at which profit hits zero, as a cushion fraction of the modeled exit.
  const breakEvenExit = guardDiv(f.cashInvested + f.loanPayoff, 1 - f.sellingCostPct);
  const marginOfSafety = guardDiv(f.exitValue - breakEvenExit, f.exitValue);

  return {
    core: {
      annualCashFlow: NaN,
      monthlyCashFlow: NaN,
      cashOnCash: NaN,
      capRate: NaN,
      dscr: NaN,
      irr5yr: annualizedRoi, // project annualized return; label notes the horizon
      totalCashInvested: f.cashInvested,
    },
    netSaleProceeds,
    profit,
    roi,
    annualizedRoi,
    marginOfSafety,
  };
}

// ── Income stream ────────────────────────────────────────────────────────────
// Deploy capital, receive a (possibly growing/declining) annual stream, maybe a
// terminal value. Covers notes, lending, tax liens, REITs, ground/solar/cell/EV
// /billboard/datacenter leases, timber royalties, LP interests.

export interface IncomeStreamSpec {
  capital: number; // cash deployed at t0
  /** Price of the underlying asset for a cap-rate style yield, or capital if none. */
  assetPrice: number;
  annualCashflows: number[]; // year 1..N (year-1 first)
  terminalValue: number; // at the end of the modeled stream (reversion / payoff)
  /** Annual debt service if the position itself is levered (else 0 → dscr NaN). */
  debtServiceAnnual: number;
  noiAnnual: number; // for cap rate; typically year-1 net income
}

export function computeIncomeStream(s: IncomeStreamSpec): CoreMetrics {
  const y1 = s.annualCashflows[0] ?? 0;
  // 5-year IRR: use up to 5 years, terminal value in the final modeled year.
  const n = Math.min(5, s.annualCashflows.length);
  const cf: number[] = [-s.capital];
  for (let i = 0; i < n; i++) {
    const isLast = i === s.annualCashflows.length - 1 || i === n - 1;
    cf.push((s.annualCashflows[i] ?? 0) + (isLast ? s.terminalValue : 0));
  }
  const irr5yr = irr(cf);
  return {
    annualCashFlow: y1,
    monthlyCashFlow: y1 / 12,
    cashOnCash: cashOnCash(y1, s.capital),
    capRate: capRate(s.noiAnnual, s.assetPrice),
    dscr: s.debtServiceAnnual > 0 ? dscr(s.noiAnnual, s.debtServiceAnnual) : NaN,
    irr5yr,
    totalCashInvested: s.capital,
  };
}
