function doPost(e) {
    var lock = LockService.getScriptLock();

    try {
        // Lock for 10 seconds
        lock.tryLock(10000);

        var data = JSON.parse(e.postData.contents);

        var sheetId = (data.action === 'add_rm') ? '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs' : '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
        var sheetName = (data.action === 'add_rm') ? 'Sheet1' : 'บันทึก StockCard';

        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = ss.getSheets()[0];

        // --- Fast Row Detection ---
        var lastRow = sheet.getLastRow();
        var targetRow = lastRow + 1;
        if (lastRow > 0) {
            // Grab last 50 rows of Col B to check (faster than getting all if large sheet, but all is safer for "holes")
            // Let's stick to reading all B for robustness but it's one call.
            var values = sheet.getRange("B1:B" + lastRow).getValues();
            for (var i = values.length - 1; i >= 0; i--) {
                if (values[i][0] && String(values[i][0]).trim() !== "") {
                    targetRow = i + 2;
                    break;
                }
            }
        }
        if (targetRow < 2) targetRow = 2;

        var entry = data.entry;
        var resultInfo = { "result": "success", "row": targetRow };

        if (data.action === 'add_rm') {
            // --- OPTIMIZED BATCH WRITE ---

            // 1. Copy ALL formulas from previous row in ONE call
            // Assuming columns A-R (1-18)
            if (targetRow > 2) {
                var sourceRange = sheet.getRange(targetRow - 1, 1, 1, 18);
                var destRange = sheet.getRange(targetRow, 1, 1, 18);
                sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
            }

            // 2. Get current formulas of the target row to decide where to write
            // (This tells us which cells got a formula from the copy)
            var targetRange = sheet.getRange(targetRow, 1, 1, 18);
            var formulas = targetRange.getFormulas()[0]; // Array of 18 strings

            // 3. Prepare Data Map
            // We map column index (0-based) to the value we WANT to write.
            // Use 'undefined' if checking formula, or specific value.
            var map = [];
            // A(0): Date
            map[0] = "'" + (entry.date || "");
            // B(1): Code
            map[1] = entry.productCode || "";
            // C(2): Name (Formula) -> check formula
            // D(3): Type
            map[3] = entry.type || "";
            // E-G(4-6): Container
            map[4] = (entry.containerQty !== undefined && entry.containerQty !== "") ? entry.containerQty : null; // null means clear
            map[5] = (entry.containerWeight !== undefined && entry.containerWeight !== "") ? entry.containerWeight : null;
            map[6] = (entry.remainder !== undefined && entry.remainder !== "") ? entry.remainder : null;
            // H-I(7-8): In/Out
            map[7] = (entry.inQty !== undefined && entry.inQty !== "") ? entry.inQty : null;
            map[8] = (entry.outQty !== undefined && entry.outQty !== "") ? entry.outQty : null;
            // J(9): Balance (Formula)
            // K(10): Lot
            map[10] = entry.lotNo || "";
            // L-N(11-13): Vendor...
            map[11] = (entry.vendorLot !== undefined && entry.vendorLot !== "") ? entry.vendorLot : null;
            map[12] = (entry.mfgDate !== undefined && entry.mfgDate !== "") ? entry.mfgDate : null;
            map[13] = (entry.expDate !== undefined && entry.expDate !== "") ? entry.expDate : null;
            // O-P(14-15): Formulas
            // Q(16): Supplier
            map[16] = (entry.supplier !== undefined && entry.supplier !== "") ? entry.supplier : null;
            // R(17): Remark
            map[17] = entry.remark || "";

            // 4. Construct Batches
            // We iterate 0 to 17. 
            // If formulas[i] is NOT empty -> Skip (do not overwrite formula).
            // If formulas[i] IS empty -> Add to current batch.

            var requests = [];
            var currentBatchVal = [];
            var currentBatchStart = -1;

            for (var i = 0; i < 18; i++) {
                var hasFormula = (formulas[i] !== "");

                // Should we write to this cell?
                // Yes, if NO formula exists.
                if (!hasFormula) {
                    // If we are starting a new batch
                    if (currentBatchStart === -1) {
                        currentBatchStart = i;
                    }
                    // Add value to batch (handle null as "")
                    var valToWrite = (map[i] === null || map[i] === undefined) ? "" : map[i];
                    currentBatchVal.push(valToWrite);
                } else {
                    // This cell has a formula. specific skip.
                    // If we have an active batch, verify if we need to close it.
                    if (currentBatchStart !== -1) {
                        // Close current batch
                        requests.push({
                            col: currentBatchStart + 1, // 1-based
                            vals: [currentBatchVal] // 2D array for setValues
                        });
                        currentBatchVal = [];
                        currentBatchStart = -1;
                    }
                }
            }
            // Close trailing batch
            if (currentBatchStart !== -1) {
                requests.push({
                    col: currentBatchStart + 1,
                    vals: [currentBatchVal]
                });
            }

            // 5. Execute Batches (Few calls as possible)
            requests.forEach(function (req) {
                sheet.getRange(targetRow, req.col, 1, req.vals[0].length).setValues(req.vals);
            });

            SpreadsheetApp.flush();

        } else {
            // --- Package Module (Already fast 1-call) ---
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

        return ContentService.createTextOutput(JSON.stringify(resultInfo)).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": e.toString() })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        try { lock.releaseLock(); } catch (e) { }
    }
}
