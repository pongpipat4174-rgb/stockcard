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

        // Find Last Row Logic
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
            // --- CRITICAL FIX FOR FORMULAS ---
            // 1. CLEAR the columns that contain ArrayFormulas (C, J, O) on the target row
            //    This removes any "hardcoded" values blocking the formula expansion.
            sheet.getRange(targetRow, 3).clearContent(); // Clear Col C (Name)
            sheet.getRange(targetRow, 10).clearContent(); // Clear Col J (Balance)
            sheet.getRange(targetRow, 15).clearContent(); // Clear Col O (DaysLeft)

            // 2. Safe Write in blocks
            // Block 1: A-B (Date, Code)
            sheet.getRange(targetRow, 1, 1, 2).setValues([[
                "'" + (entry.date || ''),
                entry.productCode || ''
            ]]);

            // Block 2: D-I (Type, ContQty, ContWt, Rem, In, Out)
            sheet.getRange(targetRow, 4, 1, 6).setValues([[
                entry.type || '',
                entry.containerQty || 0,
                entry.containerWeight || 0,
                entry.remainder || 0,
                entry.inQty || 0,
                entry.outQty || 0
            ]]);

            // Block 3: K-N (Lot, VendorLot, MFD, EXP)
            sheet.getRange(targetRow, 11, 1, 4).setValues([[
                entry.lotNo || '',
                entry.vendorLot || '',
                entry.mfgDate || '',
                entry.expDate || ''
            ]]);

            // Block 4: P-R (LotBal, Supplier, Remark)
            sheet.getRange(targetRow, 16, 1, 3).setValues([[
                entry.lotBalance || 0,
                entry.supplier || '',
                entry.remark || ''
            ]]);

        } else {
            // Package Module Data
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

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "row": targetRow }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}
