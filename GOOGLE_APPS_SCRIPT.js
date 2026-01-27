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

            // --- FINAL ADJUSTMENT: Supplier Position ---
            // User screenshot shows Supplier is getting shifted too far or wrong column.
            // Re-verify Column Mapping based on standard A-R structure:
            // A:Date, B:Code, C:Name(Formula), D:Type, E:Qty, F:Wt, G:Rem, H:In, I:Out, J:Bal(Formula)
            // K:Lot, L:VendorLot, M:MFD, N:EXP, O:Days(Formula), P:LotBal(Formula/Manual?), Q:Supplier, R:Remark

            // Clear Formulas
            sheet.getRange(targetRow, 3).clearContent();  // C
            sheet.getRange(targetRow, 10).clearContent(); // J
            sheet.getRange(targetRow, 15).clearContent(); // O
            sheet.getRange(targetRow, 16).clearContent(); // P (Lot Balance - Assuming formula based on user feedback)

            // 1. Date, Code (A, B)
            sheet.getRange(targetRow, 1, 1, 2).setValues([["'" + (entry.date || ''), entry.productCode || '']]);

            // 2. Type...Out (D, E, F, G, H, I)
            sheet.getRange(targetRow, 4, 1, 6).setValues([[
                entry.type || '',
                entry.containerQty || 0,
                entry.containerWeight || 0,
                entry.remainder || 0,
                entry.inQty || 0,
                entry.outQty || 0
            ]]);

            // 3. Lot...EXP (K, L, M, N)
            sheet.getRange(targetRow, 11, 1, 4).setValues([[
                entry.lotNo || '',
                entry.vendorLot || '',
                entry.mfgDate || '',
                entry.expDate || ''
            ]]);

            // 4. Supplier is at Column Q (17)
            sheet.getRange(targetRow, 17).setValue(entry.supplier || '');

            // 5. Remark is at Column R (18)
            sheet.getRange(targetRow, 18).setValue(entry.remark || '');

        } else {
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
