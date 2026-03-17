// Fix PVC 222*200 remaining_stock specifically
// Starting stock = 24 (from first transaction: OUT 2 → remain 22, so start was 24)
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.INVENTORY_DB_HOST,
    port: parseInt(process.env.INVENTORY_DB_PORT),
    database: process.env.INVENTORY_DB_NAME,
    user: process.env.INVENTORY_DB_USER,
    password: process.env.INVENTORY_DB_PASSWORD
});

async function fix() {
    const client = await pool.connect();
    try {
        const res = await client.query(
            `SELECT id, type, qty_cartons, remaining_stock 
             FROM sc_consumable_transactions 
             WHERE item_name LIKE '%222*200%' 
             ORDER BY date ASC, id ASC`
        );

        // Starting stock = 24 (first row: OUT 2 -> should be 22)
        let running = 24;

        for (const t of res.rows) {
            const cartons = parseFloat(t.qty_cartons) || 0;
            if (t.type === 'IN') running += cartons;
            else running -= cartons;

            const old = t.remaining_stock;
            await client.query(
                'UPDATE sc_consumable_transactions SET remaining_stock = $1 WHERE id = $2',
                [running, t.id]
            );
            console.log(`${t.type} ${cartons} → remain: ${running} (was: ${old})`);
        }

        console.log('\n✅ Done! Final stock:', running);
    } finally {
        client.release();
        pool.end();
    }
}

fix().catch(e => { console.error(e); pool.end(); });
