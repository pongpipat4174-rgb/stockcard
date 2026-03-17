// ============================================================
// GeneralStock API Server
// ============================================================
// Express API สำหรับเชื่อมต่อ Frontend กับ PostgreSQL
//
// การใช้งาน: node server.js
// ============================================================

// Load .env from the same directory as this script
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4001;
const HOST = process.env.HOST || '0.0.0.0';

// ---- Database Connection Pool ----
const dbConfig = {
    host: process.env.INVENTORY_DB_HOST || 'localhost',
    port: parseInt(process.env.INVENTORY_DB_PORT || '15432'),
    database: process.env.INVENTORY_DB_NAME || 'pddoc_dev',
    user: process.env.INVENTORY_DB_USER || 'postgres',
    password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
};

const pool = new Pool({
    ...dbConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

console.log(`[DB] เชื่อมต่อ: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

// ---- Auto-create tables if not exist ----
async function ensureTablesExist() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gs_items (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL,
                spec            TEXT,
                category        TEXT DEFAULT 'Other',
                unit            TEXT DEFAULT 'ชิ้น',
                stock           NUMERIC DEFAULT 0,
                min_stock       NUMERIC DEFAULT 5,
                price           NUMERIC,
                lead_time       TEXT,
                supplier        TEXT,
                country         TEXT,
                image           TEXT,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS gs_transactions (
                id              TEXT PRIMARY KEY,
                item_id         TEXT NOT NULL REFERENCES gs_items(id) ON DELETE CASCADE,
                item_name       TEXT,
                type            TEXT NOT NULL,
                qty             NUMERIC NOT NULL DEFAULT 0,
                remaining       NUMERIC DEFAULT 0,
                date            TEXT,
                time            TEXT,
                note            TEXT,
                created_at      TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_gs_items_category ON gs_items(category);
            CREATE INDEX IF NOT EXISTS idx_gs_transactions_item_id ON gs_transactions(item_id);
        `);
        console.log('[DB] ✅ ตาราง gs_items, gs_transactions พร้อมใช้งาน');
    } catch (err) {
        console.error('[DB] ❌ สร้างตารางล้มเหลว:', err.message);
    }
}
ensureTablesExist();

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ---- Serve Static Frontend Files ----
const staticRoot = path.join(__dirname, '../');
console.log('📁 Static root:', staticRoot);

app.get(['/', '/index.html'], (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    const indexPath = path.join(staticRoot, 'index.html');
    if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace(/\?v=\d+/g, '?v=' + Date.now());
        res.type('html').send(html);
    } else {
        res.status(404).send('index.html not found');
    }
});
app.use(express.static(staticRoot, {
    index: false,
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}));

// ---- Config Endpoint ----
app.get('/api/config', (req, res) => {
    const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    res.json({ apiBase: `${publicUrl}/api` });
});

// ---- Health Check ----
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as now');
        res.json({ status: 'ok', time: result.rows[0].now, database: dbConfig.database });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ============================================================
// ITEMS API
// ============================================================

