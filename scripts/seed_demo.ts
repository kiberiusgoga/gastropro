import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  console.log('--- Database Seeding Started ---');
  
  const client = await pool.connect();
  try {
    // 1. Run Schema
    console.log('Applying schema...');
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    console.log('Schema applied successfully.');

    // 2. Check if a restaurant exists
    const resCheck = await client.query('SELECT id FROM restaurants LIMIT 1');
    let restaurantId;

    if (resCheck.rowCount === 0) {
      console.log('Creating demo restaurant...');
      const resResult = await client.query(
        "INSERT INTO restaurants (name) VALUES ('Storehouse Demo') RETURNING id"
      );
      restaurantId = resResult.rows[0].id;
    } else {
      restaurantId = resCheck.rows[0].id;
      console.log('Using existing restaurant.');
    }

    // 3. Create Demo Admin User
    const email = 'admin@storehouse.mk';
    const password = 'password123';
    
    const userCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rowCount === 0) {
      console.log(`Creating demo user: ${email}...`);
      const hashedPassword = await bcrypt.hash(password, 10);
      await client.query(
        'INSERT INTO users (restaurant_id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5)',
        [restaurantId, 'Demo Admin', email, 'Admin', hashedPassword]
      );
      console.log('Demo user created.');
    } else {
      console.log('Demo user already exists.');
    }

    console.log('\n--- Seeding Completed Successfully ---');
    console.log('Login with:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
