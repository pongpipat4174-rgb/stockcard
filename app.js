/* Stock Card Web App - V.14 (Fixed Mobile Tab Switching + Print Styles) */

// Global Error Handler
window.onerror = function (msg, url, lineNo, columnNo, error) {
    var container = document.getElementById('cardsContainer');
    var loading = document.getElementById('loadingOverlay');
    if (loading) loading.style.display = 'none';

    var errorMsg = 'Error: ' + msg + '\nLine: ' + lineNo;
    if (container) {
        container.innerHTML = '<div style="color:red;padding:20px;text-align:center;">' +
            '<h3>⚠️ เกิดข้อผิดพลาดร้ายแรง</h3>' +
            '<pre>' + errorMsg + '</pre>' +
            '<button onclick="location.reload()" class="btn btn-primary">รีเฟรช</button>' +
            '</div>';
    }
    console.error('Global Error:', errorMsg);
    return false;
};

// Configuration
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzdF61u0WhgQ6Uxmb_fCmfK8Ww1wlTMFBC79a13AFAhN2TCjBHKDL4VmVL49C4W5bKdVw/exec';

// Google Sheet URLs for direct data fetching
const SHEET_CONFIG = {
    package: {
        id: '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU',
        sheetName: 'บันทึก StockCard',
        title: 'Stock Card แพ็คเกจ',
        subtitle: 'ระบบจัดการสต็อกบรรจุภัณฑ์และแพ็คเกจ',
        icon: '📦',
        unit: 'ชิ้น',
        color: '#6366f1'
    },
    rm: {
        id: '1C3mPPxucPueSOfW4Hh7m4k3BjJ4ZHonqzc8j-JfQOfs',
        sheetName: 'Sheet1',
        title: 'Stock Card วัตถุดิบ (RM)',
        subtitle: 'ระบบจัดการสต็อกวัตถุดิบและสารเคมี',
        icon: '🧪',
        unit: 'Kg',
        color: '#10b981'
    }
};

// Current module state
let currentModule = 'package';
let isSwitchingModule = false; // Prevent double-tap on mobile

// Data containers
let stockData = [];
let rmStockData = [];
let productMasterData = [];
let rmProductMasterData = [];
let rmSuppliersList = [];
let searchedProducts = [];

// Loading
function showLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = 'flex';
}
function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = 'none';
}

// Toast notification
function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:#fff;padding:15px 25px;border-radius:8px;z-index:9999;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(function () { toast.style.display = 'none'; }, 3000);
}

// Switch Module (Package / RM)
function switchModule(module, event) {
    // Prevent default button behavior and stop propagation immediately
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }

    // Prevent double-tap on mobile - use longer timeout
    if (isSwitchingModule) {
        console.log('Module switch in progress, ignoring duplicate call');
        return;
    }

    // If already on this module, do nothing
    if (currentModule === module) {
        console.log('Already on module:', module);
        return;
    }

    // Set lock immediately and keep it longer for mobile
    isSwitchingModule = true;

    // Force the module change
    currentModule = module;
    console.log('Switching to module:', module);

    // Save to sessionStorage to persist across any page refresh
    try {
        sessionStorage.setItem('currentStockCardModule', module);
    } catch (e) {
        console.log('SessionStorage not available');
    }

    // Update tab styles
    document.querySelectorAll('.module-tab').forEach(function (tab) {
        tab.classList.remove('active');
        if (tab.dataset.module === module) {
            tab.classList.add('active');
        }
    });

    // Update banner
    var config = SHEET_CONFIG[module];
    document.getElementById('moduleIcon').textContent = config.icon;
    document.getElementById('moduleTitle').textContent = config.title;
    document.getElementById('moduleSubtitle').textContent = config.subtitle;

    // Update banner color
    var banner = document.getElementById('moduleBanner');
    var rmFilterGroup = document.getElementById('rmFilterGroup');
    var rmSupplierGroup = document.getElementById('rmSupplierGroup');

    if (module === 'rm') {
        banner.classList.add('rm-mode');
        // Show RM filter dropdowns
        if (rmFilterGroup) rmFilterGroup.style.display = 'flex';
        if (rmSupplierGroup) rmSupplierGroup.style.display = 'flex';
        document.getElementById('labelTotalIn').textContent = 'รับเข้าทั้งหมด (Kg)';
        document.getElementById('labelTotalOut').textContent = 'เบิกออกทั้งหมด (Kg)';
    } else {
        banner.classList.remove('rm-mode');
        // Hide RM filter dropdowns
        if (rmFilterGroup) rmFilterGroup.style.display = 'none';
        if (rmSupplierGroup) rmSupplierGroup.style.display = 'none';
        document.getElementById('labelTotalIn').textContent = 'รับเข้าทั้งหมด';
        document.getElementById('labelTotalOut').textContent = 'เบิกออกทั้งหมด';
    }

    // Clear search and reset dropdowns
    document.getElementById('searchInput').value = '';
    var rmProductSelect = document.getElementById('rmProductSelect');
    var rmSupplierSelect = document.getElementById('rmSupplierSelect');
    var dateFilter = document.getElementById('dateFilter');
    if (rmProductSelect) rmProductSelect.value = '';
    if (rmSupplierSelect) rmSupplierSelect.value = '';
    if (dateFilter) dateFilter.value = '';

    // Update expiry alert banners visibility
    updateExpiryAlerts();

    // Load data for the selected module
    showLoading();
    if (module === 'package') {
        if (stockData.length > 0) {
            updateStats();
            showAllProducts();
            hideLoading();
            // Delay unlock to prevent mobile double-tap issues
            setTimeout(function () {
                isSwitchingModule = false;
            }, 500);
        } else {
            fetchPackageData().finally(function () {
                setTimeout(function () {
                    isSwitchingModule = false;
                }, 500);
            });
        }
    } else {
        if (rmStockData.length > 0) {
            updateStatsRM();
            showAllProductsRM();
            hideLoading();
            // Delay unlock to prevent mobile double-tap issues
            setTimeout(function () {
                isSwitchingModule = false;
            }, 500);
        } else {
            fetchRMData().finally(function () {
                setTimeout(function () {
                    isSwitchingModule = false;
                }, 500);
            });
        }
    }
}