// GET all items
app.get('/api/items', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM gs_items ORDER BY created_at DESC');
        // Map DB columns to frontend field names
        const items = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            spec: row.spec || '',
            category: row.category || 'Other',
            unit: row.unit || 'ชิ้น',
            stock: parseFloat(row.stock) || 0,
            min: parseFloat(row.min_stock) || 0,
            price: row.price ? parseFloat(row.price) : '',
            leadTime: row.lead_time || '',
            supplier: row.supplier || '',
            country: row.country || '',
            image: row.image || '',
        }));
        res.json(items);
    } catch (err) {
        console.error('[GET /api/items]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST create/update item (upsert)
app.post('/api/items', async (req, res) => {
    try {
        const b = req.body;
        const id = b.id || Date.now().toString();

        const result = await pool.query(
            `INSERT INTO gs_items (id, name, spec, category, unit, stock, min_stock, price, lead_time, supplier, country, image)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
                updated_at = NOW()
             RETURNING *`,
            [
                id,
                b.name,
                b.spec || null,
                b.category || 'Other',
                b.unit || 'ชิ้น',
                parseFloat(b.stock) || 0,
                parseFloat(b.min) || 0,
                b.price ? parseFloat(b.price) : null,
                b.leadTime || null,
                b.supplier || null,
                b.country || null,
                b.image || null,
            ]
        );

        console.log(`[POST /api/items] ✅ upsert: ${b.name} (id=${id})`);
        res.json({ success: true, item: result.rows[0] });
    } catch (err) {
        console.error('[POST /api/items]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT update item stock only
app.put('/api/items/:id/stock', async (req, res) => {
    try {
        const { stock } = req.body;
        await pool.query(
            'UPDATE gs_items SET stock = $1, updated_at = NOW() WHERE id = $2',
            [parseFloat(stock), req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/items/:id/stock]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE item
app.delete('/api/items/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM gs_items WHERE id = $1', [req.params.id]);
        console.log(`[DELETE /api/items] ✅ ลบ id=${req.params.id}`);
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/items]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// TRANSACTIONS API
// ============================================================

// GET all transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const { item_id } = req.query;
        let result;
        if (item_id) {
            result = await pool.query(
                'SELECT * FROM gs_transactions WHERE item_id = $1 ORDER BY created_at DESC',
                [item_id]
            );
        } else {
            result = await pool.query('SELECT * FROM gs_transactions ORDER BY created_at DESC');
        }

        const transactions = result.rows.map(row => ({
            id: row.id,
            itemId: row.item_id,
            itemName: row.item_name || '',
            type: row.type,
            qty: parseFloat(row.qty) || 0,
            remaining: parseFloat(row.remaining) || 0,
            date: row.date || '',
            time: row.time || '',
            note: row.note || '',
        }));
        res.json(transactions);
    } catch (err) {
        console.error('[GET /api/transactions]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST create transaction
app.post('/api/transactions', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const b = req.body;
        const id = b.id || Date.now().toString();
        const qty = parseFloat(b.qty) || 0;

        // Update item stock
        if (b.type === 'IN') {
            await client.query(
                'UPDATE gs_items SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
                [qty, b.itemId]
            );
        } else {
            await client.query(
                'UPDATE gs_items SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
                [qty, b.itemId]
            );
        }

        // Get updated stock
        const stockResult = await client.query('SELECT stock FROM gs_items WHERE id = $1', [b.itemId]);
        const remaining = stockResult.rows.length > 0 ? parseFloat(stockResult.rows[0].stock) : 0;

        // Insert transaction
        await client.query(
            `INSERT INTO gs_transactions (id, item_id, item_name, type, qty, remaining, date, time, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, b.itemId, b.itemName || '', b.type, qty, remaining, b.date || '', b.time || '', b.note || '']
        );

        await client.query('COMMIT');
        console.log(`[POST /api/transactions] ✅ ${b.type} ${qty} → ${b.itemName} (remaining: ${remaining})`);
        res.json({ success: true, remaining });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /api/transactions]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// PUT update transaction (edit qty)
app.put('/api/transactions/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { newQty } = req.body;
        const parsedNewQty = parseFloat(newQty);

        // Get existing transaction
        const existing = await client.query('SELECT * FROM gs_transactions WHERE id = $1', [req.params.id]);
        if (existing.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const trans = existing.rows[0];
        const qtyDiff = parsedNewQty - parseFloat(trans.qty);

        // Adjust stock
        if (trans.type === 'IN') {
            await client.query(
                'UPDATE gs_items SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
                [qtyDiff, trans.item_id]
            );
        } else {
            await client.query(
                'UPDATE gs_items SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
                [qtyDiff, trans.item_id]
            );
        }

        // Get updated stock
        const stockResult = await client.query('SELECT stock FROM gs_items WHERE id = $1', [trans.item_id]);
        const remaining = parseFloat(stockResult.rows[0].stock);

        // Update transaction
        await client.query(
            'UPDATE gs_transactions SET qty = $1, remaining = $2 WHERE id = $3',
            [parsedNewQty, remaining, req.params.id]
        );

        await client.query('COMMIT');
        res.json({ success: true, remaining });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[PUT /api/transactions]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// DELETE transaction (revert stock)
app.delete('/api/transactions/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get transaction to revert
        const existing = await client.query('SELECT * FROM gs_transactions WHERE id = $1', [req.params.id]);
        if (existing.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const trans = existing.rows[0];
        const qty = parseFloat(trans.qty);

        // Revert stock
        if (trans.type === 'IN') {
            await client.query(
                'UPDATE gs_items SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
                [qty, trans.item_id]
            );
        } else {
            await client.query(
                'UPDATE gs_items SET stock = stock + $1, updated_at = NOW() WHERE id = $2',
                [qty, trans.item_id]
            );
        }

        // Delete transaction
        await client.query('DELETE FROM gs_transactions WHERE id = $1', [req.params.id]);

        // Get updated stock
        const stockResult = await client.query('SELECT stock FROM gs_items WHERE id = $1', [trans.item_id]);
        const remaining = stockResult.rows.length > 0 ? parseFloat(stockResult.rows[0].stock) : 0;

        await client.query('COMMIT');
        console.log(`[DELETE /api/transactions] ✅ ลบ + revert stock: ${trans.item_name}`);
        res.json({ success: true, remaining });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[DELETE /api/transactions]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ============================================================
// BULK SYNC API (สำหรับ migration จาก Google Sheets)
// ============================================================
app.post('/api/sync/items', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'items array required' });
        }

        let upserted = 0;
        for (const item of items) {
            const id = item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
            await client.query(
                `INSERT INTO gs_items (id, name, spec, category, unit, stock, min_stock, price, lead_time, supplier, country, image)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
                    id,
                    item.name,
                    item.spec || null,
                    item.category || 'Other',
                    item.unit || 'ชิ้น',
                    parseFloat(item.stock) || 0,
                    parseFloat(item.min) || 0,
                    item.price ? parseFloat(item.price) : null,
                    item.leadTime || null,
                    item.supplier || null,
                    item.country || null,
                    item.image || null,
                ]
            );
            upserted++;
        }

        await client.query('COMMIT');
        console.log(`[POST /api/sync/items] ✅ synced ${upserted} items`);
        res.json({ success: true, upserted });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /api/sync/items]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.post('/api/sync/transactions', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { transactions } = req.body;
        if (!transactions || !Array.isArray(transactions)) {
            return res.status(400).json({ error: 'transactions array required' });
        }

        let upserted = 0;
        for (const t of transactions) {
            const id = t.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
            await client.query(
                `INSERT INTO gs_transactions (id, item_id, item_name, type, qty, remaining, date, time, note)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO UPDATE SET
                    item_id = EXCLUDED.item_id,
                    item_name = EXCLUDED.item_name,
                    type = EXCLUDED.type,
                    qty = EXCLUDED.qty,
                    remaining = EXCLUDED.remaining,
                    date = EXCLUDED.date,
                    time = EXCLUDED.time,
                    note = EXCLUDED.note`,
                [
                    id,
                    t.itemId,
                    t.itemName || '',
                    t.type,
                    parseFloat(t.qty) || 0,
                    parseFloat(t.remaining) || 0,
                    t.date || '',
                    t.time || '',
                    t.note || '',
                ]
            );
            upserted++;
        }

        await client.query('COMMIT');
        console.log(`[POST /api/sync/transactions] ✅ synced ${upserted} transactions`);
        res.json({ success: true, upserted });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /api/sync/transactions]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, HOST, () => {
    console.log('');
    console.log('============================================================');
    console.log(`  🚀 GeneralStock Server running`);
    console.log(`  📡 http://localhost:${PORT}`);
    console.log(`  📁 Static: ${staticRoot}`);
    console.log(`  🗄️  DB: ${dbConfig.database} @ ${dbConfig.host}:${dbConfig.port}`);
    console.log('============================================================');
    console.log('');
});
