/**
 * ลบ row จาก Google Sheet ผ่าน Apps Script
 * ใช้ rowIndex 2090 (LIW-R-023-AMP 18/03/2026)
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyFUoMhdUiCHJtwKAuDdCw29uM3205tQ5LikrW3HcX1MMwARhZtXPISjmjG4fR6Y6Jy/exec';

async function main() {
    // ก่อนอื่น ตรวจสอบว่า row 2090 ยังอยู่ใน Sheet ไหม
    const sheetId = '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs';
    const ts = Date.now();
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=Sheet1&tq=SELECT%20*&_=${ts}`;
    
    console.log('Fetching Sheet data...');
    const resp = await fetch(url);
    const text = await resp.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
    const json = JSON.parse(match[1]);
    const rows = json.table.rows;
    
    console.log(`Total rows in Sheet: ${rows.length}`);
    
    // ดู rows ล่าสุด
    console.log('\n=== Last 5 rows in Sheet ===');
    for (let i = Math.max(0, rows.length - 5); i < rows.length; i++) {
        const c = rows[i].c;
        const date = c[0]?.f || c[0]?.v || '';
        const code = c[1]?.v || '';
        const type = c[3]?.v || '';
        const inQty = c[7]?.v || 0;
        console.log(`  Row ${i + 2}: ${date} | ${code} | ${type} | in:${inQty}`);
    }
    
    // ค้นหา row ที่ตรงกับ LIW-R-023-AMP 18/03/2026 in:450
    console.log('\n=== Searching for LIW-R-023-AMP 18/03/2026 ===');
    let targetRowIndex = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
        const c = rows[i].c;
        const date = c[0]?.f || c[0]?.v || '';
        const code = c[1]?.v || '';
        const inQty = parseFloat(c[7]?.v) || 0;
        if (code === 'LIW-R-023-AMP' && date.includes('18') && date.includes('3') && inQty === 450) {
            targetRowIndex = i + 2; // +2 for header + 0-index
            console.log(`  FOUND at Sheet Row ${targetRowIndex}: ${date} | ${code} | in:${inQty}`);
            break;
        }
    }
    
    if (targetRowIndex === -1) {
        console.log('  ❌ ไม่พบ record นี้ใน Sheet แล้ว (อาจถูกลบไปแล้ว)');
        return;
    }
    
    // ลบจาก Sheet ผ่าน Apps Script
    console.log(`\n🗑️ Sending delete request to Apps Script for Row ${targetRowIndex}...`);
    const deleteResp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_rm',
            spreadsheetId: sheetId,
            sheetName: 'Sheet1',
            rowIndex: targetRowIndex,
            criteria: { productCode: 'LIW-R-023-AMP', type: 'รับเข้า' }
        }),
        redirect: 'follow'
    });
    
    // Apps Script might redirect
    const resultText = await deleteResp.text();
    console.log('Response status:', deleteResp.status);
    console.log('Response:', resultText.substring(0, 500));
}

main().catch(e => console.error('Error:', e.message));
