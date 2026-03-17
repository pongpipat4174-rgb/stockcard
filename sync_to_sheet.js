// Sync consumable data from DB to Google Sheet
const API_URL = 'https://script.google.com/macros/s/AKfycbxJJ9U7BVR-e3764ibgPkgob49CR9KAQ3uoLL6MayumlfEsWDdQEQVCb89RotS3lSWKRg/exec';

async function syncToSheet() {
    console.log('Fetching data from DB...');
    const res = await fetch('http://localhost:4000/api/consumable/data');
    const d = await res.json();
    console.log(`Items: ${d.itemCount}, Transactions: ${d.transCount}`);

    const validItems = d.items.map(item => {
        const isRoll = item.category === 'unit';
        const stockPartial = isRoll ? 0 : (item.stockPartialKg || 0);
        let totalKg = 0, totalPcs = 0;
        const pcsPerPack = item.pcsPerPack || 1;
        const fgPcsPerCarton = item.fgPcsPerCarton || 1;

        if (isRoll) {
            totalPcs = item.stockCartons * (item.pcsPerRoll || 0);
        } else {
            totalKg = (item.stockCartons * item.kgPerCarton) + stockPartial;
            totalPcs = totalKg * item.pcsPerKg * pcsPerPack;
        }

        let fgYield = 0;
        if (isRoll && item.fgYieldPerRoll) {
            fgYield = item.stockCartons * item.fgYieldPerRoll;
        } else {
            fgYield = fgPcsPerCarton > 0 ? totalPcs / fgPcsPerCarton : 0;
        }

        return {
            'ชื่อสินค้า': item.name,
            'ประเภท': item.category || 'weight',
            'สต็อก (ลัง)': item.stockCartons,
            'เศษ(กก.)': stockPartial,
            'กก./ลัง': item.kgPerCarton,
            'รวม (กก.)': parseFloat(totalKg.toFixed(2)),
            'จุดสั่งซื้อ (กก.)': item.minThreshold,
            'ชิ้น/กก.': item.pcsPerKg,
            'รวมถุง (ชิ้น)': parseFloat(totalPcs.toFixed(0)),
            'ชิ้นงาน/ถุง': pcsPerPack,
            'ชิ้น FG/ลัง': fgPcsPerCarton,
            'ผลิตได้ (ชิ้น)': parseFloat(totalPcs.toFixed(0)),
            'ผลิตได้ (ลัง)': parseFloat(fgYield.toFixed(1)),
            'สถานะ': isRoll
                ? (item.stockCartons < item.minThreshold ? 'ต้องสั่งซื้อ' : 'ปกติ')
                : (totalKg < item.minThreshold ? 'ต้องสั่งซื้อ' : 'ปกติ'),
            'ความยาวม้วน (ม.)': item.rollLength || 0,
            'ความยาวตัด (มม.)': item.cutLength || 0,
            'ชิ้น/ม้วน': item.pcsPerRoll || 0,
            'Yield/ม้วน': item.fgYieldPerRoll || 0,
            'StockCode': item.stockCode || ''
        };
    });

    console.log(`\nFirst item: ${validItems[0]['ชื่อสินค้า']}`);
    console.log(`  สต็อก (ลัง): ${validItems[0]['สต็อก (ลัง)']}`);
    console.log(`  รวม (กก.): ${validItems[0]['รวม (กก.)']}`);
    console.log(`  ผลิตได้ (ชิ้น): ${validItems[0]['ผลิตได้ (ชิ้น)']}`);
    console.log(`  ผลิตได้ (ลัง): ${validItems[0]['ผลิตได้ (ลัง)']}`);

    const payload = {
        action: 'save_all',
        sheet: 'Consumable',
        items: validItems,
        transactions: []
    };

    console.log(`\nSending ${validItems.length} items to Google Sheet...`);
    
    // Google Apps Script redirects, need to follow manually
    const sheetRes = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain' },
        redirect: 'follow'
    });
    
    console.log('Response status:', sheetRes.status);
    const result = await sheetRes.text();
    console.log('Sheet response:', result);
}

syncToSheet().catch(e => console.error('Error:', e.message));