// Initialize
async function init() {
    console.log('Initializing Stock Card System V.14...');

    // Safety Timeout: Force hide loading after 20 seconds if stuck
    const safetyTimeout = setTimeout(function () {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay && loadingOverlay.style.display !== 'none') {
            console.error('Loading timed out - Forcing display');
            hideLoading();
            showToast('การโหลดข้อมูลใช้เวลานานผิดปกติ กรุณารีเฟรชหน้านี้ใหม่');

            // Show error in container if empty
            const container = document.getElementById('cardsContainer');
            if (container && !container.innerHTML.trim()) {
                container.innerHTML = '<div class="no-results" style="color: red; text-align: center; padding: 20px;">' +
                    '<h3>⚠️ การโหลดข้อมูลล่าช้า</h3>' +
                    '<p>ระบบใช้เวลาโหลดนานเกินไป อาจเกิดจากปัญหาการเชื่อมต่ออินเทอร์เน็ต</p>' +
                    '<button class="btn btn-primary" onclick="location.reload()" style="margin-top:10px;">รีเฟรชหน้าเว็บ</button>' +
                    '</div>';
            }
        }
    }, 20000); // 20 seconds

    // Check for saved module in sessionStorage (for mobile persistence)
    var savedModule = null;
    try {
        savedModule = sessionStorage.getItem('currentStockCardModule');
    } catch (e) {
        console.log('SessionStorage not available');
    }

    showLoading();

    try {
        // Load the appropriate module based on saved state
        if (savedModule === 'rm') {
            currentModule = 'rm';
            // Update tab styles immediately
            document.querySelectorAll('.module-tab').forEach(function (tab) {
                tab.classList.remove('active');
                if (tab.dataset.module === 'rm') {
                    tab.classList.add('active');
                }
            });
            // Update banner
            var config = SHEET_CONFIG.rm;
            document.getElementById('moduleIcon').textContent = config.icon;
            document.getElementById('moduleTitle').textContent = config.title;
            document.getElementById('moduleSubtitle').textContent = config.subtitle;
            var banner = document.getElementById('moduleBanner');
            banner.classList.add('rm-mode');
            var rmFilterGroup = document.getElementById('rmFilterGroup');
            var rmSupplierGroup = document.getElementById('rmSupplierGroup');
            if (rmFilterGroup) rmFilterGroup.style.display = 'flex';
            if (rmSupplierGroup) rmSupplierGroup.style.display = 'flex';
            document.getElementById('labelTotalIn').textContent = 'รับเข้าทั้งหมด (Kg)';
            document.getElementById('labelTotalOut').textContent = 'เบิกออกทั้งหมด (Kg)';

            await fetchRMData();
        } else {
            await fetchPackageData();
        }
    } catch (error) {
        console.error('Init error:', error);
        showToast('เกิดล้มเหลวในการเริ่มต้นระบบ: ' + error.message);
    } finally {
        // Always clear timeout and hide loading
        clearTimeout(safetyTimeout);
        hideLoading();
    }
}

// ==================== PACKAGE DATA ====================

async function fetchPackageData() {
    try {
        var timestamp = new Date().getTime();
        var sheetName = encodeURIComponent(SHEET_CONFIG.package.sheetName);
        var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_CONFIG.package.id + '/gviz/tq?tqx=out:json&sheet=' + sheetName + '&tq=SELECT%20*&_=' + timestamp;

        // Fetch with explicit 15s timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            var response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error('Connection timeout (15s). Please check internet.');
            }
            throw err;
        }

        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.status);
        }
        var text = await response.text();

        // Check if response is HTML (login page) instead of JSON
        if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('google.com/accounts')) {
            throw new Error('Unauthorized: Please checking Google Sheet sharing settings (Must be "Anyone with the link")');
        }

        // Robust JSON extraction using Regex
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        var jsonText = '';
        if (jsonMatch && jsonMatch[1]) {
            jsonText = jsonMatch[1];
        } else {
            // Fallback for simple JSON or unexpected format
            jsonText = text;
        }

        var json;
        try {
            json = JSON.parse(jsonText);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.log('Raw text:', text);
            throw new Error('Invalid Data Format from Google Sheet');
        }
        var rows = json.table.rows;

        stockData = rows.map(function (row, index) {
            var c = row.c;
            return {
                rowIndex: index + 2,
                date: c[0]?.f || c[0]?.v || '',
                productCode: c[1]?.v || '',
                productName: c[2]?.v || '',
                type: c[3]?.v || '',
                inQty: parseFloat(c[4]?.v) || 0,
                outQty: parseFloat(c[5]?.v) || 0,
                balance: parseFloat(c[6]?.v) || 0,
                lotNo: c[7]?.v || '',
                pkId: c[8]?.v || '',
                docRef: c[10]?.v || '',
                remark: c[12]?.v || ''
            };
        }).filter(function (item) { return item.productCode && item.productCode !== 'code'; });

        var uniqueProducts = new Map();
        stockData.forEach(function (item) {
            if (item.productCode && !uniqueProducts.has(item.productCode)) {
                uniqueProducts.set(item.productCode, { code: item.productCode, name: item.productName });
            }
        });
        productMasterData = Array.from(uniqueProducts.values());

        populateProductDropdown();
        updateStats();
        showAllProducts();
        hideLoading();

    } catch (error) {
        console.error('Error fetching package data:', error);
        hideLoading();
        var container = document.getElementById('cardsContainer');
        if (container) {
            container.innerHTML = '<div class="no-results" style="color: red; text-align: center; padding: 20px;">' +
                '<h3>⚠️ ไม่สามารถโหลดข้อมูลได้</h3>' +
                '<p>' + error.message + '</p>' +
                '<p>กรุณาตรวจสอบการตั้งค่า "แชร์" (Share) ใน Google Sheet ให้เป็น "ทุกคนที่มีลิงก์" (Anyone with the link)</p>' +
                '</div>';
        }
    }
}

function updateStats() {
    document.getElementById('totalProducts').textContent = productMasterData.length;
    document.getElementById('totalTransactions').textContent = stockData.length;
    var totalIn = stockData.reduce(function (sum, d) { return sum + d.inQty; }, 0);
    var totalOut = stockData.reduce(function (sum, d) { return sum + d.outQty; }, 0);
    document.getElementById('totalIn').textContent = formatNumber(totalIn);
    document.getElementById('totalOut').textContent = formatNumber(totalOut);
}

function showAllProducts() {
    searchedProducts = productMasterData.map(function (prod) {
        var entries = stockData.filter(function (d) { return d.productCode === prod.code; });
        var totalIn = entries.reduce(function (sum, d) { return sum + d.inQty; }, 0);
        var totalOut = entries.reduce(function (sum, d) { return sum + d.outQty; }, 0);
        var lastEntry = entries[entries.length - 1];
        return {
            code: prod.code,
            name: prod.name,
            entries: entries,
            totalIn: totalIn,
            totalOut: totalOut,
            balance: lastEntry ? lastEntry.balance : 0,
            lotNo: lastEntry ? lastEntry.lotNo : ''
        };
    });
    renderStockCards(searchedProducts);
}

// ==================== RM DATA ====================

