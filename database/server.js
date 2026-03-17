// ============================================================
// StockCard - Unified API Server
// ============================================================
// Express API + Static Serving สำหรับทุก 5 โมดูล
//
// Architecture: อ่านจาก DB (เร็ว) + เขียนคู่ไปที่ Sheet (backup)
// ============================================================

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
const pool = new Pool({
    host: process.env.INVENTORY_DB_HOST || 'localhost',
    port: parseInt(process.env.INVENTORY_DB_PORT || '15432'),
    database: process.env.INVENTORY_DB_NAME || 'pddoc_dev',
    user: process.env.INVENTORY_DB_USER || 'postgres',
    password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const dbName = process.env.INVENTORY_DB_NAME || 'pddoc_dev';
console.log(`[DB] เชื่อมต่อ: ${process.env.INVENTORY_DB_HOST}:${process.env.INVENTORY_DB_PORT}/${dbName}`);

// ---- In-Memory Cache ----
const cache = {};
const CACHE_TTL = 30000; // 30 seconds

function getCached(key) {
    const entry = cache[key];
    if (entry && Date.now() - entry.time < CACHE_TTL) {
        return entry.data;
    }
    return null;
}

function setCache(key, data) {
    cache[key] = { data, time: Date.now() };
}

function invalidateCache(prefix) {
    Object.keys(cache).forEach(k => {
        if (k.startsWith(prefix)) delete cache[k];
    });
}

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ---- Static Files ----
const projectRoot = path.join(__dirname, '../');
console.log('📁 Static root:', projectRoot);

// Serve main index.html (Package / RM)
app.get(['/', '/index.html'], (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    const indexPath = path.join(projectRoot, 'index.html');
    if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace(/\?v=\d+/g, '?v=' + Date.now());
        res.type('html').send(html);
    } else {
        res.status(404).send('index.html not found');
    }
});

// Serve GeneralStock
app.get(['/GeneralStock/', '/GeneralStock/index.html'], (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    const indexPath = path.join(projectRoot, 'GeneralStock', 'index.html');
    if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace(/\?v=\d+/g, '?v=' + Date.now());
        res.type('html').send(html);
    } else {
        res.status(404).send('GeneralStock/index.html not found');
    }
});

// Serve Consumable
app.get(['/Consumable/', '/Consumable/index.html'], (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    const indexPath = path.join(projectRoot, 'Consumable', 'index.html');
    if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace(/\?v=\d+/g, '?v=' + Date.now());
        res.type('html').send(html);
    } else {
        res.status(404).send('Consumable/index.html not found');
    }
});

app.use(express.static(projectRoot, {
    index: false,
    setHeaders: (res) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}));

// ---- Config ----
app.get('/api/config', (req, res) => {
    const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    res.json({ apiBase: `${publicUrl}/api` });
});

// ---- Health Check ----
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as now');
        const counts = {};
        for (const table of ['sc_package', 'sc_rm', 'sc_consumable_items', 'sc_consumable_transactions', 'gs_items', 'gs_transactions']) {
            const c = await pool.query(`SELECT COUNT(*) FROM ${table}`);
            counts[table] = parseInt(c.rows[0].count);
        }
        res.json({ status: 'ok', time: result.rows[0].now, database: dbName, counts });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ============================================================
