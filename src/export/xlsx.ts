import * as XLSX from 'xlsx';
import type { InvestmentModule, ComputeResult, ParamSpec, MetricSpec, Unit } from '../core/types';
import { orderedSpecs } from '../core/metrics';
import type { AfterTaxResult } from '../core/tax';

// Excel number formats keyed to our unit/type vocabulary. Cells carry REAL
// numeric values; units live in the format and in header labels.
function paramFormat(p: ParamSpec): string {
  switch (p.type) {
    case 'currency':
      return '$#,##0';
    case 'percent':
      return '0.00%';
    case 'integer':
      return '#,##0';
    default:
      return p.unit === '$/night' ? '$#,##0' : '#,##0.00';
  }
}

function metricFormat(unit: Unit): string {
  switch (unit) {
    case '$':
    case '$/yr':
    case '$/mo':
    case '$/night':
      return '$#,##0';
    case '%':
      return '0.00%';
    case 'x':
      return '0.00"×"';
    case 'yr':
      return '0.0" yr"';
    default:
      return '#,##0.00';
  }
}

function setColFormat(ws: XLSX.WorkSheet, col: number, z: string, startRow: number) {
  const ref = ws['!ref'];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let r = startRow; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: col });
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (cell && cell.t === 'n') cell.z = z;
  }
}

function inputsSheet(module: InvestmentModule, inputs: Record<string, number>): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [['Group', 'Parameter', 'Value', 'Unit', 'Verify?']];
  for (const p of module.params) {
    aoa.push([
      p.group,
      p.label,
      inputs[p.key] ?? p.default,
      p.type === 'percent' ? '%' : (p.unit ?? ''),
      p.verify ? 'yes' : '',
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 8 }];
  // Per-row value format depends on the param type.
  const ref = ws['!ref'];
  if (ref) {
    module.params.forEach((p, i) => {
      const addr = XLSX.utils.encode_cell({ r: i + 1, c: 2 });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (cell && cell.t === 'n') cell.z = paramFormat(p);
    });
  }
  return ws;
}

