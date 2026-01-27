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

            // 1. Copy Formulas (Safety First)
            if (targetRow > 2) {
                var sourceRange = sheet.getRange(targetRow - 1, 1, 1, 18);
                var destRange = sheet.getRange(targetRow, 1, 1, 18);
                sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
            }

            // 2. CHECK Formulas
            var targetRange = sheet.getRange(targetRow, 1, 1, 18);
            var formulas = targetRange.getFormulas()[0];

            // 3. Prevent Overwrite on Specific Request Columns (G, H, O, P, Q)
            // Even if they are empty of formulas now, User insists they should be formulas or cleared?
            // Actually, user says "Data overwrites G H O P Q".
            // O, P are Days/LotBal -> Formulas.
            // Q is Supplier -> Formula.
            // G is Remainder -> Might be formula?
            // H is In -> Might be formula?

            // Strategy: Force these specific columns to be treated as "Do Not Write" if user setup implies they are formulas.
            // HOWEVER, normally H (In) is data input. If user says H is overwritten, maybe they have formula in H?
            // Let's rely strictly on `formulas[i] !== ""` check.
            // AND explicit overrides for O, P, Q.

            var map = [];
            map[0] = "'" + (entry.date || "");
            map[1] = entry.productCode || "";
            // map[2] Name -> Skip
            map[3] = entry.type || "";

            // E,F (Container)
            map[4] = (entry.containerQty !== undefined && entry.containerQty !== "") ? entry.containerQty : null;
            map[5] = (entry.containerWeight !== undefined && entry.containerWeight !== "") ? entry.containerWeight : null;

            // G (Remainder) -> Check formula? Map it, but logic below will skip if formula exists. 
            map[6] = (entry.remainder !== undefined && entry.remainder !== "") ? entry.remainder : null;

            // H (In) -> Check formula?
            map[7] = (entry.inQty !== undefined && entry.inQty !== "") ? entry.inQty : null;

            // I (Out)
            map[8] = (entry.outQty !== undefined && entry.outQty !== "") ? entry.outQty : null;

            // J Balance -> Skip
            map[10] = entry.lotNo || "";
            map[11] = (entry.vendorLot !== undefined && entry.vendorLot !== "") ? entry.vendorLot : null;
            map[12] = (entry.mfgDate !== undefined && entry.mfgDate !== "") ? entry.mfgDate : null;
            map[13] = (entry.expDate !== undefined && entry.expDate !== "") ? entry.expDate : null;

            // O, P, Q -> Override: FORCE NULL (Clear/Skip) if we want to respect formulas 100%
            // User specifically complained about O,P,Q. 
            // We will map them as null, but if they have formula, the loop below skips them anyway.
            // If they DON'T have formula (e.g. ArrayFormula spilled from top), we must write "" (Clear) to let them spill.
            // But wait, if we write ""/null, does it clear the cell? Yes.

            // Special Handling for O, P, Q: Use null (Clear)
            map[14] = null; // O
            map[15] = null; // P
            map[16] = null; // Q (Supplier) - User says data overwritten, so we clear it.

            map[17] = entry.remark || "";

            var requests = [];
            var currentBatchVal = [];
            var currentBatchStart = -1;

            for (var i = 0; i < 18; i++) {
                var isUserClaimedFormulaCol = (i === 6 || i === 7 || i === 14 || i === 15 || i === 16); // G, H, O, P, Q
                var hasFormula = (formulas[i] !== "");

                // If it has a formula, we SKIP (preserve formula).
                if (hasFormula) {
                    if (currentBatchStart !== -1) {
                        requests.push({ col: currentBatchStart + 1, vals: [currentBatchVal] });
                        currentBatchVal = [];
                        currentBatchStart = -1;
                    }
                    continue;
                }

                // If it does NOT have a formula...
                // For O, P, Q (and maybe G, H if user implies):
                // If user implies these shouldn't be overwritten with data, we should ensure we write NULL implies clear?
                // Actually, if map[i] is null, we write "".

                // Special Case: G(6), H(7). User complained they are overwritten.
                // If they are regular data inputs (Remainder, In), we SHOULD write them.
                // Unleeeess user has a formula there too?
                // If `formulas[i]` detected it, we already skipped.
                // If `formulas[i]` didn't detect it, maybe it's ArrayFormula?
                // If ArrayFormula, we MUST Clear (write "").

                // NOTE: If G or H are inputs, we shouldn't force clear them unless we are sure.
                // But user request "เอาข้อมูลที่บันทึกไปทับ...แก้ไขให้สูตรเดิมทำงานปกติ" implies G/H are formulas.
                // So if map has value, but user says it's formula... logic conflict?
                // Likely user means "If I didn't send data, don't write 0/blank to block formula".
                // My code handles null -> writes "".

                if (currentBatchStart === -1) currentBatchStart = i;
                var valToWrite = (map[i] === null || map[i] === undefined) ? "" : map[i];

                // G/H Protection: If user sends data, we write. If Map is null, we write "" (Clear).
                // This allows ArrayFormula to work if no data sent.

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
