// --- CONFIGURATION ---
// ใส่ลิงค์ Google Apps Script Web App ของคุณในเครื่องหมายคำพูดด้านล่าง
// ตัวอย่าง: const API_URL = "https://script.google.com/macros/s/xxxxxxxxx/exec";
const API_URL = 'https://script.google.com/macros/s/AKfycbxJglmGvcDbVBSTcGlCXg0NFDXIJm-RyIXe_-G-70nIlK3rxZVFT_tWAbHYP-mb-zOG3w/exec';

// --- DEBUG CONSOLE (Visual Analysis) ---
const createDebugPanel = () => {
    const p = document.createElement('div');
    p.id = 'debug-panel';
    p.style.cssText = 'position:fixed;bottom:5px;left:5px;width:200px;max-height:100px;overflow-y:auto;background:rgba(0,0,0,0.7);color:#0f0;font-size:9px;font-family:monospace;z-index:9999;padding:4px;pointer-events:none;border:1px solid #0f0;display:block;';

    // Add Mobile hide style dynamically
    const style = document.createElement('style');
    style.innerHTML = '@media (max-width: 768px) { #debug-panel { display: none !important; } }';
    document.head.appendChild(style);

    document.body.appendChild(p);
    return p;
    return p;
};
const debugLog = (msg, type = 'INFO') => {
    const debuggerEl = document.getElementById('debug-log');
    if (!debuggerEl) return;
    const line = document.createElement('div');
    line.className = `debug-line ${type.toLowerCase()}`;
    line.innerText = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
    debuggerEl.prepend(line);
};

// --- UTILITIES ---
// (formatNumber moved to line 278)

// Trap Errors
window.onerror = function (msg, url, line, col, error) {
    debugLog(`${msg} (Line ${line})`, 'ERROR');
    return false;
};
// Trap Console
const originalLog = console.log;
console.log = function (...args) { originalLog.apply(console, args); debugLog(args.join(' ')); };
const originalError = console.warn;
console.warn = function (...args) { originalError.apply(console, args); debugLog(args.join(' '), 'WARN'); };
const originalErr = console.error;
console.error = function (...args) { originalErr.apply(console, args); debugLog(args.join(' '), 'ERROR'); };

console.log("Script Started...");
const initialData = [
    { name: "PVC Shrink film 125*185 (กล่องของเล็ก)", kgPerCarton: 25, pcsPerKg: 554, stockCartons: 16, stockPartialKg: 0, minThreshold: 100, pcsPerPack: 6, fgPcsPerCarton: 504 },
    { name: "PVC Shrink film 222*200 (กล่องสบู่)", kgPerCarton: 25, pcsPerKg: 277, stockCartons: 24, minThreshold: 100, pcsPerPack: 4, fgPcsPerCarton: 120 },
    { name: "PVC Shrink film 125*220 (กล่องสูงรุ่นใหม่)", kgPerCarton: 25, pcsPerKg: 466, stockCartons: 16, minThreshold: 100, pcsPerPack: 6, fgPcsPerCarton: 504 },
    { name: "PVC Shrink film 163*235 (กล่องลิปซอง+ขวด)", kgPerCarton: 25, pcsPerKg: 335, stockCartons: 14, minThreshold: 100, pcsPerPack: 6, fgPcsPerCarton: 288 },
    { name: "PVC Shrink film 145*220 (กล่องซอง10-15 กรัม)", kgPerCarton: 25, pcsPerKg: 402, stockCartons: 15, minThreshold: 100, pcsPerPack: 6, fgPcsPerCarton: 336 },
    { name: "PVC Shrink film 92*195 (กล่องหลอด)", kgPerCarton: 25, pcsPerKg: 710, stockCartons: 18, minThreshold: 100, pcsPerPack: 1, fgPcsPerCarton: 126 },
    { name: "PVC Shrink film 185*255 (หลอดโลชั่น)", kgPerCarton: 25, pcsPerKg: 0, stockCartons: 21, minThreshold: 100, pcsPerPack: 1, fgPcsPerCarton: 100 },
    { name: "PVC Shrink film 160*265 (Pack 3 Tube Lotion)", kgPerCarton: 25, pcsPerKg: 0, stockCartons: 13, minThreshold: 100, pcsPerPack: 3, fgPcsPerCarton: 100 }
];

// Global State
let items = [];
let transactions = [];
let masterProducts = {}; // Key: Name, Value: Full Item Object

// DOM Elements
const tableBody = document.getElementById('table-body');
const totalItemsEl = document.getElementById('total-items');
const lowStockCountEl = document.getElementById('low-stock-count');
const healthyStockCountEl = document.getElementById('healthy-stock-count');
const modal = document.getElementById('item-modal');
const addItemBtn = document.getElementById('add-item-btn');
const closeBtn = document.querySelector('.close-btn');
const itemForm = document.getElementById('item-form');
const editIndexInput = document.getElementById('edit-index');

// Transaction Elements
// ... (Keeping these as they are usually defined, assuming previous edits left them or I can re-declare for safety if I see them in view. 
// Actually I will just replace up to Helper Functions start to be safe)

// Inputs
const inputName = document.getElementById('input-name');
const inputKgPerCarton = document.getElementById('input-kg-per-carton');
const inputPcsPerKg = document.getElementById('input-pcs-per-kg');
const inputStockCartons = document.getElementById('input-stock-cartons');
const inputStockPartial = document.getElementById('input-stock-partial');
const inputMinThreshold = document.getElementById('input-min-threshold');
const inputPcsPerPack = document.getElementById('input-pcs-per-pack');
const inputFgPcsPerCarton = document.getElementById('input-fg-pcs-per-carton');

// --- MISSING GLOBALS (Added to fix ReferenceErrors) ---
const transForm = document.getElementById('transaction-form');
const transModal = document.getElementById('transaction-modal');
const transDateInput = document.getElementById('trans-date');
const historyModal = document.getElementById('history-modal');
const historyBody = document.getElementById('history-body');
const calcModal = document.getElementById('calc-modal');
const calcSelect = document.getElementById('calc-select-item');
const calcArea = document.getElementById('calc-area');

