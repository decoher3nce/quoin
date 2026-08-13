import type { YearRow } from '../core/types';
import { annualDebtService, loanBalance } from '../core/finance';

// Shared, module-side helper for building a multi-year hold projection. Modules
// supply per-year revenue/expense closures; this composes finance.ts for the
// financing side. Not part of the core engine — it is a convenience so the three
// (and eventually many) hold-strategy modules don't duplicate the loop.

export interface HoldModel {
  /** Asset value at t0 (purchase price). */
  price: number;
  loanAmount: number;
  annualRate: number;
  termYears: number;
  /** Annual appreciation, fraction. */
  appreciation: number;
  /** Gross scheduled revenue for a given 1-indexed year (0 for no-income assets). */
  grossRevenue: (year: number) => number;
  /** Revenue after vacancy / platform fees / credit loss. */
  effectiveRevenue: (year: number) => number;
  /** Operating expenses excluding debt service. */
  operatingExpenses: (year: number) => number;
}

export function buildProjection(m: HoldModel, years: number): YearRow[] {
  const rows: YearRow[] = [];
  const ds = m.loanAmount > 0 ? annualDebtService(m.annualRate, m.termYears, m.loanAmount) : 0;
  let cumulative = 0;

  for (let year = 1; year <= years; year++) {
    const gross = m.grossRevenue(year);
    const effective = m.effectiveRevenue(year);
    const opex = m.operatingExpenses(year);
    const noi = effective - opex;

    // Debt service stops once the loan is amortized away.
    const loanStillOpen = m.loanAmount > 0 && (year - 1) * 12 < Math.round(m.termYears * 12);
    const debtService = loanStillOpen ? ds : 0;

    const cashFlow = noi - debtService;
    cumulative += cashFlow;

    const propertyValue = m.price * Math.pow(1 + m.appreciation, year);
    const loanBal = loanBalance(m.loanAmount, m.annualRate, m.termYears, year * 12);

    // Interest = debt service minus principal retired this year (exact for a
    // fully-amortizing loan). Used by the after-tax layer; interest is deductible,
    // principal is not.
    const balStart = loanBalance(m.loanAmount, m.annualRate, m.termYears, (year - 1) * 12);
    const principalPaid = Math.max(balStart - loanBal, 0);
    const interest = Math.max(debtService - principalPaid, 0);

    rows.push({
      year,
      grossRevenue: gross,
      effectiveRevenue: effective,
      operatingExpenses: opex,
      noi,
      debtService,
      interest,
      cashFlow,
      cumulativeCashFlow: cumulative,
      propertyValue,
      loanBalance: loanBal,
      equity: propertyValue - loanBal,
    });
  }
  return rows;
}

/** Net proceeds if the asset is sold at the end of a projection year. */
export function netSaleProceeds(row: YearRow, sellingCostPct: number): number {
  return row.propertyValue * (1 - sellingCostPct) - row.loanBalance;
}

/**
 * Standardized IRR cashflow vector for a hold: -cash invested at t0, then each
 * year's cash flow, with the net sale added in the final year. Use with irr().
 */
export function holdCashflows(
  rows: YearRow[],
  cashInvested: number,
  holdYears: number,
  sellingCostPct: number,
): number[] {
  const n = Math.min(holdYears, rows.length);
  const cf: number[] = [-cashInvested];
  for (let y = 1; y <= n; y++) {
    const row = rows[y - 1];
    if (!row) continue;
    const sale = y === n ? netSaleProceeds(row, sellingCostPct) : 0;
    cf.push(row.cashFlow + sale);
  }
  return cf;
}
