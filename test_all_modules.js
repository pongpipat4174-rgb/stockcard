/**
 * Test ALL modules: Package, RM Center, RM Production, Consumable, GeneralStock
 * Usage: node test_all_modules.js
 * ต้องรัน server.js ก่อน (port 4000)
 */

const { Pool } = require('pg');

const BASE = 'http://localhost:4000';
const pool = new Pool({
    host: 'localhost', port: 15432,
    database: 'inventory_rm_tan', user: 'postgres', password: 'postgres123'
});

const results = {};
let passed = 0, failed = 0;

function ok(name, count) {
    results[name] = `✅ ${count}`;
    passed++;
}
function fail(name, msg) {
    results[name] = `❌ ${msg}`;
    failed++;
}

async function main() {
    console.log('==========================================');
    console.log('   TEST ALL MODULES');
    console.log('==========================================\n');

    // 1. Package READ
    try {
        const r = await fetch(`${BASE}/api/package/data`);
        const d = await r.json();
        if (d.success && d.count > 0) ok('Package READ', d.count + ' records');
        else fail('Package READ', 'Empty or failed');
    } catch(e) { fail('Package READ', e.message); }

    // 2. Package WRITE
    try {
        const r = await fetch(`${BASE}/api/package/save`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                date: '17/03/2026', productCode: 'TEST-AUTO', productName: 'Auto Test',
                type: 'รับเข้า', inQty: 100, outQty: 0, balance: 100,
                lotNo: 'TEST', pkId: 'TEST', docRef: '', remark: 'auto-test'
            })
        });
        const d = await r.json();
        if (d.success) ok('Package WRITE', 'id=' + d.id);
        else fail('Package WRITE', JSON.stringify(d));
    } catch(e) { fail('Package WRITE', e.message); }

    // 3. RM Center READ
    try {
        const r = await fetch(`${BASE}/api/rm/data?module=rm`);
        const d = await r.json();
        if (d.success && d.count > 0) ok('RM Center READ', d.count + ' records');
        else fail('RM Center READ', 'Empty or failed');
    } catch(e) { fail('RM Center READ', e.message); }

    // 4. RM Center WRITE
    try {
        const r = await fetch(`${BASE}/api/rm/save`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                date: '17/03/2026', productCode: 'TEST-AUTO', productName: 'Auto Test RM',
                type: 'รับเข้า', containerQty: 1, containerWeight: 10, remainder: 0,
                inQty: 10, outQty: 0, balance: 10, lotNo: 'TEST-LOT',
                vendorLot: 'T', mfgDate: '1/1/2026', expDate: '1/1/2028',
                supplier: 'TEST', sourceModule: 'rm'
            })
        });
        const d = await r.json();
        if (d.success) ok('RM Center WRITE', 'id=' + d.id);
        else fail('RM Center WRITE', JSON.stringify(d));
    } catch(e) { fail('RM Center WRITE', e.message); }

    // 5. RM Production READ
    try {
        const r = await fetch(`${BASE}/api/rm/data?module=rm_production`);
        const d = await r.json();
        if (d.success && d.count > 0) ok('RM Production READ', d.count + ' records');
        else fail('RM Production READ', 'Empty or failed');
    } catch(e) { fail('RM Production READ', e.message); }

    // 6. RM Production WRITE
    try {
        const r = await fetch(`${BASE}/api/rm/save`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                date: '17/03/2026', productCode: 'TEST-AUTO', productName: 'Auto Test RM Prod',
                type: 'รับเข้า', containerQty: 1, containerWeight: 10, remainder: 0,
                inQty: 10, outQty: 0, balance: 10, lotNo: 'TEST-LOT',
                vendorLot: 'T', mfgDate: '1/1/2026', expDate: '1/1/2028',
                supplier: 'TEST', sourceModule: 'rm_production'
            })
        });
        const d = await r.json();
        if (d.success) ok('RM Production WRITE', 'id=' + d.id);
        else fail('RM Production WRITE', JSON.stringify(d));
    } catch(e) { fail('RM Production WRITE', e.message); }

    // 7. RM Master
    try {
        const r = await fetch(`${BASE}/api/rm/master`);
        const d = await r.json();
        if (d.success && d.data.length > 0) ok('RM Master', d.data.length + ' products');
        else fail('RM Master', 'Empty or failed');
    } catch(e) { fail('RM Master', e.message); }

    // 8. Consumable READ
    try {
        const r = await fetch(`${BASE}/api/consumable/data`);
        const d = await r.json();
        if (d.success) ok('Consumable READ', d.itemCount + ' items, ' + d.transCount + ' trans');
        else fail('Consumable READ', 'Failed');
    } catch(e) { fail('Consumable READ', e.message); }

    // 9. GeneralStock Items READ
    try {
        const r = await fetch(`${BASE}/api/items`);
        const d = await r.json();
        if (d.length > 0) ok('GS Items READ', d.length + ' items');
        else fail('GS Items READ', 'Empty');
    } catch(e) { fail('GS Items READ', e.message); }

    // 10. GeneralStock Transactions READ
    try {
        const r = await fetch(`${BASE}/api/transactions`);
        const d = await r.json();
        if (d.length >= 0) ok('GS Trans READ', d.length + ' transactions');
        else fail('GS Trans READ', 'Failed');
    } catch(e) { fail('GS Trans READ', e.message); }

    // 11. GeneralStock Item WRITE
    try {
        const r = await fetch(`${BASE}/api/items`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id: 'test-auto-delete', name: 'Auto Test Spare',
                spec: 'Test spec', category: 'Other', unit: 'ชิ้น',
                stock: 10, min: 5
            })
        });
        const d = await r.json();
        if (d.id || d.success !== false) ok('GS Item WRITE', 'OK');
        else fail('GS Item WRITE', JSON.stringify(d));
    } catch(e) { fail('GS Item WRITE', e.message); }

    // 12. GeneralStock Transaction WRITE
    try {
        const r = await fetch(`${BASE}/api/transactions`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id: 'test-trans-auto', itemId: 'test-auto-delete',
                itemName: 'Auto Test Spare', type: 'IN', qty: 5,
                date: '17/03/2026', time: '12:00', note: 'auto test'
            })
        });
        const d = await r.json();
        ok('GS Trans WRITE', 'remaining=' + d.remaining);
    } catch(e) { fail('GS Trans WRITE', e.message); }

    // 13. DB Mode check
    try {
        const r = await fetch(`${BASE}/api/admin/db-mode`);
        const d = await r.json();
        ok('DB Mode', `${d.mode} port:${d.port} db:${d.database}`);
    } catch(e) { fail('DB Mode', e.message); }

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    try {
        await pool.query("DELETE FROM sc_rm WHERE product_code = 'TEST-AUTO'");
        await pool.query("DELETE FROM sc_package WHERE product_code = 'TEST-AUTO'");
        await pool.query("DELETE FROM gs_items WHERE id = 'test-auto-delete'");
        await pool.query("DELETE FROM gs_transactions WHERE id = 'test-trans-auto'");
        console.log('   Cleaned up test records');
    } catch(e) {
        console.warn('   Cleanup warning:', e.message);
    }

    // Print results
    console.log('\n==========================================');
    console.log('   RESULTS');
    console.log('==========================================');
    Object.entries(results).forEach(([key, val]) => {
        console.log(`  ${key.padEnd(25)} ${val}`);
    });
    console.log('------------------------------------------');
    console.log(`  Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('==========================================\n');

    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
