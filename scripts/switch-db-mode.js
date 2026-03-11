#!/usr/bin/env node
/**
 * สลับโหมด DB: local | tunnel | test
 * แก้ stockcard/.env ให้ตรงกับโหมดที่เลือก
 *
 * การใช้งาน:
 *   node scripts/switch-db-mode.js local
 *   node scripts/switch-db-mode.js tunnel
 *   node scripts/switch-db-mode.js test
 */

const fs = require('fs');
const path = require('path');

const MODES = {
  local: {
    INVENTORY_DB_PORT: '5432',
    INVENTORY_DB_NAME: 'inventory_rm_tan',
    desc: 'Local (เครื่องเดียวกับ DB)',
  },
  tunnel: {
    INVENTORY_DB_PORT: '15432',
    INVENTORY_DB_NAME: 'inventory_rm_tan',
    desc: 'Cloudflare Tunnel (ทีม dev)',
  },
  test: {
    INVENTORY_DB_PORT: '15432',
    INVENTORY_DB_NAME: 'pddoc_dev',
    desc: 'เทส (pddoc_dev)',
  },
};

const envPath = path.join(__dirname, '..', '.env');
const mode = process.argv[2]?.toLowerCase();

if (!mode || !MODES[mode]) {
  console.log('การใช้งาน: node scripts/switch-db-mode.js <local|tunnel|test>\n');
  Object.entries(MODES).forEach(([k, v]) => console.log(`  ${k.padEnd(8)} - ${v.desc}`));
  process.exit(1);
}

let content = '';
try {
  content = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error('ไม่พบไฟล์ .env ที่ stockcard/.env');
  process.exit(1);
}

const cfg = MODES[mode];
content = content.replace(/INVENTORY_DB_PORT=.*/g, `INVENTORY_DB_PORT=${cfg.INVENTORY_DB_PORT}`);
content = content.replace(/INVENTORY_DB_NAME=.*/g, `INVENTORY_DB_NAME=${cfg.INVENTORY_DB_NAME}`);

fs.writeFileSync(envPath, content);
console.log(`✅ สลับเป็นโหมด: ${mode} (${cfg.desc})`);
console.log(`   PORT=${cfg.INVENTORY_DB_PORT}, DB=${cfg.INVENTORY_DB_NAME}`);
