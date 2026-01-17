/* Apps Script V.10 (Hybrid Force Delete - Working Version) */
const SHEET_NAME = 'บันทึก StockCard';

function doPost(e) {
    var lock = LockService.getScriptLock();
    try { lock.waitLock(10000); } catch (e) { }

    try {
        var data = JSON.parse(e.postData.contents);
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
        if (!sheet) return jsonResp(false, 'Sheet not found');

        // ========== DELETE LOGIC ==========
        if (data.action === 'delete_force' || data.action === 'delete_v5' || data.action === 'delete') {
            var idx = parseInt(data.rowIndex);
            var c = data.criteria || {};
            var targetCode = String(c.productCode || '').toLowerCase().trim();
            var targetType = String(c.type || '').toLowerCase().trim();
            var maxRows = sheet.getLastRow();

            // PHASE 1: PRECISION STRIKE
            if (idx > 1 && idx <= maxRows) {
                var rowVals = sheet.getRange(idx, 1, 1, 13).getDisplayValues()[0];
                var sheetCode = String(rowVals[1]).toLowerCase().trim();
                if (sheetCode === targetCode || !targetCode) {
                    sheet.deleteRow(idx);
                    return jsonResp(true, 'Deleted Exact Row ' + idx);
                }
            }

            // PHASE 2: AREA SCAN
            var startSearch = Math.max(2, idx - 10);
            var endSearch = Math.min(maxRows, idx + 10);
            if (endSearch >= startSearch) {
                var numRows = endSearch - startSearch + 1;
                var range = sheet.getRange(startSearch, 1, numRows, 13);
                var values = range.getDisplayValues();
                for (var i = 0; i < values.length; i++) {
                    if (String(values[i][1]).toLowerCase().trim() === targetCode) {
                        sheet.deleteRow(startSearch + i);
                        return jsonResp(true, 'Deleted Nearby Row ' + (startSearch + i));
                    }
                }
            }

            // PHASE 3: GLOBAL HUNT
            var allVals = sheet.getDataRange().getDisplayValues();
            for (var i = allVals.length - 1; i >= 1; i--) {
                if (String(allVals[i][1]).toLowerCase().trim() === targetCode) {
                    sheet.deleteRow(i + 1);
                    return jsonResp(true, 'Deleted Global Row ' + (i + 1));
                }
            }
            return jsonResp(false, 'Not found');
        }

        // ========== ADD RM LOGIC (สำหรับวัตถุดิบ) ==========
        if (data.action === 'addRM') {
            // Open the RM spreadsheet by ID
            var rmSpreadsheet = SpreadsheetApp.openById(data.sheetId);
            var rmSheet = rmSpreadsheet.getSheetByName(data.sheetName);
            if (!rmSheet) return jsonResp(false, 'RM Sheet not found');

            var d = data.entry || data;
            // RM columns: A-วันที่, B-รหัส, C-ชื่อ, D-รายการ, E-จำนวนCont, F-นน.Cont, G-เศษ, H-IN, I-OUT, J-Balance, K-LotNo, L-VendorLot, M-MFD, N-EXP, O-DaysLeft, P-LotBalance, Q-Supplier
            rmSheet.appendRow([
                d.date,
                d.productCode,
                d.productName,
                d.type,
                d.containerQty || 0,
                d.containerWeight || 0,
                d.remainder || 0,
                d.inQty || 0,
                d.outQty || 0,
                d.balance || 0,
                d.lotNo || '',
                d.vendorLot || '',
                '', // MFD (จะใส่ภายหลัง)
                '', // EXP
                '', // DaysLeft (formula ใน sheet จะคำนวณ)
                '', // LotBalance
                d.supplier || ''
            ]);
            return jsonResp(true, 'Added RM Entry');
        }

        // ========== ADD LOGIC (ต่อท้ายรายการล่าสุดของ Sheet) ==========
        var d = data.entry || data;
        sheet.appendRow([d.date, d.productCode, d.productName, d.type, d.inQty, d.outQty, d.balance, d.lotNo, d.pkId, '', d.docRef, '', d.remark]);
        return jsonResp(true, 'Added');

    } catch (err) {
        return jsonResp(false, 'Error: ' + err);
    } finally {
        lock.releaseLock();
    }
}

function jsonResp(s, m) {
    return ContentService.createTextOutput(JSON.stringify({ success: s, message: m })).setMimeType(ContentService.MimeType.JSON);
}
