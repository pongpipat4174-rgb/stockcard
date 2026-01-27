function doPost(e) {
    var lock = LockService.getScriptLock();

    try {
        lock.tryLock(10000);

        var data = JSON.parse(e.postData.contents);
        var sheetId = (data.action === 'add_rm') ? '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs' : '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
        var sheetName = (data.action === 'add_rm') ? 'Sheet1' : 'บันทึก StockCard';

        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) sheet = ss.getSheets()[0];

        var lastRow = sheet.getLastRow();
        var targetRow = lastRow + 1;
        if (lastRow > 0) {
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

            // 1. Copy Formulas
            if (targetRow > 2) {
                var sourceRange = sheet.getRange(targetRow - 1, 1, 1, 18);
                var destRange = sheet.getRange(targetRow, 1, 1, 18);
                sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
            }

            // 2. Check Formulas
            var targetRange = sheet.getRange(targetRow, 1, 1, 18);
            var formulas = targetRange.getFormulas()[0];

            // 3. Prepare Map
            var map = [];
            map[0] = "'" + (entry.date || "");
            map[1] = entry.productCode || "";
            map[2] = null; // Skip Name
            map[3] = entry.type || "";

            // E,F (Container) -> Write info
            map[4] = (entry.containerQty !== undefined && entry.containerQty !== "") ? entry.containerQty : null;
            map[5] = (entry.containerWeight !== undefined && entry.containerWeight !== "") ? entry.containerWeight : null;

            // G (Remainder), H (In) -> USER SAYS NO RIGHT ALIGN NUMBERS HERE? 
            // No, user says "Don't put numbers in G H (right)". 
            // In image: G, H contains 0.00 0.00.
            // This likely breaks ArrayFormula if G/H are calculated.
            // User request: "ไม่ต้องใส่ตัวเลขไปขวา G H" -> Do not put numbers to the right (G H).
            // This implies: Treat G and H like O, P, Q. DO NOT WRITE DATA. CLEAR them to let formula work.

            map[6] = null; // G (Remainder) -> Clear to let ArrayFormula work
            map[7] = null; // H (In) -> Clear to let ArrayFormula work? 
            // Wait, 'In' usually is data entry. But if user says "Don't put numbers", maybe for THIS transaction type?
            // Or maybe H is always calculated?
            // Let's Follow User Command: "Don't put numbers in G H".
            // So we Force Clear G and H.

            // I (Out) -> User didn't mention I. Keep writing Out?
            // Image shows Out (I) has value. G, H have 0.00.
            map[8] = (entry.outQty !== undefined && entry.outQty !== "") ? entry.outQty : null;

            // J Balance -> Skip
            map[9] = null;

            map[10] = entry.lotNo || "";
            map[11] = (entry.vendorLot !== undefined && entry.vendorLot !== "") ? entry.vendorLot : null;
            map[12] = (entry.mfgDate !== undefined && entry.mfgDate !== "") ? entry.mfgDate : null;
            map[13] = (entry.expDate !== undefined && entry.expDate !== "") ? entry.expDate : null;

            // O, P, Q -> Clear
            map[14] = null;
            map[15] = null;
            map[16] = null;

            map[17] = entry.remark || "";


            var requests = [];
            var currentBatchVal = [];
            var currentBatchStart = -1;

            for (var i = 0; i < 18; i++) {
                var hasFormula = (formulas[i] !== "");

                if (hasFormula) {
                    if (currentBatchStart !== -1) {
                        requests.push({ col: currentBatchStart + 1, vals: [currentBatchVal] });
                        currentBatchVal = [];
                        currentBatchStart = -1;
                    }
                    continue;
                }

                if (currentBatchStart === -1) currentBatchStart = i;
                var valToWrite = (map[i] === null || map[i] === undefined) ? "" : map[i];
                currentBatchVal.push(valToWrite);
            }

            if (currentBatchStart !== -1) {
                requests.push({ col: currentBatchStart + 1, vals: [currentBatchVal] });
            }

            requests.forEach(function (req) {
                sheet.getRange(targetRow, req.col, 1, req.vals[0].length).setValues(req.vals);
            });

            SpreadsheetApp.flush();

        } else {
            // Package...
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
