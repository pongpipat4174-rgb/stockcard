# วิธีตั้งค่า GeneralStock Sync (Google Sheet → Postgres)

## ตัวเลือกที่ 1: ใช้ Google Sheet ที่มี tab GeneralStock + GeneralTrans

### ขั้นตอน

1. **สร้างหรือใช้ Google Sheet** ที่มี 2 tabs:
   - `GeneralStock` — รายการอะไหล่/อุปกรณ์
   - `GeneralTrans` — ประวัติการเบิกจ่าย

2. **โครงสร้าง tab GeneralStock** (แถว 1 = หัวคอลัมน์):

   | A | B | C | D | E | F | G | H | I | J | K | L |
   |---||---||---||---||---||---||---||---||---||---|
   | ID | Name | Spec | Category | Unit | Stock | Min | Price | Lead Time | Supplier | Country | Image |

3. **โครงสร้าง tab GeneralTrans**:

   | A | B | C | D | E | F | G | H | I |
   |---||---||---||---||---||---||---|---|
   | ID | ItemID | ItemName | Type | Qty | Date | Time | Note | Remaining |

4. **แชร์ Sheet** เป็น "Anyone with the link can view"

5. **ใส่ใน `.env`**:
   ```
   SHEET_GENERALSTOCK_ID=xxx
   ```
   (xxx = ID จาก URL เช่น `https://docs.google.com/spreadsheets/d/xxx/edit`)

---

## ตัวเลือกที่ 2: ใช้ tab GeneralStock จาก Package Sheet (โครงสร้าง Package)

ถ้าใช้ `SHEET_PACKAGE_ID` หรือ Sheet เดียวกับ Package ที่มี tab **GeneralStock** แต่โครงสร้างเป็นแบบ Package (date, productCode, productName, type, inQty, outQty, balance, ...) — sync จะแปลงอัตโนมัติ:

- สร้าง **items** จาก productCode ไม่ซ้ำ (stock = balance แถวล่าสุด)
- สร้าง **transactions** จากแต่ละแถว (itemId = productCode, type = IN/OUT ตาม type)

ใส่ใน `.env`:
```
SHEET_GENERALSTOCK_ID=xxx   # ชี้ไปที่ Package sheet
```

---

## ตัวเลือกที่ 3: ใช้ Google Apps Script

### ขั้นตอน

1. เปิด Google Sheet ที่มี tab GeneralStock และ GeneralTrans
2. ไปที่ **Extensions → Apps Script**
3. คัดลอกโค้ดจาก `GeneralStock/APPS_SCRIPT_CODE.txt` ไปวาง
4. **Deploy → New deployment → Web app**
   - Execute as: Me
   - Who has access: Anyone
5. คัดลอก URL ที่ได้ไปใส่ใน `.env`:
   ```
   APPS_SCRIPT_GENERALSTOCK=https://script.google.com/macros/s/xxx/exec
   ```

---

## ทดสอบ Sync

```bash
cd stockcard
node database/sync_from_sheets.js
```

ถ้าสำเร็จจะเห็น:
```
⚙️ === SYNC: GeneralStock ===
  📡 Loaded from Sheet (gviz): X items, Y transactions
  หรือ
  📡 Loaded from Sheet (Package format): X items, Y transactions
  ✅ Synced X items, Y transactions to gs_items/gs_transactions
```
