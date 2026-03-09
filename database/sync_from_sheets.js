// ============================================================
// StockCard - Sync from Google Sheets to PostgreSQL
// ============================================================
// ดึงข้อมูลจาก Google Sheets แล้ว INSERT เข้า PostgreSQL
// ใช้สำหรับ initial migration เท่านั้น
//
// การใช้งาน: node sync_from_sheets.js
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { Pool } = require('pg');
const fetch = require('node-fetch');

const pool = new Pool({
    host: process.env.INVENTORY_DB_HOST || 'localhost',
    port: parseInt(process.env.INVENTORY_DB_PORT || '15432'),
    database: process.env.INVENTORY_DB_NAME || 'pddoc_dev',
    user: process.env.INVENTORY_DB_USER || 'postgres',
    password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
    max: 5,
});

// ============================================================
// HELPER: Fetch Google Sheet via gviz/tq API
// ============================================================
async function fetchGoogleSheet(sheetId, sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&tq=SELECT%20*`;
    console.log(`  📡 Fetching: ${sheetName}...`);

    const response = await fetch(url);
    const text = await response.text();

    // Check for HTML error
    if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('google.com/accounts')) {
        throw new Error(`Sheet "${sheetName}" is not publicly shared`);
    }

    // Extract JSON
    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
    if (!jsonMatch || !jsonMatch[1]) {
        throw new Error(`Cannot parse response for "${sheetName}"`);
    }

    const json = JSON.parse(jsonMatch[1]);
    return json.table.rows;
}

// ============================================================
// HELPER: Fetch from Google Apps Script API
// ============================================================
async function fetchAppsScript(url, action, sheet) {
    const fullUrl = `${url}?action=${action}&sheet=${sheet}&t=${Date.now()}`;
    console.log(`  📡 Fetching via Apps Script: ${sheet}...`);

    const response = await fetch(fullUrl);
    const data = await response.json();

    if (data.error) throw new Error(data.error);
    return data;
}

// ============================================================
// 1. SYNC PACKAGE DATA
// ============================================================
async function syncPackage() {
    console.log('\n📦 === SYNC: Package ===');

    const sheetId = process.env.SHEET_PACKAGE_ID;
    const sheetName = process.env.SHEET_PACKAGE_NAME || 'บันทึก StockCard';

    if (!sheetId) {
        console.log('  ⚠️ SHEET_PACKAGE_ID not set, skipping');
        return;
    }

    try {
        const rows = await fetchGoogleSheet(sheetId, sheetName);

        const records = rows.map((row, index) => {
            const c = row.c;
            return {
                date: c[0]?.f || c[0]?.v || '',
                productCode: c[1]?.v || '',
                productName: c[2]?.v || '',
                type: c[3]?.v || '',
                inQty: parseFloat(c[4]?.v) || 0,
                outQty: parseFloat(c[5]?.v) || 0,
                balance: parseFloat(c[6]?.v) || 0,
                lotNo: c[7]?.v || '',
                pkId: c[8]?.v || '',
                docRef: c[10]?.v || '',
                remark: c[12]?.v || '',
                rowIndex: index + 2,
            };
        }).filter(r => r.productCode && r.productCode !== 'code');

        console.log(`  📊 พบ ${records.length} รายการ`);

        // Clear existing and insert
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query("DELETE FROM sc_package WHERE source_module = 'package'");

            let inserted = 0;
            for (const r of records) {
                await client.query(
                    `INSERT INTO sc_package (date, product_code, product_name, type, in_qty, out_qty, balance, lot_no, pk_id, doc_ref, remark, source_module, row_index)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'package',$12)`,
                    [r.date, r.productCode, r.productName, r.type, r.inQty, r.outQty, r.balance, r.lotNo, r.pkId, r.docRef, r.remark, r.rowIndex]
                );
                inserted++;
            }

            await client.query('COMMIT');
            console.log(`  ✅ Synced ${inserted} records to sc_package`);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(`  ❌ Package sync failed:`, err.message);
    }
}

// ============================================================
// 2. SYNC RM DATA (Center + Production)
// ============================================================
async function syncRM(moduleKey, sheetName, sourceModule) {
    console.log(`\n🧪 === SYNC: ${sourceModule.toUpperCase()} ===`);

    const sheetId = process.env.SHEET_RM_ID;

    if (!sheetId) {
        console.log('  ⚠️ SHEET_RM_ID not set, skipping');
        return;
    }

    try {
        const rows = await fetchGoogleSheet(sheetId, sheetName);

        const records = rows.map((row, index) => {
            const c = row.c;
            return {
                date: c[0]?.f || c[0]?.v || '',
                productCode: c[1]?.v || '',
                productName: c[2]?.v || '',
                type: c[3]?.v || '',
                containerQty: parseFloat(c[4]?.v) || 0,
                containerWeight: parseFloat(c[5]?.v) || 0,
                remainder: parseFloat(c[6]?.v) || 0,
                inQty: parseFloat(c[7]?.v) || 0,
                outQty: parseFloat(c[8]?.v) || 0,
                balance: parseFloat(c[9]?.v) || 0,
                lotNo: c[10]?.v || '',
                vendorLot: c[11]?.v || '',
                mfgDate: c[12]?.f || c[12]?.v || '',
                expDate: c[13]?.f || c[13]?.v || '',
                daysLeft: c[14]?.v?.toString() || '',
                lotBalance: parseFloat(c[15]?.v) || 0,
                supplier: c[16]?.v || '',
                remark: c[17]?.v || '',
                containerOut: parseFloat(c[18]?.v) || 0,
                rowIndex: index + 2,
            };
        }).filter(r => r.productCode && r.productCode !== 'รหัสสินค้า');

        console.log(`  📊 พบ ${records.length} รายการ`);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query("DELETE FROM sc_rm WHERE source_module = $1", [sourceModule]);

            let inserted = 0;
            for (const r of records) {
                await client.query(
                    `INSERT INTO sc_rm (date, product_code, product_name, type, container_qty, container_weight, remainder, in_qty, out_qty, balance, lot_no, vendor_lot, mfg_date, exp_date, days_left, lot_balance, supplier, remark, container_out, source_module, row_index)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
                    [r.date, r.productCode, r.productName, r.type, r.containerQty, r.containerWeight, r.remainder, r.inQty, r.outQty, r.balance, r.lotNo, r.vendorLot, r.mfgDate, r.expDate, r.daysLeft, r.lotBalance, r.supplier, r.remark, r.containerOut, sourceModule, r.rowIndex]
                );
                inserted++;
            }

            await client.query('COMMIT');
            console.log(`  ✅ Synced ${inserted} records to sc_rm (${sourceModule})`);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(`  ❌ ${sourceModule} sync failed:`, err.message);
    }
}