function metricsSheet(module: InvestmentModule, result: ComputeResult): XLSX.WorkSheet {
  const specs = orderedSpecs(module);
  const aoa: (string | number)[][] = [['Metric', 'Value', 'Unit', 'Higher is better']];
  specs.forEach((spec: MetricSpec) => {
    const v = result.metrics[spec.key];
    aoa.push([
      spec.label,
      Number.isFinite(v) ? (v as number) : 'n/a',
      spec.unit,
      spec.higherIsBetter == null ? 'neutral' : spec.higherIsBetter ? 'yes' : 'no',
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 16 }];
  const ref = ws['!ref'];
  if (ref) {
    specs.forEach((spec, i) => {
      const addr = XLSX.utils.encode_cell({ r: i + 1, c: 1 });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (cell && cell.t === 'n') cell.z = metricFormat(spec.unit);
    });
  }
  return ws;
}

function projectionSheet(result: ComputeResult): XLSX.WorkSheet | null {
  const proj = result.projection;
  if (!proj || proj.length === 0) return null;
  const header = [
    'Year',
    'Gross revenue',
    'Effective revenue',
    'Operating expenses',
    'NOI',
    'Debt service',
    'Cash flow',
    'Cumulative cash flow',
    'Property value',
    'Loan balance',
    'Equity',
  ];
  const aoa: (string | number)[][] = [header];
  for (const r of proj) {
    aoa.push([
      r.year,
      r.grossRevenue,
      r.effectiveRevenue,
      r.operatingExpenses,
      r.noi,
      r.debtService,
      r.cashFlow,
      r.cumulativeCashFlow,
      r.propertyValue,
      r.loanBalance,
      r.equity,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = header.map((h, i) => ({ wch: i === 0 ? 6 : Math.max(12, h.length) }));
  for (let c = 1; c < header.length; c++) setColFormat(ws, c, '$#,##0', 1);
  return ws;
}

function afterTaxSheet(at: AfterTaxResult): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [];
  aoa.push(['After-tax metric', 'Pre-tax', 'After-tax']);
  aoa.push(['Annual cash flow ($/yr)', at.years[0]?.preTaxCashFlow ?? 0, at.metrics.afterTaxAnnualCashFlow]);
  aoa.push(['Cash-on-cash', NaN, at.metrics.afterTaxCashOnCash]);
  aoa.push(['5-yr IRR', NaN, at.metrics.afterTaxIrr]);
  aoa.push([]);
  aoa.push(['Tax detail', 'Value']);
  aoa.push(['Depreciation / yr', at.annualDepreciation]);
  aoa.push(['Accumulated depreciation', at.accumulatedDepreciation]);
  aoa.push(['Adjusted basis at sale', at.adjustedBasis]);
  aoa.push(['Total gain', at.totalGain]);
  aoa.push(['Depreciation recapture tax', at.recaptureTax]);
  aoa.push(['Capital-gains tax', at.capitalGainsTax]);
  aoa.push(['Total sale tax', at.saleTax]);
  aoa.push(['Pre-tax sale proceeds', at.preTaxSaleProceeds]);
  aoa.push(['After-tax sale proceeds', at.afterTaxSaleProceeds]);
  aoa.push(['Total income tax over hold', at.totalIncomeTaxOverHold]);
  aoa.push([]);
  aoa.push(['Year', 'Depreciation', 'Interest', 'Taxable income', 'Income tax', 'Pre-tax cash flow', 'After-tax cash flow']);
  for (const y of at.years) {
    aoa.push([y.year, y.depreciation, y.interest, y.taxableIncome, y.incomeTax, y.preTaxCashFlow, y.afterTaxCashFlow]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
  // Dollar-format the currency cells (everything numeric except the two rate rows).
  const ref = ws['!ref'];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let r = 0; r <= range.e.r; r++) {
      for (let c = 1; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr] as XLSX.CellObject | undefined;
        if (cell && cell.t === 'n') {
          const label = (ws[XLSX.utils.encode_cell({ r, c: 0 })] as XLSX.CellObject | undefined)?.v;
          const isRate = label === 'Cash-on-cash' || label === '5-yr IRR';
          cell.z = isRate ? '0.00%' : '$#,##0';
        }
      }
    }
  }
  return ws;
}

/** Build (but do not download) the workbook for a single module. Testable seam. */
export function buildModuleWorkbook(
  module: InvestmentModule,
  inputs: Record<string, number>,
  result: ComputeResult,
  afterTax?: AfterTaxResult | null,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, inputsSheet(module, inputs), 'Inputs');
  XLSX.utils.book_append_sheet(wb, metricsSheet(module, result), 'Metrics');
  const proj = projectionSheet(result);
  if (proj) XLSX.utils.book_append_sheet(wb, proj, 'Projection');
  if (afterTax) XLSX.utils.book_append_sheet(wb, afterTaxSheet(afterTax), 'After-tax');
  return wb;
}

/** Export a single module (inputs, metrics, projection, after-tax) to a .xlsx download. */
export function exportModuleXlsx(
  module: InvestmentModule,
  inputs: Record<string, number>,
  result: ComputeResult,
  afterTax?: AfterTaxResult | null,
): void {
  XLSX.writeFile(buildModuleWorkbook(module, inputs, result, afterTax), `quoin-${module.id}.xlsx`);
}

export interface ComparisonEntry {
  module: InvestmentModule;
  result: ComputeResult;
}

/** Build (but do not download) the comparison workbook. Testable seam.
 *  `afterTaxKeys` suffixes those metric labels with "(after-tax)" so an exported
 *  after-tax comparison is unambiguous. */
export function buildComparisonWorkbook(
  entries: ComparisonEntry[],
  afterTaxKeys?: readonly string[],
): XLSX.WorkBook {
  const atSet = new Set(afterTaxKeys ?? []);
  // Union of specs, core first then any shared extras, de-duplicated by key.
  const seen = new Set<string>();
  const specs: MetricSpec[] = [];
  for (const e of entries) {
    for (const s of orderedSpecs(e.module)) {
      if (!seen.has(s.key)) {
        seen.add(s.key);
        specs.push(s);
      }
    }
  }
  const header = ['Metric', 'Unit', ...entries.map((e) => e.module.name)];
  const aoa: (string | number)[][] = [header];
  for (const spec of specs) {
    const label = atSet.has(spec.key) ? `${spec.label} (after-tax)` : spec.label;
    const row: (string | number)[] = [label, spec.unit];
    for (const e of entries) {
      const v = e.result.metrics[spec.key];
      row.push(v == null || !Number.isFinite(v) ? 'n/a' : v);
    }
    aoa.push(row);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 26 }, { wch: 10 }, ...entries.map(() => ({ wch: 20 }))];
  // Format each module column per that row's metric unit.
  specs.forEach((spec, i) => {
    for (let c = 2; c < header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: i + 1, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (cell && cell.t === 'n') cell.z = metricFormat(spec.unit);
    }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison');
  return wb;
}

/** Export the comparison as one sheet with modules as columns. */
export function exportComparisonXlsx(entries: ComparisonEntry[], afterTaxKeys?: readonly string[]): void {
  if (entries.length === 0) return;
  XLSX.writeFile(buildComparisonWorkbook(entries, afterTaxKeys), 'quoin-comparison.xlsx');
}
