/**
 * Stock Card System - Apps Script Backend v2
 * Updated: 28 Jan 2026
 * OPTIMIZED: Calculates Balance, Days Left, Lot Balance in script (no formulas)
 */

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
    } else if (action === 'recalculate_rm') {
      return recalculateAllRM(data);
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
    message: 'Stock Card API v2 - Optimized',
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
  
  // Calculate balance for this product
  var balance = calculateProductBalance(sheet, entry.productCode) + (entry.inQty || 0) - (entry.outQty || 0);
  
  var row = [
    entry.date,
    entry.type,
    entry.productCode,
    entry.productName,
    entry.inQty || 0,
    entry.outQty || 0,
    balance,  // Calculated balance
    entry.lotNo || '',
    entry.remark || '',
    entry.supplier || ''
  ];
  
  var lastRow = getActualLastRow(sheet, 1);
  var newRow = lastRow + 1;
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

// ======================= RM MODULE (OPTIMIZED) =======================

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
  
  // Calculate values
  var balance = calculateProductBalanceRM(sheet, entry.productCode) + (entry.inQty || 0) - (entry.outQty || 0);
  var lotBalance = calculateLotBalance(sheet, entry.productCode, entry.lotNo) + (entry.inQty || 0) - (entry.outQty || 0);
  var daysLeft = calculateDaysLeft(entry.expDate);
  
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
   * J: คงเหลือ (Balance) - CALCULATED
   * K: Lot No./FIFO ID
   * L: Vendor Lot
   * M: วันที่ผลิต (MFD)
   * N: วันหมดอายุ (EXP)
   * O: วันคงเหลือ (Days Left) - CALCULATED
   * P: คงเหลือเฉพาะ Lot - CALCULATED
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
    balance,                              // J: คงเหลือ (CALCULATED)
    entry.lotNo || '',                    // K: Lot No.
    entry.vendorLot || '',                // L: Vendor Lot
    entry.mfgDate || '',                  // M: MFD
    entry.expDate || '',                  // N: EXP
    daysLeft,                             // O: Days Left (CALCULATED)
    lotBalance,                           // P: Lot Balance (CALCULATED)
    entry.supplier || '',                 // Q: Supplier
    entry.remark || '',                   // R: หมายเหตุ
    entry.containerOut || 0               // S: ถังเบิก
  ];
  
  var lastRow = getActualLastRow(sheet, 1);
  var newRow = lastRow + 1;
  sheet.getRange(newRow, 1, 1, row.length).setValues([row]);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'RM Entry added at row ' + newRow,
    balance: balance,
    lotBalance: lotBalance,
    daysLeft: daysLeft
  })).setMimeType(ContentService.MimeType.JSON);
}

function deleteEntryRM(data) {
  var spreadsheetId = data.spreadsheetId;
  var sheetName = data.sheetName;
  var rowIndex = data.rowIndex;
  
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  
  if (sheet && rowIndex > 1) {
    // Get product code before deleting for recalculation
    var productCode = sheet.getRange(rowIndex, 2).getValue();
    
    sheet.deleteRow(rowIndex);
    
    // Recalculate balances for this product
    if (productCode) {
      recalculateProductBalances(sheet, productCode);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'RM Row deleted and balances recalculated'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Invalid row or sheet'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ======================= CALCULATION FUNCTIONS =======================

/**
 * Calculate current balance for a product (Package)
 */
function calculateProductBalance(sheet, productCode) {
  var data = sheet.getDataRange().getValues();
  var balance = 0;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === productCode) { // Column C = productCode
      balance += (parseFloat(data[i][4]) || 0) - (parseFloat(data[i][5]) || 0);
    }
  }
  
  return Math.round(balance * 100) / 100;
}

/**
 * Calculate current balance for a product (RM)
 */
function calculateProductBalanceRM(sheet, productCode) {
  var data = sheet.getDataRange().getValues();
  var balance = 0;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === productCode) { // Column B = productCode
      balance += (parseFloat(data[i][7]) || 0) - (parseFloat(data[i][8]) || 0); // H - I
    }
  }
  
  return Math.round(balance * 100) / 100;
}

/**
 * Calculate balance for a specific Lot
 */
