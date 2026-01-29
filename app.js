/* Stock Card Web App - V.16 (Refined Mobile Tab Switching - Robust UI) */

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
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyFUoMhdUiCHJtwKAuDdCw29uM3205tQ5LikrW3HcX1MMwARhZtXPISjmjG4fR6Y6Jy/exec';

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
let rmMasterWithSupplier = []; // Master data from sheet: code, name, supplier
let rmSuppliersList = [];
let searchedProducts = [];
let currentSearchQuery = ''; // For highlighting search results

// Highlight matching text in search results
function highlightText(text, query) {
    if (!query || !text) return text;
    var textStr = String(text);
    var queryLower = query.toLowerCase();
    var textLower = textStr.toLowerCase();
    var idx = textLower.indexOf(queryLower);
    if (idx === -1) return textStr;

    // Build highlighted string
    var result = '';
    var lastIdx = 0;
    while (idx !== -1) {
        result += textStr.substring(lastIdx, idx);
        result += '<mark class="search-highlight">' + textStr.substring(idx, idx + query.length) + '</mark>';
        lastIdx = idx + query.length;
        idx = textLower.indexOf(queryLower, lastIdx);
    }
    result += textStr.substring(lastIdx);
    return result;
}

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
    // Prevent default button behavior
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (isSwitchingModule && currentModule === module) {
        return;
    }

    // Set lock
    isSwitchingModule = true;
    currentModule = module;
    console.log('Switching to module:', module);

    // Save to sessionStorage
    try {
        sessionStorage.setItem('currentStockCardModule', module);
    } catch (e) {
        console.log('SessionStorage error');
    }

    // 1. VISUAL UPDATE (Immediate & Smooth)
    const tabPackage = document.getElementById('tabPackage');
    const tabRM = document.getElementById('tabRM');
    const tabConsumable = document.getElementById('tabConsumable');

    // Explicitly hide consumable view and show main view (Safety)
    // Explicitly hide consumable/general views and show main view (Safety)
    const stockMain = document.getElementById('stockcard-main-view');
    const consumView = document.getElementById('consumable-view-container');
    const generalView = document.getElementById('general-view-container');

    if (stockMain) stockMain.style.display = 'block';
    if (consumView) consumView.style.display = 'none';
    if (generalView) generalView.style.display = 'none';

    if (document.querySelector('.header-actions')) document.querySelector('.header-actions').style.display = 'flex';

    // Remove active from ALL tabs
    if (tabPackage) tabPackage.classList.remove('active');
    if (tabRM) tabRM.classList.remove('active');
    if (tabConsumable) tabConsumable.classList.remove('active');

    // Add active to current
    if (module === 'package' && tabPackage) {
        tabPackage.classList.add('active');
    } else if (module === 'rm' && tabRM) {
        tabRM.classList.add('active');
    }

    // Update Strings
    const config = SHEET_CONFIG[module];
    if (config) {
        const iconEl = document.getElementById('moduleIcon');
        const titleEl = document.getElementById('moduleTitle');
        const subtitleEl = document.getElementById('moduleSubtitle');
        if (iconEl) iconEl.textContent = config.icon;
        if (titleEl) titleEl.textContent = config.title;
        if (subtitleEl) subtitleEl.textContent = config.subtitle;
    }

    // Update Theme Colors & Filters
    const banner = document.getElementById('moduleBanner');
    const rmFilterGroup = document.getElementById('rmFilterGroup');
    const rmSupplierGroup = document.getElementById('rmSupplierGroup');
    const labelIn = document.getElementById('labelTotalIn');
    const labelOut = document.getElementById('labelTotalOut');

    if (module === 'rm') {
        if (banner) banner.classList.add('rm-mode');
        if (rmFilterGroup) rmFilterGroup.style.display = 'flex';
        if (rmSupplierGroup) rmSupplierGroup.style.display = 'flex';
        if (labelIn) labelIn.textContent = 'รับเข้าทั้งหมด (Kg)';
        if (labelOut) labelOut.textContent = 'เบิกออกทั้งหมด (Kg)';
        // Show Smart Withdraw button for RM
        const smartBtn = document.getElementById('smartWithdrawBtn');
        if (smartBtn) smartBtn.style.display = 'inline-flex';
        // Show Recalculate button for RM
        const recalcBtn = document.getElementById('recalculateBtn');
        if (recalcBtn) recalcBtn.style.display = 'inline-flex';
    } else {
        if (banner) banner.classList.remove('rm-mode');
        if (rmFilterGroup) rmFilterGroup.style.display = 'none';
        if (rmSupplierGroup) rmSupplierGroup.style.display = 'none';
        if (labelIn) labelIn.textContent = 'รับเข้าทั้งหมด';
        if (labelOut) labelOut.textContent = 'เบิกออกทั้งหมด';
        // Hide Smart Withdraw button for Package
        const smartBtn = document.getElementById('smartWithdrawBtn');
        if (smartBtn) smartBtn.style.display = 'none';
        // Hide Recalculate button for Package
        const recalcBtn = document.getElementById('recalculateBtn');
        if (recalcBtn) recalcBtn.style.display = 'none';
    }

    // Reset inputs
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    const rmProductSelect = document.getElementById('rmProductSelect');
    if (rmProductSelect) rmProductSelect.value = '';

    const rmSupplierSelect = document.getElementById('rmSupplierSelect');
    if (rmSupplierSelect) rmSupplierSelect.value = '';

    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) dateFilter.value = '';

    // Update Alerts
    updateExpiryAlerts();

    // 2. DATA LOAD
    // Use setTimeout to allow UI to render first
    setTimeout(() => {
        try {
            if (module === 'package') {
                if (stockData.length > 0) {
                    updateStats();
                    showAllProducts();
                    isSwitchingModule = false;
                } else {
                    showLoading();
                    fetchPackageData().finally(() => {
                        isSwitchingModule = false;
                    });
                }
            } else {
                // RM Module
                if (rmStockData.length > 0) {
                    updateStatsRM();
                    showAllProductsRM();
                    isSwitchingModule = false;
                } else {
                    showLoading();
                    // Load master data first, then stock data
                    fetchRMMasterData().then(() => {
                        return fetchRMData();
                    }).then(() => {
                        // Success
                    }).catch(err => {
                        console.error('RM Fetch Error during switch:', err);
                    }).finally(() => {
                        isSwitchingModule = false;
                    });
                }
            }
        } catch (e) {
            console.error('Error during module switch execution:', e);
            isSwitchingModule = false;
            hideLoading();
        }
    }, 50); // Increased to 50ms for mobile stability
}

// Refresh Data Function (Global to fix ReferenceError)
function refreshData() {
    console.log('Refreshing data for module:', currentModule);
    if (currentModule === 'package') {
        showLoading();
        stockData = [];
        fetchPackageData();
    } else {
        showLoading();
        rmStockData = [];
        fetchRMData();
    }
}

