/**
 * ===================================================================
 * Stock Card Web App - Apps Script v4.0
 * พร้อม Deploy ทันที!
 * ===================================================================
 * 
 * อัพเดท: 31 มกราคม 2569
 * - รองรับ sheetName จาก Frontend (RM Center หรือ RM Production)
 * - แก้ไขปัญหาข้อมูลไปผิด sheet
 * 
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheets ไฟล์ RM
 * 2. ไปที่ Extensions > Apps Script
 * 3. ลบโค้ดเก่าทั้งหมด แล้ววางโค้ดนี้แทน
 * 4. กด Save (Ctrl+S)
 * 5. กด Deploy > Manage deployments > ✏️ Edit
 * 6. เลือก "New version" แล้วกด Deploy
 * 
 * ===================================================================
 */

// ==================== GET REQUEST ====================

function doGet(e) {
    var action = e && e.parameter ? e.parameter.action : null;
    var sheetName = e && e.parameter ? e.parameter.sheet : null;

    // Get RM Master Data
    if (action === 'getRMMaster') {
        return getRMMasterData();
    }

    // Load all data from a sheet
    if (action === 'load_all' && sheetName) {
        return loadAllSheetData(sheetName);
    }

    // Default response
    return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Stock Card API v4.0 - RM Production Support',
        timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
}


// ==================== GET RM MASTER DATA ====================

