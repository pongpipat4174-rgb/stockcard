require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.INVENTORY_DB_HOST || 'localhost',
    port: parseInt(process.env.INVENTORY_DB_PORT || '5432'),
    database: process.env.INVENTORY_DB_NAME || 'inventory_rm_tan',
    user: process.env.INVENTORY_DB_USER || 'postgres',
    password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
});

async function check() {
    // Find test records - dated today 17/3/2026
    const today = await pool.query(
        `SELECT id, date, product_code, product_name, type, in_qty, out_qty, source_module, row_index 
         FROM sc_rm WHERE date LIKE '%17/3/2026%' OR date LIKE '%17/03/2026%' ORDER BY id ASC`
    );
    console.log('=== Records dated 17/3/2026 ===');
    console.table(today.rows);
    console.log('Count:', today.rowCount);

    // Also check product "Chem OS" or "TEST" 
    const testProd = await pool.query(
        `SELECT id, date, product_code, product_name, type, source_module FROM sc_rm 
         WHERE product_name ILIKE '%test%' OR product_name ILIKE '%Chem OS%' ORDER BY id ASC`
    );
    console.log('=== Records with test-like names ===');
    console.table(testProd.rows);

    await pool.end();
}
check().catch(e => { console.error(e); pool.end(); });
