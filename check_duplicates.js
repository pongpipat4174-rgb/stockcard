require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.INVENTORY_DB_HOST || 'localhost',
  port: parseInt(process.env.INVENTORY_DB_PORT || '5432'),
  database: process.env.INVENTORY_DB_NAME || 'inventory_rm_tan',
  user: process.env.INVENTORY_DB_USER || 'postgres',
  password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
});

async function check() {
  const r = await pool.query(`
    SELECT name, COUNT(*) as cnt 
    FROM sc_consumable_items 
    GROUP BY name 
    HAVING COUNT(*) > 1 
    ORDER BY cnt DESC
  `);
  console.log('รายการที่ซ้ำ (ชื่อสินค้า | จำนวนแถว):');
  r.rows.forEach(row => console.log('  -', row.name, '|', row.cnt, 'แถว'));
  await pool.end();
}
check();