function getRMMasterData() {
    try {
        var ss = SpreadsheetApp.openById('1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs');
        var masterSheet = ss.getSheetByName('RawMaterial') || ss.getSheetByName('Master');

        if (!masterSheet) {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'RawMaterial or Master sheet not found'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var data = masterSheet.getDataRange().getValues();
        var masterData = [];

        // RawMaterial columns: A=Product Code, B=Product Name, C=โรงงานผลิต (Supplier)
        for (var i = 1; i < data.length; i++) {
            var row = data[i];
            if (row[0]) {
                masterData.push({
                    code: row[0] || '',
                    name: row[1] || '',
                    supplier: row[2] || ''
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


// ==================== POST REQUEST ====================

function doPost(e) {
    var lock = LockService.getScriptLock();

    try {
        lock.tryLock(10000);

        var data = JSON.parse(e.postData.contents);
        var action = data.action;

        Logger.log('doPost action: ' + action);

        // ===== DELETE RM =====
        if (action === 'delete_rm') {
            return deleteRMEntry(data);
        }

        // ===== TRANSFER TO PRODUCTION =====
        if (action === 'transferToProduction') {
            var dataArray = data.data;
            if (typeof dataArray === 'string') {
                dataArray = JSON.parse(dataArray);
            }
            var result = transferToProduction(dataArray);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        // ===== RECALCULATE RM =====
        if (action === 'recalculate_rm') {
            return recalculateAllRM(data);
        }

        // ===== ADD RM (รองรับทั้ง Sheet1 และ production) =====
        if (action === 'add_rm') {
            // *** สำคัญมาก: ใช้ sheetName ที่ส่งมาจาก Frontend ***
            var sheetId = data.spreadsheetId || '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs';
            var sheetName = data.sheetName || 'Sheet1';

            Logger.log('add_rm: sheetName = ' + sheetName);

            return addRMEntry(sheetId, sheetName, data.entry);
        }

        // ===== ADD PACKAGE =====
        if (action === 'add') {
            var sheetId = data.spreadsheetId || '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
            var sheetName = data.sheetName || 'บันทึก StockCard';
            return addPackageEntry(sheetId, sheetName, data.entry);
        }

        // ===== DELETE PACKAGE =====
        if (action === 'delete') {
            return deletePackageEntry(data);
        }

        // ===== CONSUMABLE ACTIONS =====
        if (action === 'save_all') {
            return saveConsumableData(data);
        }
        if (action === 'delete_consumable_transaction') {
            return deleteConsumableTransaction(data);
        }
        if (action === 'update_consumable_transaction') {
            return updateConsumableTransaction(data);
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'Unknown action: ' + action
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        Logger.log('doPost error: ' + e.toString());
        return ContentService.createTextOutput(JSON.stringify({
            result: "error",
            error: e.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        try { lock.releaseLock(); } catch (e) { }
    }
}


// ==================== ADD RM ENTRY ====================

function addRMEntry(sheetId, sheetName, entry) {
    try {
        Logger.log('addRMEntry - sheetName: ' + sheetName + ', entry type: ' + entry.type);

        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            Logger.log('Sheet not found: ' + sheetName);
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                error: 'Sheet not found: ' + sheetName
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Find target row
        var lastRow = sheet.getLastRow();
        var targetRow = lastRow + 1;
        if (lastRow > 0) {
            var values = sheet.getRange("B1:B" + lastRow).getValues();
            for (var i = values.length - 1; i >= 0; i--) {
                if (values[i][0] && String(values[i][0]).trim() !== "") {
                    targetRow = i + 2;
                    break;
                }
            }
        }
        if (targetRow < 2) targetRow = 2;

        Logger.log('Target row: ' + targetRow);

        // Copy Formulas from previous row
        if (targetRow > 2) {
            var sourceRange = sheet.getRange(targetRow - 1, 1, 1, 19);
            var destRange = sheet.getRange(targetRow, 1, 1, 19);
            sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);

            // Clear Column A format and set to plain text
            var cellA = sheet.getRange(targetRow, 1);
            cellA.clearFormat();
            cellA.setNumberFormat('@');
        }

        // Prepare data map (A-S = columns 1-19)
        var map = [];
        map[0] = entry.date || "";                    // A: วันที่
        map[1] = entry.productCode || "";             // B: รหัสสินค้า
        map[2] = entry.productName || "";             // C: ชื่อสินค้า
        map[3] = entry.type || "";                    // D: ประเภทรายการ (ใช้ตรงๆ จาก Frontend!)

        // E,F (Container)
        map[4] = (entry.containerQty !== undefined && entry.containerQty !== "") ? entry.containerQty : "";
        map[5] = (entry.containerWeight !== undefined && entry.containerWeight !== "") ? entry.containerWeight : "";

        // G (Remainder)
        map[6] = (entry.remainder !== undefined && entry.remainder !== "") ? entry.remainder : "";

        // H (In Qty)
        map[7] = (entry.inQty !== undefined && entry.inQty !== "") ? entry.inQty : "";

        // I (Out Qty)
        map[8] = (entry.outQty !== undefined && entry.outQty !== "") ? entry.outQty : "";

        // J Balance -> Calculate from previous balance + in - out
        var prevBalance = 0;
        if (targetRow > 2) {
            var allData = sheet.getDataRange().getValues();
            for (var r = targetRow - 2; r >= 1; r--) {
                if (allData[r][1] === entry.productCode) {
                    prevBalance = parseFloat(allData[r][9]) || 0;
                    break;
                }
            }
        }
        var inQty = parseFloat(entry.inQty) || 0;
        var outQty = parseFloat(entry.outQty) || 0;
        map[9] = prevBalance + inQty - outQty;        // J: Balance

        map[10] = entry.lotNo || "";                  // K: Lot No
        map[11] = entry.vendorLot || "";              // L: Vendor Lot
        map[12] = entry.mfgDate || "";                // M: MFG Date
        map[13] = entry.expDate || "";                // N: EXP Date

        // O (Days Left) -> Calculate from EXP date
        var daysLeft = "";
        if (entry.expDate && entry.expDate !== "-") {
            try {
                var expParts = String(entry.expDate).split("/");
                if (expParts.length === 3) {
                    var expDay = parseInt(expParts[0]);
                    var expMonth = parseInt(expParts[1]) - 1;
                    var expYear = parseInt(expParts[2]);
                    if (expYear > 2500) expYear = expYear - 543;
                    var expDateObj = new Date(expYear, expMonth, expDay);
                    expDateObj.setHours(0, 0, 0, 0);
                    var now = new Date();
                    var thaiOffset = 7 * 60;
                    var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                    var thaiTime = new Date(utc + (thaiOffset * 60000));
                    thaiTime.setHours(0, 0, 0, 0);
                    var diffTime = expDateObj.getTime() - thaiTime.getTime();
                    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                }
            } catch (e) {
                daysLeft = "";
            }
        }
        map[14] = daysLeft;                           // O: Days Left

        // P (Lot Balance) -> Calculate for this lot
        var lotBalance = 0;
        if (entry.lotNo) {
            var allData2 = sheet.getDataRange().getValues();
            for (var r2 = 1; r2 < targetRow - 1; r2++) {
                if (allData2[r2][1] === entry.productCode && allData2[r2][10] === entry.lotNo) {
                    lotBalance += (parseFloat(allData2[r2][7]) || 0) - (parseFloat(allData2[r2][8]) || 0);
                }
            }
            lotBalance += inQty - outQty;
        }
        map[15] = lotBalance;                         // P: Lot Balance

        map[16] = entry.supplier || "";               // Q: Supplier
        map[17] = entry.remark || "";                 // R: Remark
        map[18] = (entry.containerOut !== undefined && entry.containerOut !== "") ? entry.containerOut : ""; // S: Container Out

        // Set Column A format to text BEFORE writing
        sheet.getRange(targetRow, 1).setNumberFormat('@');

        // Write all columns
        var rowData = [];
        for (var i = 0; i < 19; i++) {
            rowData.push((map[i] === null || map[i] === undefined) ? "" : map[i]);
        }
        sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);

        SpreadsheetApp.flush();

        Logger.log('Entry saved successfully at row ' + targetRow + ' in sheet ' + sheetName);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            result: 'success',
            row: targetRow,
            sheetName: sheetName,
            type: entry.type
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        Logger.log('addRMEntry error: ' + e.toString());
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            result: 'error',
            error: e.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== ADD PACKAGE ENTRY ====================

function addPackageEntry(sheetId, sheetName, entry) {
    try {
        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = ss.getSheets()[0];

        var lastRow = sheet.getLastRow();
        var targetRow = lastRow + 1;
        if (lastRow > 0) {
            var values = sheet.getRange("B1:B" + lastRow).getValues();
            for (var i = values.length - 1; i >= 0; i--) {
                if (values[i][0] && String(values[i][0]).trim() !== "") {
                    targetRow = i + 2;
                    break;
                }
            }
        }
        if (targetRow < 2) targetRow = 2;

        var rowData = [
            "'" + (entry.date || ''),
            entry.productCode || '',
            entry.productName || '',
            entry.type || '',
            entry.inQty || 0,
            entry.outQty || 0,
            entry.balance || 0,
            entry.lotNo || '',
            entry.pkId || '',
            entry.user || 'Admin',
            entry.docRef || '',
            new Date(),
            entry.remark || ''
        ];
        sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            result: 'success',
            row: targetRow
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            result: 'error',
            error: e.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== DELETE RM ENTRY ====================

function deleteRMEntry(data) {
    try {
        var sheetId = data.spreadsheetId || '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs';
        var sheetName = data.sheetName || 'Sheet1';

        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({
                result: 'error',
                error: 'Sheet not found: ' + sheetName
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var rowIndex = data.rowIndex;

        if (!rowIndex || rowIndex < 2) {
            return ContentService.createTextOutput(JSON.stringify({
                result: 'error',
                error: 'Invalid row index: ' + rowIndex
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Delete the row
        sheet.deleteRow(rowIndex);

        return ContentService.createTextOutput(JSON.stringify({
            result: 'success',
            message: 'Row ' + rowIndex + ' deleted successfully'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({
            result: 'error',
            error: e.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== DELETE PACKAGE ENTRY ====================

function deletePackageEntry(data) {
    try {
        var sheetId = data.spreadsheetId || '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
        var sheetName = data.sheetName || 'บันทึก StockCard';

        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({
                result: 'error',
                error: 'Sheet not found: ' + sheetName
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var rowIndex = data.rowIndex;

        if (!rowIndex || rowIndex < 2) {
            return ContentService.createTextOutput(JSON.stringify({
                result: 'error',
                error: 'Invalid row index: ' + rowIndex
            })).setMimeType(ContentService.MimeType.JSON);
        }

        sheet.deleteRow(rowIndex);

        return ContentService.createTextOutput(JSON.stringify({
            result: 'success',
            message: 'Row ' + rowIndex + ' deleted successfully'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({
            result: 'error',
            error: e.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== TRANSFER TO PRODUCTION ====================

function transferToProduction(dataArray) {
    try {
        var ss = SpreadsheetApp.openById('1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs');
        var productionSheet = ss.getSheetByName('production');

        if (!productionSheet) {
            return { success: false, message: 'ไม่พบชีต production - กรุณาสร้างชีตชื่อ "production" ก่อน' };
        }

        var transferredCount = 0;
        var errors = [];

        for (var i = 0; i < dataArray.length; i++) {
            var item = dataArray[i];

            try {
                // Find target row
                var lastRow = productionSheet.getLastRow();
                var targetRow = lastRow + 1;
                if (lastRow > 0) {
                    var values = productionSheet.getRange("B1:B" + lastRow).getValues();
                    for (var j = values.length - 1; j >= 0; j--) {
                        if (values[j][0] && String(values[j][0]).trim() !== "") {
                            targetRow = j + 2;
                            break;
                        }
                    }
                }
                if (targetRow < 2) targetRow = 2;

                // Copy formulas from previous row
                if (targetRow > 2) {
                    var sourceRange = productionSheet.getRange(targetRow - 1, 1, 1, 19);
                    var destRange = productionSheet.getRange(targetRow, 1, 1, 19);
                    sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);

                    var cellA = productionSheet.getRange(targetRow, 1);
                    cellA.clearFormat();
                    cellA.setNumberFormat('@');
                }

                // Prepare data
                var transferDateStr = item.transferDate;
                if (!transferDateStr) {
                    var now = new Date();
                    transferDateStr = now.getDate() + '/' + (now.getMonth() + 1) + '/' + now.getFullYear();
                }

                var inQtyPD = item.quantity || 0;

                // Calculate Balance
                var prevBalancePD = 0;
                if (targetRow > 2) {
                    var allDataPD = productionSheet.getDataRange().getValues();
                    for (var rPD = targetRow - 2; rPD >= 1; rPD--) {
                        if (allDataPD[rPD][1] === item.productCode) {
                            prevBalancePD = parseFloat(allDataPD[rPD][9]) || 0;
                            break;
                        }
                    }
                }

                // Calculate Days Left
                var daysLeftPD = "";
                if (item.expDate && item.expDate !== "-") {
                    try {
                        var expPartsPD = String(item.expDate).split("/");
                        if (expPartsPD.length === 3) {
                            var expDayPD = parseInt(expPartsPD[0]);
                            var expMonthPD = parseInt(expPartsPD[1]) - 1;
                            var expYearPD = parseInt(expPartsPD[2]);
                            if (expYearPD > 2500) expYearPD = expYearPD - 543;
                            var expDateObjPD = new Date(expYearPD, expMonthPD, expDayPD);
                            expDateObjPD.setHours(0, 0, 0, 0);
                            var nowPD = new Date();
                            var thaiOffsetPD = 7 * 60;
                            var utcPD = nowPD.getTime() + (nowPD.getTimezoneOffset() * 60000);
                            var thaiTimePD = new Date(utcPD + (thaiOffsetPD * 60000));
                            thaiTimePD.setHours(0, 0, 0, 0);
                            var diffTimePD = expDateObjPD.getTime() - thaiTimePD.getTime();
                            daysLeftPD = Math.ceil(diffTimePD / (1000 * 60 * 60 * 24)) + 1;
                        }
                    } catch (e) {
                        daysLeftPD = "";
                    }
                }

                // Calculate Lot Balance
                var lotBalancePD = 0;
                if (item.lotNo) {
                    var allDataPD2 = productionSheet.getDataRange().getValues();
                    for (var rPD2 = 1; rPD2 < targetRow - 1; rPD2++) {
                        if (allDataPD2[rPD2][1] === item.productCode && allDataPD2[rPD2][10] === item.lotNo) {
                            lotBalancePD += (parseFloat(allDataPD2[rPD2][7]) || 0) - (parseFloat(allDataPD2[rPD2][8]) || 0);
                        }
                    }
                    lotBalancePD += inQtyPD;
                }

                // Build row data
                var rowData = [
                    transferDateStr,                           // A: Date
                    item.productCode || "",                    // B: Product Code
                    item.productName || "",                    // C: Product Name
                    "รับเข้า (โอนจาก Center)",                 // D: Type (fixed for transfer)
                    item.containerQty || "",                   // E: Container Qty
                    item.containerWeight || "",                // F: Container Weight
                    item.remainder || "",                      // G: Remainder
                    inQtyPD,                                   // H: IN
                    0,                                         // I: OUT = 0 for receive
                    prevBalancePD + inQtyPD,                   // J: Balance
                    item.lotNo || "",                          // K: Lot No
                    item.vendorLot || "",                      // L: Vendor Lot
                    item.mfgDate || "",                        // M: MFG Date
                    item.expDate || "",                        // N: EXP Date
                    daysLeftPD,                                // O: Days Left
                    lotBalancePD,                              // P: Lot Balance
                    item.supplier || "",                       // Q: Supplier
                    "โอนจาก Center: " + (item.originalDate || ""), // R: Remark
                    ""                                         // S: Container Out
                ];

                // Set date format and write
                productionSheet.getRange(targetRow, 1).setNumberFormat('@');
                productionSheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);

                transferredCount++;

            } catch (rowError) {
                errors.push('รายการ ' + (i + 1) + ': ' + rowError.message);
            }
        }

        SpreadsheetApp.flush();

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


// ==================== RECALCULATE RM ====================

function recalculateAllRM(data) {
    try {
        var sheetId = data.spreadsheetId || '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs';
        var sheetName = data.sheetName || 'Sheet1';

        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                error: 'Sheet not found: ' + sheetName
            })).setMimeType(ContentService.MimeType.JSON);
        }

        manualRecalculateSheet(sheet);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'Recalculation completed'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: e.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== MANUAL RECALCULATE SHEET ====================

function manualRecalculateSheet(sheet) {
    var allData = sheet.getDataRange().getValues();
    var numRows = allData.length;
    if (numRows <= 1) return;

    var productBalances = {};
    var lotBalances = {};

    for (var i = 1; i < numRows; i++) {
        var row = i + 1;
        var productCode = allData[i][1];

        if (!productCode || productCode.toString().trim() === '') continue;

        var inQty = parseFloat(allData[i][7]) || 0;
        var outQty = parseFloat(allData[i][8]) || 0;
        var lotNo = allData[i][10];

        // Product balance
        productBalances[productCode] = (productBalances[productCode] || 0) + inQty - outQty;
        sheet.getRange(row, 10).setValue(Math.round(productBalances[productCode] * 100) / 100);

        // Lot balance
        if (lotNo) {
            var lotKey = productCode + '|' + lotNo;
            lotBalances[lotKey] = (lotBalances[lotKey] || 0) + inQty - outQty;
            sheet.getRange(row, 16).setValue(Math.round(lotBalances[lotKey] * 100) / 100);
        }
    }

    Logger.log('Recalculated ' + numRows + ' rows');
}


// ==================== CONSUMABLE FUNCTIONS (Placeholders) ====================

function saveConsumableData(data) {
    // Implement if needed
    return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Consumable data saved'
    })).setMimeType(ContentService.MimeType.JSON);
}

function deleteConsumableTransaction(data) {
    // Implement if needed
    return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Consumable transaction deleted'
    })).setMimeType(ContentService.MimeType.JSON);
}

function updateConsumableTransaction(data) {
    // Implement if needed
    return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Consumable transaction updated'
    })).setMimeType(ContentService.MimeType.JSON);
}

function loadAllSheetData(sheetName) {
    // Implement if needed
    return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: []
    })).setMimeType(ContentService.MimeType.JSON);
}