// Fetch RM Master Data (code, name, supplier) from master sheet
async function fetchRMMasterData() {
    console.log('[RM Master] Fetching from API...');
    try {
        var url = APPS_SCRIPT_URL + '?action=getRMMaster';
        console.log('[RM Master] URL:', url);

        var response = await fetch(url);
        console.log('[RM Master] Response status:', response.status);

        var result = await response.json();
        console.log('[RM Master] Result:', result);

        if (result.success && result.data) {
            rmMasterWithSupplier = result.data;
            console.log('[RM Master] Loaded:', rmMasterWithSupplier.length, 'products');

            // Update rmProductMasterData with master data
            rmProductMasterData = rmMasterWithSupplier.map(function (p) {
                return { code: p.code, name: p.name };
            });

            // Populate dropdown
            populateProductDropdownRM();
        } else {
            console.warn('[RM Master] API returned:', result);
        }
    } catch (error) {
        console.error('[RM Master] Error:', error);
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

    // Initial Slider Position
    setTimeout(function () {
        const tabPackage = document.getElementById('tabPackage');
        const tabRM = document.getElementById('tabRM');
        const slider = document.getElementById('tabSlider');
        let activeTab = (savedModule === 'rm') ? tabRM : tabPackage;

        if (slider && activeTab) {
            const left = activeTab.offsetLeft;
            const width = activeTab.offsetWidth;
            slider.style.transform = 'translateX(' + left + 'px)';
            slider.style.width = width + 'px';

            // Set initial active class
            if (tabPackage) tabPackage.classList.remove('active');
            if (tabRM) tabRM.classList.remove('active');
            activeTab.classList.add('active');
        }
    }, 100);

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
            // Show Smart Withdraw button for RM on init
            var smartBtn = document.getElementById('smartWithdrawBtn');
            if (smartBtn) smartBtn.style.display = 'inline-flex';
            // Show Recalculate button for RM
            var recalcBtn = document.getElementById('recalculateBtn');
            if (recalcBtn) recalcBtn.style.display = 'inline-flex';

            // Load RM Master Data (code, name, supplier) first
            await fetchRMMasterData();
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

        var response;
        try {
            response = await fetch(url, { signal: controller.signal });
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
        }).filter(function (item) {
            // Basic check - only filter out header row
            if (!item.productCode || item.productCode === 'code') return false;

            return true;
        });

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
                supplier: c[16]?.v || '',
                remark: c[17]?.v || '', // Column R: หมายเหตุ (ระบุ "ต่ออายุ" ที่นี่)
                containerOut: parseFloat(c[18]?.v) || 0 // Column S: ถังที่เบิก
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
            var q = currentSearchQuery;
            var dateShort = entry.date.replace(/\/(\d{4})$/, function (match, year) {
                return '/' + year.slice(2);
            });
            entriesHtml += '<tr>';
            entriesHtml += '<td><span class="date-full">' + highlightText(entry.date, q) + '</span><span class="date-short">' + highlightText(dateShort, q) + '</span></td>';
            entriesHtml += '<td><span class="type-cell ' + (entry.type === 'รับเข้า' ? 'type-in' : 'type-out') + '">' + highlightText(entry.type, q) + '</span></td>';
            entriesHtml += '<td class="qty-in">' + (entry.inQty > 0 ? '+' + formatNumber(entry.inQty) : '-') + '</td>';
            entriesHtml += '<td class="qty-out">' + (entry.outQty > 0 ? '-' + formatNumber(entry.outQty) : '-') + '</td>';
            entriesHtml += '<td>' + formatNumber(entry.balance) + '</td>';
            entriesHtml += '<td>' + highlightText(entry.lotNo || '-', q) + '</td>';
            entriesHtml += '<td>' + (entry.lotNo ? formatNumber(lotBalance) : '-') + '</td>';
            entriesHtml += '<td>' + highlightText(entry.docRef || '-', q) + '</td>';
            entriesHtml += '<td>' + highlightText(entry.remark || '-', q) + '</td>';
            entriesHtml += '<td class="no-print"><button class="btn btn-delete" onclick="deleteEntry(' + entry.rowIndex + ', \'' + prod.code + '\', \'' + entry.type + '\')">ลบ</button></td>';
            entriesHtml += '</tr>';
        });

        var q = currentSearchQuery;
        html += '<div class="stock-card" id="card-' + idx + '">';
        html += '<div class="stock-card-header">';
        html += '<div class="stock-card-title"><h3>📦 ' + highlightText(prod.name, q) + '</h3><span class="product-code">' + highlightText(prod.code, q) + '</span></div>';
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
        var lotExpDays = {}; // Store expiry days for FEFO
        var lotExpDate = {}; // Store expiry date for FEFO

        prod.entries.forEach(function (entry) {
            if (entry.lotNo) {
                if (!lotBalances[entry.lotNo]) {
                    lotBalances[entry.lotNo] = 0;
                    lotFirstDate[entry.lotNo] = entry.date;
                    // Store expiry info
                    var days = parseInt(entry.daysLeft);
                    if (!isNaN(days)) {
                        lotExpDays[entry.lotNo] = days;
                        lotExpDate[entry.lotNo] = entry.expDate || '';
                    }
                }
                lotBalances[entry.lotNo] += entry.inQty - entry.outQty;

                // Update expiry days if this entry has a valid daysLeft
                var days = parseInt(entry.daysLeft);
                if (!isNaN(days) && (lotExpDays[entry.lotNo] === undefined || days < lotExpDays[entry.lotNo])) {
                    lotExpDays[entry.lotNo] = days;
                    lotExpDate[entry.lotNo] = entry.expDate || '';
                }
            }
        });

        // Find lots with positive balance
        var lotsWithBalance = Object.keys(lotBalances)
            .filter(function (lot) { return lotBalances[lot] > 0; });

        // FIFO: Sort by first appearance date (oldest first) - using proper date comparison
        var fifoSorted = lotsWithBalance.slice().sort(function (a, b) {
            var dateA = parseDateThai(lotFirstDate[a]);
            var dateB = parseDateThai(lotFirstDate[b]);
            return dateA.getTime() - dateB.getTime();
        });

        // FEFO: Sort by expiry days (soonest expiry first)
        var fefoSorted = lotsWithBalance.slice()
            .filter(function (lot) { return lotExpDays[lot] !== undefined; })
            .sort(function (a, b) {
                return (lotExpDays[a] || 9999) - (lotExpDays[b] || 9999);
            });

        // FIFO recommendation
        var fifoLot = fifoSorted.length > 0 ? fifoSorted[0] : '-';
        var fifoBalance = fifoSorted.length > 0 ? lotBalances[fifoLot] : 0;
        var fifoExpDays = fifoSorted.length > 0 ? lotExpDays[fifoLot] : null;
        var fifoExpDate = fifoSorted.length > 0 ? lotExpDate[fifoLot] : '';
        var hasMultipleLots = lotsWithBalance.length > 1;

        // FEFO recommendation
        var fefoLot = fefoSorted.length > 0 ? fefoSorted[0] : '-';
        var fefoExpDays = fefoSorted.length > 0 ? lotExpDays[fefoLot] : null;
        var fefoExpDate = fefoSorted.length > 0 ? lotExpDate[fefoLot] : '';
        var fefoBalance = fefoSorted.length > 0 ? lotBalances[fefoLot] : 0;

        // Check for Revalidated Lots (Must use first!)
        var revalLots = lotsWithBalance.filter(function (lot) {
            // Check if any entry for this lot has "ต่ออายุ" or "reval" in remark
            return prod.entries.some(function (e) {
                return e.lotNo === lot && (e.remark && /(ต่ออายุ|reval|extend)/i.test(e.remark));
            });
        });

        var isRevalPriority = revalLots.length > 0;
        var revalLot = revalLots.length > 0 ? revalLots[0] : '-';
        var revalBalance = revalLots.length > 0 ? lotBalances[revalLot] : 0;
        var revalExpDays = revalLots.length > 0 ? lotExpDays[revalLot] : null;
        var revalExpDate = revalLots.length > 0 ? lotExpDate[revalLot] : '';

        // Check if FEFO differs from FIFO (important to highlight)
        // If Reval exists, it overrides everything
        var fefoConflict = !isRevalPriority && hasMultipleLots && fefoLot !== fifoLot && fefoLot !== '-';
        var fefoUrgent = fefoExpDays !== null && fefoExpDays <= 30;

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

            var isReval = entry.remark && /(ต่ออายุ|reval|extend)/i.test(entry.remark);

            var q = currentSearchQuery;
            // Short Date Helper
            var toShortDate = function (d) {
                return (d || '').replace(/\/(\d{4})$/, function (match, year) {
                    return '/' + year.slice(2);
                });
            };

            entriesHtml += '<tr>';
            entriesHtml += '<td class="col-date"><span class="date-full">' + highlightText(entry.date, q) + '</span><span class="date-short">' + highlightText(toShortDate(entry.date), q) + '</span></td>';
            entriesHtml += '<td class="col-type"><span class="type-cell ' + (entry.type === 'รับเข้า' ? 'type-in' : 'type-out') + '">' + highlightText(entry.type, q) + '</span></td>';
            entriesHtml += '<td class="col-num no-print">' + (entry.containerQty > 0 ? formatNumber(entry.containerQty) : '-') + '</td>';
            entriesHtml += '<td class="col-num no-print">' + (entry.containerWeight > 0 ? formatNumber(entry.containerWeight) : '-') + '</td>';
            entriesHtml += '<td class="col-num no-print">' + (entry.remainder > 0 ? formatNumber(entry.remainder) : '-') + '</td>';
            entriesHtml += '<td class="col-num qty-in">' + (entry.inQty > 0 ? '+' + formatNumber(entry.inQty) : '-') + '</td>';
            entriesHtml += '<td class="col-num qty-out">' + (entry.outQty > 0 ? '-' + formatNumber(entry.outQty) : '-') + '</td>';
            entriesHtml += '<td class="col-num">' + formatNumber(entry.balance) + '</td>';

            // Lot No with Reval Badge
            var lotHtml = highlightText(entry.lotNo || '-', q);
            if (isReval) {
                lotHtml += ' <span class="badge-reval">🔄 ต่ออายุ</span>';
            }
            entriesHtml += '<td class="col-lot">' + lotHtml + '</td>';

            entriesHtml += '<td class="col-vendor no-print">' + highlightText(entry.vendorLot || '-', q) + '</td>';

            // MFD & EXP with Short Date
            entriesHtml += '<td class="col-date no-print"><span class="date-full">' + highlightText(entry.mfgDate || '-', q) + '</span><span class="date-short">' + highlightText(toShortDate(entry.mfgDate), q) + '</span></td>';
            entriesHtml += '<td class="col-date"><span class="date-full">' + highlightText(entry.expDate || '-', q) + '</span><span class="date-short">' + highlightText(toShortDate(entry.expDate), q) + '</span></td>';
            entriesHtml += '<td class="col-num ' + daysLeftClass + '">' + highlightText(entry.daysLeft || '-', q) + '</td>';
            entriesHtml += '<td class="col-num">' + (entry.lotBalance > 0 ? formatNumber(entry.lotBalance) : '-') + '</td>';
            entriesHtml += '<td class="col-supplier">' + highlightText(entry.supplier || '-', q) + '</td>';
            entriesHtml += '<td class="no-print"><button class="btn btn-delete" onclick="deleteEntryRM(' + entry.rowIndex + ', \'' + prod.code + '\', \'' + entry.type + '\')">ลบ</button></td>';
            entriesHtml += '</tr>';
        });

        var q = currentSearchQuery;
        html += '<div class="stock-card stock-card-rm" id="card-rm-' + idx + '">';
        html += '<div class="stock-card-header stock-card-header-rm">';
        html += '<div class="stock-card-title"><h3>🧪 ' + highlightText(prod.name, q) + '</h3><span class="product-code">' + highlightText(prod.code, q) + '</span></div>';
        html += '<button class="btn print-btn" onclick="printSingleCard(\'card-rm-' + idx + '\', \'' + prod.name + '\', \'' + prod.code + '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> พิมพ์</button>';
        html += '</div>';
        html += '<div class="stock-card-summary stock-card-summary-rm">';

        // Row 1: รับเข้า + เบิกออก
        html += '<div class="summary-item"><span class="summary-label">รับเข้าทั้งหมด (Kg)</span><span class="summary-value positive">+' + formatNumber(prod.totalIn) + '</span></div>';
        html += '<div class="summary-item"><span class="summary-label">เบิกออกทั้งหมด (Kg)</span><span class="summary-value negative">-' + formatNumber(prod.totalOut) + '</span></div>';

        // Row 2: คงเหลือ + (empty or another stat)
        html += '<div class="summary-item"><span class="summary-label">คงเหลือปัจจุบัน (Kg)</span><span class="summary-value">' + formatNumber(prod.balance) + '</span></div>';

        // Row 3: Priority Boxes (Display ALL if applicable)

        // 1. REVAL BOX (Purple) - Highest Priority
        if (isRevalPriority) {
            html += '<div class="summary-item reval-lot">';
            html += '<span class="summary-label">🔄 สารต่ออายุ: ต้องใช้ก่อน!</span>';
            html += '<span class="summary-value reval-value">' + revalLot + '</span>';
            html += '<span class="reval-note">เหลือ ' + formatNumber(revalBalance) + ' Kg · หมดอายุ ' + revalExpDate + '</span>';
            html += '</div>';
        }

        // 2. FEFO Box (Red) with FIFO (Blue stripe inside) - COMBINED
        // Find all lots with ≤30 days
        var urgentLots = fefoSorted.filter(function (lot) {
            return lotExpDays[lot] !== undefined && lotExpDays[lot] <= 30;
        });

        // Exclude reval lots from this display (they're shown in purple box)
        if (isRevalPriority) {
            urgentLots = urgentLots.filter(function (lot) {
                return !revalLots.includes(lot);
            });
        }

        // Calculate container count for expiring lots (for FEFO box inclusion)
        var expiringLotData = {};
        prod.entries.forEach(function (entry) {
            if (!entry.lotNo) return;
            var daysLeft = parseInt(entry.daysLeft);
            if (!expiringLotData[entry.lotNo]) {
                expiringLotData[entry.lotNo] = {
                    daysLeft: null, containersIn: 0, containersOut: 0, kgIn: 0, kgOut: 0
                };
            }
            if (!isNaN(daysLeft) && expiringLotData[entry.lotNo].daysLeft === null) {
                expiringLotData[entry.lotNo].daysLeft = daysLeft;
            }
            if (entry.inQty > 0) {
                expiringLotData[entry.lotNo].containersIn += entry.containerQty || 0;
                expiringLotData[entry.lotNo].kgIn += entry.inQty;
            }
            if (entry.outQty > 0) {
                expiringLotData[entry.lotNo].containersOut += entry.containerOut || 0;
                expiringLotData[entry.lotNo].kgOut += entry.outQty;
            }
        });

        var exactContainers = 0, estimatedContainers = 0, expiringLotCount = 0, hasEstimate = false;
        Object.keys(expiringLotData).forEach(function (lotNo) {
            var lot = expiringLotData[lotNo];
            var kgRemaining = lot.kgIn - lot.kgOut;
            if (lot.daysLeft !== null && lot.daysLeft <= 30 && kgRemaining > 0) {
                expiringLotCount++;
                var containersRemaining = lot.containersIn - lot.containersOut;
                if (lot.kgOut === 0) {
                    exactContainers += lot.containersIn;
                } else if (lot.containersOut > 0) {
                    exactContainers += Math.max(0, containersRemaining);
                } else {
                    hasEstimate = true;
                    var remainRatio = lot.kgIn > 0 ? kgRemaining / lot.kgIn : 0;
                    estimatedContainers += Math.round(lot.containersIn * remainRatio);
                }
            }
        });
        var totalContainers = exactContainers + estimatedContainers;

        // 2. FEFO Box (Red) with Container count inside
        if (urgentLots.length > 0) {
            html += '<div class="summary-item fefo-container-combined">';

            // FEFO Section (Red area)
            html += '<div class="fefo-section fefo-urgent">';
            html += '<span class="summary-label">🚨 FEFO: หมดอายุเร็ว! (' + urgentLots.length + ' Lot)</span>';
            urgentLots.forEach(function (lot, idx) {
                html += '<span class="summary-value fefo-value">' + lot + '</span>';
                html += '<span class="fefo-note">เหลือ ' + formatNumber(lotBalances[lot]) + ' Kg · หมดอายุ ' + lotExpDate[lot] + ' (' + lotExpDays[lot] + ' วัน)</span>';
            });
            html += '</div>';

            // Container Section (Blue stripe at bottom of FEFO box)
            if (totalContainers > 0) {
                html += '<div class="container-section">';
                html += '<span class="summary-label">🫙 ภาชนะคงเหลือ</span>';
                if (hasEstimate) {
                    var displayText = '';
                    if (exactContainers > 0) displayText += exactContainers + ' ถัง';
                    if (estimatedContainers > 0) {
                        if (displayText) displayText += ' + ';
                        displayText += '~' + estimatedContainers + ' ถัง (ประมาณ)';
                    }
                    html += '<span class="summary-value container-value">' + displayText + '</span>';
                } else {
                    html += '<span class="summary-value container-value">' + exactContainers + ' ถัง ✓</span>';
                }
                html += '</div>';
            }

            html += '</div>'; // Close combined box
        } else if (fefoConflict && fefoLot !== '-') {
            // Show FEFO conflict box (standalone, no container inside)
            html += '<div class="summary-item fefo-lot fefo-conflict">';
            html += '<span class="summary-label">⏰ FEFO: หมดอายุก่อน</span>';
            html += '<span class="summary-value fefo-value">' + fefoLot + '</span>';
            html += '<span class="fefo-note">เหลือ ' + formatNumber(fefoBalance) + ' Kg · หมดอายุ ' + fefoExpDate + ' (' + fefoExpDays + ' วัน)</span>';
            html += '<span class="fefo-conflict-note">⚠️ FIFO ≠ FEFO - พิจารณาใช้ Lot นี้แทน!</span>';
            html += '</div>';
        }

        // 3. FIFO Box (Yellow) - Separate box as before
        html += '<div class="summary-item fifo-lot' + (hasMultipleLots ? ' has-warning' : '') + '">';
        if (hasMultipleLots) {
            html += '<span class="lots-badge">' + lotsWithBalance.length + ' Lots</span>';
        }
        html += '<span class="summary-label">' + (hasMultipleLots ? '📦 FIFO: ใช้ Lot นี้ก่อน!' : '📦 Lot คงเหลือ') + '</span>';
        html += '<span class="summary-value fifo-value">' + fifoLot + '</span>';
        html += '<span class="fifo-note">เหลือ ' + formatNumber(fifoBalance) + ' Kg';
        if (fifoExpDate && fifoExpDays !== null) {
            html += ' · หมดอายุ ' + fifoExpDate + ' (' + fifoExpDays + ' วัน)';
        }
        html += '</span>';
        html += '</div>';

        html += '</div>';
        html += '<div class="stock-table-container"><table class="stock-table stock-table-rm"><thead><tr>';
        html += '<th>วันที่</th><th>ประเภท</th><th class="no-print">Cont.</th><th class="no-print">นน./Cont.</th><th class="no-print">เศษ(Kg)</th><th>รับเข้า</th><th>เบิกออก</th><th>คงเหลือ</th><th>Lot No.</th><th class="no-print">Vendor Lot</th><th class="no-print">MFD</th><th>EXP</th><th>Days Left</th><th>Lot Bal.</th><th>Supplier</th><th class="no-print">ลบ</th>';
        html += '</tr></thead>';
        html += '<tbody>' + entriesHtml + '</tbody></table></div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

