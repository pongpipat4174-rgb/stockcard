/**
 * Stock Card System - Apps Script Backend v3
 * Updated: 28 Jan 2026
 * OPTIMIZED + AUTO-TRIGGER on Sheet Edit
 */

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
    message: 'Stock Card API v3 - With Auto-Trigger',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ======================= AUTO-TRIGGER ON EDIT =======================

/**
 * Trigger function - runs automatically when sheet is edited
 * Must be installed via: Triggers > Add Trigger > onSheetEdit > On edit
 */
function onSheetEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    var sheetName = sheet.getName();
    
    // Only run for RM_StockCard sheet
    if (sheetName !== 'RM_StockCard') return;
    
    var range = e.range;
    var row = range.getRow();
    var col = range.getColumn();
    
    // Skip header row
    if (row <= 1) return;
    
    // Only recalculate if edited columns are: B (product), H (in), I (out), K (lot), N (exp)
    var triggerCols = [2, 8, 9, 11, 14]; // B, H, I, K, N
    if (triggerCols.indexOf(col) === -1) return;
    
    // Get product code from edited row
    var productCode = sheet.getRange(row, 2).getValue();
    if (!productCode) return;
    
    // Recalculate this product's balances
    recalculateProductBalances(sheet, productCode);
    
    // Also update days left for this row
    var expDate = sheet.getRange(row, 14).getValue();
    var daysLeft = calculateDaysLeft(expDate);
    sheet.getRange(row, 15).setValue(daysLeft);
    
  } catch (error) {
    console.error('onSheetEdit error:', error);
  }
}

/**
 * Simple onEdit trigger (installable)
 * Go to: Extensions > Apps Script > Triggers > Add Trigger
 * Choose: onSheetEdit, On edit
 */
function createEditTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  Logger.log('Edit trigger created!');
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
  
  var balance = calculateProductBalance(sheet, entry.productCode) + (entry.inQty || 0) - (entry.outQty || 0);
  
  var row = [
    entry.date,
    entry.type,
    entry.productCode,
    entry.productName,
    entry.inQty || 0,
    entry.outQty || 0,
    balance,
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
  
  var balance = calculateProductBalanceRM(sheet, entry.productCode) + (entry.inQty || 0) - (entry.outQty || 0);
  var lotBalance = calculateLotBalance(sheet, entry.productCode, entry.lotNo) + (entry.inQty || 0) - (entry.outQty || 0);
  var daysLeft = calculateDaysLeft(entry.expDate);
  
  var row = [
    entry.date,
    entry.productCode,
    entry.productName,
    entry.type,
    entry.containerQty || 0,
    entry.containerWeight || 0,
    entry.remainder || 0,
    entry.inQty || 0,
    entry.outQty || 0,
    balance,
    entry.lotNo || '',
    entry.vendorLot || '',
    entry.mfgDate || '',
    entry.expDate || '',
    daysLeft,
    lotBalance,
    entry.supplier || '',
    entry.remark || '',
    entry.containerOut || 0
  ];
  
  var lastRow = getActualLastRow(sheet, 1);
  var newRow = lastRow + 1;
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
    var productCode = sheet.getRange(rowIndex, 2).getValue();
    sheet.deleteRow(rowIndex);
    if (productCode) {
      recalculateProductBalances(sheet, productCode);
    }
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

// ======================= CALCULATION FUNCTIONS =======================

function calculateProductBalance(sheet, productCode) {
  var data = sheet.getDataRange().getValues();
  var balance = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === productCode) {
      balance += (parseFloat(data[i][4]) || 0) - (parseFloat(data[i][5]) || 0);
    }
  }
  return Math.round(balance * 100) / 100;
}

function calculateProductBalanceRM(sheet, productCode) {
  var data = sheet.getDataRange().getValues();
  var balance = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === productCode) {
      balance += (parseFloat(data[i][7]) || 0) - (parseFloat(data[i][8]) || 0);
    }
  }
  return Math.round(balance * 100) / 100;
}

function calculateLotBalance(sheet, productCode, lotNo) {
  if (!lotNo) return 0;
  var data = sheet.getDataRange().getValues();
  var balance = 0;
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === productCode && data[i][10] === lotNo) {
      balance += (parseFloat(data[i][7]) || 0) - (parseFloat(data[i][8]) || 0);
    }
  }
  return Math.round(balance * 100) / 100;
}

function calculateDaysLeft(expDate) {
  if (!expDate) return '';
  try {
    var exp;
    if (typeof expDate === 'string') {
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

function recalculateProductBalances(sheet, productCode) {
  var data = sheet.getDataRange().getValues();
  var balance = 0;
  var lotBalances = {};
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === productCode) {
      var inQty = parseFloat(data[i][7]) || 0;
      var outQty = parseFloat(data[i][8]) || 0;
      var lotNo = data[i][10];
      
      balance += inQty - outQty;
      
      if (lotNo) {
        lotBalances[lotNo] = (lotBalances[lotNo] || 0) + inQty - outQty;
      }
      
      sheet.getRange(i + 1, 10).setValue(Math.round(balance * 100) / 100);
      
      if (lotNo) {
        sheet.getRange(i + 1, 16).setValue(Math.round(lotBalances[lotNo] * 100) / 100);
      }
    }
  }
}

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
  var updates = [];
  
  // First pass: calculate all values
  for (var i = 1; i < allData.length; i++) {
    var productCode = allData[i][1];
    var lotNo = allData[i][10];
    var inQty = parseFloat(allData[i][7]) || 0;
    var outQty = parseFloat(allData[i][8]) || 0;
    var expDate = allData[i][13];
    
    productBalances[productCode] = (productBalances[productCode] || 0) + inQty - outQty;
    
    var lotKey = productCode + '|' + lotNo;
    lotBalances[lotKey] = (lotBalances[lotKey] || 0) + inQty - outQty;
    
    var daysLeft = calculateDaysLeft(expDate);
    
    updates.push({
      row: i + 1,
      balance: Math.round(productBalances[productCode] * 100) / 100,
      daysLeft: daysLeft,
      lotBalance: Math.round(lotBalances[lotKey] * 100) / 100
    });
  }
  
  // Second pass: batch update (faster)
  for (var i = 0; i < updates.length; i++) {
    var u = updates[i];
    sheet.getRange(u.row, 10).setValue(u.balance);      // J
    sheet.getRange(u.row, 15).setValue(u.daysLeft);     // O
    sheet.getRange(u.row, 16).setValue(u.lotBalance);   // P
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Recalculated ' + updates.length + ' rows'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ======================= UTILITY FUNCTIONS =======================

function getActualLastRow(sheet, column) {
  var data = sheet.getRange(1, column, sheet.getMaxRows(), 1).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i][0] !== '' && data[i][0] !== null) {
      return i + 1;
    }
  }
  return 1;
}

function testScript() {
  Logger.log('Apps Script v3 with Auto-Trigger is working!');
}
