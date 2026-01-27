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

        // Smart Row Detection (Finding last row with data in Col B)
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

            // --- ULTRA SAFE WRITE (PREVENT FORMULA OVERWRITE) ---
            // Columns with ArrayFormula: C, J, O (and potentially others)
            // We must explicitly CLEAR them to allow formula flow-down.

            sheet.getRange(targetRow, 3).clearContent();  // C - Name
            sheet.getRange(targetRow, 10).clearContent(); // J - Balance
            sheet.getRange(targetRow, 15).clearContent(); // O - DaysLeft

            // Additionally clear any other potential formula columns if suspected
            // e.g. If Supplier col has formula, clear it too. Assuming P, Q, R are manual for now.

            // WRITE BLOCK 1: A, B (Date, Code)
            sheet.getRange(targetRow, 1, 1, 2).setValues([["'" + (entry.date || ''), entry.productCode || '']]);

            // WRITE BLOCK 2: D, E, F, G, H, I (Type, C.Qty, C.Wt, Rem, In, Out)
            // Skip C
            sheet.getRange(targetRow, 4, 1, 6).setValues([[
                entry.type || '',
                entry.containerQty || 0,
                entry.containerWeight || 0,
                entry.remainder || 0,
                entry.inQty || 0,
                entry.outQty || 0
            ]]);

            // WRITE BLOCK 3: K, L, M, N (Lot, VendorLot, MFD, EXP)
            // Skip J
            sheet.getRange(targetRow, 11, 1, 4).setValues([[
                entry.lotNo || '',
                entry.vendorLot || '',
                entry.mfgDate || '',
                entry.expDate || ''
            ]]);

            // WRITE BLOCK 4: P, Q, R (LotBal, Supplier, Remark)
            // Skip O
            // CAUTION: entry.supplier might be causing shifts if passed incorrectly.
            sheet.getRange(targetRow, 16, 1, 3).setValues([[
                entry.lotBalance || 0,
                entry.supplier || '',
                entry.remark || ''
            ]]);

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
