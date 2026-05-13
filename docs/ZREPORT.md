# Z-Report (End-of-Shift Report)

## Overview

A Z-report is the fiscal summary generated when a shift is closed. It is immutable — the data is computed once and stored as JSONB in `shifts.zreport_data`. Reading a Z-report always returns the frozen snapshot, never recalculates.

---

## Workflow

```
Shift open
    │
    │  (orders created, items sold, payments taken)
    │
    ▼
Manager / Waiter triggers "Затвори смена"
    │
    ▼
CloseShiftModal
  ├─ GET /shifts/:id/preview   → shows live totals before commit
  ├─ User enters actual cash
  └─ POST /shifts/:id/close
         │
         ├─ Validates: no open orders (409 SHIFT_HAS_OPEN_ORDERS)
         ├─ Validates: not already closed (409 SHIFT_ALREADY_CLOSED)
         ├─ computeZReport() — 4 SQL queries
         ├─ UPDATE shifts SET status='closed', zreport_data=…  (atomic)
         ├─ logAuthEvent('shift_closed')
         └─ Returns { shift_id, zreport }
    │
    ▼
ZReportView displayed (print / PDF available)
    │
    ▼
ShiftHistory — row appears in closed-shift table
```

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/shifts/:id/close` | Any role | Close shift + generate Z-report |
| `GET` | `/shifts/:id/preview` | Any role | Live preview without closing |
| `GET` | `/shifts/:id/zreport` | Any role | Retrieve frozen Z-report |
| `GET` | `/shifts` | Any role | Paginated shift list (Waiter sees own only) |

### POST /shifts/:id/close

**Body:**
```json
{
  "actual_cash": 1450.00,
  "notes": "Optional notes (max 1000 chars)"
}
```

**Errors:**
- `409 SHIFT_HAS_OPEN_ORDERS` — `open_order_count` in body
- `409 SHIFT_ALREADY_CLOSED`
- `403` — Waiter trying to close another waiter's shift

**Success (200):**
```json
{
  "shift_id": "uuid",
  "zreport": { /* ZReportData */ }
}
```

### GET /shifts (query params)

| Param | Type | Description |
|-------|------|-------------|
| `status` | `open` \| `closed` | Filter by status |
| `user_id` | UUID | Filter by waiter (Manager/Admin only) |
| `date_from` | `YYYY-MM-DD` | Start of range (inclusive) |
| `date_to` | `YYYY-MM-DD` | End of range (inclusive) |
| `page` | number | Default 1 |
| `limit` | number | Default 20, max 100 |

---

## ZReportData Structure

```typescript
{
  shift_id: string
  restaurant: { id, name, address?, vat_number?, price_includes_vat }
  opened_at: ISO8601
  closed_at: ISO8601
  duration_minutes: number
  opened_by: { id, name }
  closed_by: { id, name }

  initial_cash: number       // cash in drawer at shift start
  expected_cash: number      // initial_cash + SUM(cash payment orders)
  actual_cash: number        // entered by cashier
  cash_difference: number    // actual - expected (+ = surplus, - = shortage)

  totals: {
    gross_revenue: number    // sum of paid order totals
    net_revenue: number      // gross - total_vat
    total_vat: number
    order_count: number
    item_count: number
    average_order_value: number
    guest_count: number
  }

  vat_breakdown: Array<{ rate, gross, net, vat, item_count }>
  payment_breakdown: Array<{ method, count, total }>
  order_type_breakdown: Array<{ type, count, total }>
  hourly_revenue: Array<{ hour(0-23), order_count, revenue }>  // always 24 elements
  top_items: Array<{ menu_item_id?, name, quantity_sold, revenue }>  // top 10
  category_breakdown: Array<{ category_id?, category_name, order_count, revenue, percentage }>

  discounts: {
    total_amount: number
    application_count: number
    by_type: Array<{ type, name, count, total }>
  }

  cancellations: {
    cancelled_order_count: number
    cancelled_value: number
  }
}
```

---

## VAT Calculation

VAT rates are snapshotted on `order_items.vat_rate` at order creation time:

```sql
COALESCE((SELECT vat_rate FROM menu_items WHERE id = $2), 0.10)
```

The Z-report groups items by their snapshotted rate. Changing a menu item's VAT rate after the order is placed does not affect historical reports.

**price_includes_vat = true** (default):
```
net = gross / (1 + rate)
vat = gross - net
```

**price_includes_vat = false:**
```
net = gross
vat = gross * rate
```

---

## Cash Reconciliation

```
expected_cash = initial_cash + SUM(paid orders WHERE payment_method = 'cash')
cash_difference = actual_cash - expected_cash
```

- `cash_difference = 0` → green
- `|cash_difference| ≤ 50` → yellow (minor discrepancy)
- `|cash_difference| > 50` → red (significant discrepancy)

---

## Database Schema

```sql
-- shifts table additions (migration 0008_zreport.sql)
ALTER TABLE shifts ADD COLUMN zreport_data JSONB;
ALTER TABLE shifts ADD COLUMN zreport_generated_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN cash_difference NUMERIC(15,2);
ALTER TABLE shifts ADD COLUMN closed_by_user_id UUID REFERENCES users(id);

-- order_discounts junction table (discount snapshot, never recalculated)
CREATE TABLE order_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
  applied_name TEXT NOT NULL,
  applied_type TEXT NOT NULL CHECK (applied_type IN ('percentage','fixed','bogo','happy_hour','manual_override')),
  applied_value NUMERIC(15,4) NOT NULL,
  applied_amount NUMERIC(15,2) NOT NULL,
  reason TEXT,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_shifts_active ON shifts(user_id, restaurant_id) WHERE status = 'open';
CREATE INDEX idx_orders_shift_status ON orders(shift_id, status) WHERE shift_id IS NOT NULL;
```

---

## RBAC

| Role | Close own shift | Close other shifts | View own Z-report | View all Z-reports |
|------|:-:|:-:|:-:|:-:|
| Waiter | ✅ | ❌ (403) | ✅ | ❌ (403) |
| Manager | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ |

---

## Accountant Notes

- The Z-report is the fiscal closing document for a shift. It should be printed and filed at the end of each business day.
- `gross_revenue` is the total billed amount (VAT included, as shown on customer receipts).
- `net_revenue` = gross minus VAT — this is the revenue recognized for income purposes.
- `cash_difference` must be explained in the notes field when non-zero.
- Cancelled orders are tracked separately and are NOT included in `gross_revenue`.
- Discounts reduce the `total_amount` on orders, which means `gross_revenue` is already net of discounts.

---

## Frontend Components

| Component | Path | Description |
|-----------|------|-------------|
| `CloseShiftModal` | `src/components/Shifts/CloseShiftModal.tsx` | Shift close form with preview and actual cash input |
| `ZReportView` | `src/components/Shifts/ZReportView.tsx` | Full Z-report display with print/PDF support |
| `ShiftHistory` | `src/components/Shifts/ShiftHistory.tsx` | Paginated table of closed shifts with Z-report drill-down |

Both `CloseShiftModal` and `ShiftHistory` are embedded in `StaffView`. After closing a shift, `ZReportView` replaces the StaffView content. Click "Back" to return.
