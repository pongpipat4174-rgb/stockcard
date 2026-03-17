// ลบแถวซ้ำใน sc_consumable_items (เก็บแถวที่มี id น้อยที่สุดต่อแต่ละชื่อ)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.INVENTORY_DB_HOST || 'localhost',
  port: parseInt(process.env.INVENTORY_DB_PORT || '5432'),
  database: process.env.INVENTORY_DB_NAME || 'inventory_rm_tan',
  user: process.env.INVENTORY_DB_USER || 'postgres',
  password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
});

async function dedupe() {
  const client = await pool.connect();
  try {
    // นับก่อนลบ
    const before = await client.query('SELECT COUNT(*) as cnt FROM sc_consumable_items');
    const dup = await client.query(`
      SELECT name, COUNT(*) as cnt FROM sc_consumable_items GROUP BY name HAVING COUNT(*) > 1
    `);

    if (dup.rows.length === 0) {
      console.log('ไม่มีข้อมูลซ้ำ');
      return;
    }

    console.log(`พบ ${dup.rows.length} ชื่อที่ซ้ำ รวม ~${dup.rows.reduce((s, r) => s + parseInt(r.cnt) - 1, 0)} แถวที่จะลบ`);

    // ลบแถวซ้ำ (เก็บแถวที่ id น้อยที่สุด)
    const result = await client.query(`
      DELETE FROM sc_consumable_items a
      USING sc_consumable_items b
      WHERE a.name = b.name AND a.id > b.id
    `);

    const after = await client.query('SELECT COUNT(*) as cnt FROM sc_consumable_items');
    console.log(`✅ ลบแล้ว ${result.rowCount} แถว`);
    console.log(`   ก่อน: ${before.rows[0].cnt} แถว → หลัง: ${after.rows[0].cnt} แถว`);
  } finally {
    client.release();
    await pool.end();
  }
}

dedupe().catch((e) => {
  console.error(e);
  process.exit(1);
});
