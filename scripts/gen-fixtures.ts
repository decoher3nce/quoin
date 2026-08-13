// Dev tool: run each module's compute() on its defaults and write a golden
// fixture. Re-run intentionally when a module's math legitimately changes.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODULES } from '../src/modules/index';
import { defaultsOf } from '../src/core/types';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'src', 'modules', '__fixtures__');
mkdirSync(outDir, { recursive: true });

for (const m of MODULES) {
  const inputs = defaultsOf(m);
  const result = m.compute(inputs);
  const fixture = { id: m.id, inputs, expected: result.metrics };
  writeFileSync(join(outDir, `${m.id}.json`), JSON.stringify(fixture, null, 2) + '\n');
  console.log(`\n=== ${m.id} ===`);
  for (const [k, v] of Object.entries(result.metrics)) {
    console.log(`  ${k.padEnd(22)} ${Number.isFinite(v) ? v.toFixed(4) : String(v)}`);
  }
  if (result.warnings?.length) console.log('  warnings:', result.warnings);
}
