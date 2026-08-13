import { MODULES } from '../src/modules/index';
import { defaultsOf } from '../src/core/types';

for (const m of MODULES) {
  const r = m.compute(defaultsOf(m));
  const mx = r.metrics;
  const flags: string[] = [];
  const core = ['annualCashFlow', 'cashOnCash', 'capRate', 'dscr', 'irr5yr', 'totalCashInvested'];
  const nanCore = core.filter((k) => !Number.isFinite(mx[k]));
  if (nanCore.length >= 5) flags.push('MOSTLY-NAN-CORE');
  if (!Number.isFinite(mx.totalCashInvested) || (mx.totalCashInvested ?? 0) <= 0)
    flags.push('BAD-CASH=' + mx.totalCashInvested);
  if (Number.isFinite(mx.irr5yr) && Math.abs(mx.irr5yr!) > 3) flags.push('WILD-IRR=' + mx.irr5yr!.toFixed(2));
  if (Number.isFinite(mx.cashOnCash) && Math.abs(mx.cashOnCash!) > 5) flags.push('WILD-COC=' + mx.cashOnCash!.toFixed(2));
  const proj = r.projection?.length ?? 0;
  const cash = Number.isFinite(mx.totalCashInvested) ? Math.round(mx.totalCashInvested!) : 'NaN';
  const irr = Number.isFinite(mx.irr5yr) ? (mx.irr5yr! * 100).toFixed(1) + '%' : '—';
  console.log(
    (flags.length ? '!! ' : '   ') +
      m.id.padEnd(26) +
      ` cash=${cash}`.padEnd(18) +
      ` irr=${irr}`.padEnd(13) +
      `proj=${proj} ` +
      flags.join(' '),
  );
}