function calculateLotBalance(sheet, productCode, lotNo) {
  if (!lotNo) return 0;
  
  var data = sheet.getDataRange().getValues();
  var balance = 0;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === productCode && data[i][10] === lotNo) { // B = productCode, K = lotNo
      balance += (parseFloat(data[i][7]) || 0) - (parseFloat(data[i][8]) || 0); // H - I
    }
  }
  
  return Math.round(balance * 100) / 100;
}

/**
 * Calculate days left from expiry date
 */
function calculateDaysLeft(expDate) {
  if (!expDate) return '';
  
  try {
    var exp;
    if (typeof expDate === 'string') {
      // Parse DD/MM/YYYY format
      var parts = expDate.split('/');
      if (parts.length === 3) {
        exp = new Date(parts[2], parts[1] - 1, parts[0]);
      } else {
        exp = new Date(expDate);
      }
    } else {
      exp = new Date(expDate);
    }
    
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);
    
    var diffTime = exp - today;
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (e) {
    return '';
  }
}

/**
 * Recalculate all balances for a specific product
 */
function recalculateProductBalances(sheet, productCode) {
  var data = sheet.getDataRange().getValues();
  var balance = 0;
  var lotBalances = {};
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === productCode) { // Column B = productCode
      var inQty = parseFloat(data[i][7]) || 0;
      var outQty = parseFloat(data[i][8]) || 0;
      var lotNo = data[i][10];
      
      balance += inQty - outQty;
      
      if (lotNo) {
        lotBalances[lotNo] = (lotBalances[lotNo] || 0) + inQty - outQty;
      }
      
      // Update balance in column J (10th column, index 9)
      sheet.getRange(i + 1, 10).setValue(Math.round(balance * 100) / 100);
      
      // Update lot balance in column P (16th column, index 15)
      if (lotNo) {
        sheet.getRange(i + 1, 16).setValue(Math.round(lotBalances[lotNo] * 100) / 100);
      }
    }
  }
}

/**
 * Recalculate ALL balances in the RM sheet (for maintenance)
 */
function recalculateAllRM(data) {
  var spreadsheetId = data.spreadsheetId;
  var sheetName = data.sheetName;
  
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Sheet not found'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var allData = sheet.getDataRange().getValues();
  var productBalances = {};
  var lotBalances = {};
  
  // First pass: calculate all balances
  for (var i = 1; i < allData.length; i++) {
    var productCode = allData[i][1];
    var lotNo = allData[i][10];
    var inQty = parseFloat(allData[i][7]) || 0;
    var outQty = parseFloat(allData[i][8]) || 0;
    var expDate = allData[i][13];
    
    // Product balance
    productBalances[productCode] = (productBalances[productCode] || 0) + inQty - outQty;
    
    // Lot balance
    var lotKey = productCode + '|' + lotNo;
    lotBalances[lotKey] = (lotBalances[lotKey] || 0) + inQty - outQty;
    
    // Days left
    var daysLeft = calculateDaysLeft(expDate);
    
    // Store calculated values for this row
    allData[i][9] = Math.round(productBalances[productCode] * 100) / 100;  // J: Balance
    allData[i][14] = daysLeft;  // O: Days Left
    allData[i][15] = Math.round(lotBalances[lotKey] * 100) / 100;  // P: Lot Balance
  }
  
  // Second pass: update sheet (only columns J, O, P)
  for (var i = 1; i < allData.length; i++) {
    sheet.getRange(i + 1, 10).setValue(allData[i][9]);  // J
    sheet.getRange(i + 1, 15).setValue(allData[i][14]); // O
    sheet.getRange(i + 1, 16).setValue(allData[i][15]); // P
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Recalculated ' + (allData.length - 1) + ' rows'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ======================= UTILITY FUNCTIONS =======================

/**
 * Get actual last row with data in a specific column
 */
function getActualLastRow(sheet, column) {
  var data = sheet.getRange(1, column, sheet.getMaxRows(), 1).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][0] !== '' && data[i][0] !== null) {
      return i + 1;
    }
  }
  return 1;
}

/**
 * Test function
 */
function testScript() {
  Logger.log('Apps Script v2 is working!');
  Logger.log('Timestamp: ' + new Date().toISOString());
}
