/**
 * ===================================================================
 * Stock Card Web App - Apps Script (UPDATED with Delete & Transfer)
 * ===================================================================
 * 
 * วิธีติดตั้ง:
 * 1. เปิด Google Sheets ไฟล์ RM (สต็อคการ์ด สาร Center จ้า)
 * 2. ไปที่ Extensions > Apps Script
 * 3. ลบโค้ดเก่าทั้งหมด แล้ววางโค้ดนี้แทน
 * 4. กด Save (Ctrl+S)
 * 5. กด Deploy > Manage deployments > Edit > New version > Deploy
 * 
 * ===================================================================
 */

// ==================== GET REQUEST ====================

function doGet(e) {
    var action = e.parameter.action;

    // Auto-initialize Users and ActivityLog sheets on first call
    try {
        getUsersSheet();
        getActivityLogSheet();
    } catch (initError) {
        // Ignore initialization errors
    }

    // Get RM Master Data
    if (action === 'getRMMaster') {
        return getRMMasterData();
    }

    // Get Users for Login
    if (action === 'getUsers') {
        return getUsersList();
    }

    // Default response
    return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Unknown GET action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);
}


// ==================== GET RM MASTER DATA ====================

function getRMMasterData() {
    try {
        var ss = SpreadsheetApp.openById('1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs');
        var masterSheet = ss.getSheetByName('RawMaterial') || ss.getSheetByName('Master');

        if (!masterSheet) {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'RawMaterial or Master sheet not found'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var data = masterSheet.getDataRange().getValues();
        var masterData = [];

        // RawMaterial columns: A=Product Code, B=Product Name, C=โรงงานผลิต (Supplier)
        for (var i = 1; i < data.length; i++) {
            var row = data[i];
            if (row[0]) {
                masterData.push({
                    code: row[0] || '',
                    name: row[1] || '',
                    supplier: row[2] || ''
                });
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            data: masterData
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== POST REQUEST ====================

function doPost(e) {
    var lock = LockService.getScriptLock();

    try {
        lock.tryLock(10000);

        var data = JSON.parse(e.postData.contents);
        var action = data.action;

        // ===== DELETE RM =====
        if (action === 'delete_rm') {
            return deleteRMEntry(data);
        }

        // ===== TRANSFER TO PRODUCTION =====
        if (action === 'transferToProduction') {
            var dataArray = data.data;
            if (typeof dataArray === 'string') {
                dataArray = JSON.parse(dataArray);
            }
            var result = transferToProduction(dataArray);
            return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
        }

        // ===== USER LOGIN =====
        if (action === 'loginUser') {
            return loginUser(data);
        }

        // ===== UPDATE PASSWORD =====
        if (action === 'updatePassword') {
            return updateUserPassword(data);
        }

        // ===== ADD USER =====
        if (action === 'addUser') {
            return addNewUser(data);
        }

        // ===== DELETE USER =====
        if (action === 'deleteUser') {
            return deleteUser(data);
        }

        // ===== LOG ACTIVITY =====
        if (action === 'logActivity') {
            return logActivityToSheet(data);
        }

        // ===== ADD RM / ADD PACKAGE (เดิม) =====
        var sheetId = (action === 'add_rm') ? '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs' : '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU';
        var sheetName = (action === 'add_rm') ? 'Sheet1' : 'บันทึก StockCard';

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

        if (action === 'add_rm') {

            // 1. Copy Formulas
            if (targetRow > 2) {
                var sourceRange = sheet.getRange(targetRow - 1, 1, 1, 18);
                var destRange = sheet.getRange(targetRow, 1, 1, 18);
                sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);

                // IMPORTANT: Clear Column A format and set to plain text BEFORE writing
                var cellA = sheet.getRange(targetRow, 1);
                cellA.clearFormat();
                cellA.setNumberFormat('@');
            }

            // 2. Check Formulas
            var targetRange = sheet.getRange(targetRow, 1, 1, 18);
            var formulas = targetRange.getFormulas()[0];

            // 3. Prepare Map
            var map = [];
            // Write date as plain text (setNumberFormat('@') already applied above)
            map[0] = entry.date || "";
            map[1] = entry.productCode || "";
            map[2] = entry.productName || ""; // Write Name (no formula)
            map[3] = entry.type || "";

            // E,F (Container)
            map[4] = (entry.containerQty !== undefined && entry.containerQty !== "") ? entry.containerQty : null;
            map[5] = (entry.containerWeight !== undefined && entry.containerWeight !== "") ? entry.containerWeight : null;

            // G (Remainder) - ต้องเขียน
            map[6] = (entry.remainder !== undefined && entry.remainder !== "") ? entry.remainder : null;

            // H (In Qty) - ต้องเขียน
            map[7] = (entry.inQty !== undefined && entry.inQty !== "") ? entry.inQty : null;

            // I (Out)
            map[8] = (entry.outQty !== undefined && entry.outQty !== "") ? entry.outQty : null;

            // J Balance -> Calculate from previous balance + in - out
            var prevBalance = 0;
            if (targetRow > 2) {
                // Get previous row's balance for same product
                var allData = sheet.getDataRange().getValues();
                for (var r = targetRow - 2; r >= 1; r--) {
                    if (allData[r][1] === entry.productCode) { // Column B = productCode
                        prevBalance = parseFloat(allData[r][9]) || 0; // Column J = balance
                        break;
                    }
                }
            }
            var inQty = parseFloat(entry.inQty) || 0;
            var outQty = parseFloat(entry.outQty) || 0;
            map[9] = prevBalance + inQty - outQty; // J Balance

            map[10] = entry.lotNo || "";
            map[11] = (entry.vendorLot !== undefined && entry.vendorLot !== "") ? entry.vendorLot : null;
            map[12] = (entry.mfgDate !== undefined && entry.mfgDate !== "") ? entry.mfgDate : null;
            map[13] = (entry.expDate !== undefined && entry.expDate !== "") ? entry.expDate : null;

            // O (Days Left) -> Calculate from EXP date
            var daysLeft = "";
            if (entry.expDate && entry.expDate !== "-") {
                try {
                    var expParts = String(entry.expDate).split("/");
                    if (expParts.length === 3) {
                        var expDay = parseInt(expParts[0]);
                        var expMonth = parseInt(expParts[1]) - 1;
                        var expYear = parseInt(expParts[2]);
                        // Convert Thai year to AD if > 2500
                        if (expYear > 2500) expYear = expYear - 543;
                        var expDateObj = new Date(expYear, expMonth, expDay);
                        expDateObj.setHours(0, 0, 0, 0);
                        // Use Thailand timezone (UTC+7)
                        var now = new Date();
                        var thaiOffset = 7 * 60; // Thailand is UTC+7
                        var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                        var thaiTime = new Date(utc + (thaiOffset * 60000));
                        thaiTime.setHours(0, 0, 0, 0);
                        var diffTime = expDateObj.getTime() - thaiTime.getTime();
                        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include expiry date
                    }
                } catch (e) {
                    daysLeft = "";
                }
            }
            map[14] = (daysLeft !== "") ? daysLeft : null;

            // P (Lot Balance) -> Calculate for this lot
            var lotBalance = 0;
            if (entry.lotNo) {
                var allData2 = sheet.getDataRange().getValues();
                for (var r2 = 1; r2 < targetRow - 1; r2++) {
                    if (allData2[r2][1] === entry.productCode && allData2[r2][10] === entry.lotNo) {
                        lotBalance += (parseFloat(allData2[r2][7]) || 0) - (parseFloat(allData2[r2][8]) || 0);
                    }
                }
                lotBalance += inQty - outQty;
            }
            map[15] = lotBalance;

            // Q (Supplier) - ต้องเขียน
            map[16] = entry.supplier || "";

            map[17] = entry.remark || "";

            // S (Container Out) - เพิ่ม
            map[18] = (entry.containerOut !== undefined && entry.containerOut !== "") ? entry.containerOut : null;


            var requests = [];
            var currentBatchVal = [];
            var currentBatchStart = -1;

            // Write ALL columns (no formula, no skip)
            for (var i = 0; i < 19; i++) {
                if (currentBatchStart === -1) currentBatchStart = i;
                var valToWrite = (map[i] === null || map[i] === undefined) ? "" : map[i];
                currentBatchVal.push(valToWrite);
            }

            if (currentBatchStart !== -1) {
                requests.push({ col: currentBatchStart + 1, vals: [currentBatchVal] });
            }

            // FIRST: Set Column A format to text BEFORE writing (prevent Buddhist year conversion)
            sheet.getRange(targetRow, 1).setNumberFormat('@');

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


// ==================== DELETE RM ENTRY ====================

function deleteRMEntry(data) {
    try {
        var sheetId = data.spreadsheetId || '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs';
        var sheetName = data.sheetName || 'Sheet1';

        var ss = SpreadsheetApp.openById(sheetId);
        var sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({
                result: 'error',
                error: 'Sheet not found: ' + sheetName
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var rowIndex = data.rowIndex;

        if (!rowIndex || rowIndex < 2) {
            return ContentService.createTextOutput(JSON.stringify({
                result: 'error',
                error: 'Invalid row index: ' + rowIndex
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // Delete the row
        sheet.deleteRow(rowIndex);

        return ContentService.createTextOutput(JSON.stringify({
            result: 'success',
            message: 'Row ' + rowIndex + ' deleted successfully'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({
            result: 'error',
            error: e.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== TRANSFER TO PRODUCTION ====================

function transferToProduction(dataArray) {
    try {
        var ss = SpreadsheetApp.openById('1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs');
        var productionSheet = ss.getSheetByName('production');

        if (!productionSheet) {
            return { success: false, message: 'ไม่พบชีต production - กรุณาสร้างชีตชื่อ "production" ก่อน' };
        }

        var transferredCount = 0;
        var errors = [];

        for (var i = 0; i < dataArray.length; i++) {
            var item = dataArray[i];

            try {
                // Find target row (after last data row)
                var lastRow = productionSheet.getLastRow();
                var targetRow = lastRow + 1;
                if (lastRow > 0) {
                    var values = productionSheet.getRange("B1:B" + lastRow).getValues();
                    for (var j = values.length - 1; j >= 0; j--) {
                        if (values[j][0] && String(values[j][0]).trim() !== "") {
                            targetRow = j + 2;
                            break;
                        }
                    }
                }
                if (targetRow < 2) targetRow = 2;

                // Copy formulas from previous row
                if (targetRow > 2) {
                    var sourceRange = productionSheet.getRange(targetRow - 1, 1, 1, 18);
                    var destRange = productionSheet.getRange(targetRow, 1, 1, 18);
                    sourceRange.copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA);

                    // IMPORTANT: Clear Column A format and set to plain text BEFORE writing
                    var cellA = productionSheet.getRange(targetRow, 1);
                    cellA.clearFormat();
                    cellA.setNumberFormat('@');
                }

                // Check formulas
                var targetRange = productionSheet.getRange(targetRow, 1, 1, 18);
                var formulas = targetRange.getFormulas()[0];

                // Prepare data map
                var map = [];
                // Write date - ensure it's plain text by using explicit text format
                var transferDateStr = item.transferDate;
                if (!transferDateStr) {
                    var now = new Date();
                    transferDateStr = now.getDate() + '/' + (now.getMonth() + 1) + '/' + now.getFullYear();
                }
                // Use setValue separately for date to ensure plain text
                var cellA = productionSheet.getRange(targetRow, 1);
                cellA.setValue(transferDateStr);
                map[0] = null; // Skip in setValues since we already set it
                map[1] = item.productCode || "";
                map[2] = item.productName || ""; // Write Name (no formula)
                map[3] = "รับเข้า (โอนจาก Center)";
                map[4] = (item.containerQty !== undefined) ? item.containerQty : null;
                map[5] = (item.containerWeight !== undefined) ? item.containerWeight : null;
                map[6] = (item.remainder !== undefined) ? item.remainder : null; // G (Remainder)
                var inQtyPD = item.quantity || 0;
                map[7] = inQtyPD; // H (IN)
                map[8] = 0; // I (OUT) = 0 for receive

                // J Balance -> Calculate
                var prevBalancePD = 0;
                if (targetRow > 2) {
                    var allDataPD = productionSheet.getDataRange().getValues();
                    for (var rPD = targetRow - 2; rPD >= 1; rPD--) {
                        if (allDataPD[rPD][1] === item.productCode) {
                            prevBalancePD = parseFloat(allDataPD[rPD][9]) || 0;
                            break;
                        }
                    }
                }
                map[9] = prevBalancePD + inQtyPD; // J Balance

                map[10] = item.lotNo || "";
                map[11] = item.vendorLot || "";
                map[12] = item.mfgDate || "";
                map[13] = item.expDate || "";

                // O (Days Left) -> Calculate
                var daysLeftPD = "";
                if (item.expDate && item.expDate !== "-") {
                    try {
                        var expPartsPD = String(item.expDate).split("/");
                        if (expPartsPD.length === 3) {
                            var expDayPD = parseInt(expPartsPD[0]);
                            var expMonthPD = parseInt(expPartsPD[1]) - 1;
                            var expYearPD = parseInt(expPartsPD[2]);
                            if (expYearPD > 2500) expYearPD = expYearPD - 543;
                            var expDateObjPD = new Date(expYearPD, expMonthPD, expDayPD);
                            expDateObjPD.setHours(0, 0, 0, 0);
                            // Use Thailand timezone (UTC+7)
                            var nowPD = new Date();
                            var thaiOffsetPD = 7 * 60;
                            var utcPD = nowPD.getTime() + (nowPD.getTimezoneOffset() * 60000);
                            var thaiTimePD = new Date(utcPD + (thaiOffsetPD * 60000));
                            thaiTimePD.setHours(0, 0, 0, 0);
                            var diffTimePD = expDateObjPD.getTime() - thaiTimePD.getTime();
                            daysLeftPD = Math.ceil(diffTimePD / (1000 * 60 * 60 * 24)) + 1; // +1 to include expiry date
                        }
                    } catch (e) {
                        daysLeftPD = "";
                    }
                }
                map[14] = (daysLeftPD !== "") ? daysLeftPD : null;

                // P (Lot Balance) -> Calculate
                var lotBalancePD = 0;
                if (item.lotNo) {
                    var allDataPD2 = productionSheet.getDataRange().getValues();
                    for (var rPD2 = 1; rPD2 < targetRow - 1; rPD2++) {
                        if (allDataPD2[rPD2][1] === item.productCode && allDataPD2[rPD2][10] === item.lotNo) {
                            lotBalancePD += (parseFloat(allDataPD2[rPD2][7]) || 0) - (parseFloat(allDataPD2[rPD2][8]) || 0);
                        }
                    }
                    lotBalancePD += inQtyPD;
                }
                map[15] = lotBalancePD;

                map[16] = item.supplier || ""; // Q (Supplier)
                map[17] = "โอนจาก Center: " + (item.originalDate || "");

                // Write data (skip Column A which is already set separately)
                var requests = [];
                var currentBatchVal = [];
                var currentBatchStart = -1;

                // Write columns B onwards (skip Column A which was set separately)
                for (var k = 1; k < 19; k++) {
                    if (currentBatchStart === -1) currentBatchStart = k;
                    var valToWrite = (map[k] === null || map[k] === undefined) ? "" : map[k];
                    currentBatchVal.push(valToWrite);
                }

                if (currentBatchStart !== -1) {
                    requests.push({ col: currentBatchStart + 1, vals: [currentBatchVal] });
                }

                // Column A format already set by clearFormat + setNumberFormat above

                requests.forEach(function (req) {
                    productionSheet.getRange(targetRow, req.col, 1, req.vals[0].length).setValues(req.vals);
                });

                transferredCount++;

            } catch (rowError) {
                errors.push('รายการ ' + (i + 1) + ': ' + rowError.message);
            }
        }

        SpreadsheetApp.flush();

        if (errors.length > 0) {
            return {
                success: true,
                message: 'โอนสำเร็จ ' + transferredCount + ' รายการ (มีข้อผิดพลาด ' + errors.length + ' รายการ)',
                transferredCount: transferredCount,
                errors: errors
            };
        }

        return {
            success: true,
            message: 'โอนข้อมูลสำเร็จทั้งหมด ' + transferredCount + ' รายการ',
            transferredCount: transferredCount
        };

    } catch (error) {
        return {
            success: false,
            message: 'เกิดข้อผิดพลาด: ' + error.message
        };
    }
}


// ==================== USER MANAGEMENT ====================

/**
 * รันฟังก์ชันนี้ครั้งแรกเพื่อสร้าง Tab Users และ ActivityLog
 * วิธีรัน: เลือก initializeUserSystem จาก dropdown แล้วกดปุ่ม Run ▶️
 */
function initializeUserSystem() {
    var usersSheet = getUsersSheet();
    var activitySheet = getActivityLogSheet();

    Logger.log('✅ Users sheet created/verified: ' + usersSheet.getName());
    Logger.log('✅ ActivityLog sheet created/verified: ' + activitySheet.getName());
    Logger.log('📋 ระบบพร้อมใช้งาน!');
}

// Get or Create Users Sheet
function getUsersSheet() {
    var ss = SpreadsheetApp.openById('1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs');
    var sheet = ss.getSheetByName('Users');

    if (!sheet) {
        // Create Users sheet with headers
        sheet = ss.insertSheet('Users');
        sheet.appendRow(['username', 'password', 'name', 'role', 'modules', 'created', 'lastLogin']);
        // Add default admin user
        sheet.appendRow(['admin', 'admin123', 'Admin', 'admin', 'package,rm,rm_production,consumable,general', new Date().toISOString(), '']);
    }

    return sheet;
}

// Get Users List (for login)
function getUsersList() {
    try {
        var sheet = getUsersSheet();
        var data = sheet.getDataRange().getValues();
        var users = [];

        // Skip header row
        for (var i = 1; i < data.length; i++) {
            var row = data[i];
            if (row[0]) { // has username
                users.push({
                    username: row[0],
                    password: row[1], // Will be hashed in production
                    name: row[2],
                    role: row[3] || 'viewer',
                    modules: (row[4] || '').split(',').map(function (m) { return m.trim(); }).filter(function (m) { return m; })
                });
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            users: users
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Login User
function loginUser(data) {
    try {
        var sheet = getUsersSheet();
        var allData = sheet.getDataRange().getValues();

        var username = data.username;
        var password = data.password;

        for (var i = 1; i < allData.length; i++) {
            if (allData[i][0] === username && allData[i][1] === password) {
                // Update last login time
                sheet.getRange(i + 1, 7).setValue(new Date().toISOString());

                return ContentService.createTextOutput(JSON.stringify({
                    success: true,
                    user: {
                        username: allData[i][0],
                        name: allData[i][2],
                        role: allData[i][3] || 'viewer',
                        modules: (allData[i][4] || '').split(',').map(function (m) { return m.trim(); }).filter(function (m) { return m; })
                    }
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Update User Password
function updateUserPassword(data) {
    try {
        var sheet = getUsersSheet();
        var allData = sheet.getDataRange().getValues();

        var username = data.username;
        var currentPassword = data.currentPassword;
        var newPassword = data.newPassword;

        for (var i = 1; i < allData.length; i++) {
            if (allData[i][0] === username) {
                // Verify current password
                if (allData[i][1] !== currentPassword) {
                    return ContentService.createTextOutput(JSON.stringify({
                        success: false,
                        message: 'รหัสผ่านเดิมไม่ถูกต้อง'
                    })).setMimeType(ContentService.MimeType.JSON);
                }

                // Update password
                sheet.getRange(i + 1, 2).setValue(newPassword);

                return ContentService.createTextOutput(JSON.stringify({
                    success: true,
                    message: 'เปลี่ยนรหัสผ่านสำเร็จ'
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'ไม่พบผู้ใช้นี้'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Add New User (Admin only)
function addNewUser(data) {
    try {
        var sheet = getUsersSheet();
        var allData = sheet.getDataRange().getValues();

        // Check if username already exists
        for (var i = 1; i < allData.length; i++) {
            if (allData[i][0] === data.username) {
                return ContentService.createTextOutput(JSON.stringify({
                    success: false,
                    message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว'
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        // Add new user
        var modules = Array.isArray(data.modules) ? data.modules.join(',') : data.modules;
        sheet.appendRow([
            data.username,
            data.password,
            data.name,
            data.role || 'viewer',
            modules,
            new Date().toISOString(),
            ''
        ]);

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'เพิ่มผู้ใช้สำเร็จ'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// Delete User (Admin only)
function deleteUser(data) {
    try {
        var sheet = getUsersSheet();
        var allData = sheet.getDataRange().getValues();

        // Cannot delete admin
        if (data.username === 'admin') {
            return ContentService.createTextOutput(JSON.stringify({
                success: false,
                message: 'ไม่สามารถลบผู้ใช้ admin ได้'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        for (var i = 1; i < allData.length; i++) {
            if (allData[i][0] === data.username) {
                sheet.deleteRow(i + 1);

                return ContentService.createTextOutput(JSON.stringify({
                    success: true,
                    message: 'ลบผู้ใช้สำเร็จ'
                })).setMimeType(ContentService.MimeType.JSON);
            }
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'ไม่พบผู้ใช้นี้'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}


// ==================== ACTIVITY LOG ====================

// Get or Create ActivityLog Sheet
function getActivityLogSheet() {
    var ss = SpreadsheetApp.openById('1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs');
    var sheet = ss.getSheetByName('ActivityLog');

    if (!sheet) {
        // Create ActivityLog sheet with headers
        sheet = ss.insertSheet('ActivityLog');
        sheet.appendRow(['timestamp', 'username', 'name', 'module', 'action', 'details']);
    }

    return sheet;
}

// Log Activity to Sheet
function logActivityToSheet(data) {
    try {
        var sheet = getActivityLogSheet();

        sheet.appendRow([
            data.timestamp || new Date().toISOString(),
            data.username || '',
            data.userName || '',
            data.module || '',
            data.action || '',
            data.details || ''
        ]);

        return ContentService.createTextOutput(JSON.stringify({
            success: true
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}
