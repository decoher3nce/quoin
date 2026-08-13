// Pure, tested financial primitives. Every module's compute() composes these;
// no module re-implements amortization, IRR, or ratio math. No side effects,
// no I/O. Percents are fractions throughout (0.07 === 7%).

/** Safe division: NaN when the denominator is zero or non-finite. Callers that
 *  want a different sentinel (e.g. BRRRR infinite-return) handle it explicitly. */
export function guardDiv(n: number, d: number): number {
  if (d === 0 || !Number.isFinite(d)) return NaN;
  return n / d;
}

/**
 * Fixed-rate fully-amortizing monthly payment (positive).
 * Reference: 240,000 @ 7% / 30yr ≈ 1,596.73 / mo.
 */
export function pmt(annualRate: number, termYears: number, principal: number): number {
  const n = Math.round(termYears * 12);
  if (n <= 0) return 0;
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Annual debt service for a fully-amortizing loan (12 × monthly PMT). */
export function annualDebtService(
  annualRate: number,
  termYears: number,
  principal: number,
): number {
  return pmt(annualRate, termYears, principal) * 12;
}

/**
 * Remaining loan balance after `monthsElapsed` payments on a fixed amortizing loan.
 * Clamped to [0, principal].
 */
export function loanBalance(
  principal: number,
  annualRate: number,
  termYears: number,
  monthsElapsed: number,
): number {
  if (principal <= 0) return 0;
  const n = Math.round(termYears * 12);
  const k = Math.min(Math.max(Math.round(monthsElapsed), 0), n);
  if (n <= 0) return 0;
  const r = annualRate / 12;
  const payment = pmt(annualRate, termYears, principal);
  let bal: number;
  if (r === 0) {
    bal = principal - payment * k;
  } else {
    const g = Math.pow(1 + r, k);
    bal = principal * g - payment * ((g - 1) / r);
  }
  return Math.min(Math.max(bal, 0), principal);
}

/** Net present value. cashflows[t] occurs at end of period t; cashflows[0] at t=0. */
export function npv(annualRate: number, cashflows: number[]): number {
  const base = 1 + annualRate;
  let acc = 0;
  for (let t = 0; t < cashflows.length; t++) {
    acc += (cashflows[t] ?? 0) / Math.pow(base, t);
  }
  return acc;
}

/** Derivative of NPV with respect to rate — used by the Newton step in irr(). */
function dNpv(annualRate: number, cashflows: number[]): number {
  const base = 1 + annualRate;
  let acc = 0;
  for (let t = 1; t < cashflows.length; t++) {
    acc += (-t * (cashflows[t] ?? 0)) / Math.pow(base, t + 1);
  }
  return acc;
}

/** Bracketed bisection fallback over (-0.9999, 10). NaN if no bracketed root. */
function bisectIrr(cashflows: number[]): number {
  let lo = -0.9999;
  let hi = 10;
  let flo = npv(lo, cashflows);
  let fhi = npv(hi, cashflows);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi)) return NaN;
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) return NaN; // no sign change in range
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid, cashflows);
    if (Math.abs(fmid) < 1e-9 || (hi - lo) / 2 < 1e-9) return mid;
    if (flo * fmid < 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Internal rate of return via Newton's method with a bisection fallback.
 * Returns NaN when the cashflows have no sign change (no real IRR).
 * Test: [-100000, 12000, 12000, 12000, 12000, 112000] ≈ 0.12.
 */
export function irr(cashflows: number[], guess = 0.1): number {
  const hasPos = cashflows.some((c) => c > 0);
  const hasNeg = cashflows.some((c) => c < 0);
  if (!hasPos || !hasNeg) return NaN;

  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate, cashflows);
    const df = dNpv(rate, cashflows);
    if (!Number.isFinite(f) || !Number.isFinite(df) || df === 0) break;
    let next = rate - f / df;
    if (!Number.isFinite(next)) break;
    if (next <= -0.999999) next = (rate - 0.999999) / 2; // damp toward the pole
    if (Math.abs(next - rate) < 1e-9) {
      return Number.isFinite(next) ? next : NaN;
    }
    rate = next;
  }
  return bisectIrr(cashflows);
}

/** Cap rate = annual NOI / price (a fraction). */
export function capRate(noiAnnual: number, price: number): number {
  return guardDiv(noiAnnual, price);
}

/** Cash-on-cash = annual pre-tax cash flow / cash invested (a fraction). */
export function cashOnCash(annualCashFlow: number, cashInvested: number): number {
  return guardDiv(annualCashFlow, cashInvested);
}

/** Debt-service-coverage ratio = annual NOI / annual debt service (a multiple). */
export function dscr(noiAnnual: number, debtServiceAnnual: number): number {
  return guardDiv(noiAnnual, debtServiceAnnual);
}

/** Gross rent multiplier = price / gross annual rent (a multiple). */
export function grm(price: number, grossAnnualRent: number): number {
  return guardDiv(price, grossAnnualRent);
}