// --- EVENT LISTENERS (Attached via DOMContentLoaded to ensure safety) ---
// --- EVENT LISTENERS ---
// Attached via DOMContentLoaded for safety
document.addEventListener('DOMContentLoaded', () => {
    // Re-bind elements to be sure
    const addItemBtn = document.getElementById('add-item-btn');
    const calcBtn = document.getElementById('calc-btn');
    const itemForm = document.getElementById('item-form');
    // Global ref inputs are okay to use if script loaded last, but local finding is safer
    const inputName = document.getElementById('input-name');
    const inputKgPerCarton = document.getElementById('input-kg-per-carton');
    const inputPcsPerKg = document.getElementById('input-pcs-per-kg');
    const inputStockCartons = document.getElementById('input-stock-cartons');
    const inputStockPartial = document.getElementById('input-stock-partial');
    const inputMinThreshold = document.getElementById('input-min-threshold');
    const inputPcsPerPack = document.getElementById('input-pcs-per-pack');
    const inputFgPcsPerCarton = document.getElementById('input-fg-pcs-per-carton');
    const editIndexInput = document.getElementById('edit-index');
    // New Globals (Locally scoped to init)
    const inputCategory = document.getElementById('input-category');
    const inputPcsPerRoll = document.getElementById('input-pcs-per-roll');
    // Calculator Field Refs
    const inputRollLength = document.getElementById('input-roll-length');
    const inputCutLength = document.getElementById('input-cut-length');

    const fieldShrink = document.getElementById('field-shrink');
    const fieldRoll = document.getElementById('field-roll');

    // ATTACH LISTENER if exists
    if (inputCategory) {
        inputCategory.addEventListener('change', window.toggleItemFormFields);
    }

    // Calculator Logic
    window.calculateRollCapacity = () => {
        const item = (editIndexInput && editIndexInput.value >= 0) ? items[editIndexInput.value] : {};
        const category = inputCategory ? inputCategory.value : 'weight';

        // Safe check for elements inside function as they might be dynamic or missed
        const rLenInput = document.getElementById('input-roll-length');
        const cLenInput = document.getElementById('input-cut-length');
        const pcsInput = document.getElementById('input-pcs-per-roll');
        const yieldInput = document.getElementById('input-fg-yield-per-roll');
        const resEl = document.getElementById('roll-calc-result');

        // Note: We don't need to populate inputs FROM item here anymore, openModal handles that.
        // This function should just compute based on Current Input Values. Is that correct?
        // Prior logic had auto-population inside it for some reason? 
        // Let's stick to calculation based on inputs.

        // Wait, if called from openModal, inputs might be empty if not populated yet.
        // openModal populates then calls this. So inputs have values.
        // BUT openModal logic passed "item" object into here implicitly? NO.
        // The previous code had `if (category === 'unit') { document.getElementById... = item.rollLength }`
        // That was weird side-effect. I removed it in Step 581 but maybe it was needed?
        // NO, openModal does population now.


        const fgPcsInput = document.getElementById('input-fg-pcs-per-carton');

        if (!rLenInput || !cLenInput) return;

        const lengthM = parseFloat(rLenInput.value) || 0;
        const cutMm = parseFloat(cLenInput.value) || 0;

        if (lengthM > 0 && cutMm > 0) {
            // Formula: (Length_m * 1000) / Cut_mm
            const pcs = Math.floor((lengthM * 1000) / cutMm);

            if (pcsInput) pcsInput.value = pcs;

            if (resEl) {
                resEl.innerHTML = `<span style="color:#2563eb">${lengthM.toLocaleString()} ม.</span> / <span style="color:#2563eb">${cutMm} มม.</span> = <span style="font-size:1.2em; color:#16a34a">${pcs.toLocaleString()}</span> ชิ้น/ม้วน`;
            }

            // --- Auto Calculate FG Yield per Roll ---
            if (fgPcsInput && yieldInput) {
                const fgPcs = parseFloat(fgPcsInput.value) || 0;
                if (fgPcs > 0) {
                    const yieldVal = pcs / fgPcs;
                    // Only update if user hasn't manually overridden it? 
                    // For now, let's auto-update always when params change, assuming calculation is truth.
                    yieldInput.value = yieldVal.toFixed(2);
                } else {
                    yieldInput.value = '';
                }
            }

        } else {
            if (pcsInput) pcsInput.value = 0;
            if (resEl) resEl.innerText = "- ชิ้น/ม้วน";
            if (yieldInput) yieldInput.value = '';
        }
    };

    // Toggle Form Function
    window.toggleItemFormFields = () => {
        if (!inputCategory) return;
        const cat = inputCategory.value;

        // Selectors
        const lblStock = document.querySelector('label[for="input-stock-cartons"]');
        const lblThreshold = document.querySelector('label[for="input-min-threshold"]');
        const rollYieldField = document.getElementById('field-roll-yield');

        // Partial Group - Select Parent Form Group
        const partialInput = document.getElementById('input-stock-partial');
        const partialGrp = partialInput ? partialInput.closest('.form-group') : null;

        // Pcs Per Pack Group - Yellow Box to Hide for Unit
        const pcsPerPackInput = document.getElementById('input-pcs-per-pack');
        const pcsPerPackGrp = pcsPerPackInput ? pcsPerPackInput.closest('.form-group') : null;

        if (cat === 'unit') {
            if (fieldShrink) fieldShrink.style.display = 'none';
            if (fieldRoll) fieldRoll.style.display = 'block';

            // Labels
            if (lblStock) lblStock.innerText = 'คงเหลือปัจจุบัน (ม้วน)';
            if (lblThreshold) lblThreshold.innerText = 'แจ้งเตือนเมื่อต่ำกว่า (ม้วน)';

            // Hide Partial
            if (partialGrp) partialGrp.style.display = 'none';
            // Show Roll Yield
            if (rollYieldField) rollYieldField.style.display = 'flex';
            // Hide Pcs Per Pack
            if (pcsPerPackGrp) pcsPerPackGrp.style.display = 'none';

        } else {
            if (fieldShrink) fieldShrink.style.display = 'block';
            if (fieldRoll) fieldRoll.style.display = 'none';

            // Labels
            if (lblStock) lblStock.innerText = 'คงเหลือปัจจุบัน (ลัง)';
            if (lblThreshold) lblThreshold.innerText = 'แจ้งเตือนเมื่อต่ำกว่า (กก.)';

            // Show Partial
            if (partialGrp) partialGrp.style.display = 'block';
            // Hide Roll Yield
            if (rollYieldField) rollYieldField.style.display = 'none';
            // Show Pcs Per Pack
            if (pcsPerPackGrp) pcsPerPackGrp.style.display = 'block';
        }
    };

    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            console.log("Add Item Clicked");
            if (window.openModal) window.openModal(false);
            else console.error("openModal not found");
        });
    }

    if (calcBtn) {
        calcBtn.addEventListener('click', () => {
            console.log("Calc Clicked");
            if (window.openCalcModal) window.openCalcModal();
        });
    }

    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const index = parseInt(editIndexInput.value);
            const category = inputCategory ? inputCategory.value : 'weight';

            // Basic Validation
            if (category === 'weight' && (!inputKgPerCarton.value || !inputPcsPerKg.value)) {
                alert("กรุณากรอกข้อมูลน้ำหนักและจำนวนซอง"); return;
            }
            if (category === 'unit') {
                // Check logic for roll inputs
                const rLen = parseFloat(inputRollLength.value) || 0;
                const cLen = parseFloat(inputCutLength.value) || 0;
                if (rLen <= 0 || cLen <= 0) {
                    alert("กรุณาระบุความยาวม้วนและความยาวตัดให้ถูกต้อง"); return;
                }
            }

            const item = {
                name: inputName.value,
                category: category,
                // Weight Logic
                kgPerCarton: category === 'weight' ? (parseFloat(inputKgPerCarton.value) || 0) : 0,
                pcsPerKg: category === 'weight' ? (parseFloat(inputPcsPerKg.value) || 0) : 0,
                // Unit Logic
                pcsPerRoll: category === 'unit' ? (parseInt(inputPcsPerRoll.value) || 0) : 0,
                rollLength: category === 'unit' ? (parseFloat(inputRollLength.value) || 0) : 0,
                cutLength: category === 'unit' ? (parseFloat(inputCutLength.value) || 0) : 0,
                fgYieldPerRoll: category === 'unit' ? (parseFloat(document.getElementById('input-fg-yield-per-roll').value) || 0) : 0,

                // Common Stock (Cartons = Rolls for unit)
                stockCartons: parseFloat(inputStockCartons.value) || 0,
                stockPartialKg: category === 'weight' ? (parseFloat(inputStockPartial.value) || 0) : 0,

                minThreshold: parseFloat(inputMinThreshold.value) || 0,
                pcsPerPack: parseFloat(inputPcsPerPack.value) || 1,
                fgPcsPerCarton: parseFloat(inputFgPcsPerCarton.value) || 0,
                stockCode: document.getElementById('input-stock-code') ? document.getElementById('input-stock-code').value.trim() : '',

                updated: new Date().toISOString(),
                history: index >= 0 ? items[index].history : []
            };

            // Link Stock Logic: If this item has a stockCode, we must sync its stock from existing peers OR update peers.
            if (item.stockCode) {
                const peers = items.filter(i => i.stockCode === item.stockCode && i.category === item.category);
                if (index === -1 && peers.length > 0) {
                    // Adding new: Inherit stock from existing peer
                    const master = peers[0];
                    item.stockCartons = master.stockCartons;
                    item.stockPartialKg = master.stockPartialKg;
                }
            }

            // Save History
            try {
                if (window.saveMasterProduct) window.saveMasterProduct(item);
            } catch (e) { }

            if (index === -1) {
                items.push(item);
            } else {
                items[index] = item;
            }

            // Post-Save Sync: Update ALL items with same stockCode to match this one
            if (item.stockCode) {
                items.forEach(i => {
                    if (i.stockCode === item.stockCode && i.category === item.category) {
                        i.stockCartons = item.stockCartons;
                        i.stockPartialKg = item.stockPartialKg;
                    }
                });
            }

            // Optimistic Update
            if (typeof renderTable === 'function') renderTable();
            if (typeof updateStats === 'function') updateStats();

            if (window.closeModal) window.closeModal('item-modal');

            if (window.saveData) await window.saveData();
        });
    }

    // Windows OnClick
    window.onclick = (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    };
});

