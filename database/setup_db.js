// ============================================================
// StockCard - Unified Database Setup
// ============================================================
// สร้างตารางสำหรับทุก 5 โมดูล:
// 1. Package (sc_package)
// 2. RM Center (sc_rm)
// 3. RM Production (sc_rm — ใช้ source_module แยก)
// 4. Consumable (sc_consumable_items, sc_consumable_transactions)
// 5. GeneralStock (gs_items, gs_transactions) — มีอยู่แล้ว
//
// การใช้งาน: node setup_db.js
// ============================================================

// โหลดจาก stockcard/.env (แหล่งเดียว)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

const DB_CONFIG = {
    host: process.env.INVENTORY_DB_HOST || 'localhost',
    port: parseInt(process.env.INVENTORY_DB_PORT || '15432'),
    database: process.env.INVENTORY_DB_NAME || 'pddoc_dev',
    user: process.env.INVENTORY_DB_USER || 'postgres',
    password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
};

const SCHEMA_SQL = `
-- ============================================================
-- Extension
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. SC_PACKAGE — Stock Card แพ็คเกจ
-- ============================================================
CREATE TABLE IF NOT EXISTS sc_package (
    id              SERIAL PRIMARY KEY,
    date            TEXT,
    product_code    TEXT,
    product_name    TEXT,
    type            TEXT,               -- รับเข้า / เบิกออก
    in_qty          NUMERIC DEFAULT 0,
    out_qty         NUMERIC DEFAULT 0,
    balance         NUMERIC DEFAULT 0,
    lot_no          TEXT,
    pk_id           TEXT,
    doc_ref         TEXT,
    remark          TEXT,
    source_module   TEXT DEFAULT 'package',
    row_index       INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. SC_RM — Stock Card วัตถุดิบ (RM Center + RM Production)
-- ============================================================
CREATE TABLE IF NOT EXISTS sc_rm (
    id              SERIAL PRIMARY KEY,
    date            TEXT,
    product_code    TEXT,
    product_name    TEXT,
    type            TEXT,
    container_qty   NUMERIC DEFAULT 0,
    container_weight NUMERIC DEFAULT 0,
    remainder       NUMERIC DEFAULT 0,
    in_qty          NUMERIC DEFAULT 0,
    out_qty         NUMERIC DEFAULT 0,
    balance         NUMERIC DEFAULT 0,
    lot_no          TEXT,
    vendor_lot      TEXT,
    mfg_date        TEXT,
    exp_date        TEXT,
    days_left       TEXT,
    lot_balance     NUMERIC DEFAULT 0,
    supplier        TEXT,
    remark          TEXT,
    container_out   NUMERIC DEFAULT 0,
    source_module   TEXT DEFAULT 'rm',    -- 'rm' หรือ 'rm_production'
    row_index       INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. SC_CONSUMABLE_ITEMS — วัสดุสิ้นเปลือง (รายการ)
-- ============================================================
CREATE TABLE IF NOT EXISTS sc_consumable_items (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    category        TEXT DEFAULT 'weight',     -- weight, unit
    stock_cartons   NUMERIC DEFAULT 0,
    stock_partial_kg NUMERIC DEFAULT 0,
    kg_per_carton   NUMERIC DEFAULT 25,
    pcs_per_kg      NUMERIC DEFAULT 0,
    min_threshold   NUMERIC DEFAULT 0,
    pcs_per_pack    NUMERIC DEFAULT 1,
    fg_pcs_per_carton NUMERIC DEFAULT 1,
    roll_length     NUMERIC DEFAULT 0,
    cut_length      NUMERIC DEFAULT 0,
    pcs_per_roll    NUMERIC DEFAULT 0,
    fg_yield_per_roll NUMERIC DEFAULT 0,
    stock_code      TEXT DEFAULT '',
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. SC_CONSUMABLE_TRANSACTIONS — วัสดุสิ้นเปลือง (ประวัติ)
-- ============================================================
CREATE TABLE IF NOT EXISTS sc_consumable_transactions (
    id              TEXT PRIMARY KEY,
    item_index      INTEGER,
    item_name       TEXT,
    date            TEXT,
    time            TEXT,
    type            TEXT,                      -- IN, OUT
    qty_kg          NUMERIC DEFAULT 0,
    qty_cartons     NUMERIC DEFAULT 0,
    qty_unit        NUMERIC DEFAULT 0,
    remaining_stock NUMERIC DEFAULT 0,
    note            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. GS_ITEMS + GS_TRANSACTIONS — อะไหล่ & อุปกรณ์ (General Stock)
-- ============================================================
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

-- ============================================================
-- INDEXES
-- ============================================================
-- Package
CREATE INDEX IF NOT EXISTS idx_sc_package_product_code ON sc_package(product_code);
CREATE INDEX IF NOT EXISTS idx_sc_package_date ON sc_package(date);
CREATE INDEX IF NOT EXISTS idx_sc_package_source ON sc_package(source_module);

-- RM
CREATE INDEX IF NOT EXISTS idx_sc_rm_product_code ON sc_rm(product_code);
CREATE INDEX IF NOT EXISTS idx_sc_rm_date ON sc_rm(date);
CREATE INDEX IF NOT EXISTS idx_sc_rm_source ON sc_rm(source_module);
CREATE INDEX IF NOT EXISTS idx_sc_rm_supplier ON sc_rm(supplier);
CREATE INDEX IF NOT EXISTS idx_sc_rm_lot ON sc_rm(lot_no);

-- Consumable
CREATE INDEX IF NOT EXISTS idx_sc_consumable_items_name ON sc_consumable_items(name);
CREATE INDEX IF NOT EXISTS idx_sc_consumable_items_category ON sc_consumable_items(category);
CREATE INDEX IF NOT EXISTS idx_sc_consumable_trans_item ON sc_consumable_transactions(item_name);

-- GeneralStock
CREATE INDEX IF NOT EXISTS idx_gs_items_category ON gs_items(category);
CREATE INDEX IF NOT EXISTS idx_gs_items_name ON gs_items(name);
CREATE INDEX IF NOT EXISTS idx_gs_transactions_item_id ON gs_transactions(item_id);
`;

