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

            // --- "MISSING LINK" FIX ---
            // User says L-P are not running down. This means ArrayFormulas in those columns
            // are failing because they depend on something being present in G or H or K.
            // OR we are accidentally writing "" (empty string) which BLOCKS ArrayFormula.

            // STRATEGY: 
            // 1. Explicitly CLEAR columns L, M, N if they are empty, rather than writing "".
            // 2. Clear O (Days), P (LotBal) explicitly.

            // Helper: Set value, but if empty, CLEAR IT (don't write "")
            function setOrClear(row, col, val) {
                if (val !== null && val !== undefined && val !== '' && val !== 0) {
                    sheet.getRange(row, col).setValue(val);
                } else {
                    sheet.getRange(row, col).clearContent();
                }
            }

            // Helper for Text: If empty string, CLEAR IT.
            function setTextOrClear(row, col, val) {
                if (val && val !== '') sheet.getRange(row, col).setValue(val);
                else sheet.getRange(row, col).clearContent();
            }

            // A: Date, B: Code
            sheet.getRange(targetRow, 1).setValue("'" + (entry.date || ''));
            setTextOrClear(targetRow, 2, entry.productCode);

            // C: Name (Formula) -> CLEAR
            sheet.getRange(targetRow, 3).clearContent();

            // D: Type
            setTextOrClear(targetRow, 4, entry.type);

            // E, F, G (Container Info) -> Only write if > 0, else CLEAR
            setOrClear(targetRow, 5, entry.containerQty);
            setOrClear(targetRow, 6, entry.containerWeight);
            setOrClear(targetRow, 7, entry.remainder);

            // H, I (In/Out) -> Only write if > 0, else CLEAR
            setOrClear(targetRow, 8, entry.inQty);
            setOrClear(targetRow, 9, entry.outQty);

            // J: Balance (Formula) -> CLEAR
            sheet.getRange(targetRow, 10).clearContent();

            // K: Lot No (User Key)
            setTextOrClear(targetRow, 11, entry.lotNo);

            // L, M, N (Vendor, MFD, EXP)
            // If these are empty, we MUST clear them so ArrayFormula (if any) can work, 
            // or so they are just empty cells.
            setTextOrClear(targetRow, 12, entry.vendorLot);
            setTextOrClear(targetRow, 13, entry.mfgDate);
            setTextOrClear(targetRow, 14, entry.expDate);

            // O, P (Days, LotBal) -> CLEAR (Formulas)
            sheet.getRange(targetRow, 15).clearContent();
            sheet.getRange(targetRow, 16).clearContent();

            // Q: Supplier
            setTextOrClear(targetRow, 17, entry.supplier);

            // R: Remark
            setTextOrClear(targetRow, 18, entry.remark);

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
