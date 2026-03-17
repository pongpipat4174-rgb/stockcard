## แผนงานรอบนี้: ตรวจและแก้ระบบบันทึกทุกโมดูล

### เป้าหมาย
- ให้ค่าที่แสดงใน UX/UI มาจาก `PostgreSQL` เป็นหลัก
- ให้ทุก flow ที่เป็นการ `บันทึก / แก้ไข / ลบ` เขียนทั้ง `PostgreSQL` และ `Google Sheet`
- ให้ fallback มีพฤติกรรมสอดคล้องกันทุกโมดูล และไม่ทำให้ UI ไปแสดงค่าที่ไม่ตรงกับ DB

### สิ่งที่พบก่อนเริ่มแก้
- `Package` และ `RM` โหลดจาก DB ได้ แต่บาง flow `delete` ยังเช็ก `if (DB_API_BASE)` ทั้งที่ค่าปัจจุบันเป็น `''` ทำให้ไม่ยิง DB
- `RM` ฝั่ง `save` ถูกแก้แล้วที่ `/api/rm/save` แต่ยังต้องตรวจ `delete / reload / transfer` ทั้ง flow ให้ครบ
- `Package` ฝั่ง save เป็น dual-write อยู่แล้ว แต่ต้องยืนยันว่า `delete` ยิงทั้ง DB และ Sheet ได้จริง และ `action` ฝั่ง Sheet ตรงกัน
- `Consumable` ใช้ `DB + Sheet` แบบ full replace ใน `saveData()` แต่ยังต้องตรวจ flow `edit/delete transaction` ให้แน่ใจว่าผลสุดท้ายใน UI อ้างอิง DB จริง
- `GeneralStock` ตอนนี้หลัก ๆ ยังเป็น `DB + localStorage fallback` ไม่ใช่ `DB + Google Sheet` ตามหลักที่ต้องการ
- `/api/config` ตอนนี้ยังส่งแค่ `apiBase` จึงอาจต้องเติม config เพิ่ม หากจะทำให้ `GeneralStock` dual-write ไป `Google Sheet`

### Todo List
- [x] 1. ตรวจและแก้ `Package` ให้ flow `load/save/delete` ทำงานแบบ DB + Sheet ครบ
- [x] 2. ตรวจและแก้ `RM Center / RM Production` ให้ flow `save/delete/reload/transfer` สอดคล้องกันครบ
- [x] 3. ตรวจและแก้ `Consumable` ให้ flow `load/save/edit/delete transaction` จบที่ DB จริง และ sync Sheet ถูกต้อง
- [x] 4. ตรวจและแก้ `GeneralStock` ให้ flow `load/save/edit/delete` สอดคล้องกับหลัก DB + Sheet
- [x] 5. แก้จุดกลางที่ทำให้บาง flow ไม่ยิง DB เช่น `DB_API_BASE`, path API, action name และ config ที่เกี่ยวข้อง
- [x] 6. ตรวจ logic หลังแก้ทุกโมดูลแบบรวมอีกครั้ง ว่าค่าที่ UI เห็นตรงกับ DB
- [x] 7. เพิ่ม `Review` สรุปสิ่งที่แก้และข้อควรทราบลง `tasks/todo.md` และ `tasks/todoPP.md`

### สถานะ
- แก้โค้ดจริงครบตามแผนรอบนี้แล้ว
- ตรวจ linter แล้วไม่พบ error ในไฟล์ที่แก้
- ทดสอบรัน `server.js` แบบ smoke test ไม่ได้ในเครื่องนี้ เพราะ dependency บางตัวในโฟลเดอร์ `stockcard` ยังไม่ถูกติดตั้ง

### Review - แก้ระบบบันทึกทุกโมดูล (17 มี.ค. 2026)

#### สิ่งที่แก้
- **Package**
  - ให้ `fetchPackageData()` ใช้ข้อมูลจาก DB ได้แม้ result เป็น array ว่าง
  - แก้ `deleteEntry()` ให้ยิง `/api/package/delete` จริง
  - ฝั่ง `server.js` เพิ่มการคำนวณ `row_index` และ `balance` ตอน save
  - ฝั่ง `server.js` เพิ่ม recalc `balance` และจัดเรียง `row_index` ใหม่หลัง delete
