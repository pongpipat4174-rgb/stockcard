/**
 * Stock Card System - Apps Script Backend
 * Updated: 28 Jan 2026
 * Supports: Package and RM modules with ContainerOut tracking
 */

// ======================= SETTINGS =======================

// สามารถเพิ่ม Spreadsheet IDs อื่นได้ที่นี่
const SPREADSHEET_IDS = {
  package: '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU',
  rm: '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs'
};

// ======================= MAIN HANDLERS =======================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    if (action === 'add') {
      return addEntry(data);
    } else if (action === 'add_rm') {
      return addEntryRM(data);
    } else if (action === 'delete') {
      return deleteEntry(data);
    } else if (action === 'delete_rm') {
      return deleteEntryRM(data);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Unknown action: ' + action
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'OK',
    message: 'Stock Card API is running',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ======================= PACKAGE MODULE =======================

function addEntry(data) {
  var spreadsheetId = data.spreadsheetId;
  var sheetName = data.sheetName;
  var entry = data.entry;
  
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Sheet not found: ' + sheetName
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Package columns: วันที่, ประเภท, รหัส, ชื่อ, รับเข้า, เบิกออก, คงเหลือ, Lot, Remark, Supplier
  var row = [
    entry.date,
    entry.type,
    entry.productCode,
    entry.productName,
    entry.inQty || 0,
    entry.outQty || 0,
    '', // Balance - calculated by formula
    entry.lotNo || '',
    entry.remark || '',
    entry.supplier || ''
  ];
  
  // Find actual last row with data (in column A)
  var lastRow = getActualLastRow(sheet, 1); // Column A
  var newRow = lastRow + 1;
  
  // Write data to the next row
  sheet.getRange(newRow, 1, 1, row.length).setValues([row]);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Entry added at row ' + newRow
  })).setMimeType(ContentService.MimeType.JSON);
}

function deleteEntry(data) {
  var spreadsheetId = data.spreadsheetId;
  var sheetName = data.sheetName;
  var rowIndex = data.rowIndex;
  
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  
  if (sheet && rowIndex > 1) {
    sheet.deleteRow(rowIndex);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Row deleted'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Invalid row or sheet'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ======================= RM MODULE =======================

function addEntryRM(data) {
  var spreadsheetId = data.spreadsheetId;
  var sheetName = data.sheetName;
  var entry = data.entry;
  
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Sheet not found: ' + sheetName
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  /**
   * RM Columns:
   * A: วันที่
   * B: รหัสสินค้า
   * C: ชื่อสินค้า
   * D: รายการ (ประเภท)
   * E: จำนวน Container (รับเข้า)
   * F: นน./Container (Kg)
   * G: เศษ (Kg)
   * H: รับเข้า (IN)
   * I: เบิกออก (OUT)
   * J: คงเหลือ (Balance) - formula
   * K: Lot No./FIFO ID
   * L: Vendor Lot
   * M: วันที่ผลิต (MFD)
   * N: วันหมดอายุ (EXP)
   * O: วันคงเหลือ (Days Left) - formula
   * P: คงเหลือเฉพาะ Lot - formula
   * Q: Supplier
   * R: หมายเหตุ
   * S: ถังเบิก (ContainerOut)
   */
  
  var row = [
    entry.date,                           // A: วันที่
    entry.productCode,                    // B: รหัสสินค้า
    entry.productName,                    // C: ชื่อสินค้า
    entry.type,                           // D: รายการ
    entry.containerQty || 0,              // E: จำนวน Container
    entry.containerWeight || 0,           // F: นน./Container
    entry.remainder || 0,                 // G: เศษ
    entry.inQty || 0,                     // H: รับเข้า
    entry.outQty || 0,                    // I: เบิกออก
    '',                                   // J: คงเหลือ (formula)
    entry.lotNo || '',                    // K: Lot No.
    entry.vendorLot || '',                // L: Vendor Lot
    entry.mfgDate || '',                  // M: MFD
    entry.expDate || '',                  // N: EXP
    '',                                   // O: Days Left (formula)
    '',                                   // P: Lot Balance (formula)
    entry.supplier || '',                 // Q: Supplier
    entry.remark || '',                   // R: หมายเหตุ
    entry.containerOut || 0               // S: ถังเบิก
  ];
  
  // Find actual last row with data (in column A)
  var lastRow = getActualLastRow(sheet, 1); // Column A
  var newRow = lastRow + 1;
  
  // Write data to the next row
  sheet.getRange(newRow, 1, 1, row.length).setValues([row]);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'RM Entry added at row ' + newRow
  })).setMimeType(ContentService.MimeType.JSON);
}

function deleteEntryRM(data) {
  var spreadsheetId = data.spreadsheetId;
  var sheetName = data.sheetName;
  var rowIndex = data.rowIndex;
  
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  
  if (sheet && rowIndex > 1) {
    sheet.deleteRow(rowIndex);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'RM Row deleted'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Invalid row or sheet'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ======================= UTILITY FUNCTIONS =======================

/**
 * Get actual last row with data in a specific column
 * This avoids the issue where getLastRow() returns rows with formatting/validation
 */
function getActualLastRow(sheet, column) {
  var data = sheet.getRange(1, column, sheet.getMaxRows(), 1).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][0] !== '' && data[i][0] !== null) {
      return i + 1;
    }
  }
  return 1; // Return 1 if sheet is empty (header row)
}

/**
 * Test function to verify script is working
 */
function testScript() {
  Logger.log('Apps Script is working!');
  Logger.log('Timestamp: ' + new Date().toISOString());
}

/**
 * Get sheet structure info
 */
function getSheetInfo(spreadsheetId, sheetName) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return { error: 'Sheet not found' };
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  return {
    spreadsheetId: spreadsheetId,
    sheetName: sheetName,
    headers: headers,
    lastRow: sheet.getLastRow(),
    lastColumn: sheet.getLastColumn()
  };
}
