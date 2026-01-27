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

            // --- 1. Copy Formulas from Row Above ---
            // We check C(3), J(10), O(15), P(16)
            // Also adding L(12), M(13), N(14) in case they are formulas
            if (targetRow > 2) {
                var prevRow = targetRow - 1;
                var colsToCheck = [3, 10, 12, 13, 14, 15, 16];
                for (var k = 0; k < colsToCheck.length; k++) {
                    var colIndex = colsToCheck[k];
                    var prevCell = sheet.getRange(prevRow, colIndex);
                    if (prevCell.getFormula() !== "") {
                        prevCell.copyTo(sheet.getRange(targetRow, colIndex), SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
                    }
                    // If not formula, we will handle it in step 2
                }
            }

            // --- 2. Write Data with Explicit Empty Checks ---

            // A: Date
            sheet.getRange(targetRow, 1).setValue("'" + (entry.date || ''));

            // B: Code
            if (entry.productCode && entry.productCode !== '') {
                sheet.getRange(targetRow, 2).setValue(entry.productCode);
            } else {
                sheet.getRange(targetRow, 2).clearContent();
            }

            // C: Name (Formula) -> ALWAYS CLEAR (Formula copied above will populate if it was dragged)
            // Check if we already copied a formula there? No, explicit clear is safer for ArrayFormula.
            // BUT if it's drag down formula, we just copied it. 
            // Logic: If range has formula now (from step 1), DON'T clear.
            if (sheet.getRange(targetRow, 3).getFormula() === "") {
                sheet.getRange(targetRow, 3).clearContent();
            }

            // D: Type
            if (entry.type && entry.type !== '') {
                sheet.getRange(targetRow, 4).setValue(entry.type);
            } else {
                sheet.getRange(targetRow, 4).clearContent();
            }

            // E: Container Qty
            if (entry.containerQty && entry.containerQty !== 0) {
                sheet.getRange(targetRow, 5).setValue(entry.containerQty);
            } else {
                sheet.getRange(targetRow, 5).clearContent();
            }

            // F: Container Weight
            if (entry.containerWeight && entry.containerWeight !== 0) {
                sheet.getRange(targetRow, 6).setValue(entry.containerWeight);
            } else {
                sheet.getRange(targetRow, 6).clearContent();
            }

            // G: Remainder
            if (entry.remainder && entry.remainder !== 0) {
                sheet.getRange(targetRow, 7).setValue(entry.remainder);
            } else {
                sheet.getRange(targetRow, 7).clearContent();
            }

            // H: In Qty
            if (entry.inQty && entry.inQty !== 0) {
                sheet.getRange(targetRow, 8).setValue(entry.inQty);
            } else {
                sheet.getRange(targetRow, 8).clearContent();
            }

            // I: Out Qty
            if (entry.outQty && entry.outQty !== 0) {
                sheet.getRange(targetRow, 9).setValue(entry.outQty);
            } else {
                sheet.getRange(targetRow, 9).clearContent();
            }

            // J: Balance (Formula)
            if (sheet.getRange(targetRow, 10).getFormula() === "") {
                sheet.getRange(targetRow, 10).clearContent();
            }

            // K: Lot No
            if (entry.lotNo && entry.lotNo !== '') {
                sheet.getRange(targetRow, 11).setValue(entry.lotNo);
            } else {
                sheet.getRange(targetRow, 11).clearContent();
            }

            // L: Vendor Lot
            // Only write if NOT a formula (meaning we didn't copy one in Step 1)
            if (sheet.getRange(targetRow, 12).getFormula() === "") {
                if (entry.vendorLot && entry.vendorLot !== '') {
                    sheet.getRange(targetRow, 12).setValue(entry.vendorLot);
                } else {
                    sheet.getRange(targetRow, 12).clearContent();
                }
            }

            // M: MFD
            if (sheet.getRange(targetRow, 13).getFormula() === "") {
                if (entry.mfgDate && entry.mfgDate !== '') {
                    sheet.getRange(targetRow, 13).setValue(entry.mfgDate);
                } else {
                    sheet.getRange(targetRow, 13).clearContent();
                }
            }

            // N: EXP
            if (sheet.getRange(targetRow, 14).getFormula() === "") {
                if (entry.expDate && entry.expDate !== '') {
                    sheet.getRange(targetRow, 14).setValue(entry.expDate);
                } else {
                    sheet.getRange(targetRow, 14).clearContent();
                }
            }

            // O, P (Formulas)
            if (sheet.getRange(targetRow, 15).getFormula() === "") sheet.getRange(targetRow, 15).clearContent();
            if (sheet.getRange(targetRow, 16).getFormula() === "") sheet.getRange(targetRow, 16).clearContent();

            // Q: Supplier
            if (entry.supplier && entry.supplier !== '') {
                sheet.getRange(targetRow, 17).setValue(entry.supplier);
            } else {
                sheet.getRange(targetRow, 17).clearContent();
            }

            // R: Remark
            if (entry.remark && entry.remark !== '') {
                sheet.getRange(targetRow, 18).setValue(entry.remark);
            } else {
                sheet.getRange(targetRow, 18).clearContent();
            }

            SpreadsheetApp.flush();

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
