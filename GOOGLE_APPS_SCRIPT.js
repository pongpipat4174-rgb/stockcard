function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000);

    try {
        var data;
        // Attempt to parse JSON content
        try {
            data = JSON.parse(e.postData.contents);
        } catch (err) {
            // Fallback if formatting is weird
            data = e.parameter;
        }

        var sheetId, sheetName;

        // Determine Logic based on ACTION
        if (data.action === 'add_rm') {
            // --- RM (Raw Material) ---
            // Use ID provided in request OR fallback to Hardcoded RM Sheet ID
            sheetId = data.spreadsheetId || '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs';
            sheetName = data.sheetName || 'Sheet1';

        } else {
            // --- Package (Default) ---
            // Use ID provided in request OR fallback to Hardcoded Package Sheet ID
            sheetId = data.spreadsheetId || '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
            sheetName = data.sheetName || 'บันทึก StockCard';
        }

        // Open the Spreadsheet
        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);

        // Safety check: if sheet name not found, try to use the first sheet
        if (!sheet) {
            sheet = ss.getSheets()[0];
        }

        var entry = data.entry;

        if (data.action === 'add_rm') {
            // Append RM Data (Columns match your RM Sheet Structure)
            // A:Date, B:Code, C:Name, D:Type, E:Cont.Qty, F:Cont.Weight, G:Remainder, H:In, I:Out, J:Balance, K:Lot, L:VendorLot, M:MFD, N:EXP, O:DaysLeft, P:LotBal, Q:Supplier, R:Remark
            sheet.appendRow([
                "'" + entry.date,   // Force Text for Date
                entry.productCode,
                entry.productName,
                entry.type,
                entry.containerQty || 0,
                entry.containerWeight || 0,
                entry.remainder || 0,
                entry.inQty || 0,
                entry.outQty || 0,
                entry.balance || 0, // Calculated balance (optional, usually formula)
                entry.lotNo,
                entry.vendorLot || '',
                entry.mfgDate || '',
                entry.expDate || '',
                entry.daysLeft || '',
                entry.lotBalance || 0,
                entry.supplier || '',
                entry.remark || ''
            ]);

        } else {
            // Append Package Data (Columns match your Package Sheet Structure)
            // A:Date, B:Code, C:Name, D:Type, E:In, F:Out, G:Balance, H:Lot, I:PK_ID, J:User, K:Ref, L:Time, M:Remark
            sheet.appendRow([
                "'" + entry.date,
                entry.productCode,
                entry.productName,
                entry.type,
                entry.inQty,
                entry.outQty,
                entry.balance,
                entry.lotNo,
                entry.pkId,
                entry.user || 'Admin',
                entry.docRef,
                new Date(),
                entry.remark
            ]);
        }

        return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}
