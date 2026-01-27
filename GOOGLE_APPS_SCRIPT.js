function doPost(e) {
    var lock = LockService.getScriptLock();
    if (lock.tryLock(30000)) {
        try {
            var output = {};
            var data = JSON.parse(e.postData.contents);

            var sheetId = (data.action === 'add_rm') ? '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs' : '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
            var sheetName = (data.action === 'add_rm') ? 'Sheet1' : 'บันทึก StockCard';

            var ss = SpreadsheetApp.openById(sheetId);
            var sheet = ss.getSheetByName(sheetName);
            if (!sheet) sheet = ss.getSheets()[0];

            var lastRow = sheet.getLastRow();
            var targetRow = 2;

            if (lastRow > 1) {
                var values = sheet.getRange("B1:B" + lastRow).getValues();
                for (var i = values.length - 1; i >= 0; i--) {
                    if (values[i][0] && String(values[i][0]).trim() !== "") {
                        targetRow = i + 2;
                        break;
                    }
                }
            }

            var entry = data.entry;
            if (!entry) throw new Error("No entry data provided.");

            if (data.action === 'add_rm') {

                // --- 1. Copy Formulas from Row Above (Phase Formula) ---
                // Copy formulas for ALL potential columns just in case
                if (targetRow > 2) {
                    var prevRow = targetRow - 1;
                    // Check L(12) to R(18) and others
                    var checkCols = [3, 10, 12, 13, 14, 15, 16, 17, 18];
                    for (var c = 0; c < checkCols.length; c++) {
                        var col = checkCols[c];
                        var cellPrev = sheet.getRange(prevRow, col);
                        if (cellPrev.getFormula() !== "") {
                            cellPrev.copyTo(sheet.getRange(targetRow, col), SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
                        }
                    }
                }

                // --- 2. Write Data (Phase Data) ---
                var write = function (col, val, forceClear) {
                    var cell = sheet.getRange(targetRow, col);

                    // CRITICAL: If cell has a formula (from Copy above OR ArrayFormula spill), DO NOT TOUCH IT!
                    if (cell.getFormula() !== "") return;

                    // If we suspect ArrayFormula might be here (e.g. Supplier Q), we should be very careful.
                    // However, we can't detect "Spilled" ArrayFormula easily.
                    // Best bet: If value is empty/null, clear it (allow spill). If value exists, write it.

                    if (val !== undefined && val !== null && val !== "") {
                        if (val === 0 && forceClear) cell.clearContent();
                        else cell.setValue(val);
                    } else {
                        cell.clearContent(); // This effectively allows ArrayFormula to spill into this cell
                    }
                };

                // A: Date
                sheet.getRange(targetRow, 1).setValue("'" + (entry.date || ""));

                // B: Code
                write(2, entry.productCode);

                // C: Name -> Formula Safe (Likely ArrayFormula)
                write(3, null);

                // D: Type
                write(4, entry.type);

                // E, F, G: Container
                if (entry.containerQty) sheet.getRange(targetRow, 5).setValue(entry.containerQty); else sheet.getRange(targetRow, 5).clearContent();
                if (entry.containerWeight) sheet.getRange(targetRow, 6).setValue(entry.containerWeight); else sheet.getRange(targetRow, 6).clearContent();
                if (entry.remainder) sheet.getRange(targetRow, 7).setValue(entry.remainder); else sheet.getRange(targetRow, 7).clearContent();

                // H, I: In, Out
                if (entry.inQty) sheet.getRange(targetRow, 8).setValue(entry.inQty); else sheet.getRange(targetRow, 8).clearContent();
                if (entry.outQty) sheet.getRange(targetRow, 9).setValue(entry.outQty); else sheet.getRange(targetRow, 9).clearContent();

                // J: Balance -> Formula Safe
                write(10, null);

                // K: Lot
                write(11, entry.lotNo);

                // L, M, N (Vendor, MFD, EXP)
                write(12, entry.vendorLot);
                write(13, entry.mfgDate);
                write(14, entry.expDate);

                // O, P (Days, LotBal) -> DO NOT WRITE VALUE. Only Clear.
                // Assuming these are ALWAYS calculated fields.
                write(15, null);
                write(16, null);

                // Q: Supplier -> DO NOT WRITE VALUE. Only Clear.
                // User reported "Data above disappeared", implying writing here breaks ArrayFormula.
                // So we forcefully Clear it to let Formula work.
                write(17, null);

                // R: Remark
                write(18, entry.remark);

                SpreadsheetApp.flush();

            } else {
                // Package Module
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

            return ContentService.createTextOutput(JSON.stringify({ "result": "success", "row": targetRow })).setMimeType(ContentService.MimeType.JSON);

        } catch (e) {
            return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": e.toString() })).setMimeType(ContentService.MimeType.JSON);
        } finally {
            lock.releaseLock();
        }
    } else {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": "Server busy." })).setMimeType(ContentService.MimeType.JSON);
    }
}
