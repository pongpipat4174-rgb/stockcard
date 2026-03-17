// Fix stock for items 2 & 3
const DB_API = 'http://localhost:4000/api/consumable';

async function fixStock() {
    const res = await fetch(`${DB_API}/data`);
    const data = await res.json();
    const items = data.items;
    const transactions = data.transactions;

    items[1].stockCartons = 38;  // PVC Shrink film 125*220
    items[2].stockCartons = 37;  // PVC Shrink film 222*200

    const saveRes = await fetch(`${DB_API}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, transactions })
    });
    const result = await saveRes.json();

    console.log(`2. ${items[1].name}: stockCartons = ${items[1].stockCartons}`);
    console.log(`3. ${items[2].name}: stockCartons = ${items[2].stockCartons}`);
    console.log(`✅ ${result.success ? 'Saved!' : 'Failed!'}`);
}

fixStock().catch(e => console.error('Error:', e.message));
