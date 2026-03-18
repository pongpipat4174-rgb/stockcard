/**
 * GeneralStock - Apps Script (Standalone)
 * Deploy บน Spreadsheet: อะไหล่ & อุปกรณ์
 * ID: 1a01xMjZbHZ1k5H_A2epROw2I2T9ZcdGdY2AofuXmP8A
 * 
 * ขั้นตอน Deploy:
 * 1. เปิด Sheet อะไหล่ → Extensions → Apps Script
 * 2. วางโค้ดนี้ทับทั้งหมด
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy URL ไปวาง APPS_SCRIPT_GENERALSTOCK ใน .env
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    if (action === 'save_all_general') {
      return saveGeneralStockData(data);
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
    message: 'GeneralStock API',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Save GeneralStock items and transactions
 * Items → tab "GeneralStock" (columns A-L)
 * Transactions → tab "GeneralTrans" (columns A-I)
 */
function saveGeneralStockData(data) {
  try {
    // ใช้ spreadsheetId ถ้ามี ไม่งั้นใช้ Active Spreadsheet
    var ss;
    if (data.spreadsheetId) {
      ss = SpreadsheetApp.openById(data.spreadsheetId);
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    // 1. Save Items
    var itemSheet = ss.getSheetByName('GeneralStock');
    if (!itemSheet) {
      itemSheet = ss.insertSheet('GeneralStock');
      itemSheet.appendRow(['ID', 'Name', 'Spec', 'Category', 'Unit', 'Stock', 'Min', 'Price', 'LeadTime', 'Supplier', 'Country', 'Image']);
    }
    
    // Clear existing data (keep header row)
    if (itemSheet.getLastRow() > 1) {
      itemSheet.getRange(2, 1, itemSheet.getLastRow() - 1, 12).clearContent();
    }
    
    var items = data.items;
    if (items && items.length > 0) {
      var rows = items.map(function(item) {
        return [
          "'" + (item.id || ''),
          item.name || '',
          item.spec || '',
          item.category || '',
          item.unit || '',
          item.stock || 0,
          item.min || 0,
          item.price || '',
          item.leadTime || '',
          item.supplier || '',
          item.country || '',
          '' // skip image (too large for Sheet)
        ];
      });
      itemSheet.getRange(2, 1, rows.length, 12).setValues(rows);
    }
    
    // 2. Save Transactions
    var transSheet = ss.getSheetByName('GeneralTrans');
    if (!transSheet) {
      transSheet = ss.insertSheet('GeneralTrans');
      transSheet.appendRow(['ID', 'ItemID', 'ItemName', 'Type', 'Qty', 'Date', 'Time', 'Note', 'Remaining']);
    }
    
    // Clear existing transactions (keep header row)
    if (transSheet.getLastRow() > 1) {
      transSheet.getRange(2, 1, transSheet.getLastRow() - 1, 9).clearContent();
    }
    
    var trans = data.transactions;
    if (trans && trans.length > 0) {
      var tRows = trans.map(function(t) {
        return [
          "'" + (t.id || ''),
          "'" + (t.itemId || ''),
          t.itemName || '',
          t.type || '',
          t.qty || 0,
          t.date || '',
          t.time || '',
          t.note || '',
          t.remaining || 0
        ];
      });
      transSheet.getRange(2, 1, tRows.length, 9).setValues(tRows);
    }
    
    var itemCount = items ? items.length : 0;
    var transCount = trans ? trans.length : 0;
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Saved ' + itemCount + ' items, ' + transCount + ' transactions'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