// 1. PACKAGE API
// ============================================================
app.get('/api/package/data', async (req, res) => {
    try {
        const cached = getCached('package');
        if (cached) return res.json(cached);

        const result = await pool.query(
            "SELECT * FROM sc_package WHERE source_module = 'package' ORDER BY row_index ASC"
        );
        const rows = result.rows.map(r => ({
            rowIndex: r.row_index,
            date: r.date,
            productCode: r.product_code,
            productName: r.product_name,
            type: r.type,
            inQty: parseFloat(r.in_qty) || 0,
            outQty: parseFloat(r.out_qty) || 0,
            balance: parseFloat(r.balance) || 0,
            lotNo: r.lot_no || '',
            pkId: r.pk_id || '',
            docRef: r.doc_ref || '',
            remark: r.remark || '',
        }));
        const response = { success: true, data: rows, source: 'db' };
        setCache('package', response);
        res.json(response);
    } catch (err) {
        console.error('[GET /api/package/data]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST add package entry to DB
app.post('/api/package/add', async (req, res) => {
    try {
        const e = req.body.entry || req.body;
        const maxRow = await pool.query("SELECT COALESCE(MAX(row_index),1) as mx FROM sc_package WHERE source_module='package'");
        const nextRow = (parseInt(maxRow.rows[0].mx) || 0) + 1;

        await pool.query(
            `INSERT INTO sc_package (date, product_code, product_name, type, in_qty, out_qty, balance, lot_no, pk_id, doc_ref, remark, source_module, row_index)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'package',$12)`,
            [e.date, e.productCode, e.productName, e.type, parseFloat(e.inQty) || 0, parseFloat(e.outQty) || 0, parseFloat(e.balance) || 0, e.lotNo || '', e.pkId || '', e.docRef || '', e.remark || '', nextRow]
        );
        invalidateCache('package');
        console.log('[POST /api/package/add] ✅', e.productCode, e.type);
        res.json({ success: true, rowIndex: nextRow });
    } catch (err) {
        console.error('[POST /api/package/add]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Alias: /api/package/save → same as /api/package/add (frontend uses /save)
app.post('/api/package/save', async (req, res) => {
    try {
        const e = req.body.entry || req.body;
        const maxRow = await pool.query("SELECT COALESCE(MAX(row_index),1) as mx FROM sc_package WHERE source_module='package'");
        const nextRow = (parseInt(maxRow.rows[0].mx) || 0) + 1;

        const result = await pool.query(
            `INSERT INTO sc_package (date, product_code, product_name, type, in_qty, out_qty, balance, lot_no, pk_id, doc_ref, remark, source_module, row_index)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'package',$12)
             RETURNING id`,
            [e.date, e.productCode, e.productName, e.type, parseFloat(e.inQty) || 0, parseFloat(e.outQty) || 0, parseFloat(e.balance) || 0, e.lotNo || '', e.pkId || '', e.docRef || '', e.remark || '', nextRow]
        );
        invalidateCache('package');
        console.log('[POST /api/package/save] ✅', e.productCode, e.type);
        res.json({ success: true, id: result.rows[0].id, rowIndex: nextRow });
    } catch (err) {
        console.error('[POST /api/package/save]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE package entry from DB
app.post('/api/package/delete', async (req, res) => {
    try {
        const { rowIndex, criteria } = req.body;
        let deleted = 0;
        if (rowIndex) {
            const r = await pool.query("DELETE FROM sc_package WHERE row_index = $1 AND source_module = 'package'", [rowIndex]);
            deleted = r.rowCount;
        } else if (criteria) {
            const r = await pool.query(
                "DELETE FROM sc_package WHERE product_code = $1 AND type = $2 AND source_module = 'package' LIMIT 1",
                [criteria.productCode, criteria.type]
            );
            deleted = r.rowCount;
        }
        invalidateCache('package');
        console.log('[POST /api/package/delete] ✅ deleted:', deleted);
        res.json({ success: true, deleted });
    } catch (err) {
        console.error('[POST /api/package/delete]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// 2. RM API (Center + Production)
// ============================================================
app.get('/api/rm/data', async (req, res) => {
    try {
        const module = req.query.module || 'rm';
        const cacheKey = 'rm_' + module;
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const result = await pool.query(
            "SELECT * FROM sc_rm WHERE source_module = $1 ORDER BY row_index ASC",
            [module]
        );
        const rows = result.rows.map(r => ({
            rowIndex: r.row_index,
            date: r.date,
            productCode: r.product_code,
            productName: r.product_name,
            type: r.type,
            containerQty: parseFloat(r.container_qty) || 0,
            containerWeight: parseFloat(r.container_weight) || 0,
            remainder: parseFloat(r.remainder) || 0,
            inQty: parseFloat(r.in_qty) || 0,
            outQty: parseFloat(r.out_qty) || 0,
            balance: parseFloat(r.balance) || 0,
            lotNo: r.lot_no || '',
            vendorLot: r.vendor_lot || '',
            mfgDate: r.mfg_date || '',
            expDate: r.exp_date || '',
            daysLeft: r.days_left || '',
            lotBalance: parseFloat(r.lot_balance) || 0,
            supplier: r.supplier || '',
            remark: r.remark || '',
            containerOut: parseFloat(r.container_out) || 0,
        }));
        const response = { success: true, data: rows, source: 'db' };
        setCache(cacheKey, response);
        res.json(response);
    } catch (err) {
        console.error('[GET /api/rm/data]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// RM Master (unique products)
app.get('/api/rm/master', async (req, res) => {
    try {
        const module = req.query.module || 'rm';
        const result = await pool.query(
            `SELECT DISTINCT product_code, product_name, supplier 
             FROM sc_rm WHERE source_module = $1 AND product_code IS NOT NULL AND product_code != ''
             ORDER BY product_code`,
            [module]
        );
        // Get unique products
        const productsMap = new Map();
        result.rows.forEach(r => {
            if (!productsMap.has(r.product_code)) {
                productsMap.set(r.product_code, { code: r.product_code, name: r.product_name, supplier: r.supplier || '' });
            }
        });
        res.json({ success: true, data: Array.from(productsMap.values()) });
    } catch (err) {
        console.error('[GET /api/rm/master]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST add RM entry to DB
app.post('/api/rm/add', async (req, res) => {
    try {
        const e = req.body.entry || req.body;
        const sourceModule = req.body.sourceModule || 'rm';
        const maxRow = await pool.query("SELECT COALESCE(MAX(row_index),1) as mx FROM sc_rm WHERE source_module = $1", [sourceModule]);
        const nextRow = (parseInt(maxRow.rows[0].mx) || 0) + 1;

        await pool.query(
            `INSERT INTO sc_rm (date, product_code, product_name, type, container_qty, container_weight, remainder, in_qty, out_qty, balance, lot_no, vendor_lot, mfg_date, exp_date, days_left, lot_balance, supplier, remark, container_out, source_module, row_index)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
            [
                e.date, e.productCode, e.productName, e.type,
                parseFloat(e.containerQty) || 0, parseFloat(e.containerWeight) || 0, parseFloat(e.remainder) || 0,
                parseFloat(e.inQty) || 0, parseFloat(e.outQty) || 0, parseFloat(e.balance) || 0,
                e.lotNo || '', e.vendorLot || '', e.mfgDate || '', e.expDate || '',
                e.daysLeft || '', parseFloat(e.lotBalance) || 0, e.supplier || '',
                e.remark || '', parseFloat(e.containerOut) || 0,
                sourceModule, nextRow
            ]
        );
        invalidateCache('rm_');
        console.log(`[POST /api/rm/add] ✅ ${sourceModule}:`, e.productCode, e.type);
        res.json({ success: true, rowIndex: nextRow });
    } catch (err) {
        console.error('[POST /api/rm/add]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Alias: /api/rm/save → same as /api/rm/add (frontend uses /save)
app.post('/api/rm/save', async (req, res) => {
    try {
        const e = req.body.entry || req.body;
        const sourceModule = req.body.sourceModule || e.sourceModule || 'rm';
        const maxRow = await pool.query("SELECT COALESCE(MAX(row_index),1) as mx FROM sc_rm WHERE source_module = $1", [sourceModule]);
        const nextRow = (parseInt(maxRow.rows[0].mx) || 0) + 1;

        const result = await pool.query(
            `INSERT INTO sc_rm (date, product_code, product_name, type, container_qty, container_weight, remainder, in_qty, out_qty, balance, lot_no, vendor_lot, mfg_date, exp_date, days_left, lot_balance, supplier, remark, container_out, source_module, row_index)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
             RETURNING id`,
            [
                e.date, e.productCode, e.productName, e.type,
                parseFloat(e.containerQty) || 0, parseFloat(e.containerWeight) || 0, parseFloat(e.remainder) || 0,
                parseFloat(e.inQty) || 0, parseFloat(e.outQty) || 0, parseFloat(e.balance) || 0,
                e.lotNo || '', e.vendorLot || '', e.mfgDate || '', e.expDate || '',
                e.daysLeft || '', parseFloat(e.lotBalance) || 0, e.supplier || '',
                e.remark || '', parseFloat(e.containerOut) || 0,
                sourceModule, nextRow
            ]
        );
        invalidateCache('rm_');
        console.log(`[POST /api/rm/save] ✅ ${sourceModule}:`, e.productCode, e.type, 'id:', result.rows[0].id);
        res.json({ success: true, id: result.rows[0].id, rowIndex: nextRow });
    } catch (err) {
        console.error('[POST /api/rm/save]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE RM entry from DB
app.post('/api/rm/delete', async (req, res) => {
    try {
        const { rowIndex, sourceModule, criteria } = req.body;
        const module = sourceModule || 'rm';
        let deleted = 0;
        if (rowIndex) {
            const r = await pool.query("DELETE FROM sc_rm WHERE row_index = $1 AND source_module = $2", [rowIndex, module]);
            deleted = r.rowCount;
        } else if (criteria) {
            const r = await pool.query(
                "DELETE FROM sc_rm WHERE product_code = $1 AND type = $2 AND source_module = $3",
                [criteria.productCode, criteria.type, module]
            );
            deleted = r.rowCount;
        }
        invalidateCache('rm_');
        console.log(`[POST /api/rm/delete] ✅ ${module}: deleted`, deleted);
        res.json({ success: true, deleted });
    } catch (err) {
        console.error('[POST /api/rm/delete]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. CONSUMABLE API
// ============================================================
app.get('/api/consumable/items', async (req, res) => {
    try {
        const cached = getCached('consumable_items');
        if (cached) return res.json(cached);

        const result = await pool.query('SELECT * FROM sc_consumable_items ORDER BY id ASC');
        const items = result.rows.map(r => ({
            name: r.name,
            category: r.category || 'weight',
            stockCartons: parseFloat(r.stock_cartons) || 0,
            stockPartialKg: parseFloat(r.stock_partial_kg) || 0,
            kgPerCarton: parseFloat(r.kg_per_carton) || 25,
            pcsPerKg: parseFloat(r.pcs_per_kg) || 0,
            minThreshold: parseFloat(r.min_threshold) || 0,
            pcsPerPack: parseFloat(r.pcs_per_pack) || 1,
            fgPcsPerCarton: parseFloat(r.fg_pcs_per_carton) || 1,
            rollLength: parseFloat(r.roll_length) || 0,
            cutLength: parseFloat(r.cut_length) || 0,
            pcsPerRoll: parseFloat(r.pcs_per_roll) || 0,
            fgYieldPerRoll: parseFloat(r.fg_yield_per_roll) || 0,
            stockCode: r.stock_code || '',
        }));
        const response = { success: true, items, source: 'db' };
        setCache('consumable_items', response);
        res.json(response);
    } catch (err) {
        console.error('[GET /api/consumable/items]', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/consumable/transactions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sc_consumable_transactions ORDER BY created_at DESC');
        const transactions = result.rows.map(r => ({
            id: r.id,
            itemIndex: r.item_index,
            itemName: r.item_name || '',
            date: r.date || '',
            time: r.time || '',
            type: r.type || '',
            qtyKg: parseFloat(r.qty_kg) || 0,
            qtyCartons: parseFloat(r.qty_cartons) || 0,
            qtyUnit: parseFloat(r.qty_unit) || 0,
            remainingStock: parseFloat(r.remaining_stock) || 0,
            note: r.note || '',
        }));
        res.json({ success: true, transactions, source: 'db' });
    } catch (err) {
        console.error('[GET /api/consumable/transactions]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Save consumable items (bulk upsert)
app.post('/api/consumable/save', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { items, transactions: trans } = req.body;

        if (items && Array.isArray(items)) {
            await client.query('DELETE FROM sc_consumable_items');
            for (const item of items) {
                if (!item.name) continue;
                await client.query(
                    `INSERT INTO sc_consumable_items (name, category, stock_cartons, stock_partial_kg, kg_per_carton, pcs_per_kg, min_threshold, pcs_per_pack, fg_pcs_per_carton, roll_length, cut_length, pcs_per_roll, fg_yield_per_roll, stock_code)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
                    [
                        item.name, item.category || 'weight',
                        parseFloat(item.stockCartons) || 0, parseFloat(item.stockPartialKg) || 0,
                        parseFloat(item.kgPerCarton) || 25, parseFloat(item.pcsPerKg) || 0,
                        parseFloat(item.minThreshold) || 0, parseFloat(item.pcsPerPack) || 1,
                        parseFloat(item.fgPcsPerCarton) || 1, parseFloat(item.rollLength) || 0,
                        parseFloat(item.cutLength) || 0, parseFloat(item.pcsPerRoll) || 0,
                        parseFloat(item.fgYieldPerRoll) || 0, item.stockCode || '',
                    ]
                );
            }
        }

        if (trans && Array.isArray(trans)) {
            for (const t of trans) {
                const id = t.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
                await client.query(
                    `INSERT INTO sc_consumable_transactions (id, item_index, item_name, date, time, type, qty_kg, qty_cartons, qty_unit, remaining_stock, note)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                     ON CONFLICT (id) DO UPDATE SET
                        qty_kg = EXCLUDED.qty_kg, qty_cartons = EXCLUDED.qty_cartons,
                        remaining_stock = EXCLUDED.remaining_stock, note = EXCLUDED.note`,
                    [id, t.itemIndex || 0, t.itemName || '', t.date || '', t.time || '',
                        t.type || '', parseFloat(t.qtyKg) || 0, parseFloat(t.qtyCartons) || 0,
                        parseFloat(t.qtyUnit) || 0, parseFloat(t.remainingStock) || 0, t.note || '']
                );
            }
        }

        await client.query('COMMIT');
        invalidateCache('consumable');
        console.log('[POST /api/consumable/save] ✅ saved');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /api/consumable/save]', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ============================================================
// 4. GENERALSTOCK API (Items + Transactions)
// ============================================================

// GET all items
app.get('/api/items', async (req, res) => {
    try {
        const cached = getCached('gs_items');
        if (cached) return res.json(cached);

        const result = await pool.query('SELECT * FROM gs_items ORDER BY created_at DESC');
        const items = result.rows.map(row => ({
            id: row.id, name: row.name, spec: row.spec || '',
            category: row.category || 'Other', unit: row.unit || 'ชิ้น',
            stock: parseFloat(row.stock) || 0, min: parseFloat(row.min_stock) || 0,
            price: row.price ? parseFloat(row.price) : '',
            leadTime: row.lead_time || '', supplier: row.supplier || '',
            country: row.country || '', image: row.image || '',
        }));
        setCache('gs_items', items);
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
        await pool.query(
            `INSERT INTO gs_items (id, name, spec, category, unit, stock, min_stock, price, lead_time, supplier, country, image)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             ON CONFLICT (id) DO UPDATE SET
                name=EXCLUDED.name, spec=EXCLUDED.spec, category=EXCLUDED.category,
                unit=EXCLUDED.unit, stock=EXCLUDED.stock, min_stock=EXCLUDED.min_stock,
                price=EXCLUDED.price, lead_time=EXCLUDED.lead_time, supplier=EXCLUDED.supplier,
                country=EXCLUDED.country, image=EXCLUDED.image, updated_at=NOW()
             RETURNING *`,
            [id, b.name, b.spec || null, b.category || 'Other', b.unit || 'ชิ้น',
                parseFloat(b.stock) || 0, parseFloat(b.min) || 0, b.price ? parseFloat(b.price) : null,
                b.leadTime || null, b.supplier || null, b.country || null, b.image || null]
        );
        invalidateCache('gs_');
        res.json({ success: true });
    } catch (err) {
        console.error('[POST /api/items]', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/items/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM gs_items WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const { item_id } = req.query;
        let result;
        if (item_id) {
            result = await pool.query('SELECT * FROM gs_transactions WHERE item_id=$1 ORDER BY created_at DESC', [item_id]);
        } else {
            result = await pool.query('SELECT * FROM gs_transactions ORDER BY created_at DESC');
        }
        const transactions = result.rows.map(row => ({
            id: row.id, itemId: row.item_id, itemName: row.item_name || '',
            type: row.type, qty: parseFloat(row.qty) || 0, remaining: parseFloat(row.remaining) || 0,
            date: row.date || '', time: row.time || '', note: row.note || '',
        }));
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST transaction
app.post('/api/transactions', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const b = req.body;
        const id = b.id || Date.now().toString();
        const qty = parseFloat(b.qty) || 0;

        if (b.type === 'IN') {
            await client.query('UPDATE gs_items SET stock=stock+$1, updated_at=NOW() WHERE id=$2', [qty, b.itemId]);
        } else {
            await client.query('UPDATE gs_items SET stock=stock-$1, updated_at=NOW() WHERE id=$2', [qty, b.itemId]);
        }

        const stockResult = await client.query('SELECT stock FROM gs_items WHERE id=$1', [b.itemId]);
        const remaining = stockResult.rows.length > 0 ? parseFloat(stockResult.rows[0].stock) : 0;

        await client.query(
            `INSERT INTO gs_transactions (id, item_id, item_name, type, qty, remaining, date, time, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [id, b.itemId, b.itemName || '', b.type, qty, remaining, b.date || '', b.time || '', b.note || '']
        );

        await client.query('COMMIT');
        invalidateCache('gs_');
        res.json({ success: true, remaining });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.delete('/api/transactions/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT * FROM gs_transactions WHERE id=$1', [req.params.id]);
        if (existing.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

        const trans = existing.rows[0];
        const qty = parseFloat(trans.qty);
        if (trans.type === 'IN') {
            await client.query('UPDATE gs_items SET stock=stock-$1, updated_at=NOW() WHERE id=$2', [qty, trans.item_id]);
        } else {
            await client.query('UPDATE gs_items SET stock=stock+$1, updated_at=NOW() WHERE id=$2', [qty, trans.item_id]);
        }
        await client.query('DELETE FROM gs_transactions WHERE id=$1', [req.params.id]);

        const stockResult = await client.query('SELECT stock FROM gs_items WHERE id=$1', [trans.item_id]);
        const remaining = stockResult.rows.length > 0 ? parseFloat(stockResult.rows[0].stock) : 0;

        await client.query('COMMIT');
        res.json({ success: true, remaining });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

app.put('/api/transactions/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { newQty } = req.body;
        const parsedNewQty = parseFloat(newQty);

        const existing = await client.query('SELECT * FROM gs_transactions WHERE id=$1', [req.params.id]);
        if (existing.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

        const trans = existing.rows[0];
        const qtyDiff = parsedNewQty - parseFloat(trans.qty);

        if (trans.type === 'IN') {
            await client.query('UPDATE gs_items SET stock=stock+$1, updated_at=NOW() WHERE id=$2', [qtyDiff, trans.item_id]);
        } else {
            await client.query('UPDATE gs_items SET stock=stock-$1, updated_at=NOW() WHERE id=$2', [qtyDiff, trans.item_id]);
        }

        const stockResult = await client.query('SELECT stock FROM gs_items WHERE id=$1', [trans.item_id]);
        const remaining = parseFloat(stockResult.rows[0].stock);
        await client.query('UPDATE gs_transactions SET qty=$1, remaining=$2 WHERE id=$3', [parsedNewQty, remaining, req.params.id]);

        await client.query('COMMIT');
        res.json({ success: true, remaining });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Bulk sync endpoints
app.post('/api/sync/items', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { items } = req.body;
        if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
        let upserted = 0;
        for (const item of items) {
            const id = item.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
            await client.query(
                `INSERT INTO gs_items (id,name,spec,category,unit,stock,min_stock,price,lead_time,supplier,country,image) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,spec=EXCLUDED.spec,category=EXCLUDED.category,unit=EXCLUDED.unit,stock=EXCLUDED.stock,min_stock=EXCLUDED.min_stock,price=EXCLUDED.price,lead_time=EXCLUDED.lead_time,supplier=EXCLUDED.supplier,country=EXCLUDED.country,image=EXCLUDED.image,updated_at=NOW()`,
                [id, item.name, item.spec || null, item.category || 'Other', item.unit || 'ชิ้น', parseFloat(item.stock) || 0, parseFloat(item.min) || 0, item.price ? parseFloat(item.price) : null, item.leadTime || null, item.supplier || null, item.country || null, item.image || null]
            );
            upserted++;
        }
        await client.query('COMMIT');
        res.json({ success: true, upserted });
    } catch (err) {
        await client.query('ROLLBACK');
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
    console.log(`  🚀 StockCard Unified Server running`);
    console.log(`  📡 http://localhost:${PORT}`);
    console.log(`  📁 Static: ${projectRoot}`);
    console.log(`  🗄️  DB: ${dbName}`);
    console.log('');
    console.log('  📦 Package:     /api/package/data');
    console.log('  🧪 RM:          /api/rm/data?module=rm');
    console.log('  🏭 RM Prod:     /api/rm/data?module=rm_production');
    console.log('  🧹 Consumable:  /api/consumable/items');
    console.log('  ⚙️  GeneralStock: /api/items');
    console.log('============================================================');
    console.log('');
});