// ---- Main Setup Function ----
async function setupDatabase() {
    const client = new Client(DB_CONFIG);

    try {
        console.log('============================================================');
        console.log('  StockCard - Unified Database Setup');
        console.log('============================================================');
        console.log(`  Host:     ${DB_CONFIG.host}:${DB_CONFIG.port}`);
        console.log(`  Database: ${DB_CONFIG.database}`);
        console.log(`  User:     ${DB_CONFIG.user}`);
        console.log('------------------------------------------------------------');
        console.log('');

        console.log('🔌 กำลังเชื่อมต่อฐานข้อมูล...');
        await client.connect();
        console.log('✅ เชื่อมต่อสำเร็จ!');
        console.log('');

        console.log('📦 กำลังสร้างตาราง (ทุกโมดูล)...');
        await client.query(SCHEMA_SQL);
        console.log('✅ สร้างตารางสำเร็จ!');
        console.log('');

        // ---- Verify tables ----
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE 'sc_%' OR table_name LIKE 'gs_%')
            ORDER BY table_name;
        `);

        console.log('📋 ตาราง StockCard ที่สร้างแล้ว:');
        console.log('------------------------------------------------------------');
        tablesResult.rows.forEach((row, i) => {
            const module =
                row.table_name.startsWith('sc_package') ? '📦 Package' :
                    row.table_name.startsWith('sc_rm') ? '🧪 RM' :
                        row.table_name.startsWith('sc_consumable') ? '🧹 Consumable' :
                            row.table_name.startsWith('gs_') ? '⚙️ GeneralStock' : '  ';
            console.log(`  ${i + 1}. ${row.table_name}  [${module}]`);
        });
        console.log('------------------------------------------------------------');
        console.log(`  รวม: ${tablesResult.rows.length} ตาราง`);
        console.log('');

        // ---- Count existing data ----
        console.log('📊 สถิติข้อมูล:');
        console.log('------------------------------------------------------------');
        for (const row of tablesResult.rows) {
            const countResult = await client.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
            console.log(`  ${row.table_name}: ${countResult.rows[0].count} แถว`);
        }
        console.log('------------------------------------------------------------');

        console.log('');
        console.log('🎉 ตั้งค่าฐานข้อมูลเสร็จเรียบร้อย!');
        console.log('   ถัดไป: node sync_from_sheets.js   (Sync ข้อมูลจาก Sheets เข้า DB)');
        console.log('   แล้ว:   node server.js             (เริ่ม API Server)');
        console.log('============================================================');

    } catch (err) {
        console.error('');
        console.error('❌ เกิดข้อผิดพลาด:', err.message);
        if (err.code === 'ECONNREFUSED') {
            console.error('💡 ตรวจสอบว่า PostgreSQL กำลังทำงานอยู่');
        } else if (err.code === '3D000') {
            console.error(`💡 ฐานข้อมูล "${DB_CONFIG.database}" ยังไม่มี`);
        }
        process.exit(1);
    } finally {
        await client.end();
    }
}

setupDatabase();