async function fetchRMData() {
    try {
        var timestamp = new Date().getTime();
        var sheetName = encodeURIComponent(SHEET_CONFIG.rm.sheetName);
        var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_CONFIG.rm.id + '/gviz/tq?tqx=out:json&sheet=' + sheetName + '&tq=SELECT%20*&_=' + timestamp;

        var response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.status);
        }
        var text = await response.text();

        // Check if response is HTML (login page) instead of JSON
        if (text.trim().startsWith('<!DOCTYPE html>') || text.includes('google.com/accounts')) {
            throw new Error('Unauthorized: Please checking Google Sheet sharing settings (Must be "Anyone with the link")');
        }

        // Robust JSON extraction using Regex
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
        var jsonText = '';
        if (jsonMatch && jsonMatch[1]) {
            jsonText = jsonMatch[1];
        } else {
            // Fallback for simple JSON or unexpected format
            jsonText = text;
        }

        var json;
        try {
            json = JSON.parse(jsonText);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.log('Raw text:', text);
            throw new Error('Invalid Data Format from Google Sheet (RM)');
        }
        var rows = json.table.rows;

        // RM columns: A-วันที่, B-รหัส, C-ชื่อ, D-รายการ, E-จำนวนCont, F-นน.Cont, G-เศษ, H-IN, I-OUT, J-Balance, K-LotNo, L-VendorLot, M-MFD, N-EXP, O-DaysLeft, P-LotBalance, Q-Supplier
        rmStockData = rows.map(function (row, index) {
            var c = row.c;
            return {
                rowIndex: index + 2,
                date: c[0]?.f || c[0]?.v || '',
                productCode: c[1]?.v || '',
                productName: c[2]?.v || '',
                type: c[3]?.v || '',
                containerQty: parseFloat(c[4]?.v) || 0,
                containerWeight: parseFloat(c[5]?.v) || 0,
                remainder: parseFloat(c[6]?.v) || 0,
                inQty: parseFloat(c[7]?.v) || 0,
                outQty: parseFloat(c[8]?.v) || 0,
                balance: parseFloat(c[9]?.v) || 0,
                lotNo: c[10]?.v || '',
                vendorLot: c[11]?.v || '',
                mfgDate: c[12]?.f || c[12]?.v || '',
                expDate: c[13]?.f || c[13]?.v || '',
                daysLeft: c[14]?.v || '',
                lotBalance: parseFloat(c[15]?.v) || 0,
                supplier: c[16]?.v || ''
            };
        }).filter(function (item) { return item.productCode && item.productCode !== 'รหัสสินค้า'; });

        // Create unique products list
        var uniqueProducts = new Map();
        rmStockData.forEach(function (item) {
            if (item.productCode && !uniqueProducts.has(item.productCode)) {
                uniqueProducts.set(item.productCode, { code: item.productCode, name: item.productName });
            }
        });
        rmProductMasterData = Array.from(uniqueProducts.values());

        // Create unique suppliers list for dropdown
        var uniqueSuppliers = new Set();
        rmStockData.forEach(function (item) {
            if (item.supplier && item.supplier.trim() !== '') {
                uniqueSuppliers.add(item.supplier.trim());
            }
        });
        rmSuppliersList = Array.from(uniqueSuppliers).sort();

        populateRMProductDropdown();
        populateRMSupplierDropdown();
        updateStatsRM();
        showAllProductsRM();
        updateExpiryAlerts(); // Update expiry alert banners
        hideLoading();

    } catch (error) {
        console.error('Error fetching RM data:', error);
        // Show error message to user instead of silently failing
        var container = document.getElementById('cardsContainer');
        if (container) {
            container.innerHTML = '<div class="no-results" style="color: red; text-align: center; padding: 20px;">' +
                '<h3>⚠️ ไม่สามารถโหลดข้อมูลวัตถุดิบได้</h3>' +
                '<p>' + error.message + '</p>' +
                '<p>กรุณาตรวจสอบการตั้งค่า "แชร์" (Share) ใน Google Sheet ให้เป็น "ทุกคนที่มีลิงก์" (Anyone with the link)</p>' +
                '</div>';
        }
        hideLoading();
    }
}

function populateRMProductDropdown() {
    var select = document.getElementById('rmProductSelect');
    if (!select) return;

    // Keep the first "show all" option
    select.innerHTML = '<option value="">-- แสดงทั้งหมด (' + rmProductMasterData.length + ' รายการ) --</option>';

    rmProductMasterData.forEach(function (p) {
        var option = document.createElement('option');
        option.value = p.code;
        option.textContent = p.code + ' - ' + p.name;
        select.appendChild(option);
    });
}

function populateRMSupplierDropdown() {
    var select = document.getElementById('rmSupplierSelect');
    if (!select) return;

    // Keep the first "show all" option
    select.innerHTML = '<option value="">-- แสดงทั้งหมด (' + rmSuppliersList.length + ' Suppliers) --</option>';

    rmSuppliersList.forEach(function (supplier) {
        var option = document.createElement('option');
        option.value = supplier;
        option.textContent = supplier;
        select.appendChild(option);
    });
}

function updateStatsRM() {
    document.getElementById('totalProducts').textContent = rmProductMasterData.length;
    document.getElementById('totalTransactions').textContent = rmStockData.length;
    var totalIn = rmStockData.reduce(function (sum, d) { return sum + d.inQty; }, 0);
    var totalOut = rmStockData.reduce(function (sum, d) { return sum + d.outQty; }, 0);
    document.getElementById('totalIn').textContent = formatNumber(totalIn);
    document.getElementById('totalOut').textContent = formatNumber(totalOut);
}

function showAllProductsRM() {
    searchedProducts = rmProductMasterData.map(function (prod) {
        var entries = rmStockData.filter(function (d) { return d.productCode === prod.code; });
        var totalIn = entries.reduce(function (sum, d) { return sum + d.inQty; }, 0);
        var totalOut = entries.reduce(function (sum, d) { return sum + d.outQty; }, 0);
        var lastEntry = entries[entries.length - 1];
        return {
            code: prod.code,
            name: prod.name,
            entries: entries,
            totalIn: totalIn,
            totalOut: totalOut,
            balance: lastEntry ? lastEntry.balance : 0,
            lotNo: lastEntry ? lastEntry.lotNo : '',
            supplier: lastEntry ? lastEntry.supplier : ''
        };
    });
    renderStockCardsRM(searchedProducts);
}

