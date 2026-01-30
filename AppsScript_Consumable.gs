/**
 * ======================= CONSUMABLE MODULE =======================
 * Add this code to your existing Apps Script to support Consumable save/load
 * 
 * Instructions:
 * 1. Open your Google Apps Script project
 * 2. Add this code at the end of your existing script
 * 3. Update doPost() and doGet() functions to include the new actions
 * 4. Deploy as new version
 */

// ======================= ADD TO doPost() =======================
// Add these conditions inside your doPost() function:
//
// } else if (action === 'save_all') {
//   return saveConsumableData(data);
// } else if (action === 'update_consumable_item') {
//   return updateConsumableItem(data);
// }

// ======================= ADD TO doGet() =======================
// The existing load_all action should already work if you have:
//
// if (action === 'load_all') {
//   var sheetName = e.parameter.sheet || 'Consumable';
//   return loadAllData(sheetName);
// }

// ======================= CONSUMABLE FUNCTIONS =======================

/**
 * Save all Consumable data (items + transactions)
 */
function saveConsumableData(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = data.sheet || 'Consumable';
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      // Create sheet if it doesn't exist
      sheet = ss.insertSheet(sheetName);
      // Add headers
      var headers = [
        'ชื่อสินค้า', 'ประเภท', 'สต็อก (ลัง)', 'เศษ(กก.)', 'กก./ลัง',
        'รวม (กก.)', 'จุดสั่งซื้อ (กก.)', 'ชิ้น/กก.', 'ความยาวตัด (มม.)',
        'ชิ้นงาน/ถุง', 'ชิ้น FG/ลัง', 'รวมถุง (ชิ้น)', 'ผลิตได้ (ลัง)',
        'สถานะ', 'ความยาวม้วน (ม.)', 'ความยาวตัด (มม.)', 'ชิ้น/ม้วน',
        'Yield/ม้วน', 'StockCode'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    var items = data.items;
    
    if (!items || items.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No items to save'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Clear existing data (keep header)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
    }
    
    // Convert items to rows
    var rows = items.map(function(item) {
      return [
        item['ชื่อสินค้า'] || '',
        item['ประเภท'] || 'weight',
        item['สต็อก (ลัง)'] || 0,
        item['เศษ(กก.)'] || 0,
        item['กก./ลัง'] || 25,
        item['รวม (กก.)'] || 0,
        item['จุดสั่งซื้อ (กก.)'] || 0,
        item['ชิ้น/กก.'] || 0,
        item['ความยาวตัด (มม.)'] || 0,
        item['ชิ้นงาน/ถุง'] || 1,
        item['ชิ้น FG/ลัง'] || 1,
        item['ผลิตได้ (ชิ้น)'] || 0,
        item['ผลิตได้ (ลัง)'] || 0,
        item['สถานะ'] || 'ปกติ',
        item['ความยาวม้วน (ม.)'] || 0,
        item['ความยาวตัด (มม.)'] || 0,
        item['ชิ้น/ม้วน'] || 0,
        item['Yield/ม้วน'] || 0,
        item['StockCode'] || ''
      ];
    });
    
    // Write all items at once
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    // Save transactions if provided
    if (data.transactions && data.transactions.length > 0) {
      saveConsumableTransactions(ss, data.transactions);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Saved ' + rows.length + ' items to ' + sheetName
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Save Consumable transactions
 */
function saveConsumableTransactions(ss, transactions) {
  try {
    var transSheetName = 'Consumable_Transactions';
    var transSheet = ss.getSheetByName(transSheetName);
    
    if (!transSheet) {
      // Create transactions sheet
      transSheet = ss.insertSheet(transSheetName);
      var headers = ['ID', 'วันที่', 'ประเภท', 'ItemIndex', 'ชื่อสินค้า', 
                     'จำนวน (กก.)', 'จำนวน (ลัง)', 'คงเหลือ (ลัง)', 'หมายเหตุ'];
      transSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // Get existing transaction IDs to avoid duplicates
    var existingData = transSheet.getDataRange().getValues();
    var existingIds = {};
    for (var i = 1; i < existingData.length; i++) {
      existingIds[existingData[i][0]] = true;
    }
    
    // Filter new transactions
    var newTransactions = transactions.filter(function(t) {
      return !existingIds[t['ID']];
    });
    
    if (newTransactions.length === 0) {
      return; // No new transactions to add
    }
    
    // Convert to rows
    var rows = newTransactions.map(function(t) {
      return [
        t['ID'] || '',
        t['วันที่'] || '',
        t['ประเภท'] || '',
        t['ItemIndex'] || 0,
        t['ชื่อสินค้า'] || '',
        t['จำนวน (กก.)'] || 0,
        t['จำนวน (ลัง)'] || 0,
        t['คงเหลือ (ลัง)'] || 0,
        t['หมายเหตุ'] || ''
      ];
    });
    
    // Append new transactions
    var lastRow = transSheet.getLastRow();
    transSheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
    
    Logger.log('Added ' + rows.length + ' new transactions');
    
  } catch (error) {
    Logger.log('Save transactions error: ' + error.message);
  }
}

/**
 * Update a single Consumable item stock (for quick updates)
 */
function updateConsumableItem(data) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = data.sheet || 'Consumable';
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Sheet not found: ' + sheetName
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var itemName = data.itemName;
    var newStock = data.newStock;
    var newPartial = data.newPartial || 0;
    
    // Find the item row
    var allData = sheet.getDataRange().getValues();
    var foundRow = -1;
    
    for (var i = 1; i < allData.length; i++) {
      if (allData[i][0] === itemName) {
        foundRow = i + 1;
        break;
      }
    }
    
    if (foundRow === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Item not found: ' + itemName
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Update stock columns (C and D)
    sheet.getRange(foundRow, 3).setValue(newStock);
    sheet.getRange(foundRow, 4).setValue(newPartial);
    
    // Recalculate total kg (column F)
    var kgPerCarton = sheet.getRange(foundRow, 5).getValue() || 25;
    var totalKg = (newStock * kgPerCarton) + newPartial;
    sheet.getRange(foundRow, 6).setValue(totalKg);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Updated stock for ' + itemName
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Load all data from Consumable sheet (already exists in main script)
 * This is for reference - should already work with action=load_all&sheet=Consumable
 */
function loadConsumableData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Consumable');
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Consumable sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var items = [];
    
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue; // Skip empty rows
      
      var item = {};
      for (var j = 0; j < headers.length; j++) {
        item[headers[j]] = data[i][j];
      }
      items.push(item);
    }
    
    // Load transactions
    var transSheet = ss.getSheetByName('Consumable_Transactions');
    var transactions = [];
    
    if (transSheet) {
      var transData = transSheet.getDataRange().getValues();
      var transHeaders = transData[0];
      
      for (var i = 1; i < transData.length; i++) {
        if (!transData[i][0]) continue;
        
        var trans = {};
        for (var j = 0; j < transHeaders.length; j++) {
          trans[transHeaders[j]] = transData[i][j];
        }
        transactions.push(trans);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      items: items,
      transactions: transactions
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