// Helper Functions
const formatNumber = (num, decimals = 0) => {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(num);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Fix Google Sheets Date format (sometimes comes as ISO string, sometimes specific format)
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if parse fails
    return date.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' });
};

// --- MASTER PRODUCT LOGIC (Auto-Fill) ---
window.loadMasterProducts = () => {
    try {
        const stored = localStorage.getItem('shrinkMasterProducts');
        if (stored) {
            masterProducts = JSON.parse(stored) || {};
        }
    } catch (e) {
        console.error("Master Load Error", e);
        masterProducts = {};
    }
};

window.saveMasterProduct = (item) => {
    if (!item.name) return;
    masterProducts[item.name.trim()] = {
        kgPerCarton: item.kgPerCarton,
        pcsPerKg: item.pcsPerKg,
        minThreshold: item.minThreshold,
        pcsPerPack: item.pcsPerPack,
        fgPcsPerCarton: item.fgPcsPerCarton
    };
    try {
        localStorage.setItem('shrinkMasterProducts', JSON.stringify(masterProducts));
        if (window.renderMasterProductOptions) window.renderMasterProductOptions();
    } catch (e) { console.error("Save Master Failed", e); }
};

window.syncMasterProductsFromCurrentObj = () => {
    if (!items) return;
    items.forEach(item => {
        if (window.saveMasterProduct) window.saveMasterProduct(item);
    });
};

window.renderMasterProductOptions = () => {
    const dataList = document.getElementById('product-history-list');
    if (!dataList) return;
    dataList.innerHTML = '';
    const sortedNames = Object.keys(masterProducts).sort();
    sortedNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        dataList.appendChild(option);
    });
};

window.checkProductHistory = (name) => {
    if (!name) return;
    const trimmedName = name.trim();
    const historyItem = masterProducts[trimmedName];

    // Get Elements Locally 
    const inputKgPerCarton = document.getElementById('input-kg-per-carton');
    const inputPcsPerKg = document.getElementById('input-pcs-per-kg');
    const inputMinThreshold = document.getElementById('input-min-threshold');
    const inputPcsPerPack = document.getElementById('input-pcs-per-pack');
    const inputFgPcsPerCarton = document.getElementById('input-fg-pcs-per-carton');

    if (historyItem) {
        if (confirm(`พบข้อมูลคำนวณของ "${trimmedName}" ในประวัติ \nต้องการนำเข้าข้อมูลคำนวณ (กก./ลัง, ชิ้น/กก., ฯลฯ) หรือไม่?`)) {
            if (inputKgPerCarton) inputKgPerCarton.value = historyItem.kgPerCarton;
            if (inputPcsPerKg) inputPcsPerKg.value = historyItem.pcsPerKg;
            if (inputMinThreshold) inputMinThreshold.value = historyItem.minThreshold;
            if (inputPcsPerPack) inputPcsPerPack.value = historyItem.pcsPerPack || 1;
            if (inputFgPcsPerCarton) inputFgPcsPerCarton.value = historyItem.fgPcsPerCarton || 1;

            // Highlight
            [inputKgPerCarton, inputPcsPerKg, inputPcsPerPack, inputFgPcsPerCarton].forEach(el => {
                if (el) {
                    el.style.backgroundColor = "#dcfce7";
                    setTimeout(() => el.style.backgroundColor = "", 1000);
                }
            });
        }
    }
};

// --- DATA MANAGEMENT (Hybrid: Google Sheets + LocalStorage) ---

const showLoading = (msg) => {
    console.log("Loading:", msg);
    const loader = document.getElementById('app-loader');
    if (loader) {
        loader.style.display = 'flex';
        const text = loader.querySelector('.loader-text');
        if (text) text.textContent = msg;
    }
};

const hideLoading = () => {
    console.log("Loading Finished");
    const loader = document.getElementById('app-loader');
    if (loader) {
        loader.style.display = 'none';
    }
};

const initApp = async () => {
    showLoading('กำลังเชื่อมต่อฐานข้อมูล...');

    // Load History
    try { if (window.loadMasterProducts) window.loadMasterProducts(); } catch (e) { }

    // Safety Timeout (Manual backup)
    const safetyTimer = setTimeout(() => {
        console.warn("Init timeout - Safety Timer");
        hideLoading();
    }, 10000);

    try {
        // Load Main Data
        try {
            await loadData();
        } catch (e) {
            console.error("LoadData fatal error:", e);
        }

        // FINAL FAILSAFE: Ensure we never show empty dashboard
        if (!items || !Array.isArray(items) || items.length === 0) {
            console.warn("No data loaded. Using Initial Data.");
            items = JSON.parse(JSON.stringify(initialData));
        }

        // Sync & Render History
        try {
            if (window.syncMasterProductsFromCurrentObj) window.syncMasterProductsFromCurrentObj();
            if (window.renderMasterProductOptions) window.renderMasterProductOptions();
        } catch (e) { }

        renderTable();
        updateStats();

    } catch (e) {
        console.error("Critical Init Error:", e);
    } finally {
        clearTimeout(safetyTimer);
        hideLoading();
    }
};

// Ensure init runs when DOM is ready
// Ensure init runs when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
    });
} else {
    initApp();
}