// Filter RM by Product Code
function filterRMByProduct(productCode) {
    if (!productCode) {
        showAllProductsRM();
        return;
    }

    var filtered = rmProductMasterData.filter(function (p) { return p.code === productCode; });
    searchedProducts = filtered.map(function (prod) {
        var entries = rmStockData.filter(function (d) { return d.productCode === prod.code; });
        var totalIn = entries.reduce(function (sum, d) { return sum + d.inQty; }, 0);
        var totalOut = entries.reduce(function (sum, d) { return sum + d.outQty; }, 0);
        var lastEntry = entries[entries.length - 1];
        return {
            code: prod.code,
            name: prod.name,
            entries: entries,
            totalIn: totalIn,
            totalOut: totalOut,
            balance: lastEntry ? lastEntry.balance : 0,
            lotNo: lastEntry ? lastEntry.lotNo : '',
            supplier: lastEntry ? lastEntry.supplier : ''
        };
    });
    renderStockCardsRM(searchedProducts);
}

// Filter RM by Supplier
function filterRMBySupplier(supplierName) {
    if (!supplierName) {
        showAllProductsRM();
        return;
    }

    // Get all entries from this supplier
    var filteredEntries = rmStockData.filter(function (d) {
        return d.supplier && d.supplier.trim() === supplierName;
    });

    // Get unique products from these entries
    var uniqueProducts = new Map();
    filteredEntries.forEach(function (item) {
        if (!uniqueProducts.has(item.productCode)) {
            uniqueProducts.set(item.productCode, { code: item.productCode, name: item.productName });
        }
    });

    searchedProducts = Array.from(uniqueProducts.values()).map(function (prod) {
        var entries = filteredEntries.filter(function (d) { return d.productCode === prod.code; });
        var totalIn = entries.reduce(function (sum, d) { return sum + d.inQty; }, 0);
        var totalOut = entries.reduce(function (sum, d) { return sum + d.outQty; }, 0);
        var lastEntry = entries[entries.length - 1];
        return {
            code: prod.code,
            name: prod.name,
            entries: entries,
            totalIn: totalIn,
            totalOut: totalOut,
            balance: lastEntry ? lastEntry.balance : 0,
            lotNo: lastEntry ? lastEntry.lotNo : '',
            supplier: supplierName
        };
    });
    renderStockCardsRM(searchedProducts);
}

// ==================== RENDER FUNCTIONS ====================

