import { PoolClient } from 'pg';

type DbClient = Pick<PoolClient, 'query'>;

/**
 * Resolves the warehouse for an order based on its table assignment.
 * Falls back to the restaurant's main warehouse for takeaway/delivery
 * orders (table_id IS NULL) or if the table has no warehouse set.
 */
export async function resolveWarehouseForOrder(
  orderId: string,
  client: DbClient,
): Promise<string> {
  const result = await client.query(
    `SELECT t.warehouse_id, o.restaurant_id
     FROM orders o
     LEFT JOIN restaurant_tables t ON t.id = o.table_id
     WHERE o.id = $1`,
    [orderId],
  );

  if (result.rows.length === 0) {
    throw new Error(`Order ${orderId} not found`);
  }

  const { warehouse_id, restaurant_id } = result.rows[0];

  if (warehouse_id) {
    return warehouse_id;
  }

  return getMainWarehouse(restaurant_id, client);
}

/**
 * Returns the main warehouse id for a restaurant.
 * Used by non-order operations: invoice receipts, manual movements,
 * PO receives, inventory checks.
 */
export async function getMainWarehouse(
  restaurantId: string,
  client: DbClient,
): Promise<string> {
  const result = await client.query(
    `SELECT id FROM warehouses
     WHERE restaurant_id = $1 AND is_main = TRUE
     LIMIT 1`,
    [restaurantId],
  );

  if (result.rows.length === 0) {
    throw new Error(`No main warehouse for restaurant ${restaurantId}`);
  }

  return result.rows[0].id;
}