const loadData = async () => {
    // FORCE REFRESH: Clear stale local data to fix display issues
    try {
        console.log("Force Clearing Local Data...");
        localStorage.removeItem('shrinkItems');
    } catch (e) { }

    // 1. Try Online First
    if (API_URL) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10s

            // Add t parameter for cache busting and sheet parameter for data separation
            const response = await fetch(`${API_URL}?action=load_all&sheet=Consumable&t=${Date.now()}`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error("Network response was not ok: " + response.statusText);

            const data = await response.json();

            if (data.error) {
                alert("Google Script Error: " + data.error);
                throw new Error(data.error);
            }

            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                // Map Thai headers if present
                let loadedItems = data.items;

                // CHECK: If backend already sent correct keys (name, category, stock...), USE THEM DIRECTLY!
                // Don't try to re-map unless it's raw data (which it isn't anymore).
                if (loadedItems[0].name !== undefined && loadedItems[0].stock !== undefined) {
                    console.log("Backend sent mapped data. Using directly.");
                    items = loadedItems;
                } else if (loadedItems[0]["ชื่อสินค้า"] || loadedItems[0]["name"]) {
                    // Check if it's the raw format or mapped format
                    const row = loadedItems[0];
                    if (row["ชื่อสินค้า"]) {
                        console.log("Mapping Thai Headers...");
                        loadedItems = loadedItems.map(row => ({
                            name: row["ชื่อสินค้า"],
                            category: row["ประเภท"] || 'weight',
                            stockCartons: parseFloat(row["สต็อก (ลัง)"] || row["สต๊อก (ลัง)"] || row["คงเหลือปัจจุบัน (ลัง)"] || 0),
                            stockPartialKg: parseFloat(row["เศษ(กก.)"] || row["เศษ (กก.)"] || 0),
                            kgPerCarton: parseFloat(row["กก./ลัง"] || row["น้ำหนักต่อลัง (kg)"] || 25),
                            pcsPerKg: parseFloat(row["ชิ้น/กก.1"] || row["ชิ้น/กก."] || row["จำนวนซองต่อ กก."] || 0),
                            minThreshold: parseFloat(row["จุดสั่งซื้อ (กก.)"] || row["แจ้งเตือนเมื่อต่ำกว่า (กก.)"] || 0),
                            pcsPerPack: parseFloat(row["ชิ้นงาน/ถุง"] || row["จำนวนชิ้นงาน ต่อ 1 ถุงชริ้ง"] || 1),
                            fgPcsPerCarton: parseFloat(row["ชิ้น FG/ลัง"] || row["จำนวนชิ้น FG ต่อลัง"] || 1),
                            rollLength: parseFloat(row["ความยาวม้วน (ม.)"] || 0),
                            cutLength: parseFloat(row["ความยาวตัด (มม.)"] || 0),
                            pcsPerRoll: parseFloat(row["ชิ้น/ม้วน"] || 0),
                            fgYieldPerRoll: parseFloat(row["Yield/ม้วน"] || 0),
                            stockCode: row["StockCode"] || row["รหัสสต็อก"] || ""
                        }));
                    }
                }

                // FINAL SAFETY MAP: Ensure all numbers are actually numbers
                items = loadedItems.map(item => ({
                    name: item.name,
                    category: item.category || 'weight',
                    stockCartons: Number(item.stock || item.stockCartons || 0),
                    stockPartialKg: Number(item.stockPartial || item.stockPartialKg || 0),
                    kgPerCarton: Number(item.kgPerCarton || 25),
                    pcsPerKg: Number(item.pcsPerKg || 0),
                    minThreshold: Number(item.min || item.minThreshold || 0),
                    // Fix: Do not force default 1 if value is 0 or valid number. Only if undefined/null.
                    pcsPerPack: (item.pcsPerPack !== undefined && item.pcsPerPack !== null) ? Number(item.pcsPerPack) : 1,
                    fgPcsPerCarton: Number(item.fgPerCarton || item.fgPcsPerCarton || 1),
                    rollLength: Number(item.rollLength || 0),
                    cutLength: Number(item.cutLength || 0),
                    pcsPerRoll: Number(item.pcsPerRoll || 0),
                    fgYieldPerRoll: Number(item.fgYieldPerRoll || 0),
                    stockCode: item.stockCode || ""
                }));


                // items = loadedItems; // (Already assigned above)

                if (data.transactions && Array.isArray(data.transactions)) {
                    let loadedTrans = data.transactions;
                    if (loadedTrans.length > 0 && (loadedTrans[0]["ชื่อสินค้า"] || loadedTrans[0]["วันที่"])) {
                        loadedTrans = loadedTrans.map(row => ({
                            id: row["ID"],
                            date: row["วันที่"],
                            type: row["ประเภท"],
                            itemIndex: row["ItemIndex"],
                            itemName: row["ชื่อสินค้า"],
                            qtyKg: row["จำนวน (กก.)"],
                            qtyCartons: row["จำนวน (ลัง)"],
                            remainingStock: row["คงเหลือ (ลัง)"],
                            note: row["หมายเหตุ"]
                        }));
                    }
                    transactions = loadedTrans.reverse();
                }

                console.log(`Loaded ${items.length} items from Cloud.`);
                return; // Success!
            } else {
                alert("Connected to Sheet but found 0 items! Check Sheet Name in Script.");
            }

            console.log("Cloud returned 0 items. Falling back to Local...");

        } catch (e) {
            console.warn("Online load failed:", e);
            alert("Connection Failed: " + e.message + "\n\nChecking: " + API_URL);
        }
    }

    // 2. Offline Mode (Fallback)
    try {
        const localItems = JSON.parse(localStorage.getItem('shrinkItems'));
        if (Array.isArray(localItems) && localItems.length > 0) {
            console.log(`Loaded ${localItems.length} items from LocalStorage.`);
            items = localItems;
        } else {
            console.log("Local empty. Using Initial.");
            items = JSON.parse(JSON.stringify(initialData));
        }

        transactions = JSON.parse(localStorage.getItem('shrinkTransactions')) || [];
    } catch (e) {
        console.error("Local load error:", e);
        items = JSON.parse(JSON.stringify(initialData));
        transactions = [];
    }
};

window.saveData = async () => {
    showLoading('กำลังบันทึกข้อมูล...');

    // 1. Always save to LocalStorage as backup
    localStorage.setItem('shrinkItems', JSON.stringify(items));
    localStorage.setItem('shrinkTransactions', JSON.stringify(transactions));

    // 2. If Online, Sync to Cloud
    if (API_URL) {
        try {
            // SAFETY FILTER
            const validItems = items.filter(item => item.name && item.name.trim() !== "");
            if (validItems.length < items.length) {
                console.error("Stopping save: Missing item names detected.");
                alert("เกิดข้อผิดพลาด: ข้อมูลไม่สมบูรณ์ (ชื่อหาย) กรุณารีเฟรช");
                return;
            }

            // Map to Thai Headers matching Web Page EXACTLY
            const sheetItems = validItems.map(item => {
                const isRoll = item.category === 'unit';
                const stockPartial = isRoll ? 0 : (item.stockPartialKg || 0);

                let totalKg = 0;
                let totalPcs = 0;

                // Common fields
                const pcsPerPack = item.pcsPerPack || 1;
                const fgPcsPerCarton = item.fgPcsPerCarton || 1;

                if (isRoll) {
                    // Roll Logic
                    totalPcs = item.stockCartons * (item.pcsPerRoll || 0);
                    // totalKg is not relevant for rolls, leave as 0 or calculate if needed? 
                    // Let's keep 0 to avoid confusion in KG columns.
                } else {
                    // Weight Logic
                    totalKg = (item.stockCartons * item.kgPerCarton) + stockPartial;
                    totalPcs = totalKg * item.pcsPerKg * pcsPerPack;
                }

                const fgYield = (fgPcsPerCarton > 0) ? (totalPcs / fgPcsPerCarton) : 0;
                const isLow = isRoll ? (item.stockCartons < (item.minThreshold / 20)) : (totalKg < item.minThreshold);
                // Note: minThreshold for Rolls? Usually threshold is in Kg. 
                // If user didn't change threshold logic, we use existing check. 
                // But in RenderTable line 609: `const isLowStock = totalKg < item.minThreshold;` 
                // For rolls totalKg is 0, so it will ALWAYS be low stock?
                // Wait, renderTable logic in Step 361:
                // `totalKg = 0` for rolls. 
                // `const isLowStock = totalKg < item.minThreshold;` -> 0 < 100 -> True.
                // BAD. Accessing isLowStock for Rolls needs fixing too.

                // Let's fix isLow for Rolls in saveData first. 
                // Maybe assume threshold is in 'Units' for rolls? Or just ignore for now?
                // Let's rely on totalPcs or Cartons?
                // To be safe and consistent with previous code which might be buggy for Rolls:
                // Let's just use totalKg < minThreshold for Weight.
                // For Rolls, let's use stockCartons < minThreshold (if threshold means cartons?). 
                // User input minThreshold says "(Kg)". 
                // Let's leave isLow logic simple for now or strictly defined:
                const isLowSaving = isRoll ? (item.stockCartons < item.minThreshold) : (totalKg < item.minThreshold);

                return {
                    "ชื่อสินค้า": item.name,
                    "ประเภท": item.category || 'weight',
                    "สต็อก (ลัง)": item.stockCartons,
                    "เศษ(กก.)": stockPartial,
                    "กก./ลัง": item.kgPerCarton,
                    "รวม (กก.)": parseFloat(totalKg.toFixed(2)),
                    "จุดสั่งซื้อ (กก.)": item.minThreshold,
                    "ชิ้น/กก.": item.pcsPerKg,
                    "รวมถุง (ชิ้น)": parseFloat(totalPcs.toFixed(0)),
                    "ชิ้นงาน/ถุง": pcsPerPack,
                    "ชิ้น FG/ลัง": fgPcsPerCarton,
                    "ผลิตได้ (ชิ้น)": parseFloat(totalPcs.toFixed(0)),
                    "ผลิตได้ (ลัง)": parseFloat(fgYield.toFixed(1)),
                    "สถานะ": isLowSaving ? "ต้องสั่งซื้อ" : "ปกติ",
                    "ความยาวม้วน (ม.)": item.rollLength || 0,
                    "ความยาวตัด (มม.)": item.cutLength || 0,
                    "ชิ้น/ม้วน": item.pcsPerRoll || 0,
                    "Yield/ม้วน": item.fgYieldPerRoll || 0,
                    "StockCode": item.stockCode || ""
                };
            });

            const sheetTransactions = transactions.map(t => ({
                "ID": t.id,
                "วันที่": t.date,
                "ประเภท": t.type,
                "ItemIndex": t.itemIndex,
                "ชื่อสินค้า": t.itemName,
                "จำนวน (กก.)": t.qtyKg,
                "จำนวน (ลัง)": t.qtyCartons,
                "คงเหลือ (ลัง)": t.remainingStock,
                "หมายเหตุ": t.note
            }));

            const payload = {
                action: 'save_all',
                sheet: 'Consumable',
                items: sheetItems,
                transactions: sheetTransactions
            };

            await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { "Content-Type": "text/plain" }
            });
            console.log("Saved to Google Sheets (Full Columns)");
        } catch (e) {
            console.error("Cloud save failed", e);
            alert("บันทึกออนไลน์ล้มเหลว ข้อมูลถูกบันทึกลงเครื่องแล้ว");
        }
    }

    renderTable();
    updateStats();
    hideLoading();
};

