/**
 * Stockcard - Express Server with GeneralStock API (PostgreSQL)
 * Serves static files + API endpoints for GeneralStock items/transactions
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS & Parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Backward-compatible URL rewrite: /items → /api/items, /transactions → /api/transactions
// (GeneralStock frontend uses paths without /api/ prefix)
app.use((req, res, next) => {
  if (req.url.match(/^\/(items|transactions)(\/|$|\?)/)) {
    req.url = '/api' + req.url;
  }
  next();
});

// Admin check (ถ้ามี ADMIN_SECRET ใน .env ต้องส่ง X-Admin-Token)
function checkAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return next();
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token === secret) return next();
  res.status(403).json({ error: 'ต้องมีสิทธิ์ Admin' });
}

// Database connection (อ่านจาก stockcard/.env)
const pool = new Pool({
  host: process.env.INVENTORY_DB_HOST || 'localhost',
  port: parseInt(process.env.INVENTORY_DB_PORT || '5432'),
  database: process.env.INVENTORY_DB_NAME || 'inventory_rm_tan',
  user: process.env.INVENTORY_DB_USER || 'postgres',
  password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
});

// API Config
app.get('/api/config', (req, res) => {
  const protocol = req.protocol;
  const host = req.get('host');
  res.json({
    apiBase: `${protocol}://${host}/api`,
    appsScriptGeneralStock: process.env.APPS_SCRIPT_GENERALSTOCK || ''
  });
});

function calculateDaysLeft(expDateValue) {
  const expDate = expDateValue || '';
  if (!expDate || expDate === '-') return '';

  const parts = String(expDate).split('/');
  if (parts.length !== 3) return '';

  let year = parseInt(parts[2], 10);
  if (year > 2500) year -= 543;

  const exp = new Date(year, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  exp.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil((exp - today) / (1000 * 60 * 60 * 24)) + 1;
}

async function recalculatePackageRows(client) {
  const rowsRes = await client.query(
    `SELECT id, product_code, in_qty, out_qty
     FROM sc_package
     WHERE source_module = 'package'
     ORDER BY row_index ASC, id ASC`
  );

  const balances = new Map();
  for (let i = 0; i < rowsRes.rows.length; i++) {
    const row = rowsRes.rows[i];
    const nextBalance = (balances.get(row.product_code) || 0)
      + (parseFloat(row.in_qty) || 0)
      - (parseFloat(row.out_qty) || 0);

    balances.set(row.product_code, nextBalance);

    await client.query(
      `UPDATE sc_package
       SET balance = $1, row_index = $2
       WHERE id = $3`,
      [nextBalance, i + 2, row.id]
    );
  }
}

async function recalculateRMRows(client, sourceModule) {
  const rowsRes = await client.query(
    `SELECT id, product_code, lot_no, exp_date, in_qty, out_qty
     FROM sc_rm
     WHERE source_module = $1
     ORDER BY row_index ASC, id ASC`,
    [sourceModule]
  );

  const balances = new Map();
  const lotBalances = new Map();

  for (let i = 0; i < rowsRes.rows.length; i++) {
    const row = rowsRes.rows[i];
    const productKey = row.product_code || '';
    const lotKey = `${productKey}||${row.lot_no || ''}`;

    const nextBalance = (balances.get(productKey) || 0)
      + (parseFloat(row.in_qty) || 0)
      - (parseFloat(row.out_qty) || 0);

    let nextLotBalance = 0;
    if (row.lot_no && row.lot_no !== '-') {
      nextLotBalance = (lotBalances.get(lotKey) || 0)
        + (parseFloat(row.in_qty) || 0)
        - (parseFloat(row.out_qty) || 0);
      lotBalances.set(lotKey, nextLotBalance);
    }

    balances.set(productKey, nextBalance);

    await client.query(
      `UPDATE sc_rm
       SET balance = $1, lot_balance = $2, days_left = $3, row_index = $4
       WHERE id = $5`,
      [nextBalance, nextLotBalance, String(calculateDaysLeft(row.exp_date)), i + 2, row.id]
    );
  }
}

// ============================================================
// GeneralStock Items API
// ============================================================

app.get('/api/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM gs_items ORDER BY name ASC');
    // Transform column keys from created_at to camelCase to match frontend if needed,
    // frontend script expects: id, name, spec, category, unit, stock, min, price, leadTime, supplier, country, image
    const transformed = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      spec: row.spec,
      category: row.category,
      unit: row.unit,
      stock: parseFloat(row.stock),
      min: parseFloat(row.min_stock),
      price: row.price ? parseFloat(row.price) : null,
      leadTime: row.lead_time,
      supplier: row.supplier,
      country: row.country,
      image: row.image
    }));
    res.json(transformed);
  } catch (err) {
    console.error('[DB Error] fetch items:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/items', async (req, res) => {
  const item = req.body;
  
  if (!item.id) {
    item.id = Date.now().toString();
  }

  try {
    // Upsert query
    const query = `
      INSERT INTO gs_items (id, name, spec, category, unit, stock, min_stock, price, lead_time, supplier, country, image, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
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
      RETURNING *;
    `;
    const values = [
      item.id, item.name, item.spec || null, item.category || 'Other',
      item.unit || 'ชิ้น', item.stock || 0, item.min || 5, item.price || null,
      item.leadTime || null, item.supplier || null, item.country || null, item.image || null
    ];
    await pool.query(query, values);
    res.json({ success: true, item: item });
  } catch (err) {
    console.error('[DB Error] save item:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM gs_items WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[DB Error] delete item:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================
// GeneralStock Transactions API
// ============================================================

app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM gs_transactions ORDER BY created_at DESC');
    const transformed = result.rows.map(row => ({
      id: row.id,
      itemId: row.item_id,
      itemName: row.item_name,
      type: row.type,
      qty: parseFloat(row.qty),
      remaining: parseFloat(row.remaining),
      date: row.date,
      time: row.time,
      note: row.note
    }));
    res.json(transformed);
  } catch (err) {
    console.error('[DB Error] fetch transactions:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/transactions', async (req, res) => {
  const trans = req.body;
  if (!trans.id) {
    trans.id = Date.now().toString();
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current stock
    const itemRes = await client.query('SELECT stock FROM gs_items WHERE id = $1 FOR UPDATE', [trans.itemId]);
    if (itemRes.rowCount === 0) {
      throw new Error('Item not found');
    }
    let currentStock = parseFloat(itemRes.rows[0].stock);

    // Calc new stock
    if (trans.type === 'IN') {
      currentStock += trans.qty;
    } else {
      currentStock -= trans.qty;
    }
    trans.remaining = currentStock;

    // Update item stock
    await client.query('UPDATE gs_items SET stock = $1, updated_at = NOW() WHERE id = $2', [currentStock, trans.itemId]);

    // Insert transaction
    const queryList = `
      INSERT INTO gs_transactions (id, item_id, item_name, type, qty, remaining, date, time, note, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `;
    const valList = [
      trans.id, trans.itemId, trans.itemName || '', trans.type, trans.qty, trans.remaining,
      trans.date || null, trans.time || null, trans.note || null
    ];
    await client.query(queryList, valList);

    await client.query('COMMIT');
    res.json({ success: true, transaction: trans, remaining: trans.remaining });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB Error] save transaction:', err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Find transaction
    const transRes = await client.query('SELECT * FROM gs_transactions WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (transRes.rowCount === 0) throw new Error('Transaction not found');
    const oldTrans = transRes.rows[0];
    const newQty = parseFloat(req.body.newQty);
    const qtyDiff = newQty - parseFloat(oldTrans.qty);

    // Find item
    const itemRes = await client.query('SELECT stock FROM gs_items WHERE id = $1 FOR UPDATE', [oldTrans.item_id]);
    let currentStock = parseFloat(itemRes.rows[0].stock);

    // Undo old diff, apply new diff
    if (oldTrans.type === 'IN') {
      currentStock += qtyDiff;
    } else {
      currentStock -= qtyDiff;
    }

    // Update item
    await client.query('UPDATE gs_items SET stock = $1, updated_at = NOW() WHERE id = $2', [currentStock, oldTrans.item_id]);

    // Update transaction
    await client.query('UPDATE gs_transactions SET qty = $1, remaining = $2 WHERE id = $3', [newQty, currentStock, req.params.id]);

    await client.query('COMMIT');
    res.json({ success: true, remaining: currentStock });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB Error] update transaction:', err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const transRes = await client.query('SELECT * FROM gs_transactions WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (transRes.rowCount === 0) throw new Error('Transaction not found');
    const trans = transRes.rows[0];

    const itemRes = await client.query('SELECT stock FROM gs_items WHERE id = $1 FOR UPDATE', [trans.item_id]);
    let currentStock = parseFloat(itemRes.rows[0].stock);

    // Revert stock
    if (trans.type === 'IN') {
      currentStock -= parseFloat(trans.qty);
    } else {
      currentStock += parseFloat(trans.qty);
    }

    // Update item
    await client.query('UPDATE gs_items SET stock = $1, updated_at = NOW() WHERE id = $2', [currentStock, trans.item_id]);
    
    // Delete transaction
    await client.query('DELETE FROM gs_transactions WHERE id = $1', [req.params.id]);
    
    await client.query('COMMIT');
    res.json({ success: true, remaining: currentStock });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB Error] delete transaction:', err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});


// ============================================================
// Admin API - สลับโหมด DB
// ============================================================

app.get('/api/admin/db-mode', checkAdmin, (req, res) => {
  const port = process.env.INVENTORY_DB_PORT || '5432';
  const db = process.env.INVENTORY_DB_NAME || 'inventory_rm_tan';
  let mode = 'local';
  if (port === '15432' && db === 'pddoc_dev') mode = 'test';
  else if (port === '15432') mode = 'tunnel';
  res.json({ mode, port, database: db });
});

app.post('/api/admin/switch-db-mode', checkAdmin, (req, res) => {
  const { mode } = req.body || {};
  const MODES = {
    local: { INVENTORY_DB_PORT: '5432', INVENTORY_DB_NAME: 'inventory_rm_tan' },
    tunnel: { INVENTORY_DB_PORT: '15432', INVENTORY_DB_NAME: 'inventory_rm_tan' },
    test: { INVENTORY_DB_PORT: '15432', INVENTORY_DB_NAME: 'pddoc_dev' },
  };
  const cfg = MODES[mode?.toLowerCase()];
  if (!cfg) {
    return res.status(400).json({ error: 'โหมดไม่ถูกต้อง ใช้ local, tunnel หรือ test' });
  }
  const envPath = path.join(__dirname, '.env');
  try {
    let content = fs.readFileSync(envPath, 'utf8');
    content = content.replace(/INVENTORY_DB_PORT=.*/g, `INVENTORY_DB_PORT=${cfg.INVENTORY_DB_PORT}`);
    content = content.replace(/INVENTORY_DB_NAME=.*/g, `INVENTORY_DB_NAME=${cfg.INVENTORY_DB_NAME}`);
    fs.writeFileSync(envPath, content);
    res.json({ success: true, mode, message: `สลับเป็นโหมด ${mode} แล้ว — กรุณา restart server` });
  } catch (err) {
    console.error('[Admin] switch-db-mode:', err);
    res.status(500).json({ error: 'แก้ไข .env ไม่ได้' });
  }
});

