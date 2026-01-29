/**
 * Stock Card System - Apps Script Backend v3
 * Updated: 29 Jan 2026
 * Features:
 * - Auto-recalculation via Time-based Trigger
 * - Custom Menu for manual recalculation
 * - onChange Trigger support
 */

// ======================= CUSTOM MENU =======================

/**
 * Creates custom menu when spreadsheet opens
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📊 Stock Card')
    .addItem('🔄 Recalculate All', 'manualRecalculate')
    .addSeparator()
    .addItem('⚙️ Setup Triggers', 'setupAllTriggers')
    .addToUi();
}

// ======================= API ENDPOINTS =======================

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
  // Check if requesting master data
  var action = e && e.parameter ? e.parameter.action : null;
  
  if (action === 'getRMMaster') {
    return getRMMasterData();
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'OK',
    message: 'Stock Card API v3 - With Auto-Trigger',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get RM Master Data from the master sheet
 * Returns: code, name, supplier for dropdown
 */
function getRMMasterData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var masterSheet = ss.getSheetByName('RawMaterial');
    
    if (!masterSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Master sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = masterSheet.getDataRange().getValues();
    var products = [];
    
    // Skip header row (row 1), start from row 2
    for (var i = 1; i < data.length; i++) {
      var code = data[i][0]; // Column A
      var name = data[i][1]; // Column B
      var supplier = data[i][2]; // Column C
      
      if (code && code.toString().trim() !== '') {
        products.push({
          code: code.toString().trim(),
          name: name ? name.toString().trim() : '',
          supplier: supplier ? supplier.toString().trim() : ''
        });
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: products,
      count: products.length
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ======================= AUTO-TRIGGER ON EDIT =======================

/**
 * Trigger function - runs when sheet is edited
 * Auto-fills RM info when Lot No is entered in column K
 */
function onSheetEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    if (sheet.getName() !== 'Sheet1') return;
    
    var range = e.range;
    var row = range.getRow();
    var col = range.getColumn();
    
    // Skip header row
    if (row <= 1) return;
    
    // Column K (Lot No/FIFO ID) - Auto-fill from existing data
    if (col === 11) {
      var lotNo = range.getValue();
      if (!lotNo) return;
      
      autoFillByLotNo(sheet, row, lotNo.toString().trim());
    }
  } catch (error) {
    console.error('onSheetEdit error:', error);
  }
}

/**
 * Auto-fill info from the most recent entry with same Lot No
 */
function autoFillByLotNo(sheet, targetRow, lotNo) {
  var allData = sheet.getDataRange().getValues();
  var lastEntry = null;
  
  // Find the most recent entry for this Lot No
  for (var i = allData.length - 1; i >= 1; i--) {
    if (allData[i][10] === lotNo && i + 1 !== targetRow) {
      lastEntry = {
        rmCode: allData[i][1],            // B - RM Code
        productName: allData[i][2],       // C - Product Name
        containerWeight: allData[i][5],   // F - Container Weight
        vendorLot: allData[i][11],        // L - Vendor Lot
        mfgDate: allData[i][12],          // M - Mfg Date
        expDate: allData[i][13],          // N - Exp Date
        supplier: allData[i][16]          // Q - Supplier
      };
      break;
    }
  }
  
  if (!lastEntry) return;
  
  // Check which cells are empty before auto-filling
  var currentRmCode = sheet.getRange(targetRow, 2).getValue();
  var currentName = sheet.getRange(targetRow, 3).getValue();
  var currentContainer = sheet.getRange(targetRow, 6).getValue();
  var currentVendorLot = sheet.getRange(targetRow, 12).getValue();
  var currentMfg = sheet.getRange(targetRow, 13).getValue();
  var currentExp = sheet.getRange(targetRow, 14).getValue();
  var currentSupplier = sheet.getRange(targetRow, 17).getValue();
  
  // Auto-fill only empty cells
  if (!currentRmCode && lastEntry.rmCode) {
    sheet.getRange(targetRow, 2).setValue(lastEntry.rmCode);
  }
  if (!currentName && lastEntry.productName) {
    sheet.getRange(targetRow, 3).setValue(lastEntry.productName);
  }
  if (!currentContainer && lastEntry.containerWeight) {
    sheet.getRange(targetRow, 6).setValue(lastEntry.containerWeight);
  }
  if (!currentVendorLot && lastEntry.vendorLot) {
    sheet.getRange(targetRow, 12).setValue(lastEntry.vendorLot);
  }
  if (!currentMfg && lastEntry.mfgDate) {
    sheet.getRange(targetRow, 13).setValue(lastEntry.mfgDate);
  }
  if (!currentExp && lastEntry.expDate) {
    sheet.getRange(targetRow, 14).setValue(lastEntry.expDate);
  }
  if (!currentSupplier && lastEntry.supplier) {
    sheet.getRange(targetRow, 17).setValue(lastEntry.supplier);
  }
  
  Logger.log('Auto-filled info for Lot No: ' + lotNo);
}


/**
 * Trigger function - runs automatically when sheet changes (including copy-paste)
 * Must be installed via: createChangeTrigger()
 */
function onSheetChange(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Sheet1');
    
    if (!sheet) return;
    
    // Recalculate all products when any change occurs
    manualRecalculateSheet(sheet);
    
  } catch (error) {
    console.error('onSheetChange error:', error);
  }
}

