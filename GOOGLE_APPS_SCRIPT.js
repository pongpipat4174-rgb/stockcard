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

        // Smart Row Detection
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

            // --- INTELLIGENT WRITER ---
            // 1. Check for formulas in the row ABOVE the target.
            //    If formulas exist (Drag-down style), COPY them to the new row.
            //    If no formula (ArrayFormula style), CLEAR the new row to let ArrayFormula expand.

            var formulaCols = [3, 10, 15, 16]; // C, J, O, P

            if (targetRow > 2) {
                formulaCols.forEach(function (col) {
                    var prevCell = sheet.getRange(targetRow - 1, col);
                    var targetCell = sheet.getRange(targetRow, col);

                    if (prevCell.getFormula() !== "") {
                        // Case A: Drag-Down Formula detected -> Copy it down
                        prevCell.copyTo(targetCell, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
                    } else {
                        // Case B: No formula (likely ArrayFormula or Value) -> Clear to be safe
                        targetCell.clearContent();
                    }
                });
            } else {
                // If writing to row 2 (first data row), just clear.
                formulaCols.forEach(function (col) {
                    sheet.getRange(targetRow, col).clearContent();
                });
            }

            // 2. Write Data Blocks (Same as before)
            sheet.getRange(targetRow, 1, 1, 2).setValues([["'" + (entry.date || ''), entry.productCode || '']]); // A,B

            sheet.getRange(targetRow, 4, 1, 6).setValues([[
                entry.type || '', entry.containerQty || 0, entry.containerWeight || 0,
                entry.remainder || 0, entry.inQty || 0, entry.outQty || 0
            ]]); // D-I

            sheet.getRange(targetRow, 11, 1, 4).setValues([[
                entry.lotNo || '', entry.vendorLot || '', entry.mfgDate || '', entry.expDate || ''
            ]]); // K-N

            sheet.getRange(targetRow, 17).setValue(entry.supplier || ''); // Q
            sheet.getRange(targetRow, 18).setValue(entry.remark || ''); // R

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
