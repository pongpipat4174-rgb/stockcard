// ==========================================
// Google Apps Script - Stock Card System (FULL VERSION)
// รวมทุก Module: Package, RM, Consumable, GeneralStock
// ==========================================
// Sheet ID: 1nn_YGIjdakJmTFveeZJUKhV8krXJfIxo0JKCw5UrecA
// ==========================================

// ===== MAIN ENTRY POINTS =====

function doGet(e) {
    var params = e.parameter || {};
    var action = params.action;
    var sheet = params.sheet;

    try {
        // ===== CONSUMABLE =====
        if (action == 'load_all' && sheet == 'Consumable') {
            return loadConsumable();
        }

        // ===== GENERAL STOCK =====
        if (action == 'load_all' && sheet == 'GeneralStock') {
            return loadGeneralStock();
        }

        // ===== DEFAULT: Return empty =====
        return ContentService.createTextOutput(JSON.stringify({
            items: [],
            transactions: [],
            message: "No matching action/sheet"
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
            error: err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

function doPost(e) {
    var lock = LockService.getScriptLock();

    try {
        lock.tryLock(10000);

        var data = JSON.parse(e.postData.contents);
        var action = data.action;
        var sheet = data.sheet;

        // ===== CONSUMABLE =====
        if (action == 'save_all' && sheet == 'Consumable') {
            return saveConsumable(data);
        }

        // ===== GENERAL STOCK =====
        if (action == 'save_all' && sheet == 'GeneralStock') {
            return saveGeneralStock(data);
        }

        // ===== RM (Raw Material) =====
        if (action === 'add_rm') {
            return addRMEntry(data);
        }

        // ===== PACKAGE =====
        if (action === 'add_package' || !action) {
            return addPackageEntry(data);
        }

        return ContentService.createTextOutput(JSON.stringify({
            result: "error",
            message: "Unknown action: " + action
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
            result: "error",
            error: err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        try { lock.releaseLock(); } catch (e) { }
    }
}


// ==========================================
// CONSUMABLE MODULE
// ==========================================

function loadConsumable() {
    var ss = SpreadsheetApp.openById('1nn_YGIjdakJmTFveeZJUKhV8krXJfIxo0JKCw5UrecA');

    // Load Items
    var itemSheet = ss.getSheetByName('Consumable');
    var items = [];
    if (itemSheet && itemSheet.getLastRow() > 1) {
        var lastRow = itemSheet.getLastRow();
        var data = itemSheet.getRange(2, 1, lastRow - 1, 21).getDisplayValues();

        items = data.map(function (row) {
            return {
                "ชื่อสินค้า": row[0],      // Column A - Product Name
                "category": row[1],        // Column B - weight/unit
                "คงเหลือ (ลัง)": row[2],   // Column C - Stock (Cartons)
                "เศษ (กก.)": row[3],       // Column D - Partial (kg)
                "กก./ลัง": row[4],         // Column E - kg/Carton
                "รวม (กก.)": row[5],       // Column F - Total kg
                "จุดสั่งซื้อ (กก.)": row[6], // Column G - Min order
                "ชิ้น/กก.1": row[7],       // Column H
                "ชิ้น/ม้วน": row[8],       // Column I
                "ชิ้น/ถุง": row[9],        // Column J
                "ชิ้น FG/ลัง": row[10],    // Column K
                "สถานะ": row[11],          // Column L - Status
                "รวม (ชิ้น)": row[12],     // Column M
                "ได้ FG (ลัง)": row[13],   // Column N
                "สถานะขั้นต่ำ": row[14],   // Column O
                "ความยาวม้วน (ม.)": row[15], // Column P
                "Yield/ม้วน": row[16],     // Column Q
                "StockCode": row[17],      // Column R
                "ความยาวตัด (มม.)": row[18], // Column S (unused)
                "รอรับ (จำนวน)": row[19],  // Column T
                "กำหนดรับของ": row[20]     // Column U
            };
        });
    }

    // Load Transactions
    var transSheet = ss.getSheetByName('Consumable_Transactions');
    var transactions = [];
    if (transSheet && transSheet.getLastRow() > 1) {
        var tData = transSheet.getRange(2, 1, transSheet.getLastRow() - 1, 9).getDisplayValues();
        transactions = tData.map(function (row) {
            return {
                "ID": row[0],
                "วันที่": row[1],
                "ประเภท": row[2],
                "ItemIndex": row[3],
                "ชื่อสินค้า": row[4],
                "จำนวน (กก.)": row[5],
                "จำนวน (ลัง)": row[6],
                "คงเหลือ (ลัง)": row[7],
                "หมายเหตุ": row[8]
            };
        });
    }

    return ContentService.createTextOutput(JSON.stringify({
        items: items,
        transactions: transactions
    })).setMimeType(ContentService.MimeType.JSON);
}

function saveConsumable(data) {
    var ss = SpreadsheetApp.openById('1nn_YGIjdakJmTFveeZJUKhV8krXJfIxo0JKCw5UrecA');

    // Save Items
    var itemSheet = ss.getSheetByName('Consumable');
    if (!itemSheet) {
        itemSheet = ss.insertSheet('Consumable');
        itemSheet.appendRow(['ชื่อสินค้า', 'ประเภท', 'คงเหลือ (ลัง)', 'เศษ (กก.)', 'กก./ลัง', 'รวม (กก.)', 'จุดสั่งซื้อ (กก.)', 'ชิ้น/กก.1', 'ชิ้น/ม้วน', 'ชิ้น/ถุง', 'ชิ้น FG/ลัง', 'สถานะ', 'รวม (ชิ้น)', 'ได้ FG (ลัง)', 'สถานะขั้นต่ำ', 'ความยาวม้วน (ม.)', 'Yield/ม้วน', 'StockCode', 'ความยาวตัด (มม.)', 'รอรับ (จำนวน)', 'กำหนดรับของ']);
    }

    // Clear old data
    if (itemSheet.getLastRow() > 1) {
        itemSheet.getRange(2, 1, itemSheet.getLastRow() - 1, 21).clearContent();
    }

    var items = data.items;
    if (items && items.length > 0) {
        var rows = items.map(function (item) {
            return [
                item["ชื่อสินค้า"] || item.name || "",
                item["ประเภท"] || item.category || "weight",
                item["สต็อก (ลัง)"] || item["คงเหลือ (ลัง)"] || item.stockCartons || 0,
                item["เศษ(กก.)"] || item["เศษ (กก.)"] || item.stockPartialKg || 0,
                item["กก./ลัง"] || item.kgPerCarton || 25,
                item["รวม (กก.)"] || "",
                item["จุดสั่งซื้อ (กก.)"] || item.minThreshold || 0,
                item["ชิ้น/กก."] || item["ชิ้น/กก.1"] || item.pcsPerKg || "",
                item["ชิ้น/ม้วน"] || item.pcsPerRoll || "",
                item["ชิ้นงาน/ถุง"] || item["ชิ้น/ถุง"] || item.pcsPerPack || "",
                item["ชิ้น FG/ลัง"] || item.fgPcsPerCarton || "",
                item["สถานะ"] || "",
                item["รวมถุง (ชิ้น)"] || item["ผลิตได้ (ชิ้น)"] || item["รวม (ชิ้น)"] || "",
                item["ผลิตได้ (ลัง)"] || item["ได้ FG (ลัง)"] || "",
                item["สถานะขั้นต่ำ"] || "",
                item["ความยาวม้วน (ม.)"] || item.rollLength || "",
                item["Yield/ม้วน"] || item.fgYieldPerRoll || "",
                item["StockCode"] || item.stockCode || "",
                item["ความยาวตัด (มม.)"] || item.cutLength || "",
                item["รอรับ (จำนวน)"] || item.pendingQty || "",
                item["กำหนดรับของ"] || item.dueDate || ""
            ];
        });
        itemSheet.getRange(2, 1, rows.length, 21).setValues(rows);
    }

    // Save Transactions
    var transSheet = ss.getSheetByName('Consumable_Transactions');
    if (!transSheet) {
        transSheet = ss.insertSheet('Consumable_Transactions');
        transSheet.appendRow(['ID', 'วันที่', 'ประเภท', 'ItemIndex', 'ชื่อสินค้า', 'จำนวน (กก.)', 'จำนวน (ลัง)', 'คงเหลือ (ลัง)', 'หมายเหตุ']);
    }

    if (transSheet.getLastRow() > 1) {
        transSheet.getRange(2, 1, transSheet.getLastRow() - 1, 9).clearContent();
    }

    var trans = data.transactions;
    if (trans && trans.length > 0) {
        var tRows = trans.map(function (t) {
            return [
                t["ID"] || t.id || "",
                t["วันที่"] || t.date || "",
                t["ประเภท"] || t.type || "",
                t["ItemIndex"] || t.itemIndex || "",
                t["ชื่อสินค้า"] || t.itemName || "",
                t["จำนวน (กก.)"] || t.qtyKg || "",
                t["จำนวน (ลัง)"] || t.qtyCartons || "",
                t["คงเหลือ (ลัง)"] || t.remainingStock || "",
                t["หมายเหตุ"] || t.note || ""
            ];
        });
        transSheet.getRange(2, 1, tRows.length, 9).setValues(tRows);
    }

    return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        itemCount: items ? items.length : 0,
        transCount: trans ? trans.length : 0
    })).setMimeType(ContentService.MimeType.JSON);
}


// ==========================================
// GENERAL STOCK MODULE (อะไหล่ & อุปกรณ์)
// ==========================================

function loadGeneralStock() {
    var ss = SpreadsheetApp.openById('1nn_YGIjdakJmTFveeZJUKhV8krXJfIxo0JKCw5UrecA');

    // Load Items
    var itemSheet = ss.getSheetByName('GeneralStock');
    var items = [];
    if (itemSheet && itemSheet.getLastRow() > 1) {
        var data = itemSheet.getRange(2, 1, itemSheet.getLastRow() - 1, 12).getValues();
        items = data.map(function (r) {
            return {
                id: r[0],
                name: r[1],
                spec: r[2],
                category: r[3],
                unit: r[4],
                stock: r[5],
                min: r[6],
                price: r[7],
                leadTime: r[8],
                supplier: r[9],
                country: r[10],
                image: r[11]
            };
        });
    }

    // Load Transactions
    var transSheet = ss.getSheetByName('GeneralTrans');
    var transactions = [];
    if (transSheet && transSheet.getLastRow() > 1) {
        var tData = transSheet.getRange(2, 1, transSheet.getLastRow() - 1, 8).getValues();
        transactions = tData.map(function (r) {
            var d = r[5];
            var dateStr = d;
            if (Object.prototype.toString.call(d) === "[object Date]") {
                dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
            }
            return {
                id: r[0],
                itemId: r[1],
                itemName: r[2],
                type: r[3],
                qty: r[4],
                date: dateStr,
                note: r[6],
                remaining: r[7]
            };
        });
    }

    return ContentService.createTextOutput(JSON.stringify({
        items: items,
        transactions: transactions
    })).setMimeType(ContentService.MimeType.JSON);
}

function saveGeneralStock(data) {
    var ss = SpreadsheetApp.openById('1nn_YGIjdakJmTFveeZJUKhV8krXJfIxo0JKCw5UrecA');

    // Save Items
    var itemSheet = ss.getSheetByName('GeneralStock');
    if (!itemSheet) {
        itemSheet = ss.insertSheet('GeneralStock');
        itemSheet.appendRow(['ID', 'ชื่อสินค้า', 'สเปค', 'หมวดหมู่', 'หน่วย', 'คงเหลือ', 'จุดสั่งซื้อ', 'ราคา', 'Lead Time', 'Supplier', 'ประเทศ', 'รูปภาพ']);
    }

    if (itemSheet.getLastRow() > 1) {
        itemSheet.getRange(2, 1, itemSheet.getLastRow() - 1, 12).clearContent();
    }

    var items = data.items;
    if (items && items.length > 0) {
        var rows = items.map(function (item) {
            return [
                "'" + item.id,
                item.name,
                item.spec,
                item.category,
                item.unit,
                item.stock,
                item.min,
                item.price || "",
                item.leadTime || "",
                item.supplier || "",
                item.country || "",
                item.image || ""
            ];
        });
        itemSheet.getRange(2, 1, rows.length, 12).setValues(rows);
    }

    // Save Transactions
    var transSheet = ss.getSheetByName('GeneralTrans');
    if (!transSheet) {
        transSheet = ss.insertSheet('GeneralTrans');
        transSheet.appendRow(['ID', 'ItemID', 'ItemName', 'Type', 'Qty', 'Date', 'Note', 'Remaining']);
    }

    if (transSheet.getLastRow() > 1) {
        transSheet.getRange(2, 1, transSheet.getLastRow() - 1, 8).clearContent();
    }

    var trans = data.transactions;
    if (trans && trans.length > 0) {
        var tRows = trans.map(function (t) {
            return [
                "'" + t.id,
                "'" + t.itemId,
                t.itemName,
                t.type,
                t.qty,
                t.date,
                t.note,
                t.remaining
            ];
        });
        transSheet.getRange(2, 1, tRows.length, 8).setValues(tRows);
    }

    return ContentService.createTextOutput(JSON.stringify({
        status: "success"
    })).setMimeType(ContentService.MimeType.JSON);
}


// ==========================================
// RM (RAW MATERIAL) MODULE
// ==========================================

function addRMEntry(data) {
    var sheetId = '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs';
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('Sheet1');
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

    // Copy Formulas
    if (targetRow > 2) {
        var sourceRange = sheet.getRange(targetRow - 1, 1, 1, 18);
        var destRange = sheet.getRange(targetRow, 1, 1, 18);
        sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);
    }

    var targetRange = sheet.getRange(targetRow, 1, 1, 18);
    var formulas = targetRange.getFormulas()[0];

    var map = [];
    map[0] = "'" + (entry.date || "");
    map[1] = entry.productCode || "";
    map[2] = null;
    map[3] = entry.type || "";
    map[4] = (entry.containerQty !== undefined && entry.containerQty !== "") ? entry.containerQty : null;
    map[5] = (entry.containerWeight !== undefined && entry.containerWeight !== "") ? entry.containerWeight : null;
    map[6] = null;
    map[7] = null;
    map[8] = (entry.outQty !== undefined && entry.outQty !== "") ? entry.outQty : null;
    map[9] = null;
    map[10] = entry.lotNo || "";
    map[11] = (entry.vendorLot !== undefined && entry.vendorLot !== "") ? entry.vendorLot : null;
    map[12] = (entry.mfgDate !== undefined && entry.mfgDate !== "") ? entry.mfgDate : null;
    map[13] = (entry.expDate !== undefined && entry.expDate !== "") ? entry.expDate : null;
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

    return ContentService.createTextOutput(JSON.stringify({
        result: "success",
        row: targetRow
    })).setMimeType(ContentService.MimeType.JSON);
}


// ==========================================
// PACKAGE MODULE
// ==========================================

function addPackageEntry(data) {
    var sheetId = '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('บันทึก StockCard');
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

    return ContentService.createTextOutput(JSON.stringify({
        result: "success",
        row: targetRow
    })).setMimeType(ContentService.MimeType.JSON);
}