/**
 * Setup all triggers (onChange + Time-based)
 * Run this once to install all triggers
 */
function setupAllTriggers() {
  // Delete all existing triggers first
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. onEdit Trigger (for auto-fill RM info)
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  
  // 2. onChange Trigger (for structure changes)
  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(ss)
    .onChange()
    .create();
  
  // 3. Time-based Trigger (every 5 minutes)
  ScriptApp.newTrigger('autoRecalculate')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  Logger.log('✅ All triggers created!');
  Logger.log('- onEdit: auto-fills RM info');
  Logger.log('- onChange: detects sheet changes');
  Logger.log('- Time-based: runs every 5 minutes');
  
  SpreadsheetApp.getUi().alert(
    '✅ Triggers Setup Complete!\n\n' +
    '✏️ onEdit: Auto-fill RM info\n' +
    '📌 onChange: Detect changes\n' +
    '⏰ Time-based: Every 5 minutes\n\n' +
    'Your sheet is now smart!'
  );
}

/**
 * Auto-recalculate function (called by time-based trigger)
 */
function autoRecalculate() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Sheet1');
    
    if (!sheet) return;
    
    manualRecalculateSheet(sheet);
    Logger.log('Auto-recalculation completed at: ' + new Date());
    
  } catch (error) {
    Logger.log('Auto-recalculate error: ' + error);
  }
}

// ======================= MANUAL RECALCULATE =======================

/**
 * Main recalculation function - call from menu or manually
 */
function manualRecalculate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Sheet1');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet1 not found!');
    return;
  }
  
  manualRecalculateSheet(sheet);
  SpreadsheetApp.getUi().alert('✅ Recalculation complete!');
}

/**
 * Calculate days left until expiration date
 */
