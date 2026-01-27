function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var data = JSON.parse(e.postData.contents);
        var sheetId, sheetName;

        if (data.action === 'add_rm') {
            sheetId = '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs';
            sheetName = 'Sheet1';
        } else {
            sheetId = '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
            sheetName = 'บันทึก StockCard';
        }

        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = ss.getSheets()[0];

        var lastRow = sheet.getLastRow();
        var targetRow = lastRow + 1;

        if (lastRow > 1) {
            var range = sheet.getRange("B1:B" + lastRow).getValues();
            var foundData = false;
            for (var i = range.length - 1; i >= 0; i--) {
                if (range[i][0] && range[i][0].toString().trim() !== "") {
                    targetRow = i + 2;
                    foundData = true;
                    break;
                }
            }
            if (!foundData) targetRow = 2;
        } else {
            targetRow = 2;
        }

        var entry = data.entry;

        if (data.action === 'add_rm') {

            // --- CLEANER & SMARTER SAVE ---
            // 1. Copy Formulas from row above (C, J, O, P)
            var formulaCols = [3, 10, 15, 16];
            if (targetRow > 2) {
                formulaCols.forEach(function (col) {
                    var prevCell = sheet.getRange(targetRow - 1, col);
                    var targetCell = sheet.getRange(targetRow, col);
                    if (prevCell.getFormula() !== "") {
                        prevCell.copyTo(targetCell, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
                    } else {
                        targetCell.clearContent();
                    }
                });
            }

            // Helper to set value only if not empty/zero (to keep cells clean for formulas)
            function setCleanValue(row, col, val) {
                if (val !== null && val !== undefined && val !== '' && val !== 0) {
                    sheet.getRange(row, col).setValue(val);
                } else {
                    sheet.getRange(row, col).clearContent();
                }
            }

            // Helper for Text (allow 0 if needed, but usually empty string is cleared)
            function setText(row, col, val) {
                if (val) sheet.getRange(row, col).setValue(val);
                else sheet.getRange(row, col).clearContent();
            }

            // A: Date (Force Text), B: Code
            sheet.getRange(targetRow, 1).setValue("'" + (entry.date || ''));
            setText(targetRow, 2, entry.productCode);

            // D: Type
            setText(targetRow, 4, entry.type);

            // E, F, G: Container Info (Only set if > 0)
            setCleanValue(targetRow, 5, entry.containerQty);
            setCleanValue(targetRow, 6, entry.containerWeight);
            setCleanValue(targetRow, 7, entry.remainder);  // Column G - Clean!

            // H: In, I: Out (Only set if > 0)
            setCleanValue(targetRow, 8, entry.inQty);      // Column H - Clean!
            setCleanValue(targetRow, 9, entry.outQty);

            // K: Lot
            setText(targetRow, 11, entry.lotNo);

            // L, M, N: Vendor, MFD, EXP
            setText(targetRow, 12, entry.vendorLot);
            setText(targetRow, 13, entry.mfgDate);
            setText(targetRow, 14, entry.expDate);

            // Q: Supplier, R: Remark
            setText(targetRow, 17, entry.supplier);
            setText(targetRow, 18, entry.remark);

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
}
