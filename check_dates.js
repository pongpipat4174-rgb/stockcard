const {Pool} = require('pg');
const p = new Pool({host:'localhost',port:15432,database:'inventory_rm_tan',user:'postgres',password:'postgres123'});

async function deleteEntries() {
    // Delete the 2 specific entries with date 17/03/2569 and these product codes
    const r = await p.query(
        "DELETE FROM sc_rm WHERE date = '17/03/2569' AND product_code IN ('CLW-R-005-CHO', 'PDO-R-015-STE') AND source_module = 'rm_production' RETURNING id, date, product_code"
    );
    console.log('Deleted', r.rowCount, 'records:');
    r.rows.forEach(row => console.log(`  [${row.id}] ${row.date} | ${row.product_code}`));

    // Verify
    const check = await p.query("SELECT count(*) FROM sc_rm WHERE source_module = 'rm_production'");
    console.log('\nRM Production total now:', check.rows[0].count);

    await p.end();
}
deleteEntries().catch(e => {console.error(e.message); process.exit(1);});
