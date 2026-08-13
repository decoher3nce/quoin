import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InvestmentModule, ComputeResult, MetricSpec } from '../core/types';
import { orderedSpecs } from '../core/metrics';
import { formatMetric, formatParam } from '../core/units';
import type { ComparisonEntry } from './xlsx';
import type { AfterTaxResult } from '../core/tax';

const ACCENT: [number, number, number] = [63, 92, 120];
const INK: [number, number, number] = [43, 38, 32];
const MUTED: [number, number, number] = [131, 122, 104];

type PdfTarget =
  | {
      kind: 'module';
      module: InvestmentModule;
      inputs: Record<string, number>;
      result: ComputeResult;
      afterTax?: AfterTaxResult | null;
    }
  | { kind: 'comparison'; entries: ComparisonEntry[]; afterTaxKeys?: readonly string[] };

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: { finalY: number };
}

function nextY(doc: jsPDF, fallback: number): number {
  const y = (doc as AutoTableDoc).lastAutoTable?.finalY;
  return (y ?? fallback) + 8;
}

function heading(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(11);
  doc.setTextColor(...ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.text(text, 40, y);
  return y + 6;
}

function moduleName(m: InvestmentModule): string {
  return m.name;
}

function exportModulePdf(
  module: InvestmentModule,
  inputs: Record<string, number>,
  result: ComputeResult,
  afterTax?: AfterTaxResult | null,
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(moduleName(module), 40, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(module.blurb, 40, 64);

  // Metrics
  let y = heading(doc, 'Metrics', 92);
  const specs = orderedSpecs(module);
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value', 'Direction']],
    body: specs.map((s: MetricSpec) => [
      s.label,
      formatMetric(result.metrics[s.key] ?? NaN, s.unit),
      s.higherIsBetter == null ? 'neutral' : s.higherIsBetter ? 'higher ↑' : 'lower ↓',
    ]),
    theme: 'striped',
    headStyles: { fillColor: ACCENT, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', textColor: MUTED } },
    margin: { left: 40, right: 40 },
  });

  if (result.warnings && result.warnings.length) {
    y = nextY(doc, y);
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    result.warnings.forEach((w, i) => {
      doc.text(`▲ ${w}`, 40, y + i * 12, { maxWidth: 515 });
    });
    y += result.warnings.length * 12;
  }

  // Inputs
  y = heading(doc, 'Inputs', nextY(doc, y) + 4);
  autoTable(doc, {
    startY: y,
    head: [['Group', 'Parameter', 'Value']],
    body: module.params.map((p) => [
      p.group,
      p.label + (p.verify ? '  (verify)' : ''),
      formatParam(inputs[p.key] ?? p.default, p.type, p.unit),
    ]),
    theme: 'grid',
    headStyles: { fillColor: ACCENT, fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 2: { halign: 'right' } },
    margin: { left: 40, right: 40 },
  });

  // Projection
  if (result.projection && result.projection.length) {
    y = heading(doc, 'Projection', nextY(doc, y) + 4);
    autoTable(doc, {
      startY: y,
      head: [['Yr', 'Eff. rev', 'Op. exp', 'NOI', 'Debt svc', 'Cash flow', 'Cumul.', 'Value', 'Equity']],
      body: result.projection.map((r) => [
        r.year,
        formatMetric(r.effectiveRevenue, '$'),
        formatMetric(r.operatingExpenses, '$'),
        formatMetric(r.noi, '$'),
        formatMetric(r.debtService, '$'),
        formatMetric(r.cashFlow, '$'),
        formatMetric(r.cumulativeCashFlow, '$'),
        formatMetric(r.propertyValue, '$'),
        formatMetric(r.equity, '$'),
      ]),
      theme: 'striped',
      headStyles: { fillColor: ACCENT, fontSize: 8 },
      bodyStyles: { fontSize: 7.5, halign: 'right' },
      columnStyles: { 0: { halign: 'left' } },
      margin: { left: 40, right: 40 },
    });
  }

  // After-tax section (only when the toggle was on for a depreciable module).
  if (afterTax) {
    doc.addPage();
    let ay = heading(doc, 'After-tax', 48);
    autoTable(doc, {
      startY: ay,
      head: [['Metric', 'Pre-tax', 'After-tax']],
      body: [
        ['Annual cash flow', formatMetric(afterTax.years[0]?.preTaxCashFlow ?? NaN, '$'), formatMetric(afterTax.metrics.afterTaxAnnualCashFlow, '$')],
        ['Cash-on-cash', formatMetric(result.metrics.cashOnCash ?? NaN, '%'), formatMetric(afterTax.metrics.afterTaxCashOnCash, '%')],
        ['5-yr IRR', formatMetric(result.metrics.irr5yr ?? NaN, '%'), formatMetric(afterTax.metrics.afterTaxIrr, '%')],
      ],
      theme: 'striped',
      headStyles: { fillColor: ACCENT, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right', textColor: MUTED }, 2: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    });
    ay = nextY(doc, ay) + 4;
    autoTable(doc, {
      startY: ay,
      head: [['Tax detail', 'Value']],
      body: [
        ['Depreciation / yr', formatMetric(afterTax.annualDepreciation, '$')],
        ['Accumulated depreciation', formatMetric(afterTax.accumulatedDepreciation, '$')],
        ['Adjusted basis at sale', formatMetric(afterTax.adjustedBasis, '$')],
        ['Depreciation recapture tax', formatMetric(afterTax.recaptureTax, '$')],
        ['Capital-gains tax', formatMetric(afterTax.capitalGainsTax, '$')],
        ['After-tax sale proceeds', formatMetric(afterTax.afterTaxSaleProceeds, '$')],
        ['Total income tax over hold', formatMetric(afterTax.totalIncomeTaxOverHold, '$')],
      ],
      theme: 'grid',
      headStyles: { fillColor: ACCENT, fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 40, right: 40 },
    });
    ay = nextY(doc, ay);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const note = doc.splitTextToSize(
      'After-tax = straight-line depreciation + marginal-rate income tax during the hold, with depreciation recapture and long-term capital-gains tax on the modeled sale. Simplified (flat rate, passive-loss limits ignored, basis = purchase price, no 1031/NIIT/AMT/state). A planning estimate, not tax advice.',
      515,
    );
    doc.text(note, 40, ay);
  }

  // Narrative + disclaimer on a fresh page for room.
  doc.addPage();
  let ny = heading(doc, 'Strategy', 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const strategy = module.narrative.strategy.replace(/\*\*/g, '');
  const lines = doc.splitTextToSize(strategy, 515);
  doc.text(lines, 40, ny + 4);
  ny += 4 + lines.length * 12 + 10;

  const block = (title: string, items: string[]) => {
    ny = heading(doc, title, ny);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    for (const it of items) {
      const wrapped = doc.splitTextToSize(`• ${it.replace(/\*\*/g, '')}`, 505);
      doc.text(wrapped, 44, ny + 4);
      ny += wrapped.length * 12 + 2;
    }
    ny += 8;
  };
  block('Risks', module.narrative.risks);
  block('Opportunities', module.narrative.opportunities);
  if (module.narrative.regulatory) block('Regulatory', [module.narrative.regulatory]);

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const disc = doc.splitTextToSize(
    'Assumptions & limits: pre-tax only; no depreciation or income-tax modeling. IRR uses modeled cash flows and a modeled sale — appreciation and growth are assumptions, not forecasts. Verify all rates, taxes, HOA/insurance, and ADR/occupancy against primary sources.',
    515,
  );
  doc.text(disc, 40, 740);

  doc.save(`quoin-${module.id}.pdf`);
}

function exportComparisonPdf(entries: ComparisonEntry[], afterTaxKeys?: readonly string[]): void {
  if (entries.length === 0) return;
  const atSet = new Set(afterTaxKeys ?? []);
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(atSet.size ? 'Quoin — Comparison (after-tax)' : 'Quoin — Comparison', 40, 44);

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

  // Precompute the best column per row for higher-is-better metrics.
  const bestCol = specs.map((s) => {
    if (s.higherIsBetter !== true) return -1;
    let best = -1;
    let bestVal = -Infinity;
    entries.forEach((e, ci) => {
      const v = e.result.metrics[s.key];
      if (v != null && Number.isFinite(v) && v > bestVal) {
        bestVal = v;
        best = ci;
      }
    });
    return best;
  });

  autoTable(doc, {
    startY: 64,
    head: [['Metric', ...entries.map((e) => e.module.name)]],
    body: specs.map((s) => [
      atSet.has(s.key) ? `${s.label} (after-tax)` : s.label,
      ...entries.map((e) => {
        const v = e.result.metrics[s.key];
        return v == null || !Number.isFinite(v) ? '—' : formatMetric(v, s.unit);
      }),
    ]),
    theme: 'striped',
    headStyles: { fillColor: ACCENT, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: INK } },
    margin: { left: 40, right: 40 },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const col = data.column.index;
      const rowBest = bestCol[data.row.index];
      if (col >= 1 && rowBest === col - 1) {
        data.cell.styles.fillColor = [223, 233, 223];
        data.cell.styles.textColor = [22, 101, 52];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const y = nextY(doc, 64);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    'Green = best in row for higher-is-better metrics. Total cash invested is neutral and not highlighted. Pre-tax; assumptions not forecasts.',
    40,
    y,
    { maxWidth: 700 },
  );

  doc.save('quoin-comparison.pdf');
}

/** Single swappable entry point for PDF export (module or comparison). */
export function exportPdf(target: PdfTarget): void {
  if (target.kind === 'module') exportModulePdf(target.module, target.inputs, target.result, target.afterTax);
  else exportComparisonPdf(target.entries, target.afterTaxKeys);
}