function calculateDaysLeft(expDate) {
  if (!expDate) return '';
  
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  var expiration;
  
  // Handle different date formats
  if (expDate instanceof Date) {
    expiration = new Date(expDate);
  } else if (typeof expDate === 'string') {
    // Try parsing various formats
    var parts = expDate.split('/');
    if (parts.length === 3) {
      // DD/MM/YYYY format
      expiration = new Date(parts[2], parts[1] - 1, parts[0]);
    } else {
      expiration = new Date(expDate);
    }
  } else {
    return '';
  }
  
  if (isNaN(expiration.getTime())) return '';
  
  expiration.setHours(0, 0, 0, 0);
  
  var diffTime = expiration.getTime() - today.getTime();
  var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Recalculate all values for a specific sheet - OPTIMIZED VERSION
 * Uses batch operations for 10-50x faster performance
 * Includes Container Balance tracking
 */
function manualRecalculateSheet(sheet) {
  var allData = sheet.getDataRange().getValues();
  var numRows = allData.length;
  if (numRows <= 1) return;
  
  // Prepare batch arrays for columns H, J, O, P, Q, R
  var colH = [];  // In Qty
  var colJ = [];  // Balance
  var colO = [];  // Days Left
  var colP = [];  // Lot Balance
  var colQ = [];  // Supplier (only update if empty)
  var colR = [];  // Container Balance (NEW!)
  
  var productBalances = {};
  var lotBalances = {};
  var lotContainerBalances = {};  // NEW: Track containers per lot
  var lotLastRow = {};
  var productSuppliers = {};
  var rowData = [];
  
  // First pass: collect suppliers
  for (var i = 1; i < numRows; i++) {
    var productCode = allData[i][1];
    var supplier = allData[i][16];
    
    if (productCode && supplier && supplier.toString().trim() !== '') {
      productSuppliers[productCode] = supplier.toString().trim();
    }
  }
  
  // Second pass: calculate all values
  for (var i = 1; i < numRows; i++) {
    var row = i + 1;
    var productCode = allData[i][1];
    
    // Empty row - just add empty values
    if (!productCode || productCode.toString().trim() === '') {
      rowData.push({
        row: row,
        isEmpty: true,
        inQty: '',
        balance: '',
        daysLeft: '',
        lotBalance: '',
        containerBalance: '',
        supplier: allData[i][16] || ''
      });
      continue;
    }
    
    var type = allData[i][3];
    var containerQty = parseFloat(allData[i][4]) || 0;
    var containerWeight = parseFloat(allData[i][5]) || 0;
    var remainder = parseFloat(allData[i][6]) || 0;
    var inQty = parseFloat(allData[i][7]) || 0;
    var outQty = parseFloat(allData[i][8]) || 0;
    var lotNo = allData[i][10];
    var expDate = allData[i][13];
    var currentSupplier = allData[i][16];
    
    // Determine if receive or issue
    var isReceive = (type === 'receive' || type === 'รับเข้า');
    var isIssue = (type === 'issue' || type === 'เบิก' || type === 'ตัดออก');
    
    // Auto-calculate In quantity for receive
    if (isReceive && inQty === 0 && containerQty > 0) {
      inQty = (containerQty * containerWeight) + remainder;
    }
    
    // Calculate product balance
    productBalances[productCode] = (productBalances[productCode] || 0) + inQty - outQty;
    
    // Calculate lot balance
    var lotKey = productCode + '|' + lotNo;
    lotBalances[lotKey] = (lotBalances[lotKey] || 0) + inQty - outQty;
    
    // Calculate container balance per lot (NEW!)
    if (!lotContainerBalances[lotKey]) {
      lotContainerBalances[lotKey] = 0;
    }
    if (isReceive && containerQty > 0) {
      // Receiving: add containers
      lotContainerBalances[lotKey] += containerQty;
    } else if (isIssue && containerQty > 0) {
      // Issuing: subtract containers
      lotContainerBalances[lotKey] -= containerQty;
    }
    
    if (lotNo) {
      lotLastRow[lotKey] = row;
    }
    
    var daysLeft = calculateDaysLeft(expDate);
    
    var supplierToUse = '';
    if (currentSupplier && currentSupplier.toString().trim() !== '') {
      supplierToUse = currentSupplier.toString().trim();
    } else if (productSuppliers[productCode]) {
      supplierToUse = productSuppliers[productCode];
    }
    
    rowData.push({
      row: row,
      isEmpty: false,
      productCode: productCode,
      type: type,
      lotNo: lotNo,
      lotKey: lotKey,
      containerQty: containerQty,
      inQty: Math.round(inQty * 100) / 100,
      balance: Math.round(productBalances[productCode] * 100) / 100,
      lotBalance: Math.round(lotBalances[lotKey] * 100) / 100,
      containerBalance: lotContainerBalances[lotKey],
      daysLeft: daysLeft,
      supplier: supplierToUse,
      hasSupplier: currentSupplier && currentSupplier.toString().trim() !== ''
    });
  }
  
  // Third pass: build batch arrays
  for (var i = 0; i < rowData.length; i++) {
    var r = rowData[i];
    
    if (r.isEmpty) {
      colH.push(['']);
      colJ.push(['']);
      colO.push(['']);
      colP.push(['']);
      colQ.push([r.supplier]);
      colR.push(['']);
      continue;
    }
    
    var isLastRowOfLot = (lotLastRow[r.lotKey] === r.row);
    var finalLotBalance = 0;
    var finalContainerBalance = 0;
    
    // Get final balances for this lot
    for (var j = 0; j < rowData.length; j++) {
      if (rowData[j].lotKey === r.lotKey) {
        finalLotBalance = rowData[j].lotBalance;
        finalContainerBalance = rowData[j].containerBalance;
      }
    }
    
    // H - In Qty
    colH.push([r.inQty]);
    
    // J - Balance
    colJ.push([r.balance]);
    
    // O - Days Left (only last row of lot with stock)
    if (isLastRowOfLot && finalLotBalance > 0 && r.daysLeft !== '') {
      colO.push([r.daysLeft]);
    } else {
      colO.push(['']);
    }
    
    // P - Lot Balance (only last row of lot with stock)
    if (isLastRowOfLot && finalLotBalance > 0) {
      colP.push([finalLotBalance]);
    } else {
      colP.push(['']);
    }
    
    // Q - Supplier (auto-fill if empty)
    if (!r.hasSupplier && r.supplier) {
      colQ.push([r.supplier]);
    } else {
      colQ.push([allData[r.row - 1][16] || '']);
    }
    
    // S - Container Balance (only last row of lot with remaining containers)
    // Note: Column R (18) is for Remarks/หมายเหตุ (e.g., "สารต่ออายุ")
    if (isLastRowOfLot && finalContainerBalance > 0) {
      colR.push([finalContainerBalance]);
    } else {
      colR.push(['']);
    }
  }
  
  // Fourth pass: BATCH WRITE (super fast!)
  var dataRows = numRows - 1;
  if (dataRows > 0) {
    sheet.getRange(2, 8, dataRows, 1).setValues(colH);   // H
    sheet.getRange(2, 10, dataRows, 1).setValues(colJ);  // J
    sheet.getRange(2, 15, dataRows, 1).setValues(colO);  // O
    sheet.getRange(2, 16, dataRows, 1).setValues(colP);  // P
    sheet.getRange(2, 17, dataRows, 1).setValues(colQ);  // Q
    sheet.getRange(2, 19, dataRows, 1).setValues(colR);  // S - Container Balance (skip R = Remarks)
  }
  
  Logger.log('Recalculated ' + rowData.length + ' rows (Batch mode + Container Balance)');
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