// 3. Render Table
window.renderTable = () => {
    const tableBody = document.getElementById('table-body'); // Re-get to be safe inside global
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (!items || items.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="12" class="center" style="padding: 2rem;">ไม่พบข้อมูลสินค้า</td></tr>';
        return;
    }

    // Search Logic
    const searchInput = document.getElementById('main-search-input');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    items.forEach((item, index) => {
        // Filter
        if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) {
            return; // Skip if not match
        }

        const isRoll = item.category === 'unit';
        const stockPartial = isRoll ? 0 : (item.stockPartialKg || 0); // Partial not used for rolls

        let totalKg = 0;
        let totalPcs = 0;
        let displayPackSize = 0;
        let displayPcsPerUnit = 0;

        if (isRoll) {
            // Roll Logic
            // StockCartons = Rolls
            // Total Pcs = Rolls * Pcs/Roll
            displayPackSize = item.rollLength; // Show Length
            displayPcsPerUnit = item.pcsPerRoll; // Show Pcs/Roll

            totalPcs = item.stockCartons * item.pcsPerRoll;
            // Total Kg N/A? Or maybe calculated if we knew weight/m. For now 0.
        } else {
            // Weight Logic
            displayPackSize = item.kgPerCarton;
            displayPcsPerUnit = item.pcsPerKg;

            totalKg = (item.stockCartons * item.kgPerCarton) + stockPartial;
            totalPcs = totalKg * item.pcsPerKg * (item.pcsPerPack || 1);
        }

        // FG Yield = Total Pieces / FG Pcs Per Carton
        // If fgPcsPerCarton is 0 or undefined, avoid division by zero
        let fgYield = 0;
        if (isRoll && item.fgYieldPerRoll) {
            // Use specific yield per roll if available
            fgYield = item.stockCartons * item.fgYieldPerRoll;
        } else {
            // Fallback or Weight Logic
            fgYield = (item.fgPcsPerCarton && item.fgPcsPerCarton > 0) ? (totalPcs / item.fgPcsPerCarton) : 0;
        }

        const isLowStock = isRoll ? (item.stockCartons < item.minThreshold) : (totalKg < item.minThreshold);

        const row = document.createElement('tr');
        if (isLowStock) row.classList.add('low-stock');

        row.innerHTML = `
            <td class="center">
                <span class="status-badge ${isLowStock ? 'status-low' : 'status-ok'}">
                    ${isLowStock ? 'ต้องสั่งซื้อ' : 'ปกติ'}
                </span>
            </td>
            <td style="text-align: left; font-weight: 500;">
                <div class="product-name-container">
                     ${item.name}
                     ${isLowStock ? '<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;" title="Low Stock"></i>' : ''}
                </div>
            </td>
            <td class="center mobile-hidden text-blue">
                ${(item.category === 'unit' && item.cutLength) ? formatNumber(item.cutLength, 0) : '-'}
            </td>
            <td class="center bg-shrink">${formatNumber(item.stockCartons, 1)}</td>
            <td class="center text-blue">${isRoll ? '-' : formatNumber(item.stockPartialKg || 0, 2)}</td>
            <td class="center dim bg-shrink mobile-hidden">
                ${isRoll ? formatNumber(item.rollLength, 1) + ' ม.' : item.kgPerCarton}
            </td>
            <td class="center bg-shrink">
                ${isRoll ? '-' : formatNumber(totalKg, 2)}
            </td>
             <!-- Min Threshold Red Color -->
            <td class="center dim bg-shrink mobile-hidden" style="color: #dc2626; font-weight:600;">${item.minThreshold}</td>
            <td class="center dim bg-shrink">
                ${isRoll ? formatNumber(item.pcsPerRoll) : formatNumber(item.pcsPerKg)}
            </td>
            <!-- Hidden Total Pcs -->
            <td class="center dim bg-fg mobile-hidden">${item.pcsPerPack || 1}</td>
            <td class="center dim bg-fg mobile-hidden">${item.fgPcsPerCarton || 1}</td>
            
            <!-- FG Yield (Pieces) -->
             <td class="center bg-fg" style="color: #16a34a;">${formatNumber(totalPcs)}</td>
            
            <!-- FG Yield (Cartons) -->
            <td class="center bg-fg" style="color: #16a34a; font-weight: 700;">${formatNumber(fgYield, 1)}</td>

            <td class="center">
                <!-- Desktop Actions -->
                <div class="action-buttons desktop-only">
                    <button class="btn icon-only secondary" onclick="openTransactionModal(${index})" title="ทำรายการ เบิก/จ่าย">
                        <i class="fa-solid fa-right-left"></i>
                    </button>
                    <button class="btn icon-only secondary" onclick="openHistoryModal(${index})" title="ประวัติ">
                         <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>
                    <button class="btn icon-only primary" onclick="editItem(${index})" title="แก้ไข">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn icon-only delete" onclick="deleteItem(${index})" title="ลบ">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <!-- Mobile Actions Trigger -->
                <button class="btn icon-only secondary mobile-only" onclick="openActionSheet(${index})" style="background: transparent; border: 1px solid #ccc;">
                     <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    });
};

window.updateStats = () => {
    if (!items) return;
    totalItemsEl.textContent = items.length;

    // Count Low Stock
    const lowStockCount = items.filter(item => {
        const isRoll = item.category === 'unit';
        if (isRoll) {
            return item.stockCartons < item.minThreshold;
        } else {
            const totalKg = (item.stockCartons * item.kgPerCarton) + (item.stockPartialKg || 0);
            return totalKg < item.minThreshold;
        }
    }).length;

    lowStockCountEl.textContent = lowStockCount;
    healthyStockCountEl.textContent = items.length - lowStockCount;
};

window.calculateTransRollYield = () => {
    const index = document.getElementById('trans-item-index').value;
    if (index === '') return;
    const item = items[index];
    const isRoll = item.category === 'unit';
    const calcRow = document.getElementById('trans-roll-calc-row');
    const resultSpan = document.getElementById('trans-roll-yield-result');

    if (!isRoll || !calcRow || !resultSpan) {
        if (calcRow) calcRow.style.display = 'none';
        return;
    }

    const qtyText = document.getElementById('trans-qty-cartons').value;
    const qty = parseFloat(qtyText) || 0;
    const yieldPerRoll = item.fgYieldPerRoll || 0;
    const totalYield = qty * yieldPerRoll;

    if (qty > 0 && yieldPerRoll > 0) {
        calcRow.style.display = 'block';
        resultSpan.textContent = formatNumber(totalYield, 1);
    } else {
        calcRow.style.display = 'none';
    }
};

// Transaction Logic
window.openTransactionModal = (index) => {
    const item = items[index];
    document.getElementById('trans-modal-title').textContent = `${item.name} `;
    document.getElementById('trans-item-index').value = index;
    transForm.reset();

    // Default date to today
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    transDateInput.value = `${year}-${month}-${day}`;

    // Reset Inputs
    document.getElementById('trans-qty-cartons').value = '';
    document.getElementById('trans-qty-partial').value = '';

    // Reset Radio
    document.querySelector('input[name="trans-type"][value="IN"]').checked = true;

    // --- CATEGORY UI SWITCH ---
    const isRoll = item.category === 'unit';
    const labelMain = document.querySelector('label[for="trans-qty-cartons"]');
    const labelPartial = document.querySelector('label[for="trans-qty-partial"]');
    const inputPartial = document.getElementById('trans-qty-partial');

    if (isRoll) {
        if (labelMain) labelMain.textContent = "จำนวน (ม้วน)";
        if (labelPartial) labelPartial.parentElement.style.display = 'none'; // Hide Partial
        if (inputPartial) inputPartial.removeAttribute('required');
        // Show Roll Calc Row if possible
        window.calculateTransRollYield();
    } else {
        if (labelMain) labelMain.textContent = "จำนวนเต็ม (ลัง)";
        if (labelPartial) {
            labelPartial.textContent = "เศษ (กิโลกรัม)";
            labelPartial.parentElement.style.display = 'block';
        }
        const calcRow = document.getElementById('trans-roll-calc-row');
        if (calcRow) calcRow.style.display = 'none';
    }

    transModal.style.display = 'flex';
};

transForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('trans-item-index').value);
    const item = items[index];

    const type = document.querySelector('input[name="trans-type"]:checked').value;
    const inputCartons = parseFloat(document.getElementById('trans-qty-cartons').value) || 0;
    const inputPartial = parseFloat(document.getElementById('trans-qty-partial').value) || 0;
    const date = document.getElementById('trans-date').value;
    const note = document.getElementById('trans-note').value;

    // Category check
    const isRoll = item.category === 'unit';

    if (isRoll) {
        if (inputCartons === 0) {
            alert("กรุณาระบุจำนวนม้วน"); return;
        }
    } else {
        if (inputCartons === 0 && inputPartial === 0) {
            alert("กรุณาระบุจำนวน (ลัง หรือ กก.)"); return;
        }
    }

    // Direct Update Logic
    let newStockCartons = parseFloat(item.stockCartons || 0);
    let newStockPartial = parseFloat(item.stockPartialKg || 0);

    if (type === 'IN') {
        newStockCartons += inputCartons;
        if (!isRoll) newStockPartial += inputPartial;
    } else {
        newStockCartons -= inputCartons;
        if (!isRoll) newStockPartial -= inputPartial;
    }

    item.stockCartons = newStockCartons;
    item.stockPartialKg = newStockPartial;

    // --- AUTO-BREAK LOGIC (ตัดลังอัตโนมัติ) Only for Weight ---
    if (!isRoll) {
        while (item.stockPartialKg < 0 && item.stockCartons > 0 && item.kgPerCarton > 0) {
            item.stockCartons -= 1;
            item.stockPartialKg += item.kgPerCarton;
        }
    }

    // --- LINKED STOCK SYNC ---
    // If this item has a stockCode, update all other items with the same code
    if (item.stockCode) {
        items.forEach(i => {
            if (i.stockCode === item.stockCode && i.category === item.category) {
                i.stockCartons = item.stockCartons;
                i.stockPartialKg = item.stockPartialKg;
            }
        });
    }
    // -----------------------------------------

    // Calculate approx total unit for history
    const totalMove = isRoll ? inputCartons : ((inputCartons * (item.kgPerCarton || 25)) + inputPartial);

    const newTrans = {
        id: Date.now().toString(),
        itemIndex: index,
        itemName: item.name,
        date: date,
        type: type,
        category: item.category || 'weight',
        qtyKg: isRoll ? 0 : totalMove, // Keep legacy field for weight
        qtyUnit: isRoll ? totalMove : 0, // New field for units
        qtyCartons: inputCartons,
        qtyPartial: isRoll ? 0 : inputPartial,
        fgYield: isRoll ? (inputCartons * (item.fgYieldPerRoll || 0)) : 0,
        remainingStock: item.stockCartons,
        stockPartialKg: item.stockPartialKg,
        note: note
    };

    transactions.unshift(newTrans);

    await saveData(); // Save all
    closeModal('transaction-modal');
});

// --- History Modal with Delete ---
// --- History Modal with Stock Card Style & Print ---
window.openHistoryModal = (index) => {
    const item = items[index];
    const isRoll = item.category === 'unit';
    const itemTotalKg = (item.stockCartons * item.kgPerCarton) + (item.stockPartialKg || 0);
    const logs = transactions.filter(t => t.itemName === item.name || t.itemIndex === index);

    // Header Info
    document.getElementById('history-subtitle').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>
                <div style="font-size:1.2rem; font-weight:700; color:var(--primary-color);">${item.name}</div>
                <div style="color:var(--text-muted); font-size:0.9rem;">
                    สต็อกปัจจุบัน: <b>${formatNumber(item.stockCartons, 1)} ${isRoll ? 'ม้วน' : 'ลัง'}</b> 
                    ${isRoll ? '' : `(${formatNumber(itemTotalKg, 2)} กก.)`}
                </div>
            </div>
            <button class="btn secondary" onclick="printHistory('${item.name}')">
                <i class="fa-solid fa-print"></i> พิมพ์ / PDF
            </button>
        </div>
    `;

    // Dynamic Column Headers
    const modalTable = document.getElementById('history-body').closest('table');
    const ths = modalTable.querySelectorAll('thead th');
    if (ths.length >= 5) {
        if (isRoll) {
            ths[2].textContent = "ปริมาณ (ม้วน)";
            ths[3].textContent = "ผลผลิต (ลัง FG)";
            ths[4].textContent = "คงเหลือ (ม้วน)";
        } else {
            ths[2].textContent = "ปริมาณ (กก.)";
            ths[3].textContent = "เทียบเท่า (ลัง)";
            ths[4].textContent = "คงเหลือ (ลัง)";
        }
    }

    historyBody.innerHTML = '';

    if (logs.length === 0) {
        historyBody.innerHTML = `<tr><td colspan="${isRoll ? 6 : 7}" class="center" style="padding: 20px; color: #9ca3af;">ไม่พบประวัติการทำรายการ</td></tr>`;
    } else {
        logs.forEach(log => {
            const isIn = log.type === 'IN';
            const row = document.createElement('tr');

            const displayQty = isRoll ? log.qtyUnit : log.qtyKg;
            const displayUnit = isRoll ? 'ม้วน' : 'กก.';

            // FG Yield logic for display
            let fgYieldDisplay = '-';
            if (isRoll) {
                const yieldVal = log.fgYield || (log.qtyCartons * (item.fgYieldPerRoll || 0));
                fgYieldDisplay = formatNumber(yieldVal, 1) + ' ลัง';
            } else {
                fgYieldDisplay = formatNumber(log.qtyCartons, 1) + ' ลัง';
            }

            row.innerHTML = `
                <td style="font-family:monospace; font-size:0.95rem;">${formatDate(log.date)}</td>
                <td>
                    <span style="font-weight:600; color:${isIn ? '#166534' : '#991b1b'}; display:flex; align-items:center; gap:6px;">
                        ${isIn ? '<i class="fa-solid fa-arrow-down"></i> รับเข้า' : '<i class="fa-solid fa-arrow-up"></i> เบิกออก'}
                    </span>
                </td>
                <td class="center" style="font-weight:600; color: ${isIn ? '#16a34a' : '#ef4444'};">
                    ${isIn ? '+' : '-'}${formatNumber(displayQty, isRoll ? 0 : 2)} ${displayUnit}
                </td>
                <td class="center text-blue">${fgYieldDisplay}</td>
                <td class="center" style="font-weight:700;">${formatNumber(log.remainingStock, isRoll ? 1 : 1)}</td>
                <td style="font-size:0.9rem;">${log.note || '-'}</td>
                <td class="center no-print">
                    <button class="btn icon-only delete" onclick="deleteTransaction('${log.id}', ${index})" title="ลบ" style="padding:4px;width:28px;height:28px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            historyBody.appendChild(row);
        });
    }

    // --- Calculate Summary Stats for Card ---
    let totalIn = 0;
    let totalOut = 0;

    logs.forEach(t => {
        const val = isRoll ? (t.qtyUnit || t.qtyCartons) : (t.qtyKg || (t.qtyCartons * item.kgPerCarton));
        if (t.type === 'IN') {
            totalIn += val;
        } else if (t.type === 'OUT') {
            totalOut += val;
        }
    });

    // Update Summary DOM
    const summUnit = isRoll ? ' ม้วน' : ' กก.';
    document.getElementById('hist-total-in').innerText = `+${totalIn.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: isRoll ? 0 : 2 })}${summUnit}`;
    document.getElementById('hist-total-out').innerText = `-${totalOut.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: isRoll ? 0 : 2 })}${summUnit}`;

    // Current Stock
    const currentStockDisp = isRoll ? item.stockCartons : ((item.stockCartons * item.kgPerCarton) + (item.stockPartialKg || 0));
    document.getElementById('hist-current-stock').innerText = currentStockDisp.toLocaleString('en-US', { minimumFractionDigits: isRoll ? 0 : 2, maximumFractionDigits: isRoll ? 0 : 2 }) + summUnit;

    // Update Print Header
    document.getElementById('print-product-name').innerText = item.name;
    const today = new Date();
    document.getElementById('print-print-date').innerText = `วันที่พิมพ์: ${today.toLocaleDateString('th-TH')} ${today.toLocaleTimeString('th-TH')}`;

    historyModal.style.display = 'flex';
};

// --- History Print Function ---
window.printHistoryFromModal = () => {
    // Add specific class to body to trigger CSS overrides
    document.body.classList.add('printing-history-mode');
    setTimeout(() => {
        window.print();
        // Remove class after print dialog is mostly likely open/closed (delayed)
        // Note: window.print() is blocking in many browsers, so next line runs after dialog closes.
        document.body.classList.remove('printing-history-mode');
    }, 100);
};

window.printHistory = (title) => {
    // Basic print trigger - CSS will handle hiding other elements
    // We add a class to body to scope print styles if needed, or just rely on @media print
    window.print();
};

window.deleteTransaction = async (transId, itemIndex) => {
    if (!confirm('ต้องการลบรายการประวัตินี้ใช่หรือไม่? (สต็อกจะถูกคำนวณย้อนกลับ)')) return;

    // 1. Find transaction
    const transIdx = transactions.findIndex(t => t.id === transId);
    if (transIdx === -1) return;
    const trans = transactions[transIdx];

    // 2. Revert Stock
    const item = items[itemIndex];
    // If it was IN, we added stock -> so now we deduct it
    // If it was OUT, we deducted stock -> so now we add it back
    // Check for new fields (movedCartons/movedPartial) or fallback to legacy logic
    const tCartons = trans.movedCartons !== undefined ? trans.movedCartons : trans.qtyCartons;
    const tPartial = trans.movedPartial !== undefined ? trans.movedPartial : 0;

    // Legacy fallback: if old record, tCartons was 'qtyCartons' which was float total.
    // If we want perfection on legacy delete, we just stick to total cartons revert if new fields absent.

    if (trans.movedCartons !== undefined) {
        // New Logic Revert
        if (trans.type === 'IN') {
            item.stockCartons -= tCartons;
            item.stockPartialKg = (item.stockPartialKg || 0) - tPartial;
        } else {
            item.stockCartons += tCartons;
            item.stockPartialKg = (item.stockPartialKg || 0) + tPartial;
        }
    } else {
        // Old Logic Revert
        if (trans.type === 'IN') {
            item.stockCartons -= trans.qtyCartons;
        } else {
            item.stockCartons += trans.qtyCartons;
        }
    }

    // 3. Linked Stock Sync (If item has stockCode, update peers)
    if (item.stockCode) {
        items.forEach(i => {
            if (i.stockCode === item.stockCode && i.category === item.category) {
                i.stockCartons = item.stockCartons;
                i.stockPartialKg = item.stockPartialKg;
            }
        });
    }

    // 4. Remove transaction and Save
    transactions.splice(transIdx, 1);

    // Re-render modal list immediately (visual only)
    openHistoryModal(itemIndex);

    await saveData();
};

// Modal Operations
window.openModal = (isEdit = false, index = null) => {
    // Re-select elements locally to ensure access (Fix scope issues)
    const modal = document.getElementById('item-modal');
    const modalTitle = document.getElementById('modal-title');
    const itemForm = document.getElementById('item-form');
    const inputName = document.getElementById('input-name');
    const inputCategory = document.getElementById('input-category');

    // Inputs (Redeclare to be safe)
    const inputKgPerCarton = document.getElementById('input-kg-per-carton');
    const inputPcsPerKg = document.getElementById('input-pcs-per-kg');
    const inputStockCartons = document.getElementById('input-stock-cartons');
    const inputStockPartial = document.getElementById('input-stock-partial');
    const inputMinThreshold = document.getElementById('input-min-threshold');
    const inputPcsPerPack = document.getElementById('input-pcs-per-pack');
    const inputFgPcsPerCarton = document.getElementById('input-fg-pcs-per-carton');
    const editIndexInput = document.getElementById('edit-index');

    if (!modal) return;
    modal.style.display = 'flex';

    const baseFields = [inputKgPerCarton, inputPcsPerKg, inputPcsPerPack, inputFgPcsPerCarton];

    if (isEdit && index !== null) {
        const item = items[index];
        modalTitle.textContent = 'แก้ไขข้อมูลสินค้า';
        inputName.value = item.name;

        // Set Category and Trigger UI update
        if (inputCategory) {
            inputCategory.value = item.category || 'weight';
            // Trigger Change Manually to ensure UI toggle runs
            if (window.toggleItemFormFields) window.toggleItemFormFields();
        }

        inputKgPerCarton.value = item.kgPerCarton;
        inputPcsPerKg.value = item.pcsPerKg;
        inputStockCartons.value = item.stockCartons;
        inputStockPartial.value = item.stockPartialKg || 0;
        inputMinThreshold.value = item.minThreshold;
        inputPcsPerPack.value = item.pcsPerPack || 1;
        inputFgPcsPerCarton.value = item.fgPcsPerCarton || 1;
        editIndexInput.value = index;

        // Populate Stock Code
        const stockCodeInput = document.getElementById('input-stock-code');
        if (stockCodeInput) stockCodeInput.value = item.stockCode || '';

        // Populate Roll Fields if they exist
        if (item.category === 'unit') {
            document.getElementById('input-roll-length').value = item.rollLength || '';
            document.getElementById('input-cut-length').value = item.cutLength || '';
            document.getElementById('input-pcs-per-roll').value = item.pcsPerRoll || '';
            document.getElementById('input-fg-yield-per-roll').value = item.fgYieldPerRoll || '';

            // Trigger Calc
            if (window.calculateRollCapacity) window.calculateRollCapacity();

        } else {
            // Reset roll fields
            document.getElementById('input-roll-length').value = '';
            document.getElementById('input-cut-length').value = '';
            document.getElementById('input-fg-yield-per-roll').value = '';
        }

        // Disable logic removed to allow editing spec
        /*
        baseFields.forEach(field => {
            if (field) {
                field.disabled = true;
                field.style.backgroundColor = '#f3f4f6';
                field.style.color = '#6b7280';
                field.style.cursor = 'not-allowed';
            }
        });
        */

    } else {
        modalTitle.textContent = 'เพิ่มสินค้าใหม่';
        if (itemForm) itemForm.reset();
        // Reset to defaults
        inputKgPerCarton.value = 25;
        inputMinThreshold.value = 100;
        inputStockPartial.value = 0;
        inputPcsPerPack.value = 1;
        inputFgPcsPerCarton.value = 1;
        editIndexInput.value = '-1';

        // Reset Stock Code
        const stockCodeInput = document.getElementById('input-stock-code');
        if (stockCodeInput) stockCodeInput.value = '';

        // Reset Category
        if (inputCategory) {
            inputCategory.value = 'weight';
            if (window.toggleItemFormFields) window.toggleItemFormFields();
        }

        baseFields.forEach(field => {
            if (field) {
                field.disabled = false;
                field.style.backgroundColor = '#fff';
                field.style.color = '#000';
                field.style.cursor = 'text';
            }
        });
    }
};

window.closeModal = (modalId) => {
    const m = document.getElementById(modalId);
    if (m) m.style.display = 'none';
};

window.editItem = (index) => {
    openModal(true, index);
};

window.deleteItem = async (index) => {
    const itemToDelete = items[index];
    if (confirm(`ต้องการลบสินค้า "${itemToDelete.name}" และประวัติทั้งหมดของสินค้านี้ใช่หรือไม่ ? `)) {

        // 1. Filter out transactions for this item (by index)
        // AND Shift indices for subsequent items
        // Since we are removing item at 'index', any transaction with itemIndex > index must be decremented

        const newTransactions = [];

        transactions.forEach(t => {
            // Keep transactions for items BEFORE the deleted one
            if (t.itemIndex < index) {
                newTransactions.push(t);
            }
            // Skip transactions for the deleted item (t.itemIndex === index)

            // Shift transactions for items AFTER the deleted one
            else if (t.itemIndex > index) {
                t.itemIndex = t.itemIndex - 1;
                newTransactions.push(t);
            }
        });

        transactions = newTransactions;

        // 2. Remove the Item
        items.splice(index, 1);

        // 3. Save
        await saveData();
    }
};

// Calculator Modal Logic

window.openCalcModal = () => {
    calcModal.style.display = 'flex';
    calcSelect.innerHTML = '<option value="">-- กรุณาเลือกสินค้า --</option>';
    items.forEach((item, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = item.name;
        calcSelect.appendChild(option);
    });
    calcArea.style.display = 'none';
    clearCalcInputs();
};

if (calcSelect) {
    calcSelect.addEventListener('change', () => {
        const index = calcSelect.value;
        if (index === '') {
            calcArea.style.display = 'none';
        } else {
            calcArea.style.display = 'block';
            clearCalcInputs();
        }
    });
}

const clearCalcInputs = () => {
    document.getElementById('modal-calc-shrink').value = '';
    document.getElementById('modal-calc-kg').value = '';
    document.getElementById('modal-calc-pcs').value = '';
    document.getElementById('modal-calc-fg').value = '';
};

window.calculateModalSimulation = (type, value) => {
    const index = calcSelect.value;
    if (index === '') return;

    const item = items[index];
    const shrinkInput = document.getElementById('modal-calc-shrink');
    const kgInput = document.getElementById('modal-calc-kg');
    const pcsInput = document.getElementById('modal-calc-pcs');
    const fgInput = document.getElementById('modal-calc-fg');

    if (!value || value <= 0) {
        clearCalcInputs();
        return;
    }

    const val = parseFloat(value);

    // Logic การคำนวณเหมือนเดิม
    const kgPerCarton = item.kgPerCarton;
    const pcsPerKg = item.pcsPerKg;
    const pcsPerPack = item.pcsPerPack || 1;
    const fgPcsPerCarton = item.fgPcsPerCarton || 1;

    let resShrink = 0;
    let resKg = 0;
    let resPcs = 0;
    let resFg = 0;

    if (type === 'shrink') {
        resShrink = val;
        resKg = resShrink * kgPerCarton;
        resPcs = resKg * pcsPerKg * pcsPerPack;
        resFg = resPcs / fgPcsPerCarton;
    } else if (type === 'kg') {
        resKg = val;
        resShrink = resKg / kgPerCarton;
        resPcs = resKg * pcsPerKg * pcsPerPack;
        resFg = resPcs / fgPcsPerCarton;
    } else if (type === 'pcs') {
        resPcs = val;
        const totalPcsPerKg = pcsPerKg * pcsPerPack;
        resKg = resPcs / totalPcsPerKg;
        resShrink = resKg / kgPerCarton;
        resFg = resPcs / fgPcsPerCarton;
    } else if (type === 'fg') {
        resFg = val;
        resPcs = resFg * fgPcsPerCarton;
        const totalPcsPerKg = pcsPerKg * pcsPerPack;
        resKg = resPcs / totalPcsPerKg;
        resShrink = resKg / kgPerCarton;
    }

    if (type !== 'shrink') shrinkInput.value = resShrink.toFixed(2);
    if (type !== 'kg') kgInput.value = resKg.toFixed(2);
    if (type !== 'pcs') pcsInput.value = Math.round(resPcs);
    if (type !== 'fg') fgInput.value = resFg.toFixed(1);
};

// Listeners moved to top

// App initialized via DOMContentLoaded above

// --- TAB SWITCHING ---
window.switchTab = (tabId) => {
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // Show target content
    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) targetContent.classList.add('active');

    // Activate button
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabId}'`)) {
            btn.classList.add('active');
        }
    });

    console.log(`Switched to tab: ${tabId}`);
};

// Mobile Action Sheet Logic
function openActionSheet(index) {
    const item = items[index];
    const modal = document.getElementById('action-sheet-modal');
    if (!item || !modal) return;

    document.getElementById('action-sheet-title').innerText = item.name.substring(0, 30) + (item.name.length > 30 ? '...' : '');

    // Bind buttons
    document.getElementById('sheet-btn-trans').onclick = function () {
        closeModal('action-sheet-modal');
        openTransactionModal(index);
    };
    document.getElementById('sheet-btn-hist').onclick = function () {
        closeModal('action-sheet-modal');
        openHistoryModal(index);
    };
    document.getElementById('sheet-btn-edit').onclick = function () {
        closeModal('action-sheet-modal');
        editItem(index);
    };
    document.getElementById('sheet-btn-del').onclick = function () {
        closeModal('action-sheet-modal');
        deleteItem(index);
    };

    modal.style.display = 'flex';
}
