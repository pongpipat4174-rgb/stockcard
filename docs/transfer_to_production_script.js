/**
 * ===== Apps Script สำหรับโอนข้อมูลจาก Center ไป Production =====
 * 
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheets ไฟล์ RM (สต็อคการ์ด สาร Center จ้า)
 * 2. ไปที่ Extensions > Apps Script
 * 3. ค้นหา function ที่ชื่อ doGet หรือ doPost ที่มีอยู่แล้ว
 * 4. เพิ่มโค้ดด้านล่างนี้ลงไปใน Apps Script เดิม (ต่อท้าย)
 * 5. กด Deploy > New deployment หรือ Deploy > Manage deployments > สร้างเวอร์ชันใหม่
 * 6. คัดลอก URL ใหม่ (ถ้า Deploy ใหม่)
 */

// ===== เพิ่มโค้ดนี้ใน doPost function (หรือสร้างใหม่ถ้าไม่มี) =====

/**
 * โอนข้อมูลจาก Center ไป Production
 * action: 'transferToProduction'
 * data: array ของ objects ที่ต้องการโอน
 */
function transferToProduction(dataArray) {
    try {
        // เปิด Spreadsheet
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var productionSheet = ss.getSheetByName('Production');

        if (!productionSheet) {
            return { success: false, message: 'ไม่พบชีต Production' };
        }

        var transferredCount = 0;
        var errors = [];

        // วนลูปเพิ่มข้อมูลแต่ละรายการ
        for (var i = 0; i < dataArray.length; i++) {
            var item = dataArray[i];

            try {
                // สร้าง row ใหม่สำหรับ Production (รับเข้า)
                var newRow = [
                    item.transferDate || new Date(),  // A: วันที่ (วันที่โอน)
                    item.productCode || '',           // B: รหัสสินค้า
                    item.productName || '',           // C: ชื่อสินค้า
                    'รับเข้า (โอนจาก Center)',       // D: ประเภทรายการ
                    item.containerQty || 0,           // E: จำนวน Container
                    item.containerWeight || 0,        // F: น้ำหนัก Container
                    item.remainder || 0,              // G: เศษ
                    item.quantity || 0,               // H: IN (จำนวนที่รับเข้า = จำนวนที่เบิกออกจาก Center)
                    0,                                // I: OUT
                    item.quantity || 0,               // J: Balance (จะถูกคำนวณใหม่)
                    item.lotNo || '',                 // K: Lot No.
                    item.vendorLot || '',             // L: Vendor Lot
                    item.mfgDate || '',               // M: MFD
                    item.expDate || '',               // N: EXP
                    item.daysLeft || '',              // O: Days Left
                    item.quantity || 0,               // P: Lot Balance
                    item.supplier || '',              // Q: Supplier
                    'โอนจาก Center: ' + (item.originalDate || '') + ' | Lot: ' + (item.lotNo || ''), // R: หมายเหตุ
                    item.containerOut || 0            // S: ถังที่เบิก (ถ้ามี)
                ];

                // เพิ่ม row ใหม่
                productionSheet.appendRow(newRow);
                transferredCount++;

            } catch (rowError) {
                errors.push('รายการ ' + (i + 1) + ': ' + rowError.message);
            }
        }

        // สรุปผล
        if (errors.length > 0) {
            return {
                success: true,
                message: 'โอนสำเร็จ ' + transferredCount + ' รายการ (มีข้อผิดพลาด ' + errors.length + ' รายการ)',
                transferredCount: transferredCount,
                errors: errors
            };
        }

        return {
            success: true,
            message: 'โอนข้อมูลสำเร็จทั้งหมด ' + transferredCount + ' รายการ',
            transferredCount: transferredCount
        };

    } catch (error) {
        return {
            success: false,
            message: 'เกิดข้อผิดพลาด: ' + error.message
        };
    }
}


// ===== แก้ไข doPost function เดิมให้รองรับ action ใหม่ =====
// หา doPost function ที่มีอยู่แล้ว แล้วเพิ่ม case นี้ลงไป:

/*
  // ใน doPost function, เพิ่ม case นี้:
  
  if (action === 'transferToProduction') {
    var dataArray = params.data;
    if (typeof dataArray === 'string') {
      dataArray = JSON.parse(dataArray);
    }
    result = transferToProduction(dataArray);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
*/


// ===== ตัวอย่าง doPost function แบบเต็ม (ถ้าต้องการอ้างอิง) =====

function doPost(e) {
    try {
        var params = JSON.parse(e.postData.contents);
        var action = params.action;
        var result = { success: false, message: 'Unknown action' };

        // ===== Action: โอนข้อมูลไป Production =====
        if (action === 'transferToProduction') {
            var dataArray = params.data;
            if (typeof dataArray === 'string') {
                dataArray = JSON.parse(dataArray);
            }
            result = transferToProduction(dataArray);
            return ContentService.createTextOutput(JSON.stringify(result))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // ===== เพิ่ม actions อื่นๆ ที่มีอยู่เดิมที่นี่ =====
        // ... (โค้ดเดิมของคุณ)

        return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
