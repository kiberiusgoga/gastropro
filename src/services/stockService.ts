import { ValidationError, NotFoundError } from '../lib/errors';
import logger from '../lib/logger';

export type StockMovementType =
  | 'receipt'
  | 'output_sale'
  | 'output_manual'
  | 'restore_cancel'
  | 'inventory_check'
  | 'storno';

export interface StockOptions {
  allowNegative?: boolean;
  referenceType?: 'order_item' | 'invoice' | 'po_receive' | 'manual' | 'inventory_check';
  reason?: string;
}

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rowCount: number | null; rows: any[] }>;
};

// Note: SELECT FOR UPDATE locks the stock_levels row per call. Recipe
// deduction with N ingredients = N locks on N stock_levels rows. Under
// high concurrent load (>50 orders/min), consider batching. Acceptable
// for current scale.
export async function updateStock(
  client: DbClient,
  productId: string,
  warehouseId: string,
  type: StockMovementType,
  quantity: number,
  userId: string | null,
  restaurantId: string,
  note?: string,
  referenceId?: string,
  options?: StockOptions,
): Promise<number> {
  // Validate warehouse belongs to this restaurant
  const wResult = await client.query(
    'SELECT id FROM warehouses WHERE id = $1 AND restaurant_id = $2',
    [warehouseId, restaurantId],
  );
  if (wResult.rows.length === 0) {
    throw new ValidationError('Invalid warehouse for restaurant');
  }

  // Ensure a stock_levels row exists before locking (handles first movement
  // for a product that was added after the migration backfill).
  await client.query(
    `INSERT INTO stock_levels (warehouse_id, product_id, restaurant_id, quantity)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (warehouse_id, product_id) DO NOTHING`,
    [warehouseId, productId, restaurantId],
  );

  // Lock row for this transaction — serialises concurrent movements on the
  // same product+warehouse combination.
  const stockResult = await client.query(
    `SELECT quantity FROM stock_levels
     WHERE warehouse_id = $1 AND product_id = $2
     FOR UPDATE`,
    [warehouseId, productId],
  );
  const previousQuantity = parseFloat(stockResult.rows[0].quantity);

  const movementQty = parseFloat(quantity.toString());
  let newQuantity: number;
  if (type === 'inventory_check') {
    // Absolute set — quantity IS the new count, not a delta.
    newQuantity = movementQty;
  } else {
    // receipt / restore_cancel / storno → add; output_sale / output_manual → subtract.
    const adds = type === 'receipt' || type === 'restore_cancel' || type === 'storno';
    newQuantity = previousQuantity + (adds ? movementQty : -movementQty);
  }

  if (newQuantity < 0 && !options?.allowNegative) {
    throw new ValidationError(`Insufficient stock for product ${productId}`);
  }

  // Write to stock_levels — trigger trg_stock_levels_sync_current_stock
  // propagates the change to products.current_stock automatically.
  await client.query(
    `UPDATE stock_levels
     SET quantity = $1, updated_at = NOW()
     WHERE warehouse_id = $2 AND product_id = $3`,
    [newQuantity, warehouseId, productId],
  );

  // Quantity logged in transactions: actual movement size for regular types;
  // absolute diff for inventory_check (the "correction" amount).
  const txQty = type === 'inventory_check'
    ? Math.abs(newQuantity - previousQuantity)
    : movementQty;

  await client.query(
    `INSERT INTO transactions
       (restaurant_id, warehouse_id, product_id, type, quantity,
        previous_stock, new_stock, user_id, note,
        reference_id, reference_type, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      restaurantId, warehouseId, productId, type, txQty,
      previousQuantity, newQuantity, userId, note ?? null,
      referenceId ?? null, options?.referenceType ?? null, options?.reason ?? null,
    ],
  );

  logger.info('Inventory transaction recorded', {
    productId,
    warehouseId,
    type,
    quantity: txQty,
    previousStock: previousQuantity,
    newStock: newQuantity,
    userId,
    referenceId,
    restaurantId,
  });

  return newQuantity;
}