// ==================== SEARCH ====================

function handleSearch() {
    var query = document.getElementById('searchInput').value.toLowerCase().trim();
    currentSearchQuery = query; // Store for highlighting

    if (currentModule === 'package') {
        if (!query) {
            currentSearchQuery = '';
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

        // 2. Deep Search in ALL Transaction Data Fields
        stockData.forEach(function (item) {
            // Build search string from ALL displayed fields
            var searchStr = [
                item.productCode || '',
                item.productName || '',
                item.date || '',
                item.type || '',           // ประเภท (รับเข้า/เบิกออก)
                item.lotNo || '',          // Lot No.
                item.pkId || '',           // เลขรับเข้า PK ID
                item.docRef || '',         // เอกสารอ้างอิง
                item.remark || '',         // หมายเหตุ
                String(item.inQty || ''),  // จำนวนรับเข้า
                String(item.outQty || ''), // จำนวนเบิกออก
                String(item.balance || '') // คงเหลือ
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

        // Show search result count
        if (searchedProducts.length > 0) {
            showToast('พบ ' + searchedProducts.length + ' สินค้าที่ตรงกับ "' + query + '"');
        }

    } else {
        // RM Module - Deep Search ALL Fields
        if (!query) {
            currentSearchQuery = '';
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

        // 2. Deep Search in ALL Transaction Data Fields
        rmStockData.forEach(function (item) {
            // Build search string from ALL displayed fields
            var searchStr = [
                item.productCode || '',
                item.productName || '',
                item.date || '',
                item.type || '',              // ประเภท
                item.lotNo || '',             // Lot No.
                item.vendorLot || '',         // Vendor Lot
                item.mfgDate || '',           // MFD
                item.expDate || '',           // EXP
                String(item.daysLeft || ''),  // Days Left
                item.supplier || '',          // Supplier
                String(item.inQty || ''),     // รับเข้า
                String(item.outQty || ''),    // เบิกออก
                String(item.balance || ''),   // คงเหลือ
                String(item.lotBalance || ''), // Lot Balance
                String(item.containerQty || ''),    // จำนวน Container
                String(item.containerWeight || ''), // นน. Container
                String(item.remainder || '')        // เศษ
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

        // Show search result count
        if (searchedProducts.length > 0) {
            showToast('พบ ' + searchedProducts.length + ' วัตถุดิบที่ตรงกับ "' + query + '"');
        }
    }
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

    // Count critical items (<=30 days), warning items (31-90 days), and Reval items
    var criticalItems = [];
    var warningItems = [];
    var revalItems = [];

    rmStockData.forEach(function (item) {
        // Check for Revalidate (Column R)
        if (item.remark && /(ต่ออายุ|reval|extend)/i.test(item.remark) && item.balance > 0) {
            revalItems.push(item);
        }

        var daysNum = parseInt(item.daysLeft);
        if (!isNaN(daysNum)) {
            // Include both already expired (<=0) and soon to expire (1-30)
            if (daysNum <= 30) {
                criticalItems.push(item);
            } else if (daysNum <= 90) {
                warningItems.push(item);
            }
        }
    });

    // Update counts and visibility
    var criticalCount = document.getElementById('criticalCount');
    var warningCount = document.getElementById('warningCount');
    var revalCount = document.getElementById('revalCount');

    var alertReval = document.getElementById('alertReval');
    var alertCritical = document.getElementById('alertCritical');
    var alertWarning = document.getElementById('alertWarning');

    if (criticalCount && alertCritical) {
        criticalCount.textContent = criticalItems.length + ' รายการ';
        alertCritical.style.display = criticalItems.length > 0 ? 'flex' : 'none';
    }

    if (warningCount && alertWarning) {
        warningCount.textContent = warningItems.length + ' รายการ';
        alertWarning.style.display = warningItems.length > 0 ? 'flex' : 'none';
    }

    if (revalCount && alertReval) {
        revalCount.textContent = revalItems.length + ' รายการ';
        alertReval.style.display = revalItems.length > 0 ? 'flex' : 'none';
    }

    // If no alerts at all, hide the section container (optional, but good for spacing)
    var hasAnyAlert = revalItems.length > 0 || criticalItems.length > 0 || warningItems.length > 0;
    if (!hasAnyAlert) {
        alertSection.style.display = 'none';
    } else {
        alertSection.style.display = 'block';
    }

    // Store for later use
    window.expiryData = {
        critical: criticalItems,
        warning: warningItems,
        reval: revalItems
    };
}

function showExpiryItems(type) {
    if (!window.expiryData) {
        showToast('ไม่มีข้อมูลหมดอายุ');
        return;
    }

    var items = [];
    var title = '';

    if (type === 'critical') {
        items = window.expiryData.critical;
        title = '🚨 รายการหมดอายุ/ใกล้หมดอายุ (≤30 วัน)';
    } else if (type === 'warning') {
        items = window.expiryData.warning;
        title = '⏰ รายการหมดอายุภายใน 90 วัน';
    } else if (type === 'reval') {
        items = window.expiryData.reval;
        title = '🔄 รายการต่ออายุ (ต้องใช้ก่อน)';
    }

    if (!items || items.length === 0) {
        showToast('ไม่มีรายการ' + (type === 'reval' ? 'ต่ออายุ' : (type === 'critical' ? 'วิกฤต' : 'เตือน')));
        return;
    }

    // Get unique product codes from filtered items
    var productCodes = new Set();
    items.forEach(function (item) {
        productCodes.add(item.productCode);
    });

    // Get ALL entries for these products (not just the filtered ones)
    var fullProductData = {};
    rmStockData.forEach(function (entry) {
        if (productCodes.has(entry.productCode)) {
            if (!fullProductData[entry.productCode]) {
                fullProductData[entry.productCode] = {
                    code: entry.productCode,
                    name: entry.productName,
                    entries: []
                };
            }
            fullProductData[entry.productCode].entries.push(entry);
        }
    });

    // Build products with full entries
    searchedProducts = Object.values(fullProductData).map(function (prod) {
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
    showToast(title + ' (' + productCodes.size + ' สินค้า · ' + items.length + ' รายการ)');

    // Scroll to cards
    document.getElementById('cardsContainer')?.scrollIntoView({ behavior: 'smooth' });
}

// Print Expiry Items (Critical + Warning + Reval)
function printExpiryItems(type) {
    if (currentModule !== 'rm') {
        showToast('ฟังก์ชันนี้ใช้งานได้เฉพาะโหมดวัตถุดิบ (RM)');
        return;
    }

    if (!window.expiryData) {
        showToast('ไม่มีข้อมูลหมดอายุ');
        return;
    }

    var items = [];
    var title = '';
    var headerColor = '';

    if (type === 'critical') {
        items = window.expiryData.critical || [];
        title = '⚠️ รายการหมดอายุภายใน 30 วัน (วิกฤต)';
        headerColor = '#dc2626';
    } else if (type === 'warning') {
        items = window.expiryData.warning || [];
        title = '⏰ รายการหมดอายุภายใน 90 วัน (เตือน)';
        headerColor = '#f59e0b';
    } else if (type === 'reval') {
        items = window.expiryData.reval || [];
        title = '🔄 รายการต่ออายุ (ต้องใช้ก่อน)';
        headerColor = '#7c3aed';
    } else if (type === 'all') {
        items = (window.expiryData.reval || [])
            .concat(window.expiryData.critical || [])
            .concat(window.expiryData.warning || []);
        title = '🔔 รายการที่ต้องเฝ้าระวังทั้งหมด (ต่ออายุ + หมดอายุเร็ว)';
        headerColor = '#4f46e5';
    }

    if (items.length === 0) {
        showToast('ไม่มีรายการที่จะพิมพ์');
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

    // Build print content
    var printWindow = window.open('', '_blank');
    var printContent = `
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body { font-family: 'Sarabun', 'Inter', sans-serif; padding: 20px; }
                .print-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb; }
                .print-header img { height: 50px; }
                .print-header h1 { margin: 0; font-size: 18px; }
                .print-header p { margin: 5px 0 0; color: #666; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
                th { background: ${headerColor}; color: white; padding: 8px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
                tr:nth-child(even) { background: #f9fafb; }
                .product-header { background: #f3f4f6; padding: 10px; margin-top: 20px; border-radius: 8px; }
                .product-header h3 { margin: 0; font-size: 14px; }
                .days-critical { color: #dc2626; font-weight: bold; }
                .days-warning { color: #d97706; font-weight: bold; }
                .badge-reval { display: inline-block; background: #8b5cf6; color: white; font-size: 10px; padding: 2px 4px; border-radius: 4px; margin-left: 5px; }
                @media print { @page { size: A4 landscape; margin: 10mm; } }
            </style>
        </head>
        <body>
            <div class="print-header">
                <img src="logo.png" alt="Logo">
                <div>
                    <h1>🧪 ${title}</h1>
                    <p>TAN PRODUCTION | พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH')} ${new Date().toLocaleTimeString('th-TH')}</p>
                    <p>จำนวน: ${items.length} รายการ จาก ${productMap.size} สินค้า</p>
                </div>
            </div>
    `;

    productMap.forEach(function (prod) {
        printContent += `
            <div class="product-header">
                <h3>🧪 ${prod.name} (${prod.code})</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>วันที่</th>
                        <th>ประเภท</th>
                        <th>Lot No.</th>
                        <th>EXP Date</th>
                        <th>Days Left</th>
                        <th>Lot Balance</th>
                        <th>Supplier</th>
                    </tr>
                </thead>
                <tbody>
        `;

        prod.entries.forEach(function (entry) {
            var daysClass = parseInt(entry.daysLeft) <= 30 ? 'days-critical' : 'days-warning';
            var isReval = entry.remark && /(ต่ออายุ|reval|extend)/i.test(entry.remark);
            var lotHtml = entry.lotNo || '-';
            if (isReval) lotHtml += ' <span class="badge-reval">🔄 ต่ออายุ</span>';

            printContent += `
                <tr>
                    <td>${entry.date || '-'}</td>
                    <td>${entry.type || '-'}</td>
                    <td>${lotHtml}</td>
                    <td>${entry.expDate || '-'}</td>
                    <td class="${daysClass}">${entry.daysLeft || '-'} วัน</td>
                    <td>${entry.lotBalance ? formatNumber(entry.lotBalance) : '-'} Kg</td>
                    <td>${entry.supplier || '-'}</td>
                </tr>
            `;
        });

        printContent += '</tbody></table>';
    });

    printContent += `
            <script>
                window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    showToast('กำลังพิมพ์รายการ ' + type + ' (' + items.length + ' รายการ)');
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

// Parse Thai date format (D/M/YYYY or DD/MM/YYYY) to Date object
function parseDateThai(dateStr) {
    if (!dateStr) return new Date(0);
    var str = String(dateStr).trim();
    var parts = str.split('/');
    if (parts.length === 3) {
        var day = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
        var year = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }
    // Try to parse as is
    var d = new Date(str);
    return isNaN(d.getTime()) ? new Date(0) : d;
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

// Delete Entry (Package)
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

// Delete Entry (RM)
function deleteEntryRM(rowIndex, productCode, type) {
    if (!confirm('ยืนยันการลบรายการวัตถุดิบนี้?')) return;

    showLoading();
    showToast('กำลังลบ...');

    // Send delete request to RM sheet
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_rm',
            rowIndex: rowIndex,
            criteria: { productCode: productCode, type: type }
        })
    }).then(function () {
        setTimeout(async function () {
            showToast('ลบรายการวัตถุดิบเรียบร้อย!');
            await fetchRMData();
            hideLoading();
        }, 2000);
    }).catch(function (e) { alert(e); hideLoading(); });
}

// Print All Cards (Works for both Package and RM)
function printAll() {
    if (searchedProducts.length === 0) {
        showToast('ไม่มีรายการที่จะพิมพ์');
        return;
    }

    // Add print headers to all cards
    var cards = document.querySelectorAll('.stock-card, .stock-card-rm');
    var printHeaders = [];

    cards.forEach(function (card, idx) {
        var printHeader = document.createElement('div');
        printHeader.className = 'print-header';
        var moduleIcon = currentModule === 'rm' ? '🧪' : '📦';
        var moduleText = currentModule === 'rm' ? 'Stock Card วัตถุดิบ' : 'Stock Card แพ็คเกจ';
        printHeader.innerHTML = '<img src="logo.png" alt="Logo" style="height:50px;"><div><h2 style="margin:0;">' + moduleIcon + ' ' + moduleText + '</h2><p style="margin:0;color:#666;">TAN PRODUCTION | วันที่พิมพ์: ' + new Date().toLocaleDateString('th-TH') + '</p></div>';
        card.insertBefore(printHeader, card.firstChild);
        printHeaders.push(printHeader);
    });

    window.print();

    // Remove print headers after printing
    printHeaders.forEach(function (header) {
        header.remove();
    });

    showToast('พิมพ์ทั้งหมด ' + cards.length + ' รายการ');
}

// Print Expiry Items (Critical + Warning)
function printExpiryItems(type) {
    if (currentModule !== 'rm') {
        showToast('ฟังก์ชันนี้ใช้งานได้เฉพาะโหมดวัตถุดิบ (RM)');
        return;
    }

    if (!window.expiryData) {
        showToast('ไม่มีข้อมูลหมดอายุ');
        return;
    }

    var items = [];
    var title = '';

    if (type === 'critical') {
        items = window.expiryData.critical || [];
        title = '⚠️ รายการหมดอายุภายใน 30 วัน (วิกฤต)';
    } else if (type === 'warning') {
        items = window.expiryData.warning || [];
        title = '⏰ รายการหมดอายุภายใน 90 วัน (เตือน)';
    } else if (type === 'all') {
        items = (window.expiryData.critical || []).concat(window.expiryData.warning || []);
        title = '🔔 รายการที่ต้องใช้ก่อน (หมดอายุภายใน 90 วัน)';
    }

    if (items.length === 0) {
        showToast('ไม่มีรายการที่จะพิมพ์');
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

    // Build print content
    var printWindow = window.open('', '_blank');
    var printContent = `
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body { font-family: 'Sarabun', 'Inter', sans-serif; padding: 20px; }
                .print-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb; }
                .print-header img { height: 50px; }
                .print-header h1 { margin: 0; font-size: 18px; }
                .print-header p { margin: 5px 0 0; color: #666; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
                th { background: ${type === 'critical' ? '#dc2626' : '#f59e0b'}; color: white; padding: 8px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
                tr:nth-child(even) { background: #f9fafb; }
                .product-header { background: #f3f4f6; padding: 10px; margin-top: 20px; border-radius: 8px; }
                .product-header h3 { margin: 0; font-size: 14px; }
                .days-critical { color: #dc2626; font-weight: bold; }
                .days-warning { color: #d97706; font-weight: bold; }
                @media print { @page { size: A4 landscape; margin: 10mm; } }
            </style>
        </head>
        <body>
            <div class="print-header">
                <img src="logo.png" alt="Logo">
                <div>
                    <h1>🧪 ${title}</h1>
                    <p>TAN PRODUCTION | พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH')} ${new Date().toLocaleTimeString('th-TH')}</p>
                    <p>จำนวน: ${items.length} รายการ จาก ${productMap.size} สินค้า</p>
                </div>
            </div>
    `;

    productMap.forEach(function (prod) {
        printContent += `
            <div class="product-header">
                <h3>🧪 ${prod.name} (${prod.code})</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>วันที่</th>
                        <th>ประเภท</th>
                        <th>Lot No.</th>
                        <th>EXP Date</th>
                        <th>Days Left</th>
                        <th>Lot Balance</th>
                        <th>Supplier</th>
                    </tr>
                </thead>
                <tbody>
        `;

        prod.entries.forEach(function (entry) {
            var daysClass = parseInt(entry.daysLeft) <= 30 ? 'days-critical' : 'days-warning';
            printContent += `
                <tr>
                    <td>${entry.date || '-'}</td>
                    <td>${entry.type || '-'}</td>
                    <td>${entry.lotNo || '-'}</td>
                    <td>${entry.expDate || '-'}</td>
                    <td class="${daysClass}">${entry.daysLeft || '-'} วัน</td>
                    <td>${entry.lotBalance ? formatNumber(entry.lotBalance) : '-'} Kg</td>
                    <td>${entry.supplier || '-'}</td>
                </tr>
            `;
        });

        printContent += '</tbody></table>';
    });

    printContent += `
            <script>
                window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    showToast('กำลังพิมพ์รายการ ' + type + ' (' + items.length + ' รายการ)');
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


// Save Entry for RM (Supports Multi-Split) - Robust Version
async function saveEntryRM() {
    var productCode = document.getElementById('entryProductCodeRM').value;
    var productName = document.getElementById('entryProductNameRM').value;
    var date = document.getElementById('entryDateRM').value;
    var type = document.getElementById('entryTypeRM').value;
    var vendor = document.getElementById('entryVendorRM').value || '-';

    // Check if we have a split plan
    var splitPlan = window.currentSplitPlan; // [{lot, qty}, {lot, qty}]
    // Only use split plan if we are actually withdrawing (checked by type) and valid plan exists
    var isWithdrawal = type && type.includes('เบิก');
    var isSplit = isWithdrawal && splitPlan && splitPlan.length > 1;

    // Base info
    var inQty = parseFloat(document.getElementById('entryInQtyRM').value) || 0;
    var outQty = parseFloat(document.getElementById('entryOutQtyRM').value) || 0;

    if (!productCode || !date || !type) {
        alert('กรุณากรอกข้อมูลสำคัญ (รหัสสินค้า, วันที่, ประเภท) ให้ครบถ้วน');
        return;
    }

    // Validate required fields for withdrawal
    if (isWithdrawal) {
        var containerOut = parseFloat(document.getElementById('entryContainerOutRM').value) || 0;
        var containerWeightOut = parseFloat(document.getElementById('entryContainerWeightOutRM').value) || 0;

        if (containerOut <= 0 || containerWeightOut <= 0) {
            alert('⚠️ กรุณากรอกข้อมูลให้ครบ:\n• ภาชนะที่เบิก (ใบ)\n• น.น./ภาชนะ (Kg)');
            return;
        }

        // If outQty is empty, calculate from container
        if (outQty <= 0) {
            outQty = containerOut * containerWeightOut;
            document.getElementById('entryOutQtyRM').value = outQty.toFixed(2);
        }
    }

    // Validate required fields for receive
    if (!isWithdrawal && type === 'รับเข้า') {
        var missingFields = [];
        var firstMissingField = null;

        // Check Container Qty
        var containerQty = parseFloat(document.getElementById('entryContainerQtyRM')?.value) || 0;
        if (containerQty <= 0) {
            missingFields.push('จำนวน Container');
            if (!firstMissingField) firstMissingField = 'entryContainerQtyRM';
        }

        // Check Container Weight
        var containerWeight = parseFloat(document.getElementById('entryContainerWeightRM')?.value) || 0;
        if (containerWeight <= 0) {
            missingFields.push('น.น. Container (Kg)');
            if (!firstMissingField) firstMissingField = 'entryContainerWeightRM';
        }

        // Check In Qty
        if (inQty <= 0) {
            missingFields.push('รับเข้า (Kg)');
            if (!firstMissingField) firstMissingField = 'entryInQtyRM';
        }

        // Check Lot No
        var lotNo = document.getElementById('entryLotNoRM')?.value?.trim() || '';
        if (!lotNo) {
            missingFields.push('Lot No./FIFO ID');
            if (!firstMissingField) firstMissingField = 'entryLotNoRM';
        }

        // Check Vendor
        var vendorCheck = document.getElementById('entryVendorRM')?.value?.trim() || '';
        if (!vendorCheck || vendorCheck === '-') {
            missingFields.push('ผู้ส่ง/Vendor');
            if (!firstMissingField) firstMissingField = 'entryVendorRM';
        }

        // Check MFD
        var mfdDate = document.getElementById('entryMfgDateRM')?.value?.trim() || '';
        if (!mfdDate) {
            missingFields.push('วันผลิต (MFD)');
            if (!firstMissingField) firstMissingField = 'entryMfgDateRM';
        }

        // Check EXP
        var expDate = document.getElementById('entryExpDateRM')?.value?.trim() || '';
        if (!expDate) {
            missingFields.push('วันหมดอายุ (EXP)');
            if (!firstMissingField) firstMissingField = 'entryExpDateRM';
        }

        // If any fields are missing, show alert and focus
        if (missingFields.length > 0) {
            alert('⚠️ กรุณากรอกข้อมูลให้ครบ:\n\n• ' + missingFields.join('\n• '));
            if (firstMissingField) {
                var el = document.getElementById(firstMissingField);
                if (el) {
                    el.focus();
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return;
        }
    }

    showLoading();

    var entriesToSave = [];

    if (isSplit && outQty > 0) {
        // Get all lot data for MFD/EXP lookup
        var allLots = getSortedActiveLots(productCode);
        var lotDataMap = {};
        allLots.forEach(function (l) {
            lotDataMap[l.lotNo] = l;
        });

        // Create multiple entries based on plan
        splitPlan.forEach(function (item) {
            var chunkQty = item.qty;
            var containerWeight = parseFloat(document.getElementById('entryContainerWeightRM').value) || 0;
            var contQty = 0;
            var rem = 0;

            if (containerWeight > 0) {
                contQty = Math.floor(chunkQty / containerWeight);
                rem = chunkQty % containerWeight;
                rem = Math.round(rem * 100) / 100;
            } else {
                rem = chunkQty;
            }

            // Calculate containerOut for this split chunk
            var lotInfo = getLotContainerInfo(productCode, item.lotNo);
            var avgWeight = lotInfo.totalKgIn > 0 ? lotInfo.totalKgIn / lotInfo.containersIn : 0;
            var estContainerOut = avgWeight > 0 ? Math.ceil(chunkQty / avgWeight) : 0;
            estContainerOut = Math.min(estContainerOut, lotInfo.containersAvailable);

            // Get MFD/EXP/VendorLot from lot data
            var lotData = lotDataMap[item.lotNo] || {};
            var mfgDate = lotData.mfdDate || '';
            var expDate = lotData.expDate || '';
            var vendorLotVal = lotData.vendorLot || '';

            entriesToSave.push({
                date: formatDateThai(date),
                productCode: productCode,
                productName: productName,
                type: type,
                containerQty: contQty,
                containerWeight: containerWeight,
                remainder: rem,
                inQty: 0,
                outQty: chunkQty,
                lotNo: item.lotNo,
                vendorLot: vendorLotVal,
                mfgDate: mfgDate !== '-' ? mfgDate : '',
                expDate: expDate !== '-' ? expDate : '',
                supplier: item.supplier || vendor,
                containerOut: estContainerOut
            });
        });
    } else {
        // Normal Save (Single Entry)
        var containerQty = parseFloat(document.getElementById('entryContainerQtyRM').value) || 0;
        var containerWeight = parseFloat(document.getElementById('entryContainerWeightRM').value) || 0;
        var remainder = parseFloat(document.getElementById('entryRemainderRM').value) || 0;
        var lotNo = document.getElementById('entryLotNoRM').value || '-';
        var containerOut = parseFloat(document.getElementById('entryContainerOutRM').value) || 0;
        var mfgDate = document.getElementById('entryMfgDateRM')?.value || '';
        var expDate = document.getElementById('entryExpDateRM')?.value || '';
        var vendorLot = document.getElementById('entryVendorLotRM')?.value || '';

        entriesToSave.push({
            date: formatDateThai(date),
            productCode: productCode,
            productName: productName,
            type: type,
            containerQty: containerQty,
            containerWeight: containerWeight,
            remainder: remainder,
            inQty: inQty,
            outQty: outQty,
            lotNo: lotNo,
            vendorLot: vendorLot,
            mfgDate: mfgDate ? formatDateThai(mfgDate) : '',
            expDate: expDate ? formatDateThai(expDate) : '',
            supplier: vendor,
            containerOut: isWithdrawal ? containerOut : 0
        });
    }

    showToast('กำลังบันทึก ' + entriesToSave.length + ' รายการ...');
    console.log('Saving entries:', entriesToSave);

    try {
        // Process sequentially with AWAIT to prevent concurrency issues
        for (var i = 0; i < entriesToSave.length; i++) {
            var entry = entriesToSave[i];

            // DEBUG: Alert first entry to ensure data is correct
            // alert('Debug: Sending Entry ' + (i+1) + '\nProduct: ' + entry.productCode + '\nQty: ' + (entry.inQty || entry.outQty));

            if (entriesToSave.length > 1) {
                showToast('กำลังบันทึกรายการที่ ' + (i + 1) + '/' + entriesToSave.length + '...');
            }

            // Using fetch in await mode
            await fetch(APPS_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/json"
                },
                redirect: "follow",
                body: JSON.stringify({
                    action: 'add_rm',
                    spreadsheetId: SHEET_CONFIG.rm.id,
                    sheetName: SHEET_CONFIG.rm.sheetName,
                    entry: entry
                })
            });

            // Small safety delay between writes
            await new Promise(r => setTimeout(r, 800));
        }

        showToast('บันทึกสำเร็จทั้งหมด!');

        // Success Cleanup
        setTimeout(async function () {
            closeEntryModalRM();
            document.getElementById('entryFormRM').reset();
            window.currentSplitPlan = null;
            document.getElementById('lotSplitWarning').style.display = 'none';

            await fetchRMData();
            hideLoading();
        }, 1000);

    } catch (e) {
        console.error('Save Error:', e);
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + e);
        hideLoading();
    }
}


// Auto-Calculate RM Totals
function calculateRMTotal() {
    var type = document.getElementById('entryTypeRM').value;
    var isWithdrawal = type && type.includes('เบิก');
    var isReceiving = type && type.includes('รับเข้า');

    // Get all toggle-able groups
    var containerInputRow = document.getElementById('containerInputRow');
    var inQtyGroup = document.getElementById('inQtyGroup');
    var outQtyGroup = document.getElementById('outQtyGroup');
    var balanceGroup = document.getElementById('balanceGroup');
    var mfdExpRow = document.getElementById('mfdExpRow');

    // For WITHDRAWAL: hide container inputs, inQty, balance, mfd/exp
    // For RECEIVING: hide outQty, balance
    if (containerInputRow) {
        containerInputRow.style.display = isWithdrawal ? 'none' : 'grid';
    }
    if (inQtyGroup) {
        inQtyGroup.style.display = isWithdrawal ? 'none' : 'block';
    }
    if (outQtyGroup) {
        outQtyGroup.style.display = isReceiving ? 'none' : 'block';
    }
    if (balanceGroup) {
        balanceGroup.style.display = 'none'; // Always hide - calculated in Sheet
    }
    if (mfdExpRow) {
        mfdExpRow.style.display = isWithdrawal ? 'none' : 'grid';
    }

    var containerQty = parseFloat(document.getElementById('entryContainerQtyRM').value) || 0;
    var containerWeight = parseFloat(document.getElementById('entryContainerWeightRM').value) || 0;
    var remainder = parseFloat(document.getElementById('entryRemainderRM').value) || 0;

    // Calculate Total
    var total = (containerQty * containerWeight) + remainder;
    total = Math.round(total * 100) / 100; // Round to 2 decimals

    var inInput = document.getElementById('entryInQtyRM');
    var outInput = document.getElementById('entryOutQtyRM');

    if (type === 'รับเข้า') {
        inInput.value = total;
        // outInput.value = 0; // Dont force clear if user wants to do something weird, but typically yes.
    } else if (type && type !== '') {

    } else if (type && type !== '') {
        // For withdrawals (Out)
        outInput.value = total;
        // inInput.value = 0;
    }
}

// Reverse Calculate: Total (Kg) -> Container Qty + Remainder + Split Logic
function reverseCalculateRM() {
    var inQty = parseFloat(document.getElementById('entryInQtyRM').value) || 0;
    var outQty = parseFloat(document.getElementById('entryOutQtyRM').value) || 0;
    var containerWeight = parseFloat(document.getElementById('entryContainerWeightRM').value) || 0;

    var total = (inQty > 0) ? inQty : outQty;

    if (total > 0 && containerWeight > 0) {
        var containers = Math.floor(total / containerWeight);
        var remainder = total % containerWeight;
        remainder = Math.round(remainder * 100) / 100;

        document.getElementById('entryContainerQtyRM').value = containers;
        document.getElementById('entryRemainderRM').value = remainder;
    }

    // Check Split Logic if Withdrawal
    var type = document.getElementById('entryTypeRM').value;
    var isWithdrawal = type && type.includes('เบิก');
    var productCode = document.getElementById('entryProductCodeRM').value;

    // Calculate containerOut for hidden field (used when saving)
    var containerOutInput = document.getElementById('entryContainerOutRM');
    // Date when new container tracking system started (28/1/2026)
    var newSystemDate = new Date(2026, 0, 28); // January is 0 (28/1/2026)

    if (isWithdrawal && outQty > 0) {
        var lotNo = document.getElementById('entryLotNoRM').value;
        if (productCode && lotNo) {
            var lotInfo = getLotContainerInfo(productCode, lotNo);

            // Check if lot was received on/after new system date
            var isNewLot = false;
            if (lotInfo.firstDate) {
                var dateParts = lotInfo.firstDate.split('/');
                if (dateParts.length === 3) {
                    // Format: DD/MM/YYYY
                    var lotDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
                    isNewLot = lotDate >= newSystemDate;
                }
            }

            if (isNewLot && lotInfo.containersAvailable > 0) {
                // New lot: auto-fill container out
                var avgWeight = lotInfo.totalKgIn > 0 ? lotInfo.totalKgIn / lotInfo.containersIn : 0;
                var suggestedContainers = avgWeight > 0 ? Math.ceil(outQty / avgWeight) : 0;
                suggestedContainers = Math.min(suggestedContainers, lotInfo.containersAvailable);
                containerOutInput.value = suggestedContainers;
            } else {
                // Old lot: clear container out, user must enter manually
                containerOutInput.value = '';
            }
        }
    } else {
        containerOutInput.value = 0;
    }

    if (isWithdrawal && productCode && outQty > 0) {
        checkLotSplit(productCode, outQty);
    } else {
        // Hide warning if not withdrawal or no qty
        document.getElementById('lotSplitWarning').style.display = 'none';
        window.currentSplitPlan = null;
    }
}

// Get container info for a specific lot
function getLotContainerInfo(productCode, lotNo) {
    var containersIn = 0;
    var containersOut = 0;
    var totalKgIn = 0;
    var totalKgOut = 0;
    var firstDate = null;

    rmStockData.forEach(function (entry) {
        if (entry.productCode === productCode && entry.lotNo === lotNo) {
            if (entry.inQty > 0) {
                containersIn += entry.containerQty || 0;
                totalKgIn += entry.inQty;
                // Track first receive date
                if (!firstDate) firstDate = entry.date;
            }
            if (entry.outQty > 0) {
                containersOut += entry.containerOut || 0;
                totalKgOut += entry.outQty;
            }
        }
    });

    return {
        containersIn: containersIn,
        containersOut: containersOut,
        containersAvailable: Math.max(0, containersIn - containersOut),
        totalKgIn: totalKgIn,
        totalKgOut: totalKgOut,
        firstDate: firstDate  // Date when lot was first received
    };
}

// Logic to check if splitting is needed
function checkLotSplit(productCode, requiredQty) {
    var lots = getSortedActiveLots(productCode);
    if (lots.length === 0) return;

    // Check if first lot has enough
    var firstLot = lots[0];

    if (requiredQty > firstLot.balance) {
        // SPLIT NEEDED
        var plan = [];
        var remainingNeeded = requiredQty;

        // Loop through lots to fill order
        for (var i = 0; i < lots.length; i++) {
            if (remainingNeeded <= 0) break;

            var lot = lots[i];
            var take = Math.min(remainingNeeded, lot.balance);

            plan.push({
                lotNo: lot.lotNo,
                qty: take,
                supplier: lot.supplier,
                balance: lot.balance
            });

            remainingNeeded -= take;
            // Round to avoid float errors
            remainingNeeded = Math.round(remainingNeeded * 100) / 100;
        }

        // If still need more but ran out of lots?
        if (remainingNeeded > 0) {
            // Just add remainder to the last lot or new entry?
            // Let's add it to a "Generic/New" entry or warn user.
            // Current behavior: Warn but allow?
            // Let's create an "Out of Stock" entry or just append to the last used plan.
            // Better to append to last plan to allow negative stock on that last lot.
            if (plan.length > 0) {
                plan[plan.length - 1].qty += remainingNeeded;
            } else {
                // No lots at all, just use input lot (handled by normal form)
                // If normal form has lot, use it.
            }
        }

        // Render Plan
        renderSplitWarning(plan);
        window.currentSplitPlan = plan;

    } else {
        // No split needed
        document.getElementById('lotSplitWarning').style.display = 'none';
        window.currentSplitPlan = null; // Clear plan

        // Update Lot Input to the single best lot if not already
        // (Optional: User might have changed it manually)
    }
}

function renderSplitWarning(plan) {
    var warningBox = document.getElementById('lotSplitWarning');
    var list = document.getElementById('lotSplitList');
    if (!warningBox || !list) return;

    list.innerHTML = '';
    var productCode = document.getElementById('entryProductCodeRM').value;

    plan.forEach(function (item, idx) {
        // Get container info for this lot
        var lotInfo = getLotContainerInfo(productCode, item.lotNo);
        var avgWeight = lotInfo.totalKgIn > 0 ? lotInfo.totalKgIn / lotInfo.containersIn : 0;
        var estContainers = avgWeight > 0 ? Math.ceil(item.qty / avgWeight) : 0;
        estContainers = Math.min(estContainers, lotInfo.containersAvailable);

        var containerText = lotInfo.containersAvailable > 0
            ? ' → <strong>' + estContainers + ' ถัง</strong> (มี ' + lotInfo.containersAvailable + ' ถัง)'
            : '';

        var li = document.createElement('li');
        li.innerHTML = '<strong>' + (idx + 1) + '. Lot ' + item.lotNo + '</strong>: ตัด ' + formatNumber(item.qty) + ' Kg' + containerText;
        list.appendChild(li);
    });

    warningBox.style.display = 'block';

    // Update main Lot Input to show it's mixed
    var lotInput = document.getElementById('entryLotNoRM');
    if (lotInput) {
        lotInput.value = plan[0].lotNo; // Show first lot
    }
}

// Helper: Get Sorted Lots (Reused logic)
function getSortedActiveLots(productCode) {
    var entries = rmStockData.filter(function (d) { return d.productCode === productCode; });
    var lotBalances = {};
    var lotFirstDate = {};
    var lotExpDays = {};
    var lotExpDate = {};
    var lotMfdDate = {};  // Add MFD tracking
    var lotVendor = {};
    var lotTotalContainersIn = {};
    var lotTotalKgIn = {};
    var lotTotalKgOut = {};
    var lotVendorLot = {};  // Add Vendor Lot tracking

    entries.forEach(function (e) {
        if (!e.lotNo) return;
        if (!lotBalances[e.lotNo]) {
            lotBalances[e.lotNo] = 0;
            lotFirstDate[e.lotNo] = e.date;
            lotVendor[e.lotNo] = e.supplier || e.vendorLot;
            lotTotalContainersIn[e.lotNo] = 0;
            lotTotalKgIn[e.lotNo] = 0;
            lotTotalKgOut[e.lotNo] = 0;
        }
        // Track MFD, EXP, and VendorLot from receive entries
        if (e.inQty > 0) {
            if (!lotMfdDate[e.lotNo] && e.mfgDate) lotMfdDate[e.lotNo] = e.mfgDate;
            if (!lotExpDate[e.lotNo] && e.expDate) lotExpDate[e.lotNo] = e.expDate;
            if (!lotVendorLot[e.lotNo] && e.vendorLot) lotVendorLot[e.lotNo] = e.vendorLot;
        }
        lotBalances[e.lotNo] += e.inQty - e.outQty;

        // Track actual containers received
        if (e.inQty > 0) {
            lotTotalContainersIn[e.lotNo] += e.containerQty || 0;
            lotTotalKgIn[e.lotNo] += e.inQty;
        }
        if (e.outQty > 0) {
            lotTotalKgOut[e.lotNo] += e.outQty;
        }

        var days = parseInt(e.daysLeft);
        if (!isNaN(days)) {
            if (lotExpDays[e.lotNo] === undefined || days < lotExpDays[e.lotNo]) {
                lotExpDays[e.lotNo] = days;
                lotExpDate[e.lotNo] = e.expDate || '-';
            }
        }
    });

    var activeLots = Object.keys(lotBalances)
        .filter(function (lot) { return lotBalances[lot] > 0; })
        .map(function (lot) {
            var balance = Math.round(lotBalances[lot] * 100) / 100;
            var totalContainersIn = lotTotalContainersIn[lot] || 0;
            var totalKgIn = lotTotalKgIn[lot] || 0;
            var totalKgOut = lotTotalKgOut[lot] || 0;

            // Calculate average weight per container
            var avgContainerWeight = totalContainersIn > 0 ? totalKgIn / totalContainersIn : 0;

            // Estimate containers remaining
            var estimatedContainersOut = avgContainerWeight > 0 ? totalKgOut / avgContainerWeight : 0;
            var remainingContainers = Math.max(0, totalContainersIn - estimatedContainersOut);

            // Split into full containers and partial
            var fullContainers = Math.floor(remainingContainers);
            var partialFraction = remainingContainers - fullContainers;
            var partialKg = avgContainerWeight > 0 ? Math.round(partialFraction * avgContainerWeight * 100) / 100 : 0;

            return {
                lotNo: lot,
                balance: balance,
                firstDate: lotFirstDate[lot],
                mfdDate: lotMfdDate[lot] || '-',  // Add MFD
                expDays: lotExpDays[lot],
                expDate: lotExpDate[lot] || '-',
                vendorLot: lotVendorLot[lot] || '',  // Add Vendor Lot
                supplier: lotVendor[lot],
                containerWeight: Math.round(avgContainerWeight * 100) / 100,
                originalContainers: totalContainersIn,
                fullContainers: fullContainers,
                partialKg: partialKg
            };
        });

    // Sort: Reval > FEFO > FIFO
    // 1. Identify Reval
    var revalLots = [];
    var otherLots = [];

    activeLots.forEach(function (lotObj) {
        var isReval = entries.some(function (e) {
            return e.lotNo === lotObj.lotNo && e.remark && /(ต่ออายุ|reval|extend)/i.test(e.remark);
        });
        if (isReval) revalLots.push(lotObj);
        else otherLots.push(lotObj);
    });

    // Sort Others by FEFO (ExpDays) then FIFO (Date)
    otherLots.sort(function (a, b) {
        // FEFO: if expDays <= 90
        var aUrgent = (a.expDays !== undefined && a.expDays <= 90);
        var bUrgent = (b.expDays !== undefined && b.expDays <= 90);

        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;
        if (aUrgent && bUrgent) return (a.expDays - b.expDays);

        // FIFO fallback
        return (a.firstDate || '') > (b.firstDate || '') ? 1 : -1;
    });

    return revalLots.concat(otherLots);
}

// Auto-Fill RM Entry Form (Suggest Best Lot + Vendor + Weight)
function autoFillRMForm(productCode) {
    if (!productCode) return;

    var type = document.getElementById('entryTypeRM').value;
    var isWithdrawal = type && type.includes('เบิก');

    // 1. Find product info from MASTER SHEET first
    var masterProduct = rmMasterWithSupplier.find(function (p) { return p.code === productCode; });
    var masterName = masterProduct ? masterProduct.name : '';
    var masterSupplier = masterProduct ? masterProduct.supplier : '';

    // 2. Find product info from existing STOCK DATA (for weight, last vendor)
    var foundWeight = null;
    var lastVendorFromStock = '-';
    var productNameFromStock = '';

    for (var i = rmStockData.length - 1; i >= 0; i--) {
        var item = rmStockData[i];
        if (item.productCode === productCode) {
            if (!productNameFromStock && item.productName) productNameFromStock = item.productName;
            if (foundWeight === null && item.containerWeight > 0) foundWeight = item.containerWeight;
            if (lastVendorFromStock === '-' && item.supplier) lastVendorFromStock = item.supplier;
            if (productNameFromStock && foundWeight !== null && lastVendorFromStock !== '-') break;
        }
    }

    // Use master data first, fallback to stock data
    var productName = masterName || productNameFromStock;
    var supplier = masterSupplier || lastVendorFromStock;

    // Auto-fill product name
    var nameInput = document.getElementById('entryProductNameRM');
    if (nameInput && !nameInput.value && productName) {
        nameInput.value = productName;
    }

    // Auto-fill container weight (only for withdrawal, not receive)
    var weightInput = document.getElementById('entryContainerWeightRM');
    if (isWithdrawal && weightInput && !weightInput.value && foundWeight !== null) {
        weightInput.value = foundWeight;
        calculateRMTotal();
    }

    // 3. Intelligent Auto-Fill for Withdrawal
    if (isWithdrawal) {
        var sortedLots = getSortedActiveLots(productCode);
        console.log('[AutoFill] Withdrawal for:', productCode, 'Found lots:', sortedLots.length);

        if (sortedLots.length > 0) {
            var bestLot = sortedLots[0];
            console.log('[AutoFill] Best Lot:', bestLot);

            var lotInput = document.getElementById('entryLotNoRM');
            var vendorInput = document.getElementById('entryVendorRM');
            var mfdInput = document.getElementById('entryMfgDateRM');  // entryMfgDateRM not entryMfdDateRM
            var expInput = document.getElementById('entryExpDateRM');

            if (lotInput && !lotInput.value) {
                lotInput.value = bestLot.lotNo;
                showToast('แนะนำ Lot: ' + bestLot.lotNo + ' (เหลือ ' + formatNumber(bestLot.balance) + ' Kg)');
            }
            if (vendorInput && !vendorInput.value && bestLot.supplier) {
                vendorInput.value = bestLot.supplier;
            }
            // Auto-fill MFD and EXP from lot data
            if (mfdInput && !mfdInput.value && bestLot.mfdDate && bestLot.mfdDate !== '-') {
                mfdInput.value = bestLot.mfdDate;
            }
            if (expInput && !expInput.value && bestLot.expDate && bestLot.expDate !== '-') {
                expInput.value = bestLot.expDate;
            }

            // Check if lot is new (after 28/1/2026)
            var newSystemDate = new Date(2026, 0, 28);
            var isNewLot = false;
            if (bestLot.firstDate) {
                var dateParts = bestLot.firstDate.split('/');
                if (dateParts.length === 3) {
                    var lotDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
                    isNewLot = lotDate >= newSystemDate;
                }
            }

            // Store container weight and auto-fill for NEW lots only
            if (bestLot.containerWeight && bestLot.containerWeight > 0) {
                window.currentLotContainerWeight = bestLot.containerWeight;

                // Auto-fill container weight for NEW lots
                if (isNewLot) {
                    var containerWeightInput = document.getElementById('entryContainerWeightOutRM');
                    if (containerWeightInput) {
                        containerWeightInput.value = bestLot.containerWeight;
                    }
                    showToast('✅ Lot ใหม่: น.น./ภาชนะ = ' + bestLot.containerWeight + ' Kg');
                }
            }

            // Show available containers for this RM
            showContainerInfoForWithdraw(productCode, sortedLots);
        } else {
            console.log('[AutoFill] No active lots found for:', productCode);
        }
    } else {
        // Receive: Auto-fill supplier (from master first, then stock history)
        var vendorInput = document.getElementById('entryVendorRM');
        if (vendorInput && !vendorInput.value && supplier && supplier !== '-') {
            vendorInput.value = supplier;
            showToast('📦 Supplier: ' + supplier);
        }
    }
}

// Show container info for withdrawal
function showContainerInfoForWithdraw(productCode, sortedLots) {
    // Get or create container info div
    var containerInfoDiv = document.getElementById('withdrawContainerInfo');
    if (!containerInfoDiv) {
        containerInfoDiv = document.createElement('div');
        containerInfoDiv.id = 'withdrawContainerInfo';
        containerInfoDiv.style.cssText = 'background: #e0f2fe; border: 1px solid #0ea5e9; border-radius: 8px; padding: 10px; margin-top: 10px; font-size: 0.9em;';

        var formRM = document.getElementById('entryFormRM');
        var lotSplitWarning = document.getElementById('lotSplitWarning');
        if (lotSplitWarning) {
            formRM.insertBefore(containerInfoDiv, lotSplitWarning);
        } else {
            formRM.appendChild(containerInfoDiv);
        }
    }

    var newSystemDate = new Date(2026, 0, 28); // 28/1/2026

    // Calculate total containers and typical weight
    var totalContainers = 0;
    var containerWeights = {};
    var hasOldLot = false;
    var typicalContainerWeight = 0;

    sortedLots.forEach(function (lot) {
        // Check if lot is old
        if (lot.firstDate) {
            var dateParts = lot.firstDate.split('/');
            if (dateParts.length === 3) {
                var lotDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
                if (lotDate < newSystemDate) {
                    hasOldLot = true;
                }
            }
        }

        var containers = lot.fullContainers || 0;
        if (containers > 0) {
            totalContainers += containers;
            var weight = lot.containerWeight || 0;
            if (weight > 0) {
                if (!containerWeights[weight]) containerWeights[weight] = 0;
                containerWeights[weight] += containers;
                typicalContainerWeight = weight; // Use last known weight
            }
        }
    });

    // Store typical weight for calculation
    window.currentLotContainerWeight = typicalContainerWeight;

    var html = '';

    // Only show container count header for new lots
    if (!hasOldLot && totalContainers > 0) {
        html = '<strong>📦 ภาชนะคงเหลือ:</strong> ' + totalContainers + ' ภาชนะ<br>';
    }

    html += '<small style="color:#0369a1;">';

    sortedLots.forEach(function (lot, idx) {
        var containers = lot.fullContainers || 0;

        // Check if this lot is old
        var isOldLot = false;
        if (lot.firstDate) {
            var dateParts = lot.firstDate.split('/');
            if (dateParts.length === 3) {
                var lotDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
                isOldLot = lotDate < newSystemDate;
            }
        }

        html += '<b>Lot ' + lot.lotNo + '</b>: ';

        if (isOldLot) {
            // OLD LOT: Show MFD, EXP + container hint for reference
            if (lot.mfdDate && lot.mfdDate !== '-') {
                html += 'MFD: ' + lot.mfdDate + ' | ';
            }
            if (lot.expDate && lot.expDate !== '-') {
                var expStyle = lot.expDays <= 30 ? 'color:#dc2626;font-weight:bold;' : '';
                html += '<span style="' + expStyle + '">EXP: ' + lot.expDate;
                if (lot.expDays !== undefined) html += ' (' + lot.expDays + ' วัน)';
                html += '</span>';
            }
            // Add container hint for reference (gray text)
            if (containers > 0 && lot.containerWeight) {
                html += ' <span style="color:#888;">| ' + containers + '×' + lot.containerWeight + 'Kg</span>';
            }
        } else {
            // NEW LOT: Show full container info
            if (containers > 0) {
                html += containers + ' ภาชนะ';
                if (lot.containerWeight) html += ' (' + lot.containerWeight + ' Kg/ภาชนะ)';
                if (lot.partialKg > 0) html += ' + เศษ ' + lot.partialKg + ' Kg';
            } else {
                html += formatNumber(lot.balance) + ' Kg';
            }
            // Add expiry info
            if (lot.expDate && lot.expDate !== '-') {
                var expStyle = lot.expDays <= 30 ? 'color:#dc2626;font-weight:bold;' : 'color:#666;';
                html += ' <span style="' + expStyle + '">| EXP: ' + lot.expDate;
                if (lot.expDays !== undefined) html += ' (' + lot.expDays + ' วัน)';
                html += '</span>';
            }
        }

        if (idx < sortedLots.length - 1) html += '<br>';
    });
    html += '</small>';

    // Warning for old lots
    if (hasOldLot) {
        html += '<br><span style="color:#dc2626;font-weight:bold;">⚠️ Lot นี้รับเข้าก่อน 28/1/2026 - กรุณาระบุจำนวนภาชนะที่เบิกเอง</span>';

        // Mark container input as required
        var containerLabel = document.querySelector('label[for="entryContainerOutRM"]');
        if (containerLabel && !containerLabel.innerHTML.includes('*')) {
            containerLabel.innerHTML = 'ภาชนะที่เบิก (ใบ) <span style="color:red;">*</span>';
        }
    }

    containerInfoDiv.innerHTML = html;
    containerInfoDiv.style.display = 'block';
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

    // Recalculate Button (RM only)
    document.getElementById('recalculateBtn')?.addEventListener('click', recalculateAllBalances);

    // RM Modal events
    document.getElementById('entryModalCloseRM')?.addEventListener('click', closeEntryModalRM);
    document.getElementById('entryModalBackdropRM')?.addEventListener('click', closeEntryModalRM);
    document.getElementById('cancelEntryRM')?.addEventListener('click', closeEntryModalRM);

    // Clear Form Button
    document.getElementById('clearFormRM')?.addEventListener('click', function () {
        // Reset all form fields completely
        var form = document.getElementById('entryFormRM');
        var savedDate = document.getElementById('entryDateRM').value;

        form.reset();

        // Restore date only
        document.getElementById('entryDateRM').value = savedDate;

        // Reset type to default (-- เลือกประเภท --)
        document.getElementById('entryTypeRM').value = '';

        // Hide all conditional fields (back to initial state)
        var containerRow = document.getElementById('containerInputRow');
        var mfdExpRow = document.getElementById('mfdExpRow');
        var inQtyGroup = document.getElementById('inQtyGroup');
        var outQtyGroup = document.getElementById('outQtyGroup');
        var balanceGroup = document.getElementById('balanceGroup');
        var withdrawContainerInfo = document.getElementById('withdrawContainerInfo');
        var lotSplitWarning = document.getElementById('lotSplitWarning');

        if (containerRow) containerRow.style.display = 'none';
        if (mfdExpRow) mfdExpRow.style.display = 'none';
        if (inQtyGroup) inQtyGroup.style.display = 'none';
        if (outQtyGroup) outQtyGroup.style.display = 'none';
        if (balanceGroup) balanceGroup.style.display = 'none';
        if (withdrawContainerInfo) withdrawContainerInfo.style.display = 'none';
        if (lotSplitWarning) lotSplitWarning.style.display = 'none';

        // Hide container out group
        var containerOutGroup = document.getElementById('containerOutGroup');
        if (containerOutGroup) containerOutGroup.style.display = 'none';

        showToast('🗑️ ล้างข้อมูลแล้ว');
    });

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


    // RM Save Button
    document.getElementById('saveEntryRM')?.addEventListener('click', saveEntryRM);

    // RM Auto-Calculate Listeners (Forward: Container -> Total)
    var rmCalcInputs = ['entryContainerQtyRM', 'entryContainerWeightRM', 'entryRemainderRM'];
    rmCalcInputs.forEach(function (id) {
        document.getElementById(id)?.addEventListener('input', calculateRMTotal);
        document.getElementById(id)?.addEventListener('change', calculateRMTotal);
    });

    // RM Reverse-Calculate Listeners (Backward: Total -> Container)
    // Only trigger if Container Weight is present
    ['entryInQtyRM', 'entryOutQtyRM'].forEach(function (id) {
        document.getElementById(id)?.addEventListener('input', reverseCalculateRM);
        document.getElementById(id)?.addEventListener('change', reverseCalculateRM);
    });

    // Calculate Kg from Container Out and Weight per Container
    function calculateKgFromContainers() {
        var containerCount = parseFloat(document.getElementById('entryContainerOutRM')?.value) || 0;
        var containerWeight = parseFloat(document.getElementById('entryContainerWeightOutRM')?.value) || 0;

        if (containerCount > 0 && containerWeight > 0) {
            var totalKg = containerCount * containerWeight;
            var outQtyInput = document.getElementById('entryOutQtyRM');
            if (outQtyInput) {
                outQtyInput.value = totalKg.toFixed(2);
            }
        }
    }

    document.getElementById('entryContainerOutRM')?.addEventListener('input', calculateKgFromContainers);
    document.getElementById('entryContainerWeightOutRM')?.addEventListener('input', calculateKgFromContainers);


    // RM Auto-Fill on Product Change (Logic updated to include Lot/Vendor)
    // Trigger on both 'change' (dropdown select) and 'input' (typing)
    var productCodeRMInput = document.getElementById('entryProductCodeRM');

    function handleProductCodeRMChange() {
        var code = this.value.trim();
        if (code) {
            autoFillRMForm(code);
            calculateRMTotal();
        }
    }

    productCodeRMInput?.addEventListener('change', handleProductCodeRMChange);
    productCodeRMInput?.addEventListener('input', function () {
        var code = this.value.trim();
        // Trigger auto-fill if code matches exactly (from dropdown or typed correctly)
        if (code && rmProductMasterData.some(function (p) { return p.code === code; })) {
            autoFillRMForm(code);
            calculateRMTotal();
        }
    });

    // Also trigger on Type change - immediately show full form for 'รับเข้า'
    document.getElementById('entryTypeRM')?.addEventListener('change', function () {
        var type = this.value;
        var isReceive = type === 'รับเข้า';
        var isWithdrawal = type && type.includes('เบิก');

        // Show/hide form sections based on type
        var containerRow = document.getElementById('containerInputRow');
        var mfdExpRow = document.getElementById('mfdExpRow');
        var inQtyGroup = document.getElementById('inQtyGroup');
        var outQtyGroup = document.getElementById('outQtyGroup');

        if (isReceive) {
            // Show receive-specific fields
            if (containerRow) containerRow.style.display = 'grid';
            if (mfdExpRow) mfdExpRow.style.display = 'grid';

            // Show receive rows
            var inQtyBalanceRow = document.getElementById('inQtyBalanceRow');
            if (inQtyBalanceRow) inQtyBalanceRow.style.display = 'grid';

            // Hide withdrawal rows
            var outQtyContainerRow = document.getElementById('outQtyContainerRow');
            if (outQtyContainerRow) outQtyContainerRow.style.display = 'none';
            var balanceRow = document.getElementById('balanceRow');
            if (balanceRow) balanceRow.style.display = 'none';

            // Clear out qty
            var outQtyInput = document.getElementById('entryOutQtyRM');
            if (outQtyInput) outQtyInput.value = '';
        } else if (isWithdrawal) {
            // Show withdrawal-specific fields
            if (containerRow) containerRow.style.display = 'none';
            if (mfdExpRow) mfdExpRow.style.display = 'none';

            // Show withdrawal rows
            var outQtyContainerRow = document.getElementById('outQtyContainerRow');
            if (outQtyContainerRow) outQtyContainerRow.style.display = 'grid';
            var balanceRow = document.getElementById('balanceRow');
            if (balanceRow) balanceRow.style.display = 'grid';

            // Hide receive rows
            var inQtyBalanceRow = document.getElementById('inQtyBalanceRow');
            if (inQtyBalanceRow) inQtyBalanceRow.style.display = 'none';

            // Clear in qty
            var inQtyInput = document.getElementById('entryInQtyRM');
            if (inQtyInput) inQtyInput.value = '';
        }

        // Auto-fill if product is already selected
        var productCode = document.getElementById('entryProductCodeRM').value;
        if (productCode) {
            autoFillRMForm(productCode);
        }
    });

    // ==================== MODULE TAB EVENT HANDLERS ====================
    // Use a single unified approach for both touch and click
    // CRITICAL: Prevent mobile double-tap and ghost click issues
    var tabPackage = document.getElementById('tabPackage');
    var tabRM = document.getElementById('tabRM');
    var isProcessingTab = false;
    var lastTabSwitchTime = 0;

    function handleTabSwitch(module, e) {
        var now = Date.now();

        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }

        // Prevent multiple rapid calls with time-based lock (2 seconds)
        if (now - lastTabSwitchTime < 2000) {
            console.log('Tab switch blocked - too fast (within 2s)');
            return;
        }

        // Prevent multiple rapid calls with flag lock
        if (isProcessingTab) {
            console.log('Tab switch blocked - already processing');
            return;
        }

        // Already on this tab
        if (currentModule === module) {
            console.log('Already on module:', module);
            return;
        }

        // Set both locks
        isProcessingTab = true;
        lastTabSwitchTime = now;

        console.log('Handling tab switch to:', module, 'at', now);

        // Call the actual switch function
        switchModule(module, e);

        // Reset flag after longer delay for mobile
        setTimeout(function () {
            isProcessingTab = false;
            console.log('Tab switch lock released');
        }, 2000);
    }

    // Unified Click Handler (Desktop & Mobile)
    // We rely on standard click events which work reliably on both.
    // 300ms delay on mobile is acceptable for stability.

    if (tabPackage) {
        tabPackage.addEventListener('click', function (e) {
            handleTabSwitch('package', e);
        });
    }

    if (tabRM) {
        tabRM.addEventListener('click', function (e) {
            handleTabSwitch('rm', e);
        });
    }

    // Update Slider on Resize
    // Resize listener removed to prevent mobile refresh loops
    // The slider will update position on tab switch automatically.

    // ==================== SMART WITHDRAW EVENT LISTENERS ====================
    document.getElementById('smartWithdrawBtn')?.addEventListener('click', openSmartWithdrawModal);
    document.getElementById('smartWithdrawModalClose')?.addEventListener('click', closeSmartWithdrawModal);
    document.getElementById('smartWithdrawBackdrop')?.addEventListener('click', closeSmartWithdrawModal);
    document.getElementById('btnCalculateAllocation')?.addEventListener('click', calculateSmartAllocation);
    document.getElementById('btnBackToStep1')?.addEventListener('click', smartWithdrawBackToStep1);
    document.getElementById('btnConfirmWithdraw')?.addEventListener('click', confirmSmartWithdraw);
    document.getElementById('swProductSelect')?.addEventListener('change', onSmartWithdrawProductChange);
    document.getElementById('swTotalQty')?.addEventListener('input', updateSmartWithdrawStockInfo);

});

// ==================== SMART WITHDRAWAL SYSTEM ====================

// Global variable to store current allocation plan
var smartWithdrawAllocationPlan = [];

// Open Smart Withdraw Modal
function openSmartWithdrawModal() {
    var modal = document.getElementById('smartWithdrawModal');
    if (!modal) return;

    // Populate product dropdown
    populateSmartWithdrawProducts();

    // Set default date to today
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('swDate').value = yyyy + '-' + mm + '-' + dd;

    // Reset form and show step 1
    document.getElementById('smartWithdrawForm')?.reset();
    document.getElementById('swDate').value = yyyy + '-' + mm + '-' + dd;
    document.getElementById('swStockInfo').style.display = 'none';
    document.getElementById('smartWithdrawStep1').style.display = 'block';
    document.getElementById('smartWithdrawStep2').style.display = 'none';
    smartWithdrawAllocationPlan = [];

    // Show modal
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
}

// Close Smart Withdraw Modal
function closeSmartWithdrawModal() {
    var modal = document.getElementById('smartWithdrawModal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
    }
    smartWithdrawAllocationPlan = [];
}

// Populate Product Dropdown for Smart Withdraw
function populateSmartWithdrawProducts() {
    var select = document.getElementById('swProductSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- เลือกสินค้า --</option>';

    rmProductMasterData.forEach(function (prod) {
        var option = document.createElement('option');
        option.value = prod.code;
        option.textContent = prod.code + ' - ' + prod.name;
        select.appendChild(option);
    });
}

// On Product Selection Change
function onSmartWithdrawProductChange() {
    var productCode = document.getElementById('swProductSelect').value;
    if (!productCode) {
        document.getElementById('swProductName').value = '';
        document.getElementById('swStockInfo').style.display = 'none';
        return;
    }

    // Find product name
    var prod = rmProductMasterData.find(function (p) { return p.code === productCode; });
    if (prod) {
        document.getElementById('swProductName').value = prod.name;
    }

    // Show stock info
    updateSmartWithdrawStockInfo();
}

// Update Stock Info Display
function updateSmartWithdrawStockInfo() {
    var productCode = document.getElementById('swProductSelect').value;
    if (!productCode) {
        document.getElementById('swStockInfo').style.display = 'none';
        return;
    }

    var lots = getSortedActiveLots(productCode);
    var totalStock = lots.reduce(function (sum, lot) { return sum + lot.balance; }, 0);
    totalStock = Math.round(totalStock * 100) / 100;

    // Calculate total containers
    var totalFullContainers = 0;
    var totalPartialKg = 0;
    lots.forEach(function (lot) {
        totalFullContainers += lot.fullContainers || 0;
        totalPartialKg += lot.partialKg || 0;
    });
    totalPartialKg = Math.round(totalPartialKg * 100) / 100;

    // Find nearest expiry lot
    var nearestExpiry = '-';
    if (lots.length > 0) {
        var firstLot = lots[0];
        if (firstLot.expDays !== undefined) {
            nearestExpiry = firstLot.lotNo + ' (' + firstLot.expDays + ' วัน)';
        } else {
            nearestExpiry = firstLot.lotNo;
        }
    }

    // Update UI
    var prod = rmProductMasterData.find(function (p) { return p.code === productCode; });
    document.getElementById('swStockProductName').textContent = prod ? prod.name : productCode;
    document.getElementById('swTotalStock').textContent = formatNumber(totalStock) + ' Kg';
    document.getElementById('swTotalLots').textContent = lots.length + ' Lots';
    document.getElementById('swNearExpiry').textContent = nearestExpiry;

    // Show container summary
    var containerText = totalFullContainers + ' ถัง';
    if (totalPartialKg > 0) {
        containerText += ' + ' + formatNumber(totalPartialKg) + ' Kg';
    }
    document.getElementById('swTotalContainers').textContent = containerText;

    // Check if near expiry warning needed
    var nearExpiryEl = document.getElementById('swNearExpiry');
    if (lots.length > 0 && lots[0].expDays !== undefined && lots[0].expDays <= 30) {
        nearExpiryEl.classList.add('info-warning');
    } else {
        nearExpiryEl.classList.remove('info-warning');
    }

    document.getElementById('swStockInfo').style.display = 'block';
}

// Calculate Smart Allocation (FEFO/FIFO)
function calculateSmartAllocation() {
    var productCode = document.getElementById('swProductSelect').value;
    var totalQty = parseFloat(document.getElementById('swTotalQty').value) || 0;

    // Validation
    if (!productCode) {
        alert('กรุณาเลือกสินค้าก่อน');
        return;
    }
    if (totalQty <= 0) {
        alert('กรุณาระบุจำนวนที่ต้องการเบิก');
        return;
    }

    // Get sorted lots (FEFO/FIFO)
    var lots = getSortedActiveLots(productCode);
    if (lots.length === 0) {
        alert('ไม่พบ Lot ที่มีสต็อกสำหรับสินค้านี้');
        return;
    }

    // Calculate total available stock
    var totalAvailable = lots.reduce(function (sum, lot) { return sum + lot.balance; }, 0);
    totalAvailable = Math.round(totalAvailable * 100) / 100;

    // Allocation algorithm
    var allocationPlan = [];
    var remainingNeeded = totalQty;
    var isPartial = false;

    for (var i = 0; i < lots.length && remainingNeeded > 0; i++) {
        var lot = lots[i];
        var take = Math.min(remainingNeeded, lot.balance);
        take = Math.round(take * 100) / 100;

        var afterQty = Math.round((lot.balance - take) * 100) / 100;
        var containerWt = lot.containerWeight || 0;
        var afterFullContainers = containerWt > 0 ? Math.floor(afterQty / containerWt) : 0;
        var afterPartialKg = containerWt > 0 ? Math.round((afterQty % containerWt) * 100) / 100 : afterQty;

        allocationPlan.push({
            lotNo: lot.lotNo,
            expDays: lot.expDays,
            expDate: lot.expDate || '-',
            balance: lot.balance,
            takeQty: take,
            afterQty: afterQty,
            supplier: lot.supplier,
            containerWeight: containerWt,
            fullContainers: lot.fullContainers || 0,
            partialKg: lot.partialKg || 0,
            afterFullContainers: afterFullContainers,
            afterPartialKg: afterPartialKg
        });

        remainingNeeded -= take;
        remainingNeeded = Math.round(remainingNeeded * 100) / 100;
    }

    // Check if stock is insufficient
    if (remainingNeeded > 0) {
        isPartial = true;
    }

    // Store allocation plan globally
    smartWithdrawAllocationPlan = allocationPlan;

    // Render allocation preview
    renderAllocationPreview(allocationPlan, totalQty, isPartial, remainingNeeded);

    // Switch to step 2
    document.getElementById('smartWithdrawStep1').style.display = 'none';
    document.getElementById('smartWithdrawStep2').style.display = 'block';
}

// Render Allocation Preview Table
function renderAllocationPreview(plan, totalRequested, isPartial, shortfall) {
    var tbody = document.getElementById('allocationTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    var totalTake = 0;

    plan.forEach(function (item, idx) {
        var row = document.createElement('tr');

        // Days class
        var daysClass = 'days-ok';
        var daysDisplay = '-';
        if (item.expDays !== undefined) {
            daysDisplay = item.expDays + ' วัน';
            if (item.expDays <= 30) {
                daysClass = 'days-critical';
            } else if (item.expDays <= 90) {
                daysClass = 'days-warning';
            }
        }

        // Container size display
        var containerSizeText = item.containerWeight > 0 ? formatNumber(item.containerWeight) + ' Kg/ถัง' : '-';

        // Current balance with containers
        var currentBalanceText = '';
        if (item.containerWeight > 0) {
            currentBalanceText = item.fullContainers + ' ถัง';
            if (item.partialKg > 0) {
                currentBalanceText += ' + ' + formatNumber(item.partialKg) + ' Kg';
            }
        } else {
            currentBalanceText = formatNumber(item.balance) + ' Kg';
        }

        // After balance with containers
        var afterBalanceText = '';
        if (item.containerWeight > 0) {
            afterBalanceText = item.afterFullContainers + ' ถัง';
            if (item.afterPartialKg > 0) {
                afterBalanceText += ' + ' + formatNumber(item.afterPartialKg) + ' Kg';
            }
        } else {
            afterBalanceText = formatNumber(item.afterQty) + ' Kg';
        }

        row.innerHTML = `
            <td>${idx + 1}</td>
            <td><span class="lot-badge">${item.lotNo}</span></td>
            <td>${item.expDate}</td>
            <td class="${daysClass}">${daysDisplay}</td>
            <td>${containerSizeText}</td>
            <td>${currentBalanceText}</td>
            <td class="qty-withdraw">-${formatNumber(item.takeQty)} Kg</td>
            <td class="qty-after">${afterBalanceText}</td>
        `;
        tbody.appendChild(row);
        totalTake += item.takeQty;
    });

    // Update totals
    document.getElementById('allocationTotalQty').textContent = formatNumber(totalTake) + ' Kg';
    document.getElementById('allocationLotCount').textContent = plan.length + ' Lots';

    // Handle warning
    var warningBox = document.getElementById('swWarning');
    var warningText = document.getElementById('swWarningText');
    var confirmBtn = document.getElementById('btnConfirmWithdraw');

    if (isPartial) {
        warningBox.style.display = 'flex';
        warningBox.classList.add('warning-critical');
        warningText.textContent = 'สต็อกไม่เพียงพอ! ต้องการ ' + formatNumber(totalRequested) + ' Kg แต่มีเพียง ' + formatNumber(totalTake) + ' Kg (ขาด ' + formatNumber(shortfall) + ' Kg)';
        confirmBtn.disabled = true;
        confirmBtn.textContent = '❌ สต็อกไม่พอ';
    } else {
        warningBox.style.display = 'none';
        warningBox.classList.remove('warning-critical');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '✅ ยืนยันการเบิก';
    }

    // Update badge text
    var badge = document.getElementById('allocationBadge');
    if (badge) {
        badge.textContent = plan.length > 1 ? 'Multi-Lot FEFO' : 'Single Lot';
    }
}

// Back to Step 1
function smartWithdrawBackToStep1() {
    document.getElementById('smartWithdrawStep1').style.display = 'block';
    document.getElementById('smartWithdrawStep2').style.display = 'none';
}

// Confirm and Execute Smart Withdraw
async function confirmSmartWithdraw() {
    if (smartWithdrawAllocationPlan.length === 0) {
        alert('ไม่มีรายการที่จะเบิก');
        return;
    }

    var productCode = document.getElementById('swProductSelect').value;
    var productName = document.getElementById('swProductName').value;
    var date = document.getElementById('swDate').value;
    var jobCategory = document.getElementById('swJobCategory').value;

    // Prepare entries
    var entriesToSave = smartWithdrawAllocationPlan.map(function (item) {
        // Calculate container info if available
        var containerWeight = 0;
        var containerQty = 0;
        var remainder = item.takeQty;

        // Try to find historical container weight for this product
        for (var i = rmStockData.length - 1; i >= 0; i--) {
            if (rmStockData[i].productCode === productCode && rmStockData[i].containerWeight > 0) {
                containerWeight = rmStockData[i].containerWeight;
                break;
            }
        }

        if (containerWeight > 0) {
            containerQty = Math.floor(item.takeQty / containerWeight);
            remainder = Math.round((item.takeQty % containerWeight) * 100) / 100;
        }

        return {
            date: formatDateThai(date),
            productCode: productCode,
            productName: productName,
            type: jobCategory,
            containerQty: containerQty,
            containerWeight: containerWeight,
            remainder: remainder,
            inQty: 0,
            outQty: item.takeQty,
            lotNo: item.lotNo,
            supplier: item.supplier || '-'
        };
    });

    // Confirm with user
    var confirmMsg = 'ยืนยันการเบิกจาก ' + entriesToSave.length + ' Lot:\n\n';
    entriesToSave.forEach(function (e, i) {
        confirmMsg += (i + 1) + '. Lot ' + e.lotNo + ': ' + formatNumber(e.outQty) + ' Kg\n';
    });
    confirmMsg += '\nรวมทั้งหมด: ' + formatNumber(entriesToSave.reduce((s, e) => s + e.outQty, 0)) + ' Kg';

    if (!confirm(confirmMsg)) {
        return;
    }

    showLoading();
    showToast('กำลังบันทึก ' + entriesToSave.length + ' รายการ...');

    try {
        for (var i = 0; i < entriesToSave.length; i++) {
            var entry = entriesToSave[i];

            if (entriesToSave.length > 1) {
                showToast('บันทึกรายการที่ ' + (i + 1) + '/' + entriesToSave.length + '...');
            }

            await fetch(APPS_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "application/json"
                },
                redirect: "follow",
                body: JSON.stringify({
                    action: 'add_rm',
                    spreadsheetId: SHEET_CONFIG.rm.id,
                    sheetName: SHEET_CONFIG.rm.sheetName,
                    entry: entry
                })
            });

            // Delay between writes
            await new Promise(r => setTimeout(r, 800));
        }

        showToast('✅ Smart Withdraw สำเร็จ! บันทึก ' + entriesToSave.length + ' รายการ');

        // Cleanup and refresh
        setTimeout(async function () {
            closeSmartWithdrawModal();
            smartWithdrawAllocationPlan = [];
            await fetchRMData();
            hideLoading();
        }, 1000);

    } catch (e) {
        console.error('Smart Withdraw Error:', e);
        alert('เกิดข้อผิดพลาด: ' + e);
        hideLoading();
    }
}

// ======================= RECALCULATE ALL BALANCES =======================

async function recalculateAllBalances() {
    if (!confirm('ต้องการคำนวณยอดคงเหลือใหม่ทั้งหมด?\n\nใช้เมื่อ:\n- มีการแก้ไขข้อมูลใน Sheet โดยตรง\n- มีการเพิ่มข้อมูลผ่าน AppSheet\n- ยอดคงเหลือไม่ถูกต้อง')) {
        return;
    }

    showLoading();
    showToast('🔄 กำลังคำนวณยอดคงเหลือใหม่...');

    try {
        var config = SHEET_CONFIG.rm;

        var response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'recalculate_rm',
                spreadsheetId: config.id,
                sheetName: 'RM_StockCard'
            })
        });

        showToast('✅ คำนวณเสร็จสิ้น! กำลังรีเฟรชข้อมูล...');

        // Refresh data
        setTimeout(async function () {
            rmStockData = [];
            await fetchRMData();
            hideLoading();
        }, 2000);

    } catch (e) {
        console.error('Recalculate Error:', e);
        alert('เกิดข้อผิดพลาด: ' + e);
        hideLoading();
    }
}
