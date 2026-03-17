/**
 * Full Sync: Google Sheets → PostgreSQL DB
 * ดึงข้อมูลจาก Google Sheets (RM Center, RM Production, Package) แล้วอัปเดตลง DB
 * 
 * Usage: node sync_all_from_sheet.js
 * ต้องรัน cloudflared tunnel ก่อน: cloudflared access tcp --hostname postgres-db.wejlc.com --url localhost:15432
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 15432,
    database: 'inventory_rm_tan',
    user: 'postgres',
    password: 'postgres123',
});

const SHEET_CONFIG = {
    package: {
        id: '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU',
        sheetName: 'บันทึก StockCard',
        sourceModule: 'package'
    },
    rm: {
        id: '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs',
        sheetName: 'Sheet1',
        sourceModule: 'rm'
    },
    rm_production: {
        id: '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs',
        sheetName: 'production',
        sourceModule: 'rm_production'
    }
};

// Fetch data from Google Sheets using gviz API
async function fetchSheetData(sheetId, sheetName) {
    const timestamp = Date.now();
    const encodedName = encodeURIComponent(sheetName);
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodedName}&tq=SELECT%20*&_=${timestamp}`;

    console.log(`  Fetching: ${sheetName}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    if (text.includes('google.com/accounts')) throw new Error('Sheet not shared publicly');

    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
    const jsonText = match ? match[1] : text;
    const json = JSON.parse(jsonText);
    return json.table.rows;
}

// ===== SYNC RM DATA =====
async function syncRM(moduleKey) {
    const config = SHEET_CONFIG[moduleKey];
    console.log(`\n📦 Syncing ${moduleKey} from Sheet "${config.sheetName}"...`);

    const rows = await fetchSheetData(config.id, config.sheetName);
    console.log(`  Got ${rows.length} rows from Sheet`);

    // Parse rows
    const data = rows.map((row, index) => {
        const c = row.c;
        return {
            rowIndex: index + 2,
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
            daysLeft: c[14]?.v != null ? String(c[14].v) : '',
            lotBalance: parseFloat(c[15]?.v) || 0,
            supplier: c[16]?.v || '',
            remark: c[17]?.v || '',
            containerOut: parseFloat(c[18]?.v) || 0
        };
    }).filter(item => item.productCode && item.productCode !== 'รหัสสินค้า');

    console.log(`  Parsed ${data.length} valid records`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Delete existing data for this module
        const delResult = await client.query(
            'DELETE FROM sc_rm WHERE source_module = $1',
            [config.sourceModule]
        );
        console.log(`  Deleted ${delResult.rowCount} old records`);

        // Insert new data
        let insertCount = 0;
        for (const d of data) {
            await client.query(
                `INSERT INTO sc_rm (date, product_code, product_name, type, container_qty, container_weight,
                 remainder, in_qty, out_qty, balance, lot_no, vendor_lot, mfg_date, exp_date,
                 days_left, lot_balance, supplier, remark, container_out, source_module, row_index)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
                [d.date, d.productCode, d.productName, d.type,
                 d.containerQty, d.containerWeight, d.remainder,
                 d.inQty, d.outQty, d.balance,
                 d.lotNo, d.vendorLot, d.mfgDate, d.expDate,
                 d.daysLeft, d.lotBalance, d.supplier, d.remark,
                 d.containerOut, config.sourceModule, d.rowIndex]
            );
            insertCount++;
        }

        await client.query('COMMIT');
        console.log(`  ✅ Inserted ${insertCount} records for ${moduleKey}`);
        return insertCount;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Error syncing ${moduleKey}:`, err.message);
        throw err;
    } finally {
        client.release();
    }
}

// ===== SYNC PACKAGE DATA =====
async function syncPackage() {
    const config = SHEET_CONFIG.package;
    console.log(`\n📦 Syncing Package from Sheet "${config.sheetName}"...`);

    const rows = await fetchSheetData(config.id, config.sheetName);
    console.log(`  Got ${rows.length} rows from Sheet`);

    // Parse rows
    const data = rows.map((row, index) => {
        const c = row.c;
        return {
            rowIndex: index + 2,
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
            remark: c[12]?.v || ''
        };
    }).filter(item => item.productCode && item.productCode !== 'code');

    console.log(`  Parsed ${data.length} valid records`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Delete existing package data
        const delResult = await client.query(
            "DELETE FROM sc_package WHERE source_module = 'package'"
        );
        console.log(`  Deleted ${delResult.rowCount} old records`);

        // Insert new data
        let insertCount = 0;
        for (const d of data) {
            await client.query(
                `INSERT INTO sc_package (date, product_code, product_name, type, in_qty, out_qty, balance,
                 lot_no, pk_id, doc_ref, remark, source_module, row_index)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'package',$12)`,
                [d.date, d.productCode, d.productName, d.type,
                 d.inQty, d.outQty, d.balance,
                 d.lotNo, d.pkId || '', d.docRef || '', d.remark || '', d.rowIndex]
            );
            insertCount++;
        }

        await client.query('COMMIT');
        console.log(`  ✅ Inserted ${insertCount} Package records`);
        return insertCount;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('  ❌ Error syncing Package:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// ===== MAIN =====
async function main() {
    console.log('===========================================');
    console.log('  Full Sync: Google Sheets → PostgreSQL DB');
    console.log('  Time:', new Date().toLocaleString('th-TH'));
    console.log('===========================================');

    // Test DB connection first
    try {
        const testRes = await pool.query('SELECT 1');
        console.log('✅ DB connection OK');
    } catch (err) {
        console.error('❌ Cannot connect to DB:', err.message);
        console.error('   Make sure cloudflared tunnel is running!');
        process.exit(1);
    }

    const results = {};

    // Sync RM Center
    try {
        results.rm_center = await syncRM('rm');
    } catch (e) {
        results.rm_center = 'ERROR: ' + e.message;
    }

    // Sync RM Production
    try {
        results.rm_production = await syncRM('rm_production');
    } catch (e) {
        results.rm_production = 'ERROR: ' + e.message;
    }

    // Sync Package
    try {
        results.package = await syncPackage();
    } catch (e) {
        results.package = 'ERROR: ' + e.message;
    }

    // Print summary
    console.log('\n===========================================');
    console.log('  SYNC SUMMARY');
    console.log('===========================================');
    Object.entries(results).forEach(([key, val]) => {
        const status = typeof val === 'number' ? `✅ ${val} records` : `❌ ${val}`;
        console.log(`  ${key}: ${status}`);
    });

    // Verify counts
    console.log('\n🔍 Verifying DB counts...');
    const rm = await pool.query("SELECT count(*) FROM sc_rm WHERE source_module = 'rm'");
    const rmp = await pool.query("SELECT count(*) FROM sc_rm WHERE source_module = 'rm_production'");
    const pkg = await pool.query("SELECT count(*) FROM sc_package");
    console.log(`  sc_rm (rm center): ${rm.rows[0].count}`);
    console.log(`  sc_rm (rm production): ${rmp.rows[0].count}`);
    console.log(`  sc_package: ${pkg.rows[0].count}`);

    console.log('\n✅ Sync complete!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
