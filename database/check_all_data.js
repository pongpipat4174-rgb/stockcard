// Check all StockCard tables data
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.INVENTORY_DB_HOST || 'localhost',
    port: parseInt(process.env.INVENTORY_DB_PORT || '15432'),
    database: process.env.INVENTORY_DB_NAME || 'inventory_rm_tan',
    user: process.env.INVENTORY_DB_USER || 'postgres',
    password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
});

async function checkAll() {
    try {
        console.log('============================================================');
        console.log('  StockCard - Data Verification');
        console.log('  DB:', process.env.INVENTORY_DB_NAME);
        console.log('============================================================\n');

        // 1. Package
        const pkgCount = await pool.query("SELECT COUNT(*) as cnt FROM sc_package WHERE source_module = 'package'");
        console.log(`📦 Package (sc_package): ${pkgCount.rows[0].cnt} records`);
        const pkgSample = await pool.query("SELECT product_code, product_name, type, balance FROM sc_package WHERE source_module = 'package' ORDER BY row_index ASC LIMIT 3");
        pkgSample.rows.forEach((r, i) => console.log(`   ${i + 1}. ${r.product_code} | ${r.product_name} | ${r.type} | balance: ${r.balance}`));

        // 2. RM Center
        const rmCount = await pool.query("SELECT COUNT(*) as cnt FROM sc_rm WHERE source_module = 'rm'");
        console.log(`\n🧪 RM Center (sc_rm): ${rmCount.rows[0].cnt} records`);
        const rmSample = await pool.query("SELECT product_code, product_name, type, balance FROM sc_rm WHERE source_module = 'rm' ORDER BY row_index ASC LIMIT 3");
        rmSample.rows.forEach((r, i) => console.log(`   ${i + 1}. ${r.product_code} | ${r.product_name} | ${r.type} | balance: ${r.balance}`));

        // 3. RM Production
        const rmProdCount = await pool.query("SELECT COUNT(*) as cnt FROM sc_rm WHERE source_module = 'rm_production'");
        console.log(`\n🏭 RM Production (sc_rm): ${rmProdCount.rows[0].cnt} records`);
        const rmProdSample = await pool.query("SELECT product_code, product_name, type, balance FROM sc_rm WHERE source_module = 'rm_production' ORDER BY row_index ASC LIMIT 3");
        rmProdSample.rows.forEach((r, i) => console.log(`   ${i + 1}. ${r.product_code} | ${r.product_name} | ${r.type} | balance: ${r.balance}`));

        // 4. Consumable Items
        const conItemCount = await pool.query("SELECT COUNT(*) as cnt FROM sc_consumable_items");
        console.log(`\n🧹 Consumable Items (sc_consumable_items): ${conItemCount.rows[0].cnt} records`);
        const conItemSample = await pool.query("SELECT name, category, stock_cartons, stock_partial_kg FROM sc_consumable_items ORDER BY id ASC LIMIT 3");
        conItemSample.rows.forEach((r, i) => console.log(`   ${i + 1}. ${r.name} | ${r.category} | cartons: ${r.stock_cartons} | partial: ${r.stock_partial_kg}`));

        // 5. Consumable Transactions
        const conTransCount = await pool.query("SELECT COUNT(*) as cnt FROM sc_consumable_transactions");
        console.log(`\n🧹 Consumable Transactions (sc_consumable_transactions): ${conTransCount.rows[0].cnt} records`);

        // 6. GeneralStock Items
        const gsItemCount = await pool.query("SELECT COUNT(*) as cnt FROM gs_items");
        console.log(`\n⚙️ GeneralStock Items (gs_items): ${gsItemCount.rows[0].cnt} records`);
        const gsItemSample = await pool.query("SELECT id, name, spec, category, stock, min_stock FROM gs_items ORDER BY created_at DESC LIMIT 5");
        gsItemSample.rows.forEach((r, i) => console.log(`   ${i + 1}. [${r.id}] ${r.name} | ${r.spec || '-'} | ${r.category} | stock: ${r.stock} | min: ${r.min_stock}`));

        // 7. GeneralStock Transactions
        const gsTransCount = await pool.query("SELECT COUNT(*) as cnt FROM gs_transactions");
        console.log(`\n⚙️ GeneralStock Transactions (gs_transactions): ${gsTransCount.rows[0].cnt} records`);
        const gsTransSample = await pool.query("SELECT id, item_name, type, qty, remaining, date FROM gs_transactions ORDER BY created_at DESC LIMIT 5");
        gsTransSample.rows.forEach((r, i) => console.log(`   ${i + 1}. ${r.item_name} | ${r.type} | qty: ${r.qty} | remaining: ${r.remaining} | ${r.date}`));

        console.log('\n============================================================');
        console.log('  Summary');
        console.log('============================================================');
        console.log(`  Package:              ${pkgCount.rows[0].cnt}`);
        console.log(`  RM Center:            ${rmCount.rows[0].cnt}`);
        console.log(`  RM Production:        ${rmProdCount.rows[0].cnt}`);
        console.log(`  Consumable Items:     ${conItemCount.rows[0].cnt}`);
        console.log(`  Consumable Trans:     ${conTransCount.rows[0].cnt}`);
        console.log(`  GeneralStock Items:   ${gsItemCount.rows[0].cnt}`);
        console.log(`  GeneralStock Trans:   ${gsTransCount.rows[0].cnt}`);
        console.log('============================================================');

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

checkAll();
