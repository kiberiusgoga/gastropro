import { PoolClient } from 'pg';

// ============================================================
// MAPA ZA KONVERZIJA NA EDINICI
// Klu~: UNIT_CONVERSION[recipe_unit][inventory_unit] = faktor
//
// Za dodavanje nova edinica (pr. 'oz'):
//   1. Dodaj vo ovaa mapa: oz: { g: 28.3495, kg: 0.0283495 }
//   2. Dodaj 'oz' vo CHECK constraint vo nova migracija
//   3. Dodaj 'oz' vo allowedUnitsFor() vo RecipeTab.tsx
// ============================================================
const UNIT_CONVERSION: Record<string, Record<string, number>> = {
  g:   { kg: 0.001 },
  ml:  { l:  0.001 },
  kg:  { kg: 1 },
  l:   { l:  1 },
  pcs: { pcs: 1, box: 1 },
  box: { box: 1 },
};

// Kombinacii koi se dozvoleni no barat predupreduvanje (recipe≠inventory semantics)
const WARN_PAIRS = new Set(['pcs→box']);

function convertToInventoryUnit(
  recipeQty: number,
  recipeUnit: string,
  inventoryUnit: string,
  ingredientName: string,
): { amount: number; warn: boolean } {
  const factor = UNIT_CONVERSION[recipeUnit]?.[inventoryUnit];
  if (factor === undefined) {
    throw new Error(
      `Cannot convert '${recipeUnit}' to '${inventoryUnit}' for ingredient '${ingredientName}'`,
    );
  }
  return {
    amount: recipeQty * factor,
    warn: WARN_PAIRS.has(`${recipeUnit}→${inventoryUnit}`),
  };
}

export interface DeductionWarning {
  ingredientName: string;
  required: number;
  available: number;
  inventoryUnit: string;
  reason: 'low_stock' | 'unit_mismatch';
}

/**
 * Odzemuva od zaliha za site sostojki vo normativot na eden order_item.
 * Mora da se povika vnatre vo otvorena DB transakcija.
 *
 * - Ako zalihata bi otisla pod 0: se dozvolouva (spec), se logira kako
 *   'low_stock_override' i se vraka predupreduvanje vo nizata warnings[].
 * - Ako menu_item nema definiran normativ: tiho se preskokouva.
 */
export async function deductForOrderItem(
  orderItemId: string,
  client: PoolClient,
): Promise<DeductionWarning[]> {
  const warnings: DeductionWarning[] = [];

  // 1. Zemame gi podatocite za order_item-ot (menu_item_id + kolicina porcii)
  const oiRes = await client.query(
    `SELECT oi.menu_item_id, oi.quantity AS portions, o.restaurant_id
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.id = $1`,
    [orderItemId],
  );
  if (oiRes.rowCount === 0) throw new Error(`Order item ${orderItemId} not found`);
  const { menu_item_id, portions, restaurant_id } = oiRes.rows[0];

  // 2. Gi ucituouvame sostojkite od normativot
  const recipeRes = await client.query(
    `SELECT ri.quantity AS recipe_qty, ri.recipe_unit,
            p.id AS product_id, p.name, p.current_stock, p.unit AS inv_unit
     FROM recipe_ingredients ri
     JOIN products p ON p.id = ri.inventory_item_id
     WHERE ri.menu_item_id = $1`,
    [menu_item_id],
  );

  if (recipeRes.rowCount === 0) {
    console.warn(`[Deduction] No recipe for menu_item_id=${menu_item_id} — skipping`);
    return [];
  }

  for (const ing of recipeRes.rows) {
    const { amount, warn: unitWarn } = convertToInventoryUnit(
      Number(ing.recipe_qty) * Number(portions),
      ing.recipe_unit,
      ing.inv_unit,
      ing.name,
    );

    const currentStock = Number(ing.current_stock);
    const wouldGoNegative = currentStock - amount < 0;
    const reason = wouldGoNegative ? 'low_stock_override' : 'order_completed';

    // Odzemuva (dozvolouva negativna zaliha per spec)
    await client.query(
      'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
      [amount, ing.product_id],
    );

    // Audit trail vo inventory_transactions
    await client.query(
      `INSERT INTO inventory_transactions
         (restaurant_id, inventory_item_id, change_amount, reason,
          reference_type, reference_id, note)
       VALUES ($1, $2, $3, $4, 'order_item', $5, $6)`,
      [
        restaurant_id,
        ing.product_id,
        -amount,
        reason,
        orderItemId,
        wouldGoNegative
          ? `Zaliha negativna. Bese: ${currentStock} ${ing.inv_unit}, odzeto: ${amount} ${ing.inv_unit}`
          : null,
      ],
    );

    if (wouldGoNegative) {
      warnings.push({
        ingredientName: ing.name,
        required: amount,
        available: currentStock,
        inventoryUnit: ing.inv_unit,
        reason: 'low_stock',
      });
    }
    if (unitWarn) {
      warnings.push({
        ingredientName: ing.name,
        required: amount,
        available: currentStock,
        inventoryUnit: ing.inv_unit,
        reason: 'unit_mismatch',
      });
    }
  }

  return warnings;
}

/**
 * Vraka ja zalihata za site sostojki vo normativot na eden order_item.
 * Se povikuva koga ready order_item e otkazan.
 * Mora da se povika vnatre vo otvorena DB transakcija.
 */
export async function restoreForOrderItem(
  orderItemId: string,
  client: PoolClient,
): Promise<void> {
  const oiRes = await client.query(
    `SELECT oi.menu_item_id, oi.quantity AS portions, o.restaurant_id
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.id = $1`,
    [orderItemId],
  );
  if (oiRes.rowCount === 0) return;
  const { menu_item_id, portions, restaurant_id } = oiRes.rows[0];

  const recipeRes = await client.query(
    `SELECT ri.quantity AS recipe_qty, ri.recipe_unit,
            p.id AS product_id, p.unit AS inv_unit
     FROM recipe_ingredients ri
     JOIN products p ON p.id = ri.inventory_item_id
     WHERE ri.menu_item_id = $1`,
    [menu_item_id],
  );

  for (const ing of recipeRes.rows) {
    const { amount } = convertToInventoryUnit(
      Number(ing.recipe_qty) * Number(portions),
      ing.recipe_unit,
      ing.inv_unit,
      '',
    );

    await client.query(
      'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2',
      [amount, ing.product_id],
    );

    await client.query(
      `INSERT INTO inventory_transactions
         (restaurant_id, inventory_item_id, change_amount, reason,
          reference_type, reference_id)
       VALUES ($1, $2, $3, 'order_cancelled_restore', 'order_item', $4)`,
      [restaurant_id, ing.product_id, amount, orderItemId],
    );
  }
}
