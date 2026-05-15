import pool from '../db';

export interface MenuItemCost {
  menu_item_id: string;
  unit_cost: number | null;
  ingredients_count: number;
  missing_purchase_price: boolean;
}

export interface MarginBreakdown {
  selling_price: number;
  vat_rate: number;
  net_revenue: number;
  unit_cost: number;
  vat_amount: number;
  net_margin_amount: number;
  net_margin_percent: number;
}

export async function calculateMenuItemCost(
  menuItemId: string,
  restaurantId: string
): Promise<MenuItemCost> {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ri.id IS NOT NULL) AS ingredients_count,
       COALESCE(SUM(
         CASE
           WHEN ri.recipe_unit = 'g'  AND p.unit = 'kg' THEN ri.quantity * 0.001 * p.purchase_price
           WHEN ri.recipe_unit = 'ml' AND p.unit = 'l'  THEN ri.quantity * 0.001 * p.purchase_price
           ELSE ri.quantity * p.purchase_price
         END
       ), 0) AS total_cost,
       (COUNT(*) FILTER (WHERE p.purchase_price = 0 AND ri.id IS NOT NULL)) > 0 AS has_missing_prices
     FROM menu_items mi
     LEFT JOIN recipe_ingredients ri ON ri.menu_item_id = mi.id
     LEFT JOIN products p ON p.id = ri.inventory_item_id
                          AND p.restaurant_id = $2
     WHERE mi.id = $1 AND mi.restaurant_id = $2`,
    [menuItemId, restaurantId]
  );

  if (result.rows.length === 0) {
    throw new Error('Menu item not found');
  }

  const row = result.rows[0];
  const ingredientsCount = parseInt(row.ingredients_count);

  return {
    menu_item_id: menuItemId,
    unit_cost: ingredientsCount > 0 ? parseFloat(row.total_cost) : null,
    ingredients_count: ingredientsCount,
    missing_purchase_price: row.has_missing_prices === true,
  };
}

export function calculateNetMargin(
  sellingPriceGross: number,
  vatRate: number,
  unitCost: number
): MarginBreakdown {
  if (vatRate < 0 || vatRate > 1) {
    throw new Error(`Invalid VAT rate: ${vatRate}`);
  }
  if (unitCost < 0) {
    throw new Error(`Invalid unit cost: ${unitCost}`);
  }

  const netRevenue = sellingPriceGross / (1 + vatRate);
  const vatAmount = sellingPriceGross - netRevenue;
  const netMarginAmount = netRevenue - unitCost;
  const netMarginPercent = netRevenue > 0
    ? (netMarginAmount / netRevenue) * 100
    : 0;

  return {
    selling_price: round2(sellingPriceGross),
    vat_rate: vatRate,
    net_revenue: round2(netRevenue),
    unit_cost: round2(unitCost),
    vat_amount: round2(vatAmount),
    net_margin_amount: round2(netMarginAmount),
    net_margin_percent: round2(netMarginPercent),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Pure reference implementation of the unit-conversion CASE in the SQL cost queries.
// The SQL and this function must stay in sync. Test this function to verify conversion
// semantics — mocked-DB tests cannot catch SQL CASE errors.
export function ingredientCost(
  quantity: number,
  recipeUnit: string,
  invUnit: string,
  purchasePrice: number
): number {
  if (recipeUnit === 'g'  && invUnit === 'kg') return quantity * 0.001 * purchasePrice;
  if (recipeUnit === 'ml' && invUnit === 'l')  return quantity * 0.001 * purchasePrice;
  return quantity * purchasePrice;
}
