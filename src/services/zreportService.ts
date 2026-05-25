import pool from '../db';
import { aggregateVatByRate } from '../utils/vatCalculator';

export interface ZReportData {
  shift_id: string;
  restaurant: {
    id: string;
    name: string;
    address?: string;
    vat_number?: string;
    price_includes_vat: boolean;
  };
  opened_at: string;
  closed_at: string;
  duration_minutes: number;
  opened_by: { id: string; name: string };
  closed_by: { id: string; name: string };

  initial_cash: number;
  expected_cash: number;
  actual_cash: number;
  cash_difference: number;

  totals: {
    gross_revenue: number;
    net_revenue: number;
    total_vat: number;
    order_count: number;
    item_count: number;
    average_order_value: number;
    guest_count: number;
  };

  vat_breakdown: Array<{
    rate: number;
    gross: number;
    net: number;
    vat: number;
    item_count: number;
  }>;

  payment_breakdown: Array<{
    method: string;
    count: number;
    total: number;
  }>;

  order_type_breakdown: Array<{
    type: string;
    count: number;
    total: number;
  }>;

  hourly_revenue: Array<{
    hour: number;
    order_count: number;
    revenue: number;
  }>;

  top_items: Array<{
    menu_item_id: string | null;
    name: string;
    quantity_sold: number;
    revenue: number;
  }>;

  category_breakdown: Array<{
    category_id: string | null;
    category_name: string;
    order_count: number;
    revenue: number;
    percentage: number;
  }>;

  discounts: {
    total_amount: number;
    application_count: number;
    by_type: Array<{ type: string; name: string; count: number; total: number }>;
  };

  cancellations: {
    cancelled_order_count: number;
    cancelled_value: number;
  };

  // Per-location breakdown (informational, not legal/fiscal)
  per_warehouse?: Array<{
    warehouse_id: string;
    warehouse_name: string;
    is_main: boolean;
    order_count: number;
    subtotal: number;
    vat_amount: number;
    net_revenue: number;
  }>;