// ============================================================
// Package API (sc_package table)
// ============================================================

// GET /api/package/data — ดึงข้อมูล Package ทั้งหมด
app.get('/api/package/data', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, date, product_code, product_name, type, in_qty, out_qty, balance,
              lot_no, pk_id, doc_ref, remark, row_index
       FROM sc_package WHERE source_module = 'package' ORDER BY row_index ASC`
    );
    // Map to frontend format
    const data = result.rows.map(r => ({
      rowIndex: r.row_index,
      date: r.date || '',
      productCode: r.product_code || '',
      productName: r.product_name || '',
      type: r.type || '',
      inQty: parseFloat(r.in_qty) || 0,
      outQty: parseFloat(r.out_qty) || 0,
      balance: parseFloat(r.balance) || 0,
      lotNo: r.lot_no || '',
      pkId: r.pk_id || '',
      docRef: r.doc_ref || '',
      remark: r.remark || ''
    }));
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    console.error('[Package API] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/package/save — บันทึกรายการ Package ลง DB
app.post('/api/package/save', async (req, res) => {
  const d = req.body;
  try {
    const inQty = parseFloat(d.inQty) || 0;
    const outQty = parseFloat(d.outQty) || 0;

    const rowIndexRes = await pool.query(
      `SELECT GREATEST(COALESCE(MAX(row_index), 1), 1) + 1 AS next_idx
       FROM sc_package
       WHERE source_module = 'package'`
    );
    const rowIndex = parseInt(d.rowIndex, 10) || rowIndexRes.rows[0].next_idx;

    const balanceRes = await pool.query(
      `SELECT COALESCE(SUM(in_qty - out_qty), 0) AS total
       FROM sc_package
       WHERE product_code = $1 AND source_module = 'package'`,
      [d.productCode]
    );
    const balance = (parseFloat(balanceRes.rows[0].total) || 0) + inQty - outQty;

    const result = await pool.query(
      `INSERT INTO sc_package (date, product_code, product_name, type, in_qty, out_qty, balance, lot_no, pk_id, doc_ref, remark, source_module, row_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'package',$12)
       RETURNING id`,
      [d.date, d.productCode, d.productName, d.type,
       inQty, outQty, balance,
       d.lotNo || '', d.pkId || '', d.docRef || '', d.remark || '', rowIndex]
    );
    console.log('[Package] ✅ Saved to DB, id:', result.rows[0].id, 'balance:', balance, 'row_index:', rowIndex);
    res.json({ success: true, id: result.rows[0].id, balance, rowIndex });
  } catch (err) {
    console.error('[Package API] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/package/delete — ลบรายการ Package จาก DB
app.post('/api/package/delete', async (req, res) => {
  const { rowIndex, criteria } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let result = { rowCount: 0 };
    if (rowIndex) {
      result = await client.query(
        `DELETE FROM sc_package WHERE row_index = $1 AND source_module = 'package'`,
        [rowIndex]
      );
    } else if (criteria) {
      result = await client.query(
        `DELETE FROM sc_package WHERE product_code = $1 AND type = $2 AND source_module = 'package'`,
        [criteria.productCode, criteria.type]
      );
    }
    await recalculatePackageRows(client);
    await client.query('COMMIT');
    console.log('[Package] ✅ Deleted from DB, rows:', result?.rowCount);
    res.json({ success: true, deleted: result?.rowCount || 0 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Package API] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// RM API (sc_rm table)
// ============================================================

// GET /api/rm/data — ดึงข้อมูล RM (Center หรือ Production)
app.get('/api/rm/data', async (req, res) => {
  const module = req.query.module || 'rm';
  try {
    const result = await pool.query(
      `SELECT id, date, product_code, product_name, type, container_qty, container_weight,
              remainder, in_qty, out_qty, balance, lot_no, vendor_lot, mfg_date, exp_date,
              days_left, lot_balance, supplier, remark, container_out, row_index
       FROM sc_rm WHERE source_module = $1 ORDER BY row_index ASC`,
      [module]
    );
    const data = result.rows.map(r => ({
      rowIndex: r.row_index,
      date: r.date || '',
      productCode: r.product_code || '',
      productName: r.product_name || '',
      type: r.type || '',
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
      containerOut: parseFloat(r.container_out) || 0
    }));
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    console.error('[RM API] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rm/master — ดึง master data (product code, name, supplier) ที่ไม่ซ้ำ
app.get('/api/rm/master', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT product_code as code, product_name as name,
              (SELECT supplier FROM sc_rm r2 WHERE r2.product_code = r1.product_code AND r2.supplier != '' ORDER BY r2.row_index DESC LIMIT 1) as supplier
       FROM sc_rm r1
       WHERE product_code != '' AND product_code != 'รหัสสินค้า'
       ORDER BY product_code ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[RM Master API] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rm/save — บันทึกรายการ RM ลง DB (auto-calculate balance/daysLeft/lotBalance)
app.post('/api/rm/save', async (req, res) => {
  const d = req.body;
  const sourceModule = d.sourceModule || 'rm';
  try {
    const inQty = parseFloat(d.inQty) || 0;
    const outQty = parseFloat(d.outQty) || 0;

    // Auto-calculate row_index if not provided (append to end)
    let rowIndex = parseInt(d.rowIndex) || 0;
    if (rowIndex <= 0) {
      const maxRes = await pool.query(
        `SELECT GREATEST(COALESCE(MAX(row_index), 1), 1) + 1 AS next_idx FROM sc_rm WHERE source_module = $1`,
        [sourceModule]
      );
      rowIndex = maxRes.rows[0].next_idx;
    }

    // Auto-calculate balance: cumulative (in - out) per product
    const balanceRes = await pool.query(
      `SELECT COALESCE(SUM(in_qty - out_qty), 0) AS total FROM sc_rm WHERE product_code = $1 AND source_module = $2`,
      [d.productCode, sourceModule]
    );
    const balance = (parseFloat(balanceRes.rows[0].total) || 0) + inQty - outQty;

    // Auto-calculate lotBalance: cumulative (in - out) per product+lot
    let lotBalance = 0;
    if (d.lotNo && d.lotNo !== '-') {
      const lotRes = await pool.query(
        `SELECT COALESCE(SUM(in_qty - out_qty), 0) AS total FROM sc_rm WHERE product_code = $1 AND lot_no = $2 AND source_module = $3`,
        [d.productCode, d.lotNo, sourceModule]
      );
      lotBalance = (parseFloat(lotRes.rows[0].total) || 0) + inQty - outQty;
    }

    // Auto-calculate daysLeft from expDate (format: d/m/yyyy or dd/mm/yyyy)
    const daysLeft = calculateDaysLeft(d.expDate);

    const result = await pool.query(
      `INSERT INTO sc_rm (date, product_code, product_name, type, container_qty, container_weight,
       remainder, in_qty, out_qty, balance, lot_no, vendor_lot, mfg_date, exp_date,
       days_left, lot_balance, supplier, remark, container_out, source_module, row_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING id`,
      [d.date, d.productCode, d.productName, d.type,
       parseFloat(d.containerQty) || 0, parseFloat(d.containerWeight) || 0,
       parseFloat(d.remainder) || 0, inQty, outQty,
       balance, d.lotNo || '', d.vendorLot || '',
       d.mfgDate || '', d.expDate || '', String(daysLeft),
       lotBalance, d.supplier || '', d.remark || '',
       parseFloat(d.containerOut) || 0, sourceModule, rowIndex]
    );
    console.log(`[RM] ✅ Saved to DB (${sourceModule}), id:`, result.rows[0].id, 'balance:', balance, 'lotBalance:', lotBalance);
    res.json({ success: true, id: result.rows[0].id, balance, lotBalance, daysLeft });
  } catch (err) {
    console.error('[RM API] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rm/delete — ลบรายการ RM จาก DB
app.post('/api/rm/delete', async (req, res) => {
  const { rowIndex, sourceModule, criteria } = req.body;
  const mod = sourceModule || 'rm';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let result = { rowCount: 0 };
    if (rowIndex) {
      result = await client.query(
        `DELETE FROM sc_rm WHERE row_index = $1 AND source_module = $2`,
        [rowIndex, mod]
      );
    } else if (criteria) {
      result = await client.query(
        `DELETE FROM sc_rm WHERE product_code = $1 AND type = $2 AND source_module = $3`,
        [criteria.productCode, criteria.type, mod]
      );
    }
    await recalculateRMRows(client, mod);
    await client.query('COMMIT');
    console.log(`[RM] ✅ Deleted from DB (${mod}), rows:`, result?.rowCount);
    res.json({ success: true, deleted: result?.rowCount || 0 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[RM API] DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// Consumable API (sc_consumable_items + sc_consumable_transactions)
// ============================================================

// GET /api/consumable/data — ดึงข้อมูล Consumable ทั้งหมด (items + transactions)
app.get('/api/consumable/data', async (req, res) => {
  try {
    const [itemsResult, transResult] = await Promise.all([
      pool.query('SELECT * FROM sc_consumable_items ORDER BY id ASC'),
      pool.query('SELECT * FROM sc_consumable_transactions ORDER BY id DESC')
    ]);

    const items = itemsResult.rows.map(r => ({
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
      stockCode: r.stock_code || ''
    }));

    const transactions = transResult.rows.map(r => ({
      id: r.id,
      itemIndex: r.item_index,
      itemName: r.item_name,
      date: r.date,
      time: r.time,
      type: r.type,
      qtyKg: parseFloat(r.qty_kg) || 0,
      qtyCartons: parseFloat(r.qty_cartons) || 0,
      qtyUnit: parseFloat(r.qty_unit) || 0,
      remainingStock: parseFloat(r.remaining_stock) || 0,
      note: r.note || ''
    }));

    res.json({ success: true, items, transactions, itemCount: items.length, transCount: transactions.length });
  } catch (err) {
    console.error('[Consumable API] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/consumable/save — บันทึก Consumable ลง DB (full replace)
app.post('/api/consumable/save', async (req, res) => {
  const { items: newItems, transactions: newTrans } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear and re-insert items
    await client.query('DELETE FROM sc_consumable_transactions');
    await client.query('DELETE FROM sc_consumable_items');

    let itemCount = 0;
    if (newItems && Array.isArray(newItems)) {
      for (const item of newItems) {
        if (!item.name) continue;
        await client.query(
          `INSERT INTO sc_consumable_items (name, category, stock_cartons, stock_partial_kg, kg_per_carton, pcs_per_kg, min_threshold, pcs_per_pack, fg_pcs_per_carton, roll_length, cut_length, pcs_per_roll, fg_yield_per_roll, stock_code)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [item.name, item.category || 'weight',
           parseFloat(item.stockCartons || item.stock || 0),
           parseFloat(item.stockPartialKg || item.stockPartial || 0),
           parseFloat(item.kgPerCarton || 25),
           parseFloat(item.pcsPerKg || 0),
           parseFloat(item.minThreshold || item.min || 0),
           parseFloat(item.pcsPerPack || 1),
           parseFloat(item.fgPcsPerCarton || item.fgPerCarton || 1),
           parseFloat(item.rollLength || 0),
           parseFloat(item.cutLength || 0),
           parseFloat(item.pcsPerRoll || 0),
           parseFloat(item.fgYieldPerRoll || 0),
           item.stockCode || '']
        );
        itemCount++;
      }
    }

    let transCount = 0;
    if (newTrans && Array.isArray(newTrans)) {
      for (const t of newTrans) {
        const id = t.id || Date.now().toString() + Math.random().toString(36).substr(2, 5);
        await client.query(
          `INSERT INTO sc_consumable_transactions (id, item_index, item_name, date, time, type, qty_kg, qty_cartons, qty_unit, remaining_stock, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO NOTHING`,
          [id, t.itemIndex || 0, t.itemName || '',
           t.date || '', t.time || '', t.type || '',
           parseFloat(t.qtyKg || 0), parseFloat(t.qtyCartons || 0),
           parseFloat(t.qtyUnit || 0), parseFloat(t.remainingStock || 0),
           t.note || '']
        );
        transCount++;
      }
    }

    await client.query('COMMIT');
    console.log(`[Consumable] ✅ Saved to DB: ${itemCount} items, ${transCount} transactions`);
    res.json({ success: true, itemCount, transCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Consumable API] POST error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// Static Files
// ============================================================

app.use(express.static(__dirname, {
  extensions: ['html', 'css', 'js', 'png', 'jpg', 'gif', 'svg', 'ico'],
  index: 'index.html'
}));

app.use('/database', express.static(path.join(__dirname, 'database')));
app.use('/Consumable', express.static(path.join(__dirname, 'Consumable')));
app.use('/GeneralStock', express.static(path.join(__dirname, 'GeneralStock')));
app.use('/docs', express.static(path.join(__dirname, 'docs')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Stockcard] Running on http://localhost:${PORT} (Database Connected)`);
});
