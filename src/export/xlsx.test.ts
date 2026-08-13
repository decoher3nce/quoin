import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildModuleWorkbook, buildComparisonWorkbook, type ComparisonEntry } from './xlsx';
import { MODULES } from '../modules';
import { defaultsOf } from '../core/types';
import { computeAfterTax, DEFAULT_TAX_SETTINGS, AFTER_TAX_CORE_KEYS } from '../core/tax';

describe('xlsx module export', () => {
  const module = MODULES.find((m) => m.id === 'metro-condo-ltr')!;
  const inputs = defaultsOf(module);
  const result = module.compute(inputs);
  const wb = buildModuleWorkbook(module, inputs, result);

  it('has Inputs, Metrics, and Projection sheets', () => {
    expect(wb.SheetNames).toEqual(['Inputs', 'Metrics', 'Projection']);
  });

  it('writes the real purchase price as a numeric cell', () => {
    const ws = wb.Sheets['Inputs']!;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    const priceRow = rows.find((r) => r['Parameter'] === 'Purchase price');
    expect(priceRow?.['Value']).toBe(inputs.purchasePrice);
  });

  it('projection sheet has one row per hold year', () => {
    const ws = wb.Sheets['Projection']!;
    const rows = XLSX.utils.sheet_to_json(ws);
    expect(rows.length).toBe(result.projection?.length);
  });

  it('omits the Projection sheet when there is no projection', () => {
    const noProj = { metrics: result.metrics }; // no projection field
    const wb2 = buildModuleWorkbook(module, inputs, noProj);
    expect(wb2.SheetNames).toEqual(['Inputs', 'Metrics']);
  });

  it('adds an After-tax sheet only when an after-tax result is passed', () => {
    expect(wb.SheetNames).not.toContain('After-tax');
    const at = computeAfterTax(module, inputs, result, DEFAULT_TAX_SETTINGS);
    expect(at).not.toBeNull();
    const wbAt = buildModuleWorkbook(module, inputs, result, at);
    expect(wbAt.SheetNames).toContain('After-tax');
    const ws = wbAt.Sheets['After-tax']!;
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    // The depreciation figure appears in the tax-detail block.
    const depRow = rows.find((r) => r[0] === 'Depreciation / yr');
    expect(depRow?.[1]).toBeCloseTo(at!.annualDepreciation, 4);
  });
});

describe('xlsx comparison export', () => {
  const entries: ComparisonEntry[] = MODULES.slice(0, 3).map((module) => ({
    module,
    result: module.compute(defaultsOf(module)),
  }));
  const wb = buildComparisonWorkbook(entries);

  it('has a single Comparison sheet', () => {
    expect(wb.SheetNames).toEqual(['Comparison']);
  });

  it('has one column per selected module plus Metric and Unit', () => {
    const ws = wb.Sheets['Comparison']!;
    const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    const header = aoa[0]!;
    expect(header.slice(0, 2)).toEqual(['Metric', 'Unit']);
    expect(header.length).toBe(2 + entries.length);
  });

  it('suffixes after-tax metric labels when afterTaxKeys is passed', () => {
    const wbAt = buildComparisonWorkbook(entries, AFTER_TAX_CORE_KEYS);
    const aoa = XLSX.utils.sheet_to_json<string[]>(wbAt.Sheets['Comparison']!, { header: 1 });
    const labels = aoa.map((r) => r[0]);
    expect(labels).toContain('Annual cash flow (after-tax)');
    expect(labels).toContain('5-yr IRR (after-tax)');
    // A non-tax metric is untouched.
    expect(labels).toContain('Cap rate');
  });
});
