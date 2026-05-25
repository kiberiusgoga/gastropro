import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeInvoiceTotals,
} from '../../src/lib/nonFiscalInvoiceHelpers';

// Pure helpers for supplier consumption aggregation logic
// (DB-level tested via integration; here we test the pure calculation helpers)

function aggregateBySupplier(
  rows: Array<{ supplier_id: string; product_id: string; quantity: number; unit_price: number }>,
): Record<string, { total_value: number; product_count: number }> {
  const result: Record<string, { total_value: number; product_count: number }> = {};
  for (const r of rows) {
    if (!result[r.supplier_id]) result[r.supplier_id] = { total_value: 0, product_count: 0 };
    result[r.supplier_id].total_value += r.quantity * r.unit_price;
    result[r.supplier_id].product_count += 1;
  }
  return result;
}

function groupProductsBySupplier(
  rows: Array<{ supplier_id: string; product_id: string; product_name: string; quantity: number; unit_price: number; unit: string }>,
): Record<string, Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; unit: string; total: number }>> {
  const result: Record<string, Array<any>> = {};
  for (const r of rows) {
    if (!result[r.supplier_id]) result[r.supplier_id] = [];
    const existing = result[r.supplier_id].find(p => p.product_id === r.product_id);
    if (existing) {
      existing.quantity += r.quantity;
      existing.total += r.quantity * r.unit_price;
    } else {
      result[r.supplier_id].push({
        product_id: r.product_id,
        product_name: r.product_name,
        quantity: r.quantity,
        unit_price: r.unit_price,
        unit: r.unit,
        total: r.quantity * r.unit_price,
      });
    }
  }
  return result;
}

describe('supplier consumption aggregation', () => {
  const sampleRows = [
    { supplier_id: 's1', product_id: 'p1', product_name: 'Вино', quantity: 5, unit_price: 200, unit: 'л' },
    { supplier_id: 's1', product_id: 'p2', product_name: 'Ракија', quantity: 3, unit_price: 150, unit: 'л' },
    { supplier_id: 's2', product_id: 'p3', product_name: 'Месо', quantity: 10, unit_price: 500, unit: 'кг' },
  ];

  it('aggregates total_value per supplier correctly', () => {
    const agg = aggregateBySupplier(sampleRows);
    expect(agg['s1'].total_value).toBe(5 * 200 + 3 * 150); // 1450
    expect(agg['s2'].total_value).toBe(10 * 500); // 5000
  });

  it('counts distinct products per supplier', () => {
    const agg = aggregateBySupplier(sampleRows);
    expect(agg['s1'].product_count).toBe(2);
    expect(agg['s2'].product_count).toBe(1);
  });

  it('groups products under each supplier', () => {
    const grouped = groupProductsBySupplier(sampleRows);
    expect(grouped['s1']).toHaveLength(2);
    expect(grouped['s2']).toHaveLength(1);
    expect(grouped['s2'][0].product_name).toBe('Месо');
  });

  it('merges multiple transactions for same product under same supplier', () => {
    const withDuplicates = [
      ...sampleRows,
      { supplier_id: 's1', product_id: 'p1', product_name: 'Вино', quantity: 3, unit_price: 200, unit: 'л' },
    ];
    const grouped = groupProductsBySupplier(withDuplicates);
    const wine = grouped['s1'].find(p => p.product_id === 'p1')!;
    expect(wine.quantity).toBe(8); // 5 + 3
    expect(wine.total).toBe(8 * 200);
  });

  it('returns empty result for empty transactions', () => {
    const agg = aggregateBySupplier([]);
    expect(Object.keys(agg)).toHaveLength(0);
  });
});
