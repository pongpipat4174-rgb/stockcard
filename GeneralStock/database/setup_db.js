// ============================================================
// GeneralStock - Database Setup
// ============================================================
// สร้างตารางสำหรับระบบคลังอะไหล่และอุปกรณ์ (General Stock Card)
//
// การใช้งาน: node setup_db.js
// ============================================================

// โหลดจาก stockcard/.env (แหล่งเดียว)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { Client } = require('pg');

// ---- Database Connection Config ----
const DB_CONFIG = {
    host: process.env.INVENTORY_DB_HOST || 'localhost',
    port: parseInt(process.env.INVENTORY_DB_PORT || '15432'),
    database: process.env.INVENTORY_DB_NAME || 'pddoc_dev',
    user: process.env.INVENTORY_DB_USER || 'postgres',
    password: process.env.INVENTORY_DB_PASSWORD || 'postgres123',
};

// ---- SQL Schema ----
const SCHEMA_SQL = `
-- ============================================================
-- Extension
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. GS_ITEMS (รายการสินค้า/อะไหล่)
-- ============================================================
CREATE TABLE IF NOT EXISTS gs_items (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    spec            TEXT,
    category        TEXT DEFAULT 'Other',       -- Spare Part, Cleaning, Other
    unit            TEXT DEFAULT 'ชิ้น',
    stock           NUMERIC DEFAULT 0,
    min_stock       NUMERIC DEFAULT 5,
    price           NUMERIC,
    lead_time       TEXT,
    supplier        TEXT,
    country         TEXT,
    image           TEXT,                        -- base64 encoded image
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. GS_TRANSACTIONS (ประวัติรับ/เบิก)
-- ============================================================
CREATE TABLE IF NOT EXISTS gs_transactions (
    id              TEXT PRIMARY KEY,
    item_id         TEXT NOT NULL REFERENCES gs_items(id) ON DELETE CASCADE,
    item_name       TEXT,
    type            TEXT NOT NULL,               -- IN, OUT
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
CREATE INDEX IF NOT EXISTS idx_gs_items_category ON gs_items(category);
CREATE INDEX IF NOT EXISTS idx_gs_items_name ON gs_items(name);
CREATE INDEX IF NOT EXISTS idx_gs_transactions_item_id ON gs_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_gs_transactions_type ON gs_transactions(type);
CREATE INDEX IF NOT EXISTS idx_gs_transactions_date ON gs_transactions(date);

-- ============================================================
-- UPDATE TRIGGER (อัพเดท updated_at อัตโนมัติ)
-- ============================================================
CREATE OR REPLACE FUNCTION gs_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_gs_items_updated ON gs_items;
CREATE TRIGGER trigger_gs_items_updated
    BEFORE UPDATE ON gs_items
    FOR EACH ROW EXECUTE FUNCTION gs_update_updated_at();
`;

// ---- Main Setup Function ----
async function setupDatabase() {
    const client = new Client(DB_CONFIG);

    try {
        console.log('============================================================');
        console.log('  GeneralStock - Database Setup');
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

        console.log('📦 กำลังสร้างตาราง...');
        await client.query(SCHEMA_SQL);
        console.log('✅ สร้างตารางสำเร็จ!');
        console.log('');

        // ---- Verify tables ----
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'gs_%'
            ORDER BY table_name;
        `);

        console.log('📋 ตาราง GeneralStock ที่สร้างแล้ว:');
        console.log('------------------------------------------------------------');
        tablesResult.rows.forEach((row, i) => {
            console.log(`  ${i + 1}. ${row.table_name}`);
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
        console.log('============================================================');

    } catch (err) {
        console.error('');
        console.error('❌ เกิดข้อผิดพลาด:', err.message);
        console.error('');

        if (err.code === 'ECONNREFUSED') {
            console.error('💡 ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
            console.error('   - ตรวจสอบว่า PostgreSQL กำลังทำงานอยู่');
            console.error(`   - ตรวจสอบ Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
        } else if (err.code === '3D000') {
            console.error(`💡 ฐานข้อมูล "${DB_CONFIG.database}" ยังไม่มี`);
            console.error('   กรุณาสร้างฐานข้อมูลก่อน');
        } else if (err.code === '28P01') {
            console.error('💡 ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }

        process.exit(1);
    } finally {
        await client.end();
    }
}

// ---- Run ----
setupDatabase();
