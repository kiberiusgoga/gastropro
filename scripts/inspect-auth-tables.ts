import 'dotenv/config';
import pool from '../src/db';

async function inspect() {
  const tables = ['refresh_tokens', 'password_reset_tokens', 'auth_audit_log'];

  // Check users.must_change_password column
  console.log('\n=== users.must_change_password ===');
  const userCol = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'must_change_password'
  `);
  console.table(userCol.rows);

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);

    // Columns
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    console.log('\nColumns:');
    console.table(cols.rows);

    // Indexes
    const idx = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = $1
      ORDER BY indexname
    `, [table]);

    console.log('\nIndexes:');
    idx.rows.forEach(r => console.log(`  ${r.indexname}`));

    // Constraints (PK, FK, CHECK, UNIQUE)
    const con = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = $1::regclass
      ORDER BY contype, conname
    `, [table]);

    console.log('\nConstraints:');
    con.rows.forEach(r => {
      const typeMap: Record<string, string> = {
        c: 'CHECK', f: 'FK', p: 'PK', u: 'UNIQUE'
      };
      const type = typeMap[r.contype] || r.contype;
      console.log(`  [${type}] ${r.conname}: ${r.definition}`);
    });
  }

  await pool.end();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
