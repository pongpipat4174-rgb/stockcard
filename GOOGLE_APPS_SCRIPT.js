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

        // ==========================================
        // SMART APPEND LOGIC (Fixes "Last Line" Gap)
        // ==========================================
        // Check Column B (Product Code) to find the true last content row.
        // This ignores empty rows that might have formatting.
        var lastRow = sheet.getLastRow();
        var targetRow = lastRow + 1;

        // Scan upwards from the detected last row to find actual text
        if (lastRow > 1) {
            // Get all values in Column B up to lastRow
            var range = sheet.getRange("B1:B" + lastRow).getValues();
            var foundData = false;
            for (var i = range.length - 1; i >= 0; i--) {
                if (range[i][0] && range[i][0].toString().trim() !== "") {
                    targetRow = i + 2; // Row index is i+1, so next is i+2
                    foundData = true;
                    break;
                }
            }
            // If no data found in Col B, start at Row 2 (assuming Row 1 is Header)
            if (!foundData) targetRow = 2;
        } else {
            targetRow = 2;
        }

        var entry = data.entry;
        var rowData = [];

        if (data.action === 'add_rm') {
            // RM Data Structure (A-R)
            rowData = [
                "'" + (entry.date || ''), // Force Text
                entry.productCode || '',
                entry.productName || '',
                entry.type || '',
                entry.containerQty || 0,
                entry.containerWeight || 0,
                entry.remainder || 0,
                entry.inQty || 0,
                entry.outQty || 0,
                entry.balance || 0,
                entry.lotNo || '',
                entry.vendorLot || '',
                entry.mfgDate || '',
                entry.expDate || '',
                entry.daysLeft || '',
                entry.lotBalance || 0,
                entry.supplier || '',
                entry.remark || ''
            ];
        } else {
            // Package Data Structure
            rowData = [
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
        }

        // Write the data to the calculated targetRow
        sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);

        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "row": targetRow }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}
