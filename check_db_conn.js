const { Pool } = require('pg');
const p = new Pool({
  host: 'localhost', port: 15432,
  database: 'inventory_rm_tan', user: 'postgres', password: 'postgres123'
});
async function main() {
  // Latest 5 entries
  const r = await p.query("SELECT id, date, product_code, lot_no, type, in_qty, out_qty, source_module FROM sc_rm ORDER BY id DESC LIMIT 5");
  console.log('=== Latest 5 entries ===');
  r.rows.forEach(row => console.log(JSON.stringify(row)));
  
  // Total RM
  const cnt = await p.query("SELECT count(*) as cnt FROM sc_rm WHERE source_module='rm'");
  console.log('\nTotal RM:', cnt.rows[0].cnt);
  
  // Entries from today
  const today = await p.query("SELECT id, date, product_code, lot_no, type, in_qty, out_qty FROM sc_rm WHERE date LIKE '%17/03%' OR date LIKE '%17/3/%' OR date LIKE '%2026-03-17%'");
  console.log('\nEntries from 17/03:', today.rowCount);
  today.rows.forEach(row => console.log(JSON.stringify(row)));
  
  await p.end();
}
main().catch(e => { console.error(e.message); p.end(); });
