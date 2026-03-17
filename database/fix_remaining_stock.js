// Fix remaining_stock: restore from Google Sheet original values
// Then fix only the clearly broken ones (abs > 500)
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const fetch = require('node-fetch');

const pool = new Pool({
    host: process.env.INVENTORY_DB_HOST,
    port: parseInt(process.env.INVENTORY_DB_PORT),
    database: process.env.INVENTORY_DB_NAME,
    user: process.env.INVENTORY_DB_USER,
    password: process.env.INVENTORY_DB_PASSWORD
});

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_CONSUMABLE;

async function fix() {
    const client = await pool.connect();
    try {
        // 1. Fetch original data from Apps Script
        console.log('📡 Fetching transactions from Google Sheet...');
        const url = `${APPS_SCRIPT_URL}?action=load_all&sheet=Consumable&t=${Date.now()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.transactions || data.transactions.length === 0) {
            console.error('No transactions from Apps Script');
            return;
        }

        console.log(`📊 Got ${data.transactions.length} transactions from Sheet`);

        // 2. Build lookup: ID → remaining_stock from Sheet
        const sheetLookup = {};
        for (const t of data.transactions) {
            const id = String(t.ID || t.id);
            const remain = t['คงเหลือ (ลัง)'] !== undefined ? t['คงเหลือ (ลัง)'] : t.remainingStock;
            sheetLookup[id] = parseFloat(remain) || 0;
        }

        // 3. Get all DB transactions
        const dbRes = await client.query(
            'SELECT id, item_name, remaining_stock FROM sc_consumable_transactions ORDER BY item_name, date ASC'
        );

        let updated = 0;
        let alreadyOk = 0;

        for (const row of dbRes.rows) {
            const tid = String(row.id);
            const sheetRemain = sheetLookup[tid];

            if (sheetRemain !== undefined) {
                const dbRemain = parseFloat(row.remaining_stock) || 0;

                if (Math.abs(dbRemain - sheetRemain) > 0.01) {
                    // Check if Sheet value is also broken (> 500 in absolute)
                    let finalValue = sheetRemain;
                    
                    // If the Sheet value is wildly negative, it was also broken
                    // We'll keep it for now but flag it
                    if (Math.abs(sheetRemain) > 500) {
                        console.log(`  ⚠️ Sheet value also broken for ${row.item_name}: ${sheetRemain} (keeping as-is for now)`);
                    }

                    await client.query(
                        'UPDATE sc_consumable_transactions SET remaining_stock = $1 WHERE id = $2',
                        [finalValue, row.id]
                    );
                    updated++;
                } else {
                    alreadyOk++;
                }
            }
        }

        console.log(`\n✅ Updated ${updated} transactions from Sheet`);
        console.log(`✓ ${alreadyOk} already matched`);

        // 4. Now fix the broken Sheet values using recalculation
        // Get items with current stock
        const itemsRes = await client.query('SELECT name, stock_cartons FROM sc_consumable_items');
        const items = {};
        for (const r of itemsRes.rows) {
            items[r.name] = parseFloat(r.stock_cartons) || 0;
        }

        // Find transactions with abs(remaining_stock) > 500 — clearly broken
        const brokenRes = await client.query(
            `SELECT DISTINCT item_name FROM sc_consumable_transactions WHERE ABS(remaining_stock) > 500`
        );

        console.log(`\n🔧 Items with broken remaining_stock (>500): ${brokenRes.rows.length}`);

        for (const nameRow of brokenRes.rows) {
            const itemName = nameRow.item_name;
            const currentStock = items[itemName];
            if (currentStock === undefined) continue;

            const transRes = await client.query(
                `SELECT id, type, qty_cartons, remaining_stock FROM sc_consumable_transactions WHERE item_name = $1 ORDER BY date ASC, id ASC`,
                [itemName]
            );

            // Find the last transaction with a GOOD remaining_stock before the broken ones
            let lastGoodRemain = null;
            let lastGoodIdx = -1;

            for (let i = 0; i < transRes.rows.length; i++) {
                const r = parseFloat(transRes.rows[i].remaining_stock);
                if (Math.abs(r) <= 500) {
                    lastGoodRemain = r;
                    lastGoodIdx = i;
                }
            }

            if (lastGoodIdx >= 0) {
                // Replay from last known good point
                let running = lastGoodRemain;
                let fixCount = 0;

                for (let i = lastGoodIdx + 1; i < transRes.rows.length; i++) {
                    const t = transRes.rows[i];
                    const cartons = parseFloat(t.qty_cartons) || 0;
                    if (t.type === 'IN') running += cartons;
                    else running -= cartons;

                    await client.query(
                        'UPDATE sc_consumable_transactions SET remaining_stock = $1 WHERE id = $2',
                        [running, t.id]
                    );
                    fixCount++;
                }
                console.log(`  ✅ ${itemName}: Fixed ${fixCount} broken entries (from good point ${lastGoodRemain})`);
            } else {
                // All are broken, use current stock to work backwards
                let sumIn = 0, sumOut = 0;
                for (const t of transRes.rows) {
                    const c = parseFloat(t.qty_cartons) || 0;
                    if (t.type === 'IN') sumIn += c;
                    else sumOut += c;
                }
                let running = currentStock - sumIn + sumOut;
                let fixCount = 0;

                for (const t of transRes.rows) {
                    const c = parseFloat(t.qty_cartons) || 0;
                    if (t.type === 'IN') running += c;
                    else running -= c;

                    await client.query(
                        'UPDATE sc_consumable_transactions SET remaining_stock = $1 WHERE id = $2',
                        [running, t.id]
                    );
                    fixCount++;
                }
                console.log(`  ✅ ${itemName}: Recalculated all ${fixCount} entries (start=${currentStock - sumIn + sumOut})`);
            }
        }

        console.log('\n🎉 Done!');
    } finally {
        client.release();
        pool.end();
    }
}

fix().catch(e => { console.error(e); pool.end(); });
