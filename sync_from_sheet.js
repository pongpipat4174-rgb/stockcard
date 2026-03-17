// Sync data FROM Google Sheet back TO DB
// ดึงค่าจาก Sheet แล้วอัปเดตเข้า DB

const SHEET_API = 'https://script.google.com/macros/s/AKfycbxJJ9U7BVR-e3764ibgPkgob49CR9KAQ3uoLL6MayumlfEsWDdQEQVCb89RotS3lSWKRg/exec';
const DB_API = 'http://localhost:4000/api/consumable';

async function syncFromSheet() {
    // 1. Fetch data from Google Sheet
    console.log('📥 Fetching data from Google Sheet...');
    const sheetRes = await fetch(`${SHEET_API}?action=load_all&sheet=Consumable&t=${Date.now()}`);
    const sheetData = await sheetRes.json();
    
    console.log(`   Found ${sheetData.items?.length || 0} items, ${sheetData.transactions?.length || 0} transactions`);

    if (!sheetData.items || sheetData.items.length === 0) {
        console.error('❌ No items found in sheet!');
        return;
    }

    // 2. Map Thai header keys to DB format
    const mappedItems = sheetData.items.map(row => {
        const category = row['ประเภท'] || 'weight';
        
        return {
            name: row['ชื่อสินค้า'],
            category: category,
            stockCartons: parseFloat(row['สต็อก (ลัง)']) || 0,
            stockPartialKg: parseFloat(row['เศษ(กก.)']) || 0,
            kgPerCarton: parseFloat(row['กก./ลัง']) || 25,
            pcsPerKg: parseFloat(row['ชิ้น/กก.']) || 0,
            minThreshold: parseFloat(row['จุดสั่งซื้อ (กก.)']) || 0,
            pcsPerPack: parseFloat(row['ชิ้นงาน/ถุง']) || 1,
            fgPcsPerCarton: parseFloat(row['ชิ้น FG/ลัง']) || 1,
            rollLength: parseFloat(row['ความยาวม้วน (ม.)']) || 0,
            cutLength: parseFloat(row['ความยาวตัด (มม.)']) || 0,
            pcsPerRoll: parseFloat(row['ชิ้น/ม้วน']) || 0,
            fgYieldPerRoll: parseFloat(row['Yield/ม้วน']) || 0,
            stockCode: row['StockCode'] || ''
        };
    });

    // 3. Map transactions
    const mappedTrans = (sheetData.transactions || []).map(row => ({
        id: String(row['ID'] || Date.now()),
        itemIndex: row['ItemIndex'] || 0,
        itemName: row['ชื่อสินค้า'] || '',
        date: row['วันที่'] || '',
        time: row['เวลา'] || '',
        type: row['ประเภท'] || '',
        qtyKg: parseFloat(row['จำนวน (กก.)']) || 0,
        qtyCartons: parseFloat(row['จำนวน (ลัง)']) || 0,
        qtyUnit: parseFloat(row['จำนวน (ลัง)']) || 0,
        remainingStock: parseFloat(row['คงเหลือ (ลัง)']) || 0,
        note: row['หมายเหตุ'] || ''
    }));

    // 4. Print summary before saving
    console.log('\n📊 Items to save:');
    mappedItems.forEach((item, i) => {
        const isRoll = item.category === 'unit';
        const stockLabel = isRoll ? 'ม้วน' : 'ลัง';
        console.log(`   ${i + 1}. ${item.name} → stockCartons: ${item.stockCartons} ${stockLabel}`);
    });

    // 5. Save to DB
    console.log(`\n💾 Saving ${mappedItems.length} items + ${mappedTrans.length} transactions to DB...`);
    const saveRes = await fetch(`${DB_API}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: mappedItems,
            transactions: mappedTrans
        })
    });

    const result = await saveRes.json();
    if (result.success) {
        console.log(`✅ Sync complete! Saved ${result.itemCount} items, ${result.transCount} transactions`);
    } else {
        console.error('❌ Save failed:', result);
    }

    // 6. Verify by reading back
    console.log('\n🔍 Verifying saved data...');
    const verifyRes = await fetch(`${DB_API}/data`);
    const verifyData = await verifyRes.json();
    
    console.log(`   DB now has: ${verifyData.items?.length || 0} items`);
    verifyData.items?.filter(i => i.category === 'unit').forEach(item => {
        console.log(`   ✓ ${item.name}: stockCartons = ${item.stockCartons}`);
    });
}

syncFromSheet().catch(e => console.error('Fatal:', e.message));
