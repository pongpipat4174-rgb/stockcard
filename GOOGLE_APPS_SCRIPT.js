function doPost(e) {
    // Use a simpler lock approach or skip if causing issues, 
    // but generally good to keep. Let's try 10s lock.
    var lock = LockService.getScriptLock();

    try {
        // Try lock for 10 seconds
        lock.tryLock(10000);

        var output = {};
        if (!e || !e.postData || !e.postData.contents) {
            throw new Error("No post data received");
        }

        var data = JSON.parse(e.postData.contents);

        // Determine Sheet
        var sheetId = (data.action === 'add_rm') ? '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs' : '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
        var sheetName = (data.action === 'add_rm') ? 'Sheet1' : 'บันทึก StockCard';

        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = ss.getSheets()[0];

        // --- ROBUST ROW FINDING ---
        // If getLastRow() is unreliable due to formulas/formatting.
        var lastRow = sheet.getLastRow();
        var targetRow = lastRow + 1; // Default append

        // Intelligent scan for REAL last data row in Col B
        if (lastRow > 0) {
            // Read Col B (Product Code) to find last non-empty cell
            var values = sheet.getRange("B1:B" + lastRow).getValues();
            var realLastRow = 0;
            for (var i = values.length - 1; i >= 0; i--) {
                if (values[i][0] && String(values[i][0]).trim() !== "") {
                    realLastRow = i + 1;
                    break;
                }
            }
            targetRow = realLastRow + 1;
        }
        if (targetRow < 2) targetRow = 2; // Always start at least at row 2

        var entry = data.entry;
        if (!entry) throw new Error("No entry data provided.");

        if (data.action === 'add_rm') {

            // --- 1. PRESERVE FORMULAS ---
            // Before writing anything, ensure we are not breaking drag-down formulas.
            // We COPY formulas from the row above (targetRow - 1) to the targetRow.
            if (targetRow > 2) {
                var prevRow = targetRow - 1;
                // Columns likely to have formulas: C(3), J(10), maybe L-R?
                var formulaCols = [3, 10, 15, 16, 17]; // C, J, O, P, Q

                formulaCols.forEach(function (col) {
                    var prevCell = sheet.getRange(prevRow, col);
                    if (prevCell.getFormula() !== "") {
                        prevCell.copyTo(sheet.getRange(targetRow, col), SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
                    }
                });
            }

            // --- 2. WRITE DATA BLOCK ---
            // Write standard fields directly.

            // A: Date
            sheet.getRange(targetRow, 1).setValue("'" + (entry.date || ""));
            // B: Code
            sheet.getRange(targetRow, 2).setValue(entry.productCode || "");

            // C: Name -> SKIP (Formula) - Just in case user wants us to clear if no formula?
            if (sheet.getRange(targetRow, 3).getFormula() === "") sheet.getRange(targetRow, 3).clearContent();

            // D: Type
            sheet.getRange(targetRow, 4).setValue(entry.type || "");

            // E, F, G: Container (Handle 0 vs Empty)
            // If 0, we write 0. If null/undefined, we clear.
            var setValOrClear = function (col, val) {
                if (val !== undefined && val !== null && val !== "") sheet.getRange(targetRow, col).setValue(val);
                else sheet.getRange(targetRow, col).clearContent();
            };

            setValOrClear(5, entry.containerQty);
            setValOrClear(6, entry.containerWeight);
            setValOrClear(7, entry.remainder);

            // H, I: In/Out
            setValOrClear(8, entry.inQty);
            setValOrClear(9, entry.outQty);

            // J: Balance -> SKIP (Formula)
            if (sheet.getRange(targetRow, 10).getFormula() === "") sheet.getRange(targetRow, 10).clearContent();

            // K: Lot No
            sheet.getRange(targetRow, 11).setValue(entry.lotNo || "");

            // L, M, N: Vendor, MFD, EXP
            // Only write if cell is NOT a formula (preserved from copy above)
            if (sheet.getRange(targetRow, 12).getFormula() === "") setValOrClear(12, entry.vendorLot);
            if (sheet.getRange(targetRow, 13).getFormula() === "") setValOrClear(13, entry.mfgDate);
            if (sheet.getRange(targetRow, 14).getFormula() === "") setValOrClear(14, entry.expDate);

            // O: Days -> SKIP (Formula)
            // Check if formula exists (from copy). If not, clear it.
            if (sheet.getRange(targetRow, 15).getFormula() === "") sheet.getRange(targetRow, 15).clearContent();

            // P: Lot Bal -> SKIP (Formula)
            if (sheet.getRange(targetRow, 16).getFormula() === "") sheet.getRange(targetRow, 16).clearContent();

            // Q: Supplier
            // If formula exists (ArrayFormula or copied), SKIP. Else write user input if provided, else Clear.
            if (sheet.getRange(targetRow, 17).getFormula() === "") {
                // User provided supplier?
                if (entry.supplier) sheet.getRange(targetRow, 17).setValue(entry.supplier);
                else sheet.getRange(targetRow, 17).clearContent();
            }

            // R: Remark
            sheet.getRange(targetRow, 18).setValue(entry.remark || "");

            SpreadsheetApp.flush();

        } else {
            // --- Package Module ---
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
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": e.toString() + " Stack: " + e.stack })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        try { lock.releaseLock(); } catch (e) { }
    }
}
