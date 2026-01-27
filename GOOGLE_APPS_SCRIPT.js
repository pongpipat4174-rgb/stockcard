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

        // Detect last row with data in Col B
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

            // --- 1. Copy Formulas from Row Above ---
            // Check ALL potential formula columns: C(3), J(10), L(12), M(13), N(14), O(15), P(16)
            // Q(17) is Supplier (Data), but user says it might be overlapping formula? 
            // Let's assume Q and R are data, but O and P contain formulas.
            if (targetRow > 2) {
                var prevRow = targetRow - 1;
                var colsToCheck = [3, 10, 12, 13, 14, 15, 16];
                for (var k = 0; k < colsToCheck.length; k++) {
                    var colIndex = colsToCheck[k];
                    var prevCell = sheet.getRange(prevRow, colIndex);
                    if (prevCell.getFormula() !== "") {
                        prevCell.copyTo(sheet.getRange(targetRow, colIndex), SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
                    }
                }
            }

            // --- 2. Write Data with "Formula Safe" Checks ---

            // A, B
            sheet.getRange(targetRow, 1).setValue("'" + (entry.date || ''));
            if (entry.productCode) sheet.getRange(targetRow, 2).setValue(entry.productCode);
            else sheet.getRange(targetRow, 2).clearContent();

            // C: Name (Formula) -> Clear only if NOT formula
            if (sheet.getRange(targetRow, 3).getFormula() === "") {
                sheet.getRange(targetRow, 3).clearContent();
            }

            // D: Type
            if (entry.type) sheet.getRange(targetRow, 4).setValue(entry.type);
            else sheet.getRange(targetRow, 4).clearContent();

            // E, F, G (Container)
            if (entry.containerQty && entry.containerQty !== 0) sheet.getRange(targetRow, 5).setValue(entry.containerQty);
            else sheet.getRange(targetRow, 5).clearContent();

            if (entry.containerWeight && entry.containerWeight !== 0) sheet.getRange(targetRow, 6).setValue(entry.containerWeight);
            else sheet.getRange(targetRow, 6).clearContent();

            if (entry.remainder && entry.remainder !== 0) sheet.getRange(targetRow, 7).setValue(entry.remainder);
            else sheet.getRange(targetRow, 7).clearContent();

            // H, I (In, Out)
            if (entry.inQty && entry.inQty !== 0) sheet.getRange(targetRow, 8).setValue(entry.inQty);
            else sheet.getRange(targetRow, 8).clearContent();

            if (entry.outQty && entry.outQty !== 0) sheet.getRange(targetRow, 9).setValue(entry.outQty);
            else sheet.getRange(targetRow, 9).clearContent();

            // J: Balance (Formula)
            if (sheet.getRange(targetRow, 10).getFormula() === "") {
                sheet.getRange(targetRow, 10).clearContent();
            }

            // K: Lot No
            if (entry.lotNo) sheet.getRange(targetRow, 11).setValue(entry.lotNo);
            else sheet.getRange(targetRow, 11).clearContent();

            // L, M, N (Vendor, MFD, EXP) -> Write only if NO Formula
            if (sheet.getRange(targetRow, 12).getFormula() === "") {
                if (entry.vendorLot) sheet.getRange(targetRow, 12).setValue(entry.vendorLot);
                else sheet.getRange(targetRow, 12).clearContent();
            }
            if (sheet.getRange(targetRow, 13).getFormula() === "") {
                if (entry.mfgDate) sheet.getRange(targetRow, 13).setValue(entry.mfgDate);
                else sheet.getRange(targetRow, 13).clearContent();
            }
            if (sheet.getRange(targetRow, 14).getFormula() === "") {
                if (entry.expDate) sheet.getRange(targetRow, 14).setValue(entry.expDate);
                else sheet.getRange(targetRow, 14).clearContent();
            }

            // --- CRITICAL FIX: O, P Checks ----
            // User says O, P, Q overlap formula.
            // O (Days), P (LotBal) MUST NOT be cleared if they have formulas!

            // O: Days Left
            if (sheet.getRange(targetRow, 15).getFormula() === "") {
                // Only clear/write if it's NOT a formula (copied from above or ArrayFormula)
                sheet.getRange(targetRow, 15).clearContent();
            }

            // P: Lot Balance
            if (sheet.getRange(targetRow, 16).getFormula() === "") {
                sheet.getRange(targetRow, 16).clearContent();
            }

            // Q: Supplier
            // User implied Q might interfere too. Check formula first.
            if (sheet.getRange(targetRow, 17).getFormula() === "") {
                if (entry.supplier) sheet.getRange(targetRow, 17).setValue(entry.supplier);
                else sheet.getRange(targetRow, 17).clearContent();
            }

            // R: Remark
            if (entry.remark) sheet.getRange(targetRow, 18).setValue(entry.remark);
            else sheet.getRange(targetRow, 18).clearContent();

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
}
