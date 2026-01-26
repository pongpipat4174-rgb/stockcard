
# วิธีอัปเดต Google Apps Script เพื่อบันทึกข้อมูลใหม่

เนื่องจากมีการเพิ่มช่องข้อมูลใหม่ (ราคา, Lead Time, รูปภาพ, Supplier, ประเทศ) 
**ท่านจำเป็นต้องอัปเดตโค้ดใน Google Apps Script และเพิ่มหัวตารางใน Google Sheet** ข้อมูลถึงจะถูกบันทึกลงชีตครับ

## 1. เพิ่มหัวตารางใน Google Sheet (Tab: GeneralStock)
กรุณาเพิ่มคอลัมน์ในแถวที่ 1 ให้ครบตามลำดับนี้:
- Column A: ID
- Column B: Name
- Column C: Spec
- Column D: Category
- Column E: Unit
- Column F: Stock
- Column G: Min
- **Column H: Price** (ใหม่)
- **Column I: Lead Time** (ใหม่)
- **Column J: Supplier** (ใหม่)
- **Column K: Country** (ใหม่)
- **Column L: Image** (ใหม่)

## 2. อัปเดตโค้ด Apps Script
1. ไปที่ Extensions > Apps Script ใน Google Sheet ของท่าน
2. คัดลอกโค้ดด้านล่างนี้ ไปแทนที่ส่วนที่บันทึกข้อมูล (หรือฟังก์ชัน `save_all`)

```javascript
// ตัวอย่างโค้ดส่วนที่ต้องแก้ไขใน Apps Script

if (requestData.action == 'save_all' && requestData.sheet == 'GeneralStock') {
   var sheet = ss.getSheetByName('GeneralStock');
   // ... code เดิมที่ใช้เคลียร์ข้อมูล ...
   if (sheet.getLastRow() > 1) {
       sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).clearContent();
   }

   var items = requestData.items;
   var rows = [];

   items.forEach(function(item) {
       rows.push([
           "'" + item.id, // ID ใส่ ' นำหน้าเพื่อให้เป็น Text
           item.name,
           item.spec,
           item.category,
           item.unit,
           item.stock,
           item.min,
           item.price || '',      // * ใหม่
           item.leadTime || '',   // * ใหม่
           item.supplier || '',   // * ใหม่
           item.country || '',    // * ใหม่
           item.image || ''       // * ใหม่
       ]);
   });

   if (rows.length > 0) {
       sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
   }
   
   // ... return success ...
}
```

## 3. การโหลดข้อมูล (Load)
ต้องตรวจสอบส่วน `load_all` ด้วยว่าอ่านข้อมูลครบทุกคอลัมน์ (A ถึง L)
```javascript
if (requestData.action == 'load_all' && requestData.sheet == 'GeneralStock') {
    // อ่านข้อมูลถึงคอลัมน์ L (12 คอลัมน์)
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues(); 
    var items = data.map(function(row) {
        return {
            id: row[0],
            name: row[1],
            spec: row[2],
            category: row[3],
            unit: row[4],
            stock: row[5],
            min: row[6],
            price: row[7],     // * ใหม่
            leadTime: row[8],  // * ใหม่
            supplier: row[9],  // * ใหม่
            country: row[10],  // * ใหม่
            image: row[11]     // * ใหม่
        };
    });
    // ...
}
```

ขออภัยในความไม่สะดวกครับ ระบบฝั่ง Server ของ Google จำเป็นต้องมีการแก้ไขโค้ดด้วยตนเองเพื่อรองรับฟิลด์ข้อมูลใหม่ครับ ✨