// ============================================================
// 3. SYNC CONSUMABLE DATA
// ============================================================
async function syncConsumable() {
    console.log('\n🧹 === SYNC: Consumable ===');

    const apiUrl = process.env.APPS_SCRIPT_CONSUMABLE;

    if (!apiUrl) {
        console.log('  ⚠️ APPS_SCRIPT_CONSUMABLE not set, skipping');
        return;
    }

    try {
        const data = await fetchAppsScript(apiUrl, 'load_all', 'Consumable');

        // Sync Items
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query('DELETE FROM sc_consumable_transactions');
                await client.query('DELETE FROM sc_consumable_items');

                let itemCount = 0;
                for (const item of data.items) {
                    // Map fields — handle both mapped and Thai header formats
                    const name = item.name || item['ชื่อสินค้า'] || '';
                    if (!name) continue;

                    await client.query(
                        `INSERT INTO sc_consumable_items (name, category, stock_cartons, stock_partial_kg, kg_per_carton, pcs_per_kg, min_threshold, pcs_per_pack, fg_pcs_per_carton, roll_length, cut_length, pcs_per_roll, fg_yield_per_roll, stock_code)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
                        [
                            name,
                            item.category || 'weight',
                            parseFloat(item.stock || item.stockCartons || 0),
                            parseFloat(item.stockPartial || item.stockPartialKg || 0),
                            parseFloat(item.kgPerCarton || 25),
                            parseFloat(item.pcsPerKg || 0),
                            parseFloat(item.min || item.minThreshold || 0),
                            parseFloat(item.pcsPerPack || 1),
                            parseFloat(item.fgPerCarton || item.fgPcsPerCarton || 1),
                            parseFloat(item.rollLength || 0),
                            parseFloat(item.cutLength || 0),
                            parseFloat(item.pcsPerRoll || 0),
                            parseFloat(item.fgYieldPerRoll || 0),
                            item.stockCode || '',
                        ]
                    );
                    itemCount++;
                }

                // Sync Transactions
                let transCount = 0;
                if (data.transactions && Array.isArray(data.transactions)) {
                    for (const t of data.transactions) {
                        const id = t.id || t['ID'] || Date.now().toString() + Math.random().toString(36).substr(2, 5);
                        const itemName = t.itemName || t['ชื่อสินค้า'] || '';

                        // Handle time format
                        let timeStr = '';
                        const rawTime = t.time || t['เวลา'] || '';
                        if (typeof rawTime === 'string' && rawTime.includes('T')) {
                            const d = new Date(rawTime);
                            timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                        } else {
                            timeStr = rawTime.toString();
                        }

                        await client.query(
                            `INSERT INTO sc_consumable_transactions (id, item_index, item_name, date, time, type, qty_kg, qty_cartons, qty_unit, remaining_stock, note)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                             ON CONFLICT (id) DO NOTHING`,
                            [
                                id,
                                t.itemIndex || t['ItemIndex'] || 0,
                                itemName,
                                t.date || t['วันที่'] || '',
                                timeStr,
                                t.type || t['ประเภท'] || '',
                                parseFloat(t.qtyKg || t['จำนวน (กก.)'] || 0),
                                parseFloat(t.qtyCartons || t['จำนวน (ลัง)'] || 0),
                                parseFloat(t.qtyUnit || t['จำนวน (ลัง)'] || 0),
                                parseFloat(t.remainingStock || t['คงเหลือ (ลัง)'] || 0),
                                t.note || t['หมายเหตุ'] || '',
                            ]
                        );
                        transCount++;
                    }
                }

                await client.query('COMMIT');
                console.log(`  ✅ Synced ${itemCount} items, ${transCount} transactions to sc_consumable`);
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } else {
            console.log('  ⚠️ No items returned from API');
        }
    } catch (err) {
        console.error(`  ❌ Consumable sync failed:`, err.message);
    }
}

// ============================================================
// 4. SYNC GENERALSTOCK DATA
// ============================================================
async function syncGeneralStock() {
    console.log('\n⚙️ === SYNC: GeneralStock ===');

    const apiUrl = process.env.APPS_SCRIPT_GENERALSTOCK;

    if (!apiUrl) {
        console.log('  ⚠️ APPS_SCRIPT_GENERALSTOCK not set, skipping');
        return;
    }

    try {
        const data = await fetchAppsScript(apiUrl, 'load_all', 'GeneralStock');

        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                let itemCount = 0;
                for (const item of data.items) {
                    const id = item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);

                    await client.query(
                        `INSERT INTO gs_items (id, name, spec, category, unit, stock, min_stock, price, lead_time, supplier, country, image)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                         ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            spec = EXCLUDED.spec,
                            category = EXCLUDED.category,
                            unit = EXCLUDED.unit,
                            stock = EXCLUDED.stock,
                            min_stock = EXCLUDED.min_stock,
                            price = EXCLUDED.price,
                            lead_time = EXCLUDED.lead_time,
                            supplier = EXCLUDED.supplier,
                            country = EXCLUDED.country,
                            image = EXCLUDED.image,
                            updated_at = NOW()`,
                        [
                            id, item.name, item.spec || null, item.category || 'Other',
                            item.unit || 'ชิ้น', parseFloat(item.stock) || 0, parseFloat(item.min) || 0,
                            item.price ? parseFloat(item.price) : null, item.leadTime || null,
                            item.supplier || null, item.country || null, item.image || null,
                        ]
                    );
                    itemCount++;
                }

                // Sync transactions
                let transCount = 0;
                if (data.transactions && Array.isArray(data.transactions)) {
                    for (const t of data.transactions) {
                        const id = t.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
                        await client.query(
                            `INSERT INTO gs_transactions (id, item_id, item_name, type, qty, remaining, date, time, note)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                             ON CONFLICT (id) DO NOTHING`,
                            [id, t.itemId, t.itemName || '', t.type, parseFloat(t.qty) || 0,
                                parseFloat(t.remaining) || 0, t.date || '', t.time || '', t.note || '']
                        );
                        transCount++;
                    }
                }

                await client.query('COMMIT');
                console.log(`  ✅ Synced ${itemCount} items, ${transCount} transactions to gs_items/gs_transactions`);
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        } else {
            console.log('  ⚠️ No items returned from API');
        }
    } catch (err) {
        console.error(`  ❌ GeneralStock sync failed:`, err.message);
    }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('============================================================');
    console.log('  StockCard - Sync from Google Sheets → PostgreSQL');
    console.log('============================================================');
    console.log(`  Database: ${process.env.INVENTORY_DB_NAME || 'pddoc_dev'}`);
    console.log('------------------------------------------------------------');

    const startTime = Date.now();

    // Sync all modules
    await syncPackage();
    await syncRM('rm', process.env.SHEET_RM_NAME || 'Sheet1', 'rm');
    await syncRM('rm_production', process.env.SHEET_RM_PRODUCTION_NAME || 'production', 'rm_production');
    await syncConsumable();
    await syncGeneralStock();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('============================================================');
    console.log(`  🎉 Sync เสร็จสมบูรณ์! (${elapsed} วินาที)`);
    console.log('============================================================');

    await pool.end();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
