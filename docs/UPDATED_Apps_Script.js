/**
 * ===================================================================
 * Stock Card Web App - Apps Script (UPDATED with Delete & Transfer)
 * ===================================================================
 * 
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheets ไฟล์ RM (สต็อคการ์ด สาร Center จ้า)
 * 2. ไปที่ Extensions > Apps Script
 * 3. ลบโค้ดเก่าทั้งหมด แล้ววางโค้ดนี้แทน
 * 4. กด Save (Ctrl+S)
 * 5. กด Deploy > Manage deployments > Edit > New version > Deploy
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

        // ===== ADD RM / ADD PACKAGE (เดิม) =====
        var sheetId = (action === 'add_rm') ? '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs' : '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
        var sheetName = (action === 'add_rm') ? 'Sheet1' : 'บันทึก StockCard';

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

        var entry = data.entry;
        var resultInfo = { "result": "success", "row": targetRow };

        if (action === 'add_rm') {

            // 1. Copy Formulas
            if (targetRow > 2) {
                var sourceRange = sheet.getRange(targetRow - 1, 1, 1, 18);
                var destRange = sheet.getRange(targetRow, 1, 1, 18);
                sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
            }

            // 2. Check Formulas
            var targetRange = sheet.getRange(targetRow, 1, 1, 18);
            var formulas = targetRange.getFormulas()[0];

            // 3. Prepare Map
            var map = [];
            map[0] = "'" + (entry.date || "");
            map[1] = entry.productCode || "";
            map[2] = null; // Skip Name (formula)
            map[3] = entry.type || "";

            // E,F (Container)
            map[4] = (entry.containerQty !== undefined && entry.containerQty !== "") ? entry.containerQty : null;
            map[5] = (entry.containerWeight !== undefined && entry.containerWeight !== "") ? entry.containerWeight : null;

            // G, H -> Skip (formula)
            map[6] = null;
            map[7] = null;

            // I (Out)
            map[8] = (entry.outQty !== undefined && entry.outQty !== "") ? entry.outQty : null;

            // J Balance -> Skip
            map[9] = null;

            map[10] = entry.lotNo || "";
            map[11] = (entry.vendorLot !== undefined && entry.vendorLot !== "") ? entry.vendorLot : null;
            map[12] = (entry.mfgDate !== undefined && entry.mfgDate !== "") ? entry.mfgDate : null;
            map[13] = (entry.expDate !== undefined && entry.expDate !== "") ? entry.expDate : null;

            // O, P, Q -> Skip (formula)
            map[14] = null;
            map[15] = null;
            map[16] = null;

            map[17] = entry.remark || "";


            var requests = [];
            var currentBatchVal = [];
            var currentBatchStart = -1;

            for (var i = 0; i < 18; i++) {
                var hasFormula = (formulas[i] !== "");

                if (hasFormula) {
                    if (currentBatchStart !== -1) {
                        requests.push({ col: currentBatchStart + 1, vals: [currentBatchVal] });
                        currentBatchVal = [];
                        currentBatchStart = -1;
                    }
                    continue;
                }

                if (currentBatchStart === -1) currentBatchStart = i;
                var valToWrite = (map[i] === null || map[i] === undefined) ? "" : map[i];
                currentBatchVal.push(valToWrite);
            }

            if (currentBatchStart !== -1) {
                requests.push({ col: currentBatchStart + 1, vals: [currentBatchVal] });
            }

            requests.forEach(function (req) {
                sheet.getRange(targetRow, req.col, 1, req.vals[0].length).setValues(req.vals);
            });

            SpreadsheetApp.flush();

        } else {
            // Package...
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
        }

        return ContentService.createTextOutput(JSON.stringify(resultInfo)).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": e.toString() })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        try { lock.releaseLock(); } catch (e) { }
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
                // Find target row (after last data row)
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
                    var sourceRange = productionSheet.getRange(targetRow - 1, 1, 1, 18);
                    var destRange = productionSheet.getRange(targetRow, 1, 1, 18);
                    sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
                }

                // Check formulas
                var targetRange = productionSheet.getRange(targetRow, 1, 1, 18);
                var formulas = targetRange.getFormulas()[0];

                // Prepare data map
                var map = [];
                map[0] = "'" + (item.transferDate || new Date().toLocaleDateString('th-TH'));
                map[1] = item.productCode || "";
                map[2] = null; // Name (formula)
                map[3] = "รับเข้า (โอนจาก Center)";
                map[4] = (item.containerQty !== undefined) ? item.containerQty : null;
                map[5] = (item.containerWeight !== undefined) ? item.containerWeight : null;
                map[6] = null; // G
                map[7] = item.quantity || 0; // H (IN)
                map[8] = null; // I (OUT)
                map[9] = null; // J Balance
                map[10] = item.lotNo || "";
                map[11] = item.vendorLot || "";
                map[12] = item.mfgDate || "";
                map[13] = item.expDate || "";
                map[14] = null; // O
                map[15] = null; // P
                map[16] = null; // Q
                map[17] = "โอนจาก Center: " + (item.originalDate || "");

                // Write data (skip formula cells)
                var requests = [];
                var currentBatchVal = [];
                var currentBatchStart = -1;

                for (var k = 0; k < 18; k++) {
                    var hasFormula = (formulas[k] !== "");

                    if (hasFormula) {
                        if (currentBatchStart !== -1) {
                            requests.push({ col: currentBatchStart + 1, vals: [currentBatchVal] });
                            currentBatchVal = [];
                            currentBatchStart = -1;
                        }
                        continue;
                    }

                    if (currentBatchStart === -1) currentBatchStart = k;
                    var valToWrite = (map[k] === null || map[k] === undefined) ? "" : map[k];
                    currentBatchVal.push(valToWrite);
                }

                if (currentBatchStart !== -1) {
                    requests.push({ col: currentBatchStart + 1, vals: [currentBatchVal] });
                }

                requests.forEach(function (req) {
                    productionSheet.getRange(targetRow, req.col, 1, req.vals[0].length).setValues(req.vals);
                });

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
