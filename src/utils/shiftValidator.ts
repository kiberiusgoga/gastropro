import pool from '../db';

export async function requireActiveShift(
  userId: string,
  restaurantId: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM shifts
     WHERE user_id = $1 AND restaurant_id = $2 AND status = 'open'
     LIMIT 1`,
    [userId, restaurantId],
  );
  if (!result.rows.length) {
    const err: NodeJS.ErrnoException = new Error(
      'No active shift. Open a shift before creating orders.',
    );
    (err as any).statusCode = 409;
    (err as any).code = 'NO_ACTIVE_SHIFT';
    throw err;
  }
  return result.rows[0].id;
}