function renderStockCards(products) {
    var container = document.getElementById('cardsContainer');
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = '<div class="no-results"><p>ไม่พบข้อมูล</p></div>';
        return;
    }

    var html = '';
    products.forEach(function (prod, idx) {
        // Calculate FIFO - Find the oldest lot with remaining balance
        var lotBalances = {};
        var lotFirstDate = {};

        prod.entries.forEach(function (entry) {
            if (entry.lotNo) {
                if (!lotBalances[entry.lotNo]) {
                    lotBalances[entry.lotNo] = 0;
                    lotFirstDate[entry.lotNo] = entry.date;
                }
                lotBalances[entry.lotNo] += entry.inQty - entry.outQty;
            }
        });

        // Find lots with positive balance, sorted by first appearance (oldest first)
        var lotsWithBalance = Object.keys(lotBalances)
            .filter(function (lot) { return lotBalances[lot] > 0; })
            .sort(function (a, b) {
                // Sort by first date (oldest first)
                return lotFirstDate[a] < lotFirstDate[b] ? -1 : 1;
            });

        // The first lot in sorted array is the one to use first (FIFO)
        var fifoLot = lotsWithBalance.length > 0 ? lotsWithBalance[0] : '-';
        var fifoBalance = lotsWithBalance.length > 0 ? lotBalances[fifoLot] : 0;
        var hasMultipleLots = lotsWithBalance.length > 1;

        var entriesHtml = '';
        prod.entries.forEach(function (entry) {
            var lotEntries = prod.entries.filter(function (e) { return e.lotNo === entry.lotNo; });
            var lotIdx = lotEntries.findIndex(function (e) { return e.rowIndex === entry.rowIndex; });
            var lotBalance = 0;
            for (var i = 0; i <= lotIdx; i++) {
                lotBalance += lotEntries[i].inQty - lotEntries[i].outQty;
            }
            entriesHtml += '<tr>';
            entriesHtml += '<td>' + entry.date + '</td>';
            entriesHtml += '<td><span class="type-cell ' + (entry.type === 'รับเข้า' ? 'type-in' : 'type-out') + '">' + entry.type + '</span></td>';
            entriesHtml += '<td class="qty-in">' + (entry.inQty > 0 ? '+' + formatNumber(entry.inQty) : '-') + '</td>';
            entriesHtml += '<td class="qty-out">' + (entry.outQty > 0 ? '-' + formatNumber(entry.outQty) : '-') + '</td>';
            entriesHtml += '<td>' + formatNumber(entry.balance) + '</td>';
            entriesHtml += '<td>' + (entry.lotNo || '-') + '</td>';
            entriesHtml += '<td>' + (entry.lotNo ? formatNumber(lotBalance) : '-') + '</td>';
            entriesHtml += '<td>' + (entry.docRef || '-') + '</td>';
            entriesHtml += '<td>' + (entry.remark || '-') + '</td>';
            entriesHtml += '<td class="no-print"><button class="btn btn-delete" onclick="deleteEntry(' + entry.rowIndex + ', \'' + prod.code + '\', \'' + entry.type + '\')">ลบ</button></td>';
            entriesHtml += '</tr>';
        });

        html += '<div class="stock-card" id="card-' + idx + '">';
        html += '<div class="stock-card-header">';
        html += '<div class="stock-card-title"><h3>📦 ' + prod.name + '</h3><span class="product-code">' + prod.code + '</span></div>';
        html += '<button class="btn print-btn" onclick="printSingleCard(\'card-' + idx + '\', \'' + prod.name + '\', \'' + prod.code + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> พิมพ์</button>';
        html += '</div>';
        html += '<div class="stock-card-summary">';
        html += '<div class="summary-item"><span class="summary-label">รับเข้าทั้งหมด</span><span class="summary-value positive">+' + formatNumber(prod.totalIn) + '</span></div>';
        html += '<div class="summary-item"><span class="summary-label">เบิกออกทั้งหมด</span><span class="summary-value negative">-' + formatNumber(prod.totalOut) + '</span></div>';
        html += '<div class="summary-item"><span class="summary-label">คงเหลือปัจจุบัน</span><span class="summary-value">' + formatNumber(prod.balance) + '</span></div>';
        html += '<div class="summary-item fifo-lot' + (hasMultipleLots ? ' has-warning' : '') + '">';
        html += '<span class="summary-label">' + (hasMultipleLots ? '⚠️ ใช้ Lot นี้ก่อน!' : '📦 Lot คงเหลือ') + '</span>';
        html += '<span class="summary-value fifo-value">' + fifoLot + '</span>';
        if (hasMultipleLots) {
            html += '<span class="fifo-note">เหลือ ' + formatNumber(fifoBalance) + ' ชิ้น · มี ' + lotsWithBalance.length + ' Lots</span>';
        }
        html += '</div>';
        html += '</div>';
        html += '<div class="stock-table-container"><table class="stock-table"><thead><tr><th>วันที่</th><th>ประเภท</th><th>รับเข้า</th><th>เบิกออก</th><th>คงเหลือ</th><th>Lot No.</th><th>คงเหลือ Lot</th><th>อ้างอิง</th><th>หมายเหตุ</th><th class="no-print">ลบ</th></tr></thead>';
        html += '<tbody>' + entriesHtml + '</tbody></table></div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

function renderStockCardsRM(products) {
    var container = document.getElementById('cardsContainer');
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = '<div class="no-results"><p>ไม่พบข้อมูลวัตถุดิบ</p></div>';
        return;
    }

    var html = '';
    products.forEach(function (prod, idx) {
        // Calculate FIFO - Find the oldest lot with remaining balance
        var lotBalances = {};
        var lotFirstDate = {};

        prod.entries.forEach(function (entry) {
            if (entry.lotNo) {
                if (!lotBalances[entry.lotNo]) {
                    lotBalances[entry.lotNo] = 0;
                    lotFirstDate[entry.lotNo] = entry.date;
                }
                lotBalances[entry.lotNo] += entry.inQty - entry.outQty;
            }
        });

        // Find lots with positive balance, sorted by first appearance (oldest first)
        var lotsWithBalance = Object.keys(lotBalances)
            .filter(function (lot) { return lotBalances[lot] > 0; })
            .sort(function (a, b) {
                // Sort by first date (oldest first)
                return lotFirstDate[a] < lotFirstDate[b] ? -1 : 1;
            });

        // The first lot in sorted array is the one to use first (FIFO)
        var fifoLot = lotsWithBalance.length > 0 ? lotsWithBalance[0] : '-';
        var fifoBalance = lotsWithBalance.length > 0 ? lotBalances[fifoLot] : 0;
        var hasMultipleLots = lotsWithBalance.length > 1;

        var entriesHtml = '';
        prod.entries.forEach(function (entry) {
            // Days left styling
            var daysLeftClass = '';
            var daysNum = parseInt(entry.daysLeft);
            if (!isNaN(daysNum)) {
                if (daysNum <= 30) daysLeftClass = 'days-critical';
                else if (daysNum <= 90) daysLeftClass = 'days-warning';
                else daysLeftClass = 'days-ok';
            }

            entriesHtml += '<tr>';
            entriesHtml += '<td class="col-date">' + entry.date + '</td>';
            entriesHtml += '<td class="col-type"><span class="type-cell ' + (entry.type === 'รับเข้า' ? 'type-in' : 'type-out') + '">' + entry.type + '</span></td>';
            entriesHtml += '<td class="col-num no-print">' + (entry.containerQty > 0 ? formatNumber(entry.containerQty) : '-') + '</td>';
            entriesHtml += '<td class="col-num no-print">' + (entry.containerWeight > 0 ? formatNumber(entry.containerWeight) : '-') + '</td>';
            entriesHtml += '<td class="col-num no-print">' + (entry.remainder > 0 ? formatNumber(entry.remainder) : '-') + '</td>';
            entriesHtml += '<td class="col-num qty-in">' + (entry.inQty > 0 ? '+' + formatNumber(entry.inQty) : '-') + '</td>';
            entriesHtml += '<td class="col-num qty-out">' + (entry.outQty > 0 ? '-' + formatNumber(entry.outQty) : '-') + '</td>';
            entriesHtml += '<td class="col-num">' + formatNumber(entry.balance) + '</td>';
            entriesHtml += '<td class="col-lot">' + (entry.lotNo || '-') + '</td>';
            entriesHtml += '<td class="col-vendor no-print">' + (entry.vendorLot || '-') + '</td>';
            entriesHtml += '<td class="col-date no-print">' + (entry.mfgDate || '-') + '</td>';
            entriesHtml += '<td class="col-date">' + (entry.expDate || '-') + '</td>';
            entriesHtml += '<td class="col-num ' + daysLeftClass + '">' + (entry.daysLeft || '-') + '</td>';
            entriesHtml += '<td class="col-num">' + (entry.lotBalance > 0 ? formatNumber(entry.lotBalance) : '-') + '</td>';
            entriesHtml += '<td class="col-supplier">' + (entry.supplier || '-') + '</td>';
            entriesHtml += '</tr>';
        });

        html += '<div class="stock-card stock-card-rm" id="card-rm-' + idx + '">';
        html += '<div class="stock-card-header stock-card-header-rm">';
        html += '<div class="stock-card-title"><h3>🧪 ' + prod.name + '</h3><span class="product-code">' + prod.code + '</span></div>';
        html += '<button class="btn print-btn" onclick="printSingleCard(\'card-rm-' + idx + '\', \'' + prod.name + '\', \'' + prod.code + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> พิมพ์</button>';
        html += '</div>';
        html += '<div class="stock-card-summary stock-card-summary-rm">';
        html += '<div class="summary-item"><span class="summary-label">รับเข้าทั้งหมด (Kg)</span><span class="summary-value positive">+' + formatNumber(prod.totalIn) + '</span></div>';
        html += '<div class="summary-item"><span class="summary-label">เบิกออกทั้งหมด (Kg)</span><span class="summary-value negative">-' + formatNumber(prod.totalOut) + '</span></div>';
        html += '<div class="summary-item"><span class="summary-label">คงเหลือปัจจุบัน (Kg)</span><span class="summary-value">' + formatNumber(prod.balance) + '</span></div>';
        html += '<div class="summary-item fifo-lot' + (hasMultipleLots ? ' has-warning' : '') + '">';
        html += '<span class="summary-label">' + (hasMultipleLots ? '⚠️ ใช้ Lot นี้ก่อน!' : '📦 Lot คงเหลือ') + '</span>';
        html += '<span class="summary-value fifo-value">' + fifoLot + '</span>';
        if (hasMultipleLots) {
            html += '<span class="fifo-note">เหลือ ' + formatNumber(fifoBalance) + ' Kg · มี ' + lotsWithBalance.length + ' Lots</span>';
        }
        html += '</div>';
        html += '</div>';
        html += '<div class="stock-table-container"><table class="stock-table stock-table-rm"><thead><tr>';
        html += '<th>วันที่</th><th>ประเภท</th><th class="no-print">Cont.</th><th class="no-print">นน./Cont.</th><th class="no-print">เศษ(Kg)</th><th>รับเข้า</th><th>เบิกออก</th><th>คงเหลือ</th><th>Lot No.</th><th class="no-print">Vendor Lot</th><th class="no-print">MFD</th><th>EXP</th><th>Days Left</th><th>Lot Bal.</th><th>Supplier</th>';
        html += '</tr></thead>';
        html += '<tbody>' + entriesHtml + '</tbody></table></div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

// ==================== SEARCH ====================

function handleSearch() {
    var query = document.getElementById('searchInput').value.toLowerCase().trim();

    if (currentModule === 'package') {
        if (!query) {
            showAllProducts();
            return;
        }

        var matchingProductCodes = new Set();

        // 1. Check Master Data (Code, Name)
        productMasterData.forEach(function (p) {
            if (p.code.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)) {
                matchingProductCodes.add(p.code);
            }
        });

        // 2. Check Transaction Data (Deep Search)
        stockData.forEach(function (item) {
            var searchStr = [
                item.productCode,
                item.productName,
                item.date,
                item.docNo,
                item.lotNo,
                item.remarks
            ].join(' ').toLowerCase();

            if (searchStr.includes(query)) {
                matchingProductCodes.add(item.productCode);
            }
        });

        searchedProducts = Array.from(matchingProductCodes).map(function (code) {
            var entries = stockData.filter(function (d) { return d.productCode === code; });
            var name = entries.length > 0 ? entries[0].productName : '';
            if (!name) {
                var master = productMasterData.find(function (m) { return m.code === code; });
                if (master) name = master.name;
            }

            var totalIn = entries.reduce(function (sum, d) { return sum + d.inQty; }, 0);
            var totalOut = entries.reduce(function (sum, d) { return sum + d.outQty; }, 0);
            var lastEntry = entries[entries.length - 1];

            return {
                code: code,
                name: name,
                entries: entries,
                totalIn: totalIn,
                totalOut: totalOut,
                balance: lastEntry ? lastEntry.balance : 0,
                lotNo: lastEntry ? lastEntry.lotNo : ''
            };
        });

        renderStockCards(searchedProducts);

    } else {
        // RM Module - Deep Search
        if (!query) {
            showAllProductsRM();
            return;
        }

        var matchingProductCodes = new Set();

        // 1. Check Master Data
        rmProductMasterData.forEach(function (p) {
            if (p.code.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)) {
                matchingProductCodes.add(p.code);
            }
        });

        // 2. Check Transaction Data
        rmStockData.forEach(function (item) {
            var searchStr = [
                item.productCode,
                item.productName,
                item.date,
                item.docNo,
                item.lotNo,
                item.supplier,
                item.vendorLot,
                item.mfd,
                item.exp
            ].join(' ').toLowerCase();

            if (searchStr.includes(query)) {
                matchingProductCodes.add(item.productCode);
            }
        });

        searchedProducts = Array.from(matchingProductCodes).map(function (code) {
            var entries = rmStockData.filter(function (d) { return d.productCode === code; });
            var name = entries.length > 0 ? entries[0].productName : '';
            if (!name) {
                var master = rmProductMasterData.find(function (m) { return m.code === code; });
                if (master) name = master.name;
            }

            var totalIn = entries.reduce(function (sum, d) { return sum + d.inQty; }, 0);
            var totalOut = entries.reduce(function (sum, d) { return sum + d.outQty; }, 0);
            var lastEntry = entries[entries.length - 1];
            return {
                code: code,
                name: name,
                entries: entries,
                totalIn: totalIn,
                totalOut: totalOut,
                balance: lastEntry ? lastEntry.balance : 0,
                lotNo: lastEntry ? lastEntry.lotNo : '',
                supplier: lastEntry ? lastEntry.supplier : ''
            };
        });

        renderStockCardsRM(searchedProducts);
    }


    // ==================== CLEAR ALL FILTERS ====================

    function clearAllFilters() {
        // Clear search input
        var searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }

        // Clear RM dropdowns
        var rmProductSelect = document.getElementById('rmProductSelect');
        var rmSupplierSelect = document.getElementById('rmSupplierSelect');
        var dateFilter = document.getElementById('dateFilter');
        if (rmProductSelect) rmProductSelect.value = '';
        if (rmSupplierSelect) rmSupplierSelect.value = '';
        if (dateFilter) dateFilter.value = '';

        // Hide selected filter badge
        var selectedFilter = document.getElementById('selectedFilter');
        if (selectedFilter) selectedFilter.style.display = 'none';

        // Show all products based on current module
        if (currentModule === 'package') {
            showAllProducts();
            showToast('ล้างตัวกรองแพ็คเกจแล้ว');
        } else {
            showAllProductsRM();
            showToast('ล้างตัวกรองวัตถุดิบแล้ว');
        }

        console.log('All filters cleared for module:', currentModule);
    }

    // ==================== EXPIRY ALERT BANNERS ====================

    function updateExpiryAlerts() {
        // Only show for RM module
        var alertSection = document.getElementById('alertBannersSection');
        if (!alertSection) return;

        if (currentModule !== 'rm') {
            alertSection.style.display = 'none';
            return;
        }

        alertSection.style.display = 'block';

        // Count critical items (<=30 days) and warning items (31-90 days)
        var criticalItems = [];
        var warningItems = [];

        rmStockData.forEach(function (item) {
            var daysNum = parseInt(item.daysLeft);
            if (!isNaN(daysNum) && daysNum > 0) {
                if (daysNum <= 30) {
                    criticalItems.push(item);
                } else if (daysNum <= 90) {
                    warningItems.push(item);
                }
            }
        });

        // Update counts
        var criticalCount = document.getElementById('criticalCount');
        var warningCount = document.getElementById('warningCount');

        if (criticalCount) {
            criticalCount.textContent = criticalItems.length + ' รายการ';
        }
        if (warningCount) {
            warningCount.textContent = warningItems.length + ' รายการ';
        }

        // Store for later use
        window.expiryData = {
            critical: criticalItems,
            warning: warningItems
        };
    }

    function showExpiryItems(type) {
        if (!window.expiryData) {
            showToast('ไม่มีข้อมูลหมดอายุ');
            return;
        }

        var items = type === 'critical' ? window.expiryData.critical : window.expiryData.warning;
        var title = type === 'critical' ? '⚠️ รายการหมดอายุภายใน 30 วัน' : '⏰ รายการหมดอายุภายใน 90 วัน';

        if (items.length === 0) {
            showToast('ไม่มีรายการ' + (type === 'critical' ? 'วิกฤต' : 'เตือน'));
            return;
        }

        // Group by product
        var productMap = new Map();
        items.forEach(function (item) {
            if (!productMap.has(item.productCode)) {
                productMap.set(item.productCode, {
                    code: item.productCode,
                    name: item.productName,
                    entries: []
                });
            }
            productMap.get(item.productCode).entries.push(item);
        });

        // Filter to show only these products
        searchedProducts = Array.from(productMap.values()).map(function (prod) {
            var entries = prod.entries;
            var totalIn = entries.reduce(function (sum, d) { return sum + d.inQty; }, 0);
            var totalOut = entries.reduce(function (sum, d) { return sum + d.outQty; }, 0);
            var lastEntry = entries[entries.length - 1];
            return {
                code: prod.code,
                name: prod.name,
                entries: entries,
                totalIn: totalIn,
                totalOut: totalOut,
                balance: lastEntry ? lastEntry.balance : 0,
                lotNo: lastEntry ? lastEntry.lotNo : '',
                supplier: lastEntry ? lastEntry.supplier : ''
            };
        });

        renderStockCardsRM(searchedProducts);
        showToast(title + ' (' + items.length + ' รายการ)');

        // Scroll to cards
        document.getElementById('cardsContainer')?.scrollIntoView({ behavior: 'smooth' });
    }

    // ==================== DATE FILTER ====================

    function filterByDate(dateStr) {
        if (!dateStr) {
            // Clear date filter - show all
            if (currentModule === 'package') {
                showAllProducts();
            } else {
                showAllProductsRM();
            }
            return;
        }

        // Convert input date to Thai format for comparison
        var inputDate = new Date(dateStr);
        var day = inputDate.getDate();
        var month = inputDate.getMonth() + 1;
        var year = inputDate.getFullYear();
        var thaiDateStr = day + '/' + month + '/' + year;

        if (currentModule === 'package') {
            // Filter package data by date
            var filtered = stockData.filter(function (item) {
                return item.date && item.date.includes(thaiDateStr);
            });

            // Group by product
            var productMap = new Map();
            filtered.forEach(function (item) {
                if (!productMap.has(item.productCode)) {
                    productMap.set(item.productCode, {
                        code: item.productCode,
                        name: item.productName,
                        entries: []
                    });
                }
                productMap.get(item.productCode).entries.push(item);
            });

            searchedProducts = Array.from(productMap.values()).map(function (prod) {
                var entries = prod.entries;
                var totalIn = entries.reduce(function (sum, d) { return sum + d.inQty; }, 0);
                var totalOut = entries.reduce(function (sum, d) { return sum + d.outQty; }, 0);
                var lastEntry = entries[entries.length - 1];
                return {
                    code: prod.code,
                    name: prod.name,
                    entries: entries,
                    totalIn: totalIn,
                    totalOut: totalOut,
                    balance: lastEntry ? lastEntry.balance : 0,
                    lotNo: lastEntry ? lastEntry.lotNo : ''
                };
            });

            renderStockCards(searchedProducts);
            showToast('กรองวันที่: ' + thaiDateStr + ' (' + searchedProducts.length + ' สินค้า)');

        } else {
            // Filter RM data by date
            var filtered = rmStockData.filter(function (item) {
                return item.date && item.date.includes(thaiDateStr);
            });

            // Group by product
            var productMap = new Map();
            filtered.forEach(function (item) {
                if (!productMap.has(item.productCode)) {
                    productMap.set(item.productCode, {
                        code: item.productCode,
                        name: item.productName,
                        entries: []
                    });
                }
                productMap.get(item.productCode).entries.push(item);
            });

            searchedProducts = Array.from(productMap.values()).map(function (prod) {
                var entries = prod.entries;
                var totalIn = entries.reduce(function (sum, d) { return sum + d.inQty; }, 0);
                var totalOut = entries.reduce(function (sum, d) { return sum + d.outQty; }, 0);
                var lastEntry = entries[entries.length - 1];
                return {
                    code: prod.code,
                    name: prod.name,
                    entries: entries,
                    totalIn: totalIn,
                    totalOut: totalOut,
                    balance: lastEntry ? lastEntry.balance : 0,
                    lotNo: lastEntry ? lastEntry.lotNo : '',
                    supplier: lastEntry ? lastEntry.supplier : ''
                };
            });

            renderStockCardsRM(searchedProducts);
            showToast('กรองวันที่: ' + thaiDateStr + ' (' + searchedProducts.length + ' วัตถุดิบ)');
        }
    }

    // ==================== UTILITY ====================

    function formatNumber(num) {
        return new Intl.NumberFormat('th-TH').format(num || 0);
    }

    function formatDateThai(dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        var day = parseInt(parts[2], 10);
        var month = parseInt(parts[1], 10);
        var year = parts[0];
        return day + '/' + month + '/' + year;
    }

    function populateProductDropdown() {
        var datalist = document.getElementById('productCodeList');
        if (!datalist) return;
        datalist.innerHTML = '';
        productMasterData.forEach(function (p) {
            datalist.innerHTML += '<option value="' + p.code + '">' + p.code + ' - ' + p.name + '</option>';
        });
    }

    function populateProductDropdownRM() {
        var datalist = document.getElementById('productCodeListRM');
        if (!datalist) return;
        datalist.innerHTML = '';
        rmProductMasterData.forEach(function (p) {
            datalist.innerHTML += '<option value="' + p.code + '">' + p.code + ' - ' + p.name + '</option>';
        });
    }

    // Print Single Card
    function printSingleCard(cardId, productName, productCode) {
        var card = document.getElementById(cardId);
        if (!card) return;

        var printHeader = document.createElement('div');
        printHeader.className = 'print-header';
        printHeader.innerHTML = '<img src="logo.png" alt="Logo" style="height:50px;"><div><h2 style="margin:0;">' + productName + '</h2><p style="margin:0;color:#666;">' + productCode + ' | วันที่พิมพ์: ' + new Date().toLocaleDateString('th-TH') + '</p></div>';

        document.querySelectorAll('.stock-card').forEach(function (c) {
            if (c.id !== cardId) c.style.display = 'none';
        });

        card.insertBefore(printHeader, card.firstChild);
        window.print();

        printHeader.remove();
        document.querySelectorAll('.stock-card').forEach(function (c) { c.style.display = ''; });
    }

    // Delete Entry
    function deleteEntry(rowIndex, productCode, type) {
        if (!confirm('ยืนยันการลบรายการนี้?')) return;

        showLoading();
        showToast('กำลังลบ...');

        fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete_force',
                rowIndex: rowIndex,
                criteria: { productCode: productCode, type: type }
            })
        }).then(function () {
            setTimeout(async function () {
                showToast('ลบเรียบร้อย!');
                await fetchPackageData();
                hideLoading();
            }, 2000);
        }).catch(function (e) { alert(e); hideLoading(); });
    }

    // ==================== MODAL FUNCTIONS ====================

    function openEntryModal() {
        if (currentModule === 'package') {
            var modal = document.getElementById('entryModal');
            if (modal) {
                modal.style.display = 'flex';
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';

                var today = new Date();
                var yyyy = today.getFullYear();
                var mm = String(today.getMonth() + 1).padStart(2, '0');
                var dd = String(today.getDate()).padStart(2, '0');
                document.getElementById('entryDate').value = yyyy + '-' + mm + '-' + dd;
            }
        } else {
            var modal = document.getElementById('entryModalRM');
            if (modal) {
                modal.style.display = 'flex';
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';

                var today = new Date();
                var yyyy = today.getFullYear();
                var mm = String(today.getMonth() + 1).padStart(2, '0');
                var dd = String(today.getDate()).padStart(2, '0');
                document.getElementById('entryDateRM').value = yyyy + '-' + mm + '-' + dd;
            }
        }
    }

    function closeEntryModal() {
        var modal = document.getElementById('entryModal');
        if (modal) {
            modal.style.display = 'none';
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
        }
    }

    function closeEntryModalRM() {
        var modal = document.getElementById('entryModalRM');
        if (modal) {
            modal.style.display = 'none';
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
        }
    }

    // Save Entry for Package
    function saveEntry() {
        var productCode = document.getElementById('entryProductCode').value;
        var date = document.getElementById('entryDate').value;
        var type = document.getElementById('entryType').value;
        var inQty = parseFloat(document.getElementById('entryInQty').value) || 0;
        var outQty = parseFloat(document.getElementById('entryOutQty').value) || 0;
        var lotNo = document.getElementById('entryLotNo').value || '-';
        var docRef = document.getElementById('entryDocRef').value || '-';
        var remark = document.getElementById('entryRemark').value || '-';
        var pkId = document.getElementById('entryPkId')?.value || '-';

        if (!productCode || !date) {
            alert('กรุณากรอกรหัสสินค้าและวันที่');
            return;
        }

        var prod = productMasterData.find(function (p) { return p.code === productCode; });
        var productName = prod ? prod.name : productCode;

        var lastEntry = stockData.filter(function (d) { return d.productCode === productCode; }).pop();
        var lastBalance = lastEntry ? lastEntry.balance : 0;
        var balance = lastBalance + inQty - outQty;

        showLoading();
        showToast('กำลังบันทึก...');

        fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'add',
                entry: {
                    date: formatDateThai(date),
                    productCode: productCode,
                    productName: productName,
                    type: type,
                    inQty: inQty,
                    outQty: outQty,
                    balance: balance,
                    lotNo: lotNo,
                    pkId: pkId,
                    docRef: docRef,
                    remark: remark
                }
            })
        }).then(function () {
            setTimeout(async function () {
                showToast('บันทึกเรียบร้อย!');
                closeEntryModal();
                document.getElementById('entryDate').value = '';
                document.getElementById('entryInQty').value = '';
                document.getElementById('entryOutQty').value = '';
                document.getElementById('entryLotNo').value = '';
                document.getElementById('entryDocRef').value = '';
                document.getElementById('entryRemark').value = '';
                await fetchPackageData();
                hideLoading();
            }, 2000);
        }).catch(function (e) { alert(e); hideLoading(); });
    }

    // Stats Detail Modal
    function showStatDetail(type) {
        alert('ดูรายละเอียด: ' + type);
    }

    function closeStatsModal() {
        var modal = document.getElementById('statsModal');
        if (modal) modal.style.display = 'none';
    }

    // ==================== EVENT LISTENERS ====================

    document.addEventListener('DOMContentLoaded', function () {
        init();

        document.getElementById('searchInput')?.addEventListener('input', handleSearch);
        document.getElementById('addEntryBtn')?.addEventListener('click', openEntryModal);
        document.getElementById('saveEntry')?.addEventListener('click', saveEntry);
        document.getElementById('refreshBtn')?.addEventListener('click', function () {
            if (currentModule === 'package') {
                showLoading();
                stockData = [];
                fetchPackageData();
            } else {
                showLoading();
                rmStockData = [];
                fetchRMData();
            }
        });
        document.getElementById('entryModalClose')?.addEventListener('click', closeEntryModal);
        document.getElementById('entryModalBackdrop')?.addEventListener('click', closeEntryModal);
        document.getElementById('cancelEntry')?.addEventListener('click', closeEntryModal);

        // Clear Filter Button
        document.getElementById('clearFilterBtn')?.addEventListener('click', clearAllFilters);

        // Date Filter
        document.getElementById('dateFilter')?.addEventListener('change', function () {
            filterByDate(this.value);
        });

        // RM Modal events
        document.getElementById('entryModalCloseRM')?.addEventListener('click', closeEntryModalRM);
        document.getElementById('entryModalBackdropRM')?.addEventListener('click', closeEntryModalRM);
        document.getElementById('cancelEntryRM')?.addEventListener('click', closeEntryModalRM);

        // RM Product Dropdown
        document.getElementById('rmProductSelect')?.addEventListener('change', function () {
            var value = this.value;
            // Reset supplier dropdown
            var supplierSelect = document.getElementById('rmSupplierSelect');
            if (supplierSelect) supplierSelect.value = '';
            // Filter by product
            filterRMByProduct(value);
        });

        // RM Supplier Dropdown
        document.getElementById('rmSupplierSelect')?.addEventListener('change', function () {
            var value = this.value;
            // Reset product dropdown
            var productSelect = document.getElementById('rmProductSelect');
            if (productSelect) productSelect.value = '';
            // Filter by supplier
            filterRMBySupplier(value);
        });

        document.getElementById('entryProductCode')?.addEventListener('change', function () {
            var prod = productMasterData.find(function (p) { return p.code === this.value; }.bind(this));
            if (prod) {
                var nameInput = document.getElementById('entryProductName');
                if (nameInput) nameInput.value = prod.name;
            }
        });

        document.getElementById('entryProductCodeRM')?.addEventListener('change', function () {
            var prod = rmProductMasterData.find(function (p) { return p.code === this.value; }.bind(this));
            if (prod) {
                var nameInput = document.getElementById('entryProductNameRM');
                if (nameInput) nameInput.value = prod.name;
            }
        });

        // ==================== MODULE TAB EVENT HANDLERS ====================
        // Use a single unified approach for both touch and click
        var tabPackage = document.getElementById('tabPackage');
        var tabRM = document.getElementById('tabRM');
        var isProcessingTab = false;

        function handleTabSwitch(module, e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }

            // Prevent multiple rapid calls
            if (isProcessingTab) {
                console.log('Tab switch blocked - already processing');
                return;
            }

            // Already on this tab
            if (currentModule === module) {
                console.log('Already on module:', module);
                return;
            }

            isProcessingTab = true;
            console.log('Handling tab switch to:', module);

            // Call the actual switch function
            switchModule(module, e);

            // Reset after delay
            setTimeout(function () {
                isProcessingTab = false;
            }, 1000);
        }

        // Package tab handlers
        if (tabPackage) {
            tabPackage.addEventListener('click', function (e) {
                handleTabSwitch('package', e);
            });
        }

        // RM tab handlers
        if (tabRM) {
            tabRM.addEventListener('click', function (e) {
                handleTabSwitch('rm', e);
            });
        }
    });

