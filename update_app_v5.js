const fs = require('fs');
const path = 'd:\\TANLAB\\Stockcard\\app.js';

try {
    let content = fs.readFileSync(path, 'utf8');

    // โค้ดฟังก์ชันลบแบบใหม่: ส่ง item ทั้งก้อนไปหา Backend
    const newDeleteFunction = `
// ฟังก์ชันสำหรับลบรายการ (แบบค้นหาและลบ V.5)
async function deleteEntry(rowIndex) { 
    // หมายเหตุ: rowIndex ในที่นี้เราจะรื้อทิ้ง แต่ชื่อตัวแปรรับเข้ามาอาจจะเป็น index
    // แต่จริงๆ เราต้องการ object data. ดังนั้นเราต้องแก้ที่คนเรียก (renderStockCards) ด้วย
    // หรือ... เราไปดึงข้อมูลจาก stockData โดยใช้ rowIndex ที่รับมา (ถ้ามันเป็น index ของ array)
    
    // เพื่อความง่ายและไม่ต้องแก้ renderStockCards เยอะ 
    // เราจะสมมติว่า rowIndex ที่ส่งมา คือ index ใน array stockData ของเรา
    // *แต่* ใน renderStockCards ปัจจุบันส่ง d.rowIndex (ซึ่งมาจาก sheet)
    
    // งั้นเราขอแก้ renderStockCards ให้ส่ง 'item' ไปเลยดีกว่า แต่แก้ HTML string ยาก
    
    // เอาแบบนี้: เราจะใช้ deleteEntry รับ rowIndex เหมือนเดิม
    // แล้วเราจะวนหาใน stockData ว่าตัวไหนมี .rowIndex ตรงกับที่ส่งมา
    // แล้วเอาข้อมูลตัวนั้นส่งไปลบ
    
    const targetItem = stockData.find(d => d.rowIndex === rowIndex);
    
    if (!targetItem) {
        alert('ไม่พบข้อมูลรายการนี้ในหน่วยความจำ (ลองรีเฟรชหน้าเว็บ)');
        return;
    }

    if (!confirm(\`ยืนยันการลบรายการนี้?\\nสินค้า: \${targetItem.productCode}\\nรายการ: \${targetItem.type}\\nคงเหลือ: \${targetItem.balance}\`)) {
        return;
    }

    try {
        if (typeof showToast === 'function') showToast('กำลังค้นหาและลบรายการ...');
        
        // ส่งข้อมูลสำคัญไประบุตัวตน
        const criteria = {
            date: targetItem.date,
            productCode: targetItem.productCode,
            type: targetItem.type,
            balance: targetItem.balance,
            remark: targetItem.remark,
            rowHint: rowIndex // ส่งไปเป็นไกด์ไลน์เฉยๆ
        };

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'delete_v5',  // ใช้ action ใหม่
                criteria: criteria 
            })
        });

        setTimeout(async () => {
            if (typeof showToast === 'function') showToast('ส่งคำสั่งลบแล้ว กรุณารอระบบอัปเดต...');
            // รอเพิ่มอีกหน่อยเพื่อให้ Backend หาเจอและลบ
            setTimeout(async () => {
                 if (typeof init === 'function') await init(); 
                 else location.reload();
            }, 1000);
        }, 2000);

    } catch (error) {
        console.error(error);
        alert('Error: ' + error.message);
    }
}
`;

    // 1. Replace function deleteEntry
    // Find start of function deleteEntry
    const regex = /async function deleteEntry\(rowIndex\) \{([\s\S]*?)\n\}/;

    if (regex.test(content)) {
        content = content.replace(regex, newDeleteFunction.trim());
        fs.writeFileSync(path, content, 'utf8');
        console.log("Updated app.js with V5 delete logic.");
    } else {
        console.log("Could not find deleteEntry function to replace.");
    }

} catch (e) {
    console.error(e);
}