- **RM Center / RM Production**
  - ให้ `fetchRMData()` ใช้ข้อมูลจาก DB ได้แม้ result เป็น array ว่าง
  - แก้ `deleteEntryRM()` ให้ยิง `/api/rm/delete` จริง
  - ปรับ `/api/rm/save` ให้ row ใหม่เริ่มสอดคล้องกับ row data จริงมากขึ้น
  - เพิ่ม recalc `balance`, `lot_balance`, `days_left`, `row_index` หลัง delete
- **Consumable**
  - ให้หน้าโหลดข้อมูลจาก DB แม้ DB จะยังว่าง โดยไม่ fallback ไป Sheet ทันที
- **GeneralStock**
  - เพิ่ม `appsScriptGeneralStock` ใน `/api/config`
  - เพิ่ม `syncGeneralStockToSheet()` ใน `GeneralStock/script.js`
  - หลัง save/edit/delete item และ transaction จะ sync full dataset ไป Google Sheet ด้วย `save_all`

#### ผลลัพธ์ที่ต้องการหลังแก้
- ค่าที่หน้า UX/UI แสดง จะยึด `PostgreSQL` เป็นหลักมากขึ้นทุกโมดูล
- การบันทึกข้อมูลสำคัญในแอป จะเขียน `PostgreSQL` และ `Google Sheet` ควบคู่กันครบขึ้น
- การลบข้อมูลใน `Package/RM` จะไม่ทิ้งค่า `balance` และ `row_index` เพี้ยนใน DB เหมือนเดิม

#### ข้อควรทราบ
- ฝั่ง `GeneralStock` ใช้ sync แบบ `save_all` ไปยัง Apps Script ดังนั้น Apps Script ปลายทางต้องรองรับ action นี้ตามไฟล์ `GeneralStock/APPS_SCRIPT_CODE.txt`
- ถ้า production ยังใช้ Apps Script คนละเวอร์ชัน บาง action ฝั่ง Sheet อาจยังต้องอัปเดตตามเอกสารใน repo

# Stockcard - แก้ไขปัญหา "ข้อมูลไม่แสดง/ไม่อัพเดต"

## สรุปการวิเคราะห์

### โครงสร้างระบบ
- **Server**: Express (port 3001) อ่าน/เขียน PostgreSQL
- **Frontend**: app.js โหลดข้อมูลจาก DB API ก่อน → ถ้า DB ว่าง/error จะ fallback ไป Google Sheets
- **โมดูล**: Package, RM Center, RM Production, Consumable, GeneralStock (อะไหล่)

### สาเหตุที่พบ (หลายจุด)

| # | ปัญหา | รายละเอียด |
|---|-------|------------|
| 1 | **DB_API_BASE = ''** | เมื่อเป็น empty string → `if (DB_API_BASE)` เป็น false → **ไม่มีการบันทึก/ลบลง DB เลย** แม้โหลดจาก DB ได้ |
| 2 | **API path ไม่ตรง** | app.js ใช้ `/package/add`, `/package/delete` แต่ server มี `/api/package/save`, `/api/package/delete` |
| 3 | **DB ว่าง** | ถ้าไม่เคยรัน `sync_from_sheets.js` หรือ .env ไม่มี SHEET_* → DB จะว่าง → fallback ไป Sheet |
| 4 | **เงื่อนไขโหลดเข้มงวด** | ใช้ DB เฉพาะเมื่อ `dbResult.data.length > 0` ถ้า DB ว่างจะไปใช้ Sheet ทันที |

---

## Todo List

- [x] 1. แก้ DB_API_BASE ให้ใช้ DB ได้เมื่อเปิดผ่าน server (ใช้ `/api`)
- [x] 2. แก้ path และ body ของ save/delete ใน app.js ให้ตรงกับ server
- [x] 3. เพิ่ม RM save ลง DB (เดิมข้ามไว้เพราะ route ไม่มี)
- [ ] 4. (แนะนำ) รัน `node database/sync_from_sheets.js` เพื่อ sync ข้อมูลจาก Sheet เข้า DB ครั้งแรก
- [x] 5. แก้ วัสดุสิ้นเปลือง (Consumable) — โหลดจาก DB แม้ items ว่าง + ป้องกัน cache
- [x] 6. แก้ อะไหล่ & อุปกรณ์ (GeneralStock) — ป้องกัน cache

