/**
 * ===================================================================
 * Stock Card Web App - Apps Script (Complete Version)
 * ===================================================================
 * 
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheets ไฟล์ RM (สต็อคการ์ด สาร Center จ้า)
 * 2. ไปที่ Extensions > Apps Script
 * 3. ลบโค้ดเก่าทั้งหมด แล้ววางโค้ดนี้แทน
 * 4. กด Save (Ctrl+S)
 * 5. กด Deploy > New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. กด Deploy แล้วคัดลอก URL ที่ได้
 * 7. นำ URL ไปใส่ใน app.js ตรง APPS_SCRIPT_URL
 * 
 * ===================================================================
 */

// ==================== GET REQUEST ====================

function doGet(e) {
    var action = e.parameter.action;

    // Get RM Master Data
    if (action === 'getRMMaster') {
        return getRMMasterData();
    }

    // Default response
    return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Unknown GET action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);
}


// ==================== POST REQUEST ====================

function doPost(e) {
    try {
        var params = JSON.parse(e.postData.contents);
        var action = params.action;
        var result = { success: false, message: 'Unknown action' };

        // ===== ADD PACKAGE =====
        if (action === 'add') {
            result = addPackageEntry(params);
        }

        // ===== ADD RM =====
        else if (action === 'add_rm') {
            result = addRMEntry(params);
        }

        // ===== DELETE PACKAGE =====
        else if (action === 'delete_force') {
            result = deletePackageEntry(params);
        }

        // ===== DELETE RM =====
        else if (action === 'delete_rm') {
            result = deleteRMEntry(params);
        }

        // ===== RECALCULATE RM =====
        else if (action === 'recalculate_rm') {
            result = recalculateRMBalances(params);
        }

        // ===== TRANSFER TO PRODUCTION =====
        else if (action === 'transferToProduction') {
            var dataArray = params.data;
            if (typeof dataArray === 'string') {
                dataArray = JSON.parse(dataArray);
            }
            result = transferToProduction(dataArray);
        }

        return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'Error: ' + error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== GET RM MASTER DATA ====================

function getRMMasterData() {
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        // ใช้ชีต RawMaterial ที่มีอยู่แล้ว (หรือ Master ถ้ามี)
        var masterSheet = ss.getSheetByName('RawMaterial') || ss.getSheetByName('Master');

        if (!masterSheet) {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'RawMaterial or Master sheet not found'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var data = masterSheet.getDataRange().getValues();
        var masterData = [];

        // RawMaterial columns: A=Product Code1, B=Product Name, C=โรงงานผลิต (Supplier)
        for (var i = 1; i < data.length; i++) {
            var row = data[i];
            if (row[0]) { // Check if has product code
                masterData.push({
                    code: row[0] || '',      // Column A: Product Code1
                    name: row[1] || '',       // Column B: Product Name
                    supplier: row[2] || ''    // Column C: โรงงานผลิต
                });
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            data: masterData
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== ADD PACKAGE ENTRY ====================

function addPackageEntry(params) {
    try {
        var ss = SpreadsheetApp.openById(params.spreadsheetId);
        var sheet = ss.getSheetByName(params.sheetName);

        if (!sheet) {
            return { success: false, message: 'Sheet not found: ' + params.sheetName };
        }

        var entry = params.entry;

        // Package columns: Date, ProductCode, ProductName, Type, InQty, OutQty, Balance, LotNo
        var newRow = [
            entry.date,
            entry.productCode,
            entry.productName,
            entry.type,
            entry.inQty || 0,
            entry.outQty || 0,
            0, // Balance will be calculated
            entry.lotNo || ''
        ];

        sheet.appendRow(newRow);

        // Calculate balance
        calculatePackageBalance(sheet, entry.productCode);

        return { success: true, message: 'Entry added successfully' };

    } catch (error) {
        return { success: false, message: error.message };
    }
}

function calculatePackageBalance(sheet, productCode) {
    var data = sheet.getDataRange().getValues();
    var balance = 0;

    for (var i = 1; i < data.length; i++) {
        if (data[i][1] === productCode) { // Column B = ProductCode
            balance += (parseFloat(data[i][4]) || 0) - (parseFloat(data[i][5]) || 0); // In - Out
            sheet.getRange(i + 1, 7).setValue(balance); // Column G = Balance
        }
    }
}


// ==================== ADD RM ENTRY ====================

function addRMEntry(params) {
    try {
        var ss = SpreadsheetApp.openById(params.spreadsheetId);
        var sheet = ss.getSheetByName(params.sheetName);

        if (!sheet) {
            return { success: false, message: 'Sheet not found: ' + params.sheetName };
        }

        var entry = params.entry;

        // RM columns: A-วันที่, B-รหัส, C-ชื่อ, D-รายการ, E-จำนวนCont, F-นน.Cont, G-เศษ, 
        //             H-IN, I-OUT, J-Balance, K-LotNo, L-VendorLot, M-MFD, N-EXP, 
        //             O-DaysLeft, P-LotBalance, Q-Supplier, R-หมายเหตุ, S-ถังเบิก
        var newRow = [
            entry.date,                          // A: วันที่
            entry.productCode,                   // B: รหัส
            entry.productName,                   // C: ชื่อ
            entry.type,                          // D: รายการ
            entry.containerQty || 0,             // E: จำนวน Container
            entry.containerWeight || 0,          // F: น้ำหนัก Container
            entry.remainder || 0,                // G: เศษ
            entry.inQty || 0,                    // H: IN
            entry.outQty || 0,                   // I: OUT
            0,                                   // J: Balance (จะคำนวณใหม่)
            entry.lotNo || '',                   // K: Lot No.
            entry.vendorLot || '',               // L: Vendor Lot
            entry.mfgDate || '',                 // M: MFD
            entry.expDate || '',                 // N: EXP
            '',                                  // O: Days Left (สูตร)
            0,                                   // P: Lot Balance (จะคำนวณใหม่)
            entry.supplier || '',                // Q: Supplier
            entry.remark || '',                  // R: หมายเหตุ
            entry.containerOut || 0              // S: ถังที่เบิก
        ];

        sheet.appendRow(newRow);

        // Calculate balances
        calculateRMBalance(sheet, entry.productCode);
        calculateRMLotBalance(sheet, entry.productCode, entry.lotNo);

        return { success: true, message: 'RM Entry added successfully' };

    } catch (error) {
        return { success: false, message: error.message };
    }
}

function calculateRMBalance(sheet, productCode) {
    var data = sheet.getDataRange().getValues();
    var balance = 0;

    for (var i = 1; i < data.length; i++) {
        if (data[i][1] === productCode) { // Column B = ProductCode
            balance += (parseFloat(data[i][7]) || 0) - (parseFloat(data[i][8]) || 0); // H(IN) - I(OUT)
            sheet.getRange(i + 1, 10).setValue(balance); // Column J = Balance
        }
    }
}

function calculateRMLotBalance(sheet, productCode, lotNo) {
    var data = sheet.getDataRange().getValues();
    var lotBalance = 0;

    for (var i = 1; i < data.length; i++) {
        if (data[i][1] === productCode && data[i][10] === lotNo) { // B=ProductCode, K=LotNo
            lotBalance += (parseFloat(data[i][7]) || 0) - (parseFloat(data[i][8]) || 0); // H(IN) - I(OUT)
            sheet.getRange(i + 1, 16).setValue(lotBalance); // Column P = Lot Balance
        }
    }
}


// ==================== DELETE PACKAGE ENTRY ====================

function deletePackageEntry(params) {
    try {
        var ss = SpreadsheetApp.openById(params.spreadsheetId);
        var sheet = ss.getSheetByName(params.sheetName);

        if (!sheet) {
            return { success: false, message: 'Sheet not found' };
        }

        var rowIndex = params.rowIndex;
        var productCode = params.productCode;

        // Delete the row
        sheet.deleteRow(rowIndex);

        // Recalculate balance
        calculatePackageBalance(sheet, productCode);

        return { success: true, message: 'Entry deleted successfully' };

    } catch (error) {
        return { success: false, message: error.message };
    }
}


// ==================== DELETE RM ENTRY ====================

function deleteRMEntry(params) {
    try {
        var ss = SpreadsheetApp.openById(params.spreadsheetId);
        var sheet = ss.getSheetByName(params.sheetName);

        if (!sheet) {
            return { success: false, message: 'Sheet not found' };
        }

        var rowIndex = params.rowIndex;
        var productCode = params.productCode;
        var lotNo = params.lotNo || '';

        // Delete the row
        sheet.deleteRow(rowIndex);

        // Recalculate balances
        calculateRMBalance(sheet, productCode);
        if (lotNo) {
            calculateRMLotBalance(sheet, productCode, lotNo);
        }

        return { success: true, message: 'RM Entry deleted successfully' };

    } catch (error) {
        return { success: false, message: error.message };
    }
}


// ==================== RECALCULATE RM BALANCES ====================

function recalculateRMBalances(params) {
    try {
        var ss = SpreadsheetApp.openById(params.spreadsheetId);
        var sheet = ss.getSheetByName('Sheet1'); // Main RM sheet

        if (!sheet) {
            return { success: false, message: 'Sheet not found' };
        }

        var data = sheet.getDataRange().getValues();

        // Get unique product codes
        var productCodes = {};
        var lotKeys = {};

        for (var i = 1; i < data.length; i++) {
            var code = data[i][1]; // Column B
            var lotNo = data[i][10]; // Column K

            if (code) {
                productCodes[code] = true;
                if (lotNo) {
                    lotKeys[code + '|' + lotNo] = true;
                }
            }
        }

        // Recalculate all product balances
        for (var code in productCodes) {
            calculateRMBalance(sheet, code);
        }

        // Recalculate all lot balances
        for (var key in lotKeys) {
            var parts = key.split('|');
            calculateRMLotBalance(sheet, parts[0], parts[1]);
        }

        return { success: true, message: 'Balances recalculated successfully' };

    } catch (error) {
        return { success: false, message: error.message };
    }
}


// ==================== TRANSFER TO PRODUCTION ====================

function transferToProduction(dataArray) {
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var productionSheet = ss.getSheetByName('production');

        if (!productionSheet) {
            return { success: false, message: 'ไม่พบชีต production - กรุณาสร้างชีตชื่อ "production" ก่อน' };
        }

        var transferredCount = 0;
        var errors = [];

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
                    item.quantity || 0,               // H: IN (จำนวนที่รับเข้า)
                    0,                                // I: OUT
                    0,                                // J: Balance (จะคำนวณใหม่)
                    item.lotNo || '',                 // K: Lot No.
                    item.vendorLot || '',             // L: Vendor Lot
                    item.mfgDate || '',               // M: MFD
                    item.expDate || '',               // N: EXP
                    '',                               // O: Days Left
                    0,                                // P: Lot Balance
                    item.supplier || '',              // Q: Supplier
                    'โอนจาก Center: ' + (item.originalDate || ''), // R: หมายเหตุ
                    item.containerOut || 0            // S: ถังที่เบิก
                ];

                productionSheet.appendRow(newRow);

                // Calculate balances
                calculateRMBalance(productionSheet, item.productCode);
                if (item.lotNo) {
                    calculateRMLotBalance(productionSheet, item.productCode, item.lotNo);
                }

                transferredCount++;

            } catch (rowError) {
                errors.push('รายการ ' + (i + 1) + ': ' + rowError.message);
            }
        }

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
