# การตั้งค่า Database (stockcard)

## แหล่งเดียว: แก้แค่ stockcard/.env

ทุก script โหลดจาก **stockcard/.env** เท่านั้น — แก้ไฟล์เดียวก็พอ

---

## สลับโหมดผ่านหน้าเว็บ

กดปุ่ม **ตั้งค่า** (ไอคอนเฟือง) ที่ header → เลือก Local / Tunnel / เทส  
**หมายเหตุ:** สลับแล้วต้อง restart server จึงจะมีผล

---

## สลับโหมดด้วยสคริปต์

```bash
node scripts/switch-db-mode.js local   # Local (port 5432)
node scripts/switch-db-mode.js tunnel # Cloudflare Tunnel (port 15432)
node scripts/switch-db-mode.js test   # เทส pddoc_dev (port 15432)
```

---

## โหมดการใช้งาน

| โหมด | Port | DB |
|------|------|-----|
| local | 5432 | inventory_rm_tan |
| tunnel | 15432 | inventory_rm_tan |
| test | 15432 | pddoc_dev |

---

## ความปลอดภัย (Admin API)

ถ้าเพิ่ม `ADMIN_SECRET=รหัสลับ` ใน .env การเรียก API ตั้งค่า DB ต้องส่ง header `X-Admin-Token: รหัสลับ`