  // Non-fiscal B2B invoices (parallel section — not added to fiscal totals)
  non_fiscal_sales?: {
    order_linked: {
      count: number;
      total_amount: number;
      total_vat: number;
      total_subtotal: number;
    };
    standalone: {
      count: number;
      total_amount: number;
    };
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function computeZReport(
  shiftId: string,
  restaurantId: string,
  closedBy: { id: string; name: string },
  actualCash: number,
): Promise<ZReportData> {
  // ── Q1: Shift + restaurant + opener ───────────────────────────────────────
  const shiftRes = await pool.query<{
    id: string; start_time: string; end_time: string | null;
    initial_cash: string; user_id: string; opener_name: string;
    restaurant_name: string; restaurant_address: string | null;
    vat_number: string | null; price_includes_vat: boolean;
  }>(
    `SELECT
       s.id, s.start_time, s.end_time, s.initial_cash, s.user_id,
       u.name AS opener_name,
       r.name AS restaurant_name,
       r.address AS restaurant_address,
       r.settings->>'vat_number' AS vat_number,
       COALESCE(r.price_includes_vat, TRUE) AS price_includes_vat
     FROM shifts s
     JOIN restaurants r ON r.id = s.restaurant_id
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.restaurant_id = $2`,
    [shiftId, restaurantId],
  );

  if (!shiftRes.rows.length) throw new Error('Shift not found');
  const shift = shiftRes.rows[0];

  const openedAt = shift.start_time;
  const closedAt = new Date().toISOString();
  const durationMinutes = Math.round(
    (new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000,
  );
  const initialCash = round2(Number(shift.initial_cash));
  const priceIncludesVat = shift.price_includes_vat;

  // ── Q2: Order-level aggregates ────────────────────────────────────────────
  const orderAggRes = await pool.query<{
    status: string; payment_method: string | null; order_type: string;
    hour: string; order_count: string; revenue: string; guest_count: string;
  }>(
    `SELECT
       status,
       COALESCE(payment_method, 'unknown') AS payment_method,
       order_type,
       EXTRACT(hour FROM created_at)::int AS hour,
       COUNT(*) AS order_count,
       SUM(total_amount) AS revenue,
       SUM(COALESCE(guest_count, 1)) AS guest_count
     FROM orders
     WHERE shift_id = $1 AND restaurant_id = $2
     GROUP BY status, payment_method, order_type, hour`,
    [shiftId, restaurantId],
  );

  const rows = orderAggRes.rows;

  // Revenue totals (paid only)
  const paidRows = rows.filter(r => r.status === 'paid');
  const grossRevenue = round2(paidRows.reduce((s, r) => s + Number(r.revenue), 0));
  const orderCount = paidRows.reduce((s, r) => s + Number(r.order_count), 0);
  const guestCount = paidRows.reduce((s, r) => s + Number(r.guest_count), 0);

  // Cancelled totals
  const cancelledRows = rows.filter(r => r.status === 'cancelled');
  const cancelledOrderCount = cancelledRows.reduce((s, r) => s + Number(r.order_count), 0);
  const cancelledValue = round2(cancelledRows.reduce((s, r) => s + Number(r.revenue), 0));

  // Payment method breakdown (paid only)
  const paymentMap = new Map<string, { count: number; total: number }>();
  for (const r of paidRows) {
    const m = r.payment_method;
    const existing = paymentMap.get(m) ?? { count: 0, total: 0 };
    paymentMap.set(m, {
      count: existing.count + Number(r.order_count),
      total: round2(existing.total + Number(r.revenue)),
    });
  }
  const paymentBreakdown = [...paymentMap.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.total - a.total);

  // Order type breakdown (paid only)
  const typeMap = new Map<string, { count: number; total: number }>();
  for (const r of paidRows) {
    const t = r.order_type;
    const existing = typeMap.get(t) ?? { count: 0, total: 0 };
    typeMap.set(t, {
      count: existing.count + Number(r.order_count),
      total: round2(existing.total + Number(r.revenue)),
    });
  }
  const orderTypeBreakdown = [...typeMap.entries()]
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.total - a.total);

  // Hourly revenue (paid only, all 24 hours)
  const hourlyMap = new Map<number, { order_count: number; revenue: number }>();
  for (const r of paidRows) {
    const h = Number(r.hour);
    const existing = hourlyMap.get(h) ?? { order_count: 0, revenue: 0 };
    hourlyMap.set(h, {
      order_count: existing.order_count + Number(r.order_count),
      revenue: round2(existing.revenue + Number(r.revenue)),
    });
  }
  const hourlyRevenue = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    order_count: hourlyMap.get(h)?.order_count ?? 0,
    revenue: hourlyMap.get(h)?.revenue ?? 0,
  }));

  // Expected cash = initial_cash + all cash payments on paid orders
  const cashSales = round2(
    paidRows
      .filter(r => r.payment_method === 'cash')
      .reduce((s, r) => s + Number(r.revenue), 0),
  );
  const expectedCash = round2(initialCash + cashSales);
  const cashDifference = round2(actualCash - expectedCash);

  // ── Q3: Item-level aggregates (paid orders only) ──────────────────────────
  const itemRes = await pool.query<{
    menu_item_id: string | null; name: string;
    quantity: string; line_total: string; vat_rate: string | null;
    category_id: string | null; category_name: string | null;
    order_id: string;
  }>(
    `SELECT
       oi.menu_item_id,
       oi.name,
       oi.quantity,
       (oi.price * oi.quantity) AS line_total,
       COALESCE(oi.vat_rate, 0.10) AS vat_rate,
       mc.id AS category_id,
       mc.name AS category_name,
       o.id AS order_id
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
     LEFT JOIN menu_categories mc ON mc.id = mi.menu_category_id
     WHERE o.shift_id = $1 AND o.restaurant_id = $2 AND o.status = 'paid'`,
    [shiftId, restaurantId],
  );

  const itemRows = itemRes.rows;
  const itemCount = itemRows.reduce((s, r) => s + Number(r.quantity), 0);

  // VAT breakdown using existing aggregateVatByRate helper
  const vatItems = itemRows.map(r => ({
    price: Number(r.line_total),
    vat_rate: Number(r.vat_rate),
    quantity: 1, // line_total already multiplied
  }));
  const vatMap = aggregateVatByRate(vatItems, priceIncludesVat);
  const vatBreakdown = [...vatMap.entries()]
    .map(([rate, v]) => ({
      rate,
      gross: round2(v.gross),
      net: round2(v.net),
      vat: round2(v.vat),
      item_count: v.count,
    }))
    .sort((a, b) => b.gross - a.gross);

  const totalVat = round2(vatBreakdown.reduce((s, v) => s + v.vat, 0));
  const netRevenue = round2(grossRevenue - totalVat);

  // Top items
  const itemSalesMap = new Map<string, { menu_item_id: string | null; name: string; quantity_sold: number; revenue: number }>();
  for (const r of itemRows) {
    const key = r.menu_item_id ?? `__name__${r.name}`;
    const existing = itemSalesMap.get(key) ?? { menu_item_id: r.menu_item_id, name: r.name, quantity_sold: 0, revenue: 0 };
    itemSalesMap.set(key, {
      ...existing,
      quantity_sold: existing.quantity_sold + Number(r.quantity),
      revenue: round2(existing.revenue + Number(r.line_total)),
    });
  }
  const topItems = [...itemSalesMap.values()]
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, 10);

  // Category breakdown
  const catMap = new Map<string, { category_id: string | null; category_name: string; order_ids: Set<string>; revenue: number }>();
  for (const r of itemRows) {
    const key = r.category_id ?? '__uncategorized__';
    const existing = catMap.get(key) ?? {
      category_id: r.category_id,
      category_name: r.category_name ?? 'Некатегоризирано',
      order_ids: new Set(),
      revenue: 0,
    };
    existing.order_ids.add(r.order_id);
    existing.revenue = round2(existing.revenue + Number(r.line_total));
    catMap.set(key, existing);
  }
  const categoryBreakdown = [...catMap.values()]
    .map(c => ({
      category_id: c.category_id,
      category_name: c.category_name,
      order_count: c.order_ids.size,
      revenue: c.revenue,
      percentage: grossRevenue > 0 ? round2((c.revenue / grossRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Q4: Discounts (paid orders only) ─────────────────────────────────────
  const discountRes = await pool.query<{
    applied_name: string; applied_type: string;
    total: string; cnt: string;
  }>(
    `SELECT
       od.applied_name,
       od.applied_type,
       SUM(od.applied_amount) AS total,
       COUNT(*) AS cnt
     FROM order_discounts od
     JOIN orders o ON o.id = od.order_id
     WHERE o.shift_id = $1 AND o.restaurant_id = $2 AND o.status = 'paid'
     GROUP BY od.applied_name, od.applied_type`,
    [shiftId, restaurantId],
  );

  const discountRows = discountRes.rows;
  const discountTotalAmount = round2(discountRows.reduce((s, r) => s + Number(r.total), 0));
  const discountApplicationCount = discountRows.reduce((s, r) => s + Number(r.cnt), 0);

  // ── Q5: Per-warehouse revenue breakdown (informational) ───────────────────
  // Routes paid orders through table → warehouse. Orders without a table
  // (takeaway/delivery) appear as a separate 'no_table' row.
  // VAT back-calculated assuming price_includes_vat (decimal rate, e.g. 0.10).
  const perWarehouseRes = await pool.query<{
    warehouse_id: string;
    warehouse_name: string;
    is_main: boolean;
    order_count: string;
    subtotal: string | null;
    vat_amount: string | null;
    net_revenue: string | null;
  }>(
    `SELECT
       COALESCE(rt.warehouse_id::text, 'no_table') AS warehouse_id,
       COALESCE(w.name, 'Takeaway/Delivery') AS warehouse_name,
       COALESCE(w.is_main, FALSE) AS is_main,
       COUNT(DISTINCT o.id) AS order_count,
       SUM(oi.quantity * oi.price) AS subtotal,
       SUM(oi.quantity * oi.price * COALESCE(oi.vat_rate, 0.10)
           / (1 + COALESCE(oi.vat_rate, 0.10))) AS vat_amount,
       SUM(oi.quantity * oi.price
           / (1 + COALESCE(oi.vat_rate, 0.10))) AS net_revenue
     FROM orders o
     LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
     LEFT JOIN warehouses w ON w.id = rt.warehouse_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.shift_id = $1
       AND o.restaurant_id = $2
       AND o.status = 'paid'
     GROUP BY rt.warehouse_id, w.name, w.is_main
     ORDER BY w.is_main DESC NULLS LAST, w.name ASC NULLS LAST`,
    [shiftId, restaurantId],
  );

  const perWarehouse = perWarehouseRes.rows.map(r => ({
    warehouse_id: r.warehouse_id,
    warehouse_name: r.warehouse_name,
    is_main: r.is_main,
    order_count: parseInt(r.order_count),
    subtotal: round2(parseFloat(r.subtotal ?? '0')),
    vat_amount: round2(parseFloat(r.vat_amount ?? '0')),
    net_revenue: round2(parseFloat(r.net_revenue ?? '0')),
  }));

  // ── Non-fiscal B2B invoices (parallel, not fiscal) ────────────────────────
  const [nonFiscalLinkedRes, nonFiscalStandaloneRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(DISTINCT nfi.id) AS count,
              COALESCE(SUM(nfi.total_amount), 0) AS total_amount,
              COALESCE(SUM(nfi.vat_amount), 0) AS total_vat,
              COALESCE(SUM(nfi.subtotal), 0) AS total_subtotal
       FROM non_fiscal_invoices nfi
       JOIN orders o ON o.non_fiscal_invoice_id = nfi.id
       WHERE o.shift_id = $1 AND o.restaurant_id = $2`,
      [shiftId, restaurantId],
    ),
    pool.query(
      `SELECT COUNT(*) AS count,
              COALESCE(SUM(total_amount), 0) AS total_amount
       FROM non_fiscal_invoices
       WHERE restaurant_id = $1
         AND order_id IS NULL
         AND issue_date::date = (SELECT start_time::date FROM shifts WHERE id = $2)`,
      [restaurantId, shiftId],
    ),
  ]);

  const nonFiscalSales = {
    order_linked: {
      count: parseInt(nonFiscalLinkedRes.rows[0].count),
      total_amount: round2(parseFloat(nonFiscalLinkedRes.rows[0].total_amount)),
      total_vat: round2(parseFloat(nonFiscalLinkedRes.rows[0].total_vat)),
      total_subtotal: round2(parseFloat(nonFiscalLinkedRes.rows[0].total_subtotal)),
    },
    standalone: {
      count: parseInt(nonFiscalStandaloneRes.rows[0].count),
      total_amount: round2(parseFloat(nonFiscalStandaloneRes.rows[0].total_amount)),
    },
  };

  return {
    shift_id: shiftId,
    restaurant: {
      id: restaurantId,
      name: shift.restaurant_name,
      address: shift.restaurant_address ?? undefined,
      vat_number: shift.vat_number ?? undefined,
      price_includes_vat: priceIncludesVat,
    },
    opened_at: openedAt,
    closed_at: closedAt,
    duration_minutes: durationMinutes,
    opened_by: { id: shift.user_id, name: shift.opener_name },
    closed_by: closedBy,

    initial_cash: initialCash,
    expected_cash: expectedCash,
    actual_cash: round2(actualCash),
    cash_difference: cashDifference,

    totals: {
      gross_revenue: grossRevenue,
      net_revenue: netRevenue,
      total_vat: totalVat,
      order_count: orderCount,
      item_count: itemCount,
      average_order_value: orderCount > 0 ? round2(grossRevenue / orderCount) : 0,
      guest_count: guestCount,
    },

    vat_breakdown: vatBreakdown,
    payment_breakdown: paymentBreakdown,
    order_type_breakdown: orderTypeBreakdown,
    hourly_revenue: hourlyRevenue,
    top_items: topItems,
    category_breakdown: categoryBreakdown,

    discounts: {
      total_amount: discountTotalAmount,
      application_count: discountApplicationCount,
      by_type: discountRows.map(r => ({
        type: r.applied_type,
        name: r.applied_name,
        count: Number(r.cnt),
        total: round2(Number(r.total)),
      })),
    },

    cancellations: {
      cancelled_order_count: cancelledOrderCount,
      cancelled_value: cancelledValue,
    },

    per_warehouse: perWarehouse,
    non_fiscal_sales: nonFiscalSales,
  };
}
