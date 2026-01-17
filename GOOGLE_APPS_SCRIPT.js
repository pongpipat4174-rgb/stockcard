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