---

## Review (หลังแก้ไข)

### สิ่งที่แก้ไข
1. **DB_API_BASE** — เปลี่ยนจาก `''` เป็น `'/api'` เมื่อเปิดผ่าน browser เพื่อให้ `if (DB_API_BASE)` เป็น true และมีการบันทึก/ลบลง DB
2. **Package save** — เปลี่ยน path จาก `/package/add` เป็น `/package/save` และส่ง body รูปแบบที่ server ต้องการ (flat object + rowIndex)
3. **Package delete** — path ถูกต้องแล้ว (`/package/delete`)
4. **RM delete** — path ถูกต้องแล้ว (`/rm/delete`)
5. **RM save** — เพิ่มการบันทึกลง DB (เดิมข้ามไว้) ใช้ `/rm/save` พร้อม body ที่ตรงกับ server

### หมายเหตุสำคัญ
- **ต้องเปิดผ่าน server** เช่น `http://localhost:3001` ไม่ใช่เปิดไฟล์ HTML โดยตรง
- **แนะนำรัน sync ก่อน** — ถ้า DB ยังว่าง ให้รัน `node database/sync_from_sheets.js` เพื่อดึงข้อมูลจาก Google Sheets เข้า DB (ต้องตั้งค่า SHEET_* ใน .env ก่อน)

### แก้ไขเพิ่มเติม (วัสดุสิ้นเปลือง + อะไหล่ & อุปกรณ์)
- **Consumable**: เปลี่ยนเงื่อนไขโหลดจาก `items.length > 0` เป็น `items !== undefined` เพื่อใช้ DB แม้ข้อมูลว่าง + เพิ่ม `cache: 'no-store'` และ `?t=timestamp` ป้องกัน cache
- **GeneralStock**: เพิ่ม `cache: 'no-store'` และ `?t=timestamp` ใน fetch items/transactions/config เพื่อให้ได้ข้อมูลล่าสุด

### Search แบบ Slicer (มี.ค. 2026)
- **buildSearchSuggestions**: สร้างรายการจากข้อมูลในระบบ (productMasterData, rmProductMasterData, stockData, rmStockData)
- **Dropdown Slicer**: กด focus หรือพิมพ์ → แสดงเฉพาะสินค้า / Lot No. / เลขที่เอกสาร / Supplier ที่มีในระบบ
- **เลือกจาก dropdown**: คลิกเลือกรายการ → กรองผลลัพธ์ทันที

### แก้ไข Log / แจ้งเตือนเมื่อทำอะไรไม่ได้ (มี.ค. 2026)
- **showErrorToast**: แจ้งเตือนสีแดงเมื่อเกิด error (เด้งมุมขวาล่าง 5 วินาที)
- **logStatus**: บันทึก log ทุก action (success/error/warn) เก็บไว้ใน statusLog
- **ปุ่ม Log**: กดเปิด panel มุมซ้ายล่าง ดู log ล่าสุด 20 รายการ
- **อัปเดต catch blocks**: บันทึก, ลบ, โหลด, โอน, Smart เบิก, Recalculate — ใช้ logStatus + showErrorToast แทน alert

### แก้ไข Search ช้า + กดบันทึกไม่ได้ (มี.ค. 2026)
- **Search ช้า**: เพิ่ม `debounce(handleSearch, 250)` แทนการเรียก handleSearch ทุก keystroke — ลดการประมวลผลซ้ำเมื่อพิมพ์
- **กดบันทึกไม่ได้**: เรียก `hideLoading()` เมื่อเปิด modal เพิ่มรายการ — ป้องกัน loading overlay ค้างบังปุ่ม

### ทำให้ทุกโมดูลเหมือนกัน (Load: Postgres → Sheet fallback | Save: Postgres + Sheet)
- **Server**: เพิ่ม `appsScriptGeneralStock` ใน `/api/config` (อ่านจาก APPS_SCRIPT_GENERALSTOCK ใน .env)
- **GeneralStock**: เพิ่ม load fallback ไป Google Apps Script เมื่อ DB ว่าง/error + เพิ่ม save dual-write ไป Sheet หลังทุกการบันทึก
- **.env.example**: เพิ่ม APPS_SCRIPT_GENERALSTOCK
