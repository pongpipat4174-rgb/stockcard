// Debug: check field names from DB API
async function debug() {
    const res = await fetch('http://localhost:4000/api/consumable/data');
    const d = await res.json();
    const item = d.items[0];
    console.log('First item keys:', Object.keys(item));
    console.log('First item:', JSON.stringify(item, null, 2));
}
debug().catch(e => console.error(e));
