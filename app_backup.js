/* Stock Card Web App - V.10 (Working Edition) */

// Configuration
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzdF61u0WhgQ6Uxmb_fCmfK8Ww1wlTMFBC79a13AFAhN2TCjBHKDL4VmVL49C4W5bKdVw/exec';

// Data containers
let stockData = [];
let productMasterData = [];
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
    setTimeout(() => toast.style.display = 'none', 3000);
}

// Initialize
async function init() {
    console.log('Initializing...');
    showLoading();
    await fetchDataFromSheets();
    hideLoading();
}

// Fetch Data from Google Sheets
async function fetchDataFromSheets() {
    try {
        const timestamp = new Date().getTime();
        const sheetName = encodeURIComponent('บันทึก StockCard');
        const url = `https://docs.google.com/spreadsheets/d/1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU/gviz/tq?tqx=out:json&sheet=${sheetName}&tq=SELECT%20*&_=${timestamp}`;

        const response = await fetch(url);
        const text = await response.text();
        const jsonText = text.substring(47).slice(0, -2);
        const json = JSON.parse(jsonText);
        const rows = json.table.rows;

        stockData = rows.map((row, index) => {
            const c = row.c;
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
        }).filter(item => item.productCode && item.productCode !== 'code');

        const uniqueProducts = new Map();
        stockData.forEach(item => {
            if (item.productCode && !uniqueProducts.has(item.productCode)) {
                uniqueProducts.set(item.productCode, { code: item.productCode, name: item.productName });
            }
        });
        productMasterData = Array.from(uniqueProducts.values());

        populateProductDropdown();
        updateStats();
        showAllProducts();

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Update Stats
function updateStats() {
    document.getElementById('totalProducts').textContent = productMasterData.length;
    document.getElementById('totalTransactions').textContent = stockData.length;
    const totalIn = stockData.reduce((sum, d) => sum + d.inQty, 0);
    const totalOut = stockData.reduce((sum, d) => sum + d.outQty, 0);
    document.getElementById('totalIn').textContent = formatNumber(totalIn);
    document.getElementById('totalOut').textContent = formatNumber(totalOut);
}

// Show All Products
function showAllProducts() {
    searchedProducts = productMasterData.map(prod => {
        const entries = stockData.filter(d => d.productCode === prod.code);
        const totalIn = entries.reduce((sum, d) => sum + d.inQty, 0);
        const totalOut = entries.reduce((sum, d) => sum + d.outQty, 0);
        const lastEntry = entries[entries.length - 1];
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

// Handle Search
function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!query) {
        showAllProducts();
        return;
    }
    const filtered = productMasterData.filter(p =>
        p.code.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
    );
    searchedProducts = filtered.map(prod => {
        const entries = stockData.filter(d => d.productCode === prod.code);
        const totalIn = entries.reduce((sum, d) => sum + d.inQty, 0);
        const totalOut = entries.reduce((sum, d) => sum + d.outQty, 0);
        const lastEntry = entries[entries.length - 1];
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

// Render Stock Cards
function renderStockCards(products) {
    const container = document.getElementById('cardsContainer');
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = '<div class="no-results"><p>ไม่พบข้อมูล</p></div>';
        return;
    }

    container.innerHTML = products.map((prod, idx) => `
        <div class="stock-card" id="card-${idx}">
            <div class="stock-card-header">
                <div class="stock-card-title">
                    <h3>${prod.name}</h3>
                    <span class="product-code">${prod.code}</span>
                </div>
                <button class="btn print-btn" onclick="printSingleCard('card-${idx}', '${prod.name}', '${prod.code}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <polyline points="6 9 6 2 18 2 18 9"></polyline>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                        <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    พิมพ์
                </button>
            </div>
            <div class="stock-card-summary">
                <div class="summary-item">
                    <span class="summary-label">รับเข้าทั้งหมด</span>
                    <span class="summary-value positive">+${formatNumber(prod.totalIn)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">เบิกออกทั้งหมด</span>
                    <span class="summary-value negative">-${formatNumber(prod.totalOut)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">คงเหลือปัจจุบัน</span>
                    <span class="summary-value">${formatNumber(prod.balance)}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">LOT ล่าสุด</span>
                    <span class="summary-value">${prod.lotNo || '-'}</span>
                </div>
            </div>
            <div class="stock-table-container">
                <table class="stock-table">
                    <thead>
                        <tr>
                            <th>วันที่</th>
                            <th>ประเภท</th>
                            <th>รับเข้า</th>
                            <th>เบิกออก</th>
                            <th>คงเหลือ</th>
                            <th>Lot No.</th>
                            <th>คงเหลือ Lot</th>
                            <th>อ้างอิง</th>
                            <th>หมายเหตุ</th>
                            <th class="no-print">ลบ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${prod.entries.map(entry => {
        // คำนวณคงเหลือเฉพาะ Lot
        const lotEntries = prod.entries.filter(e => e.lotNo === entry.lotNo);
        const lotIdx = lotEntries.findIndex(e => e.rowIndex === entry.rowIndex);
        let lotBalance = 0;
        for (let i = 0; i <= lotIdx; i++) {
            lotBalance += lotEntries[i].inQty - lotEntries[i].outQty;
        }
        return `
                            <tr>
                                <td>${entry.date}</td>
                                <td><span class="type-cell ${entry.type === 'รับเข้า' ? 'type-in' : 'type-out'}">${entry.type}</span></td>
                                <td class="qty-in">${entry.inQty > 0 ? '+' + formatNumber(entry.inQty) : '-'}</td>
                                <td class="qty-out">${entry.outQty > 0 ? '-' + formatNumber(entry.outQty) : '-'}</td>
                                <td>${formatNumber(entry.balance)}</td>
                                <td>${entry.lotNo || '-'}</td>
                                <td>${entry.lotNo ? formatNumber(lotBalance) : '-'}</td>
                                <td>${entry.docRef || '-'}</td>
                                <td>${entry.remark || '-'}</td>
                                <td class="no-print">
                                    <button class="btn btn-delete" onclick="deleteEntry(${entry.rowIndex}, '${prod.code}', '${entry.type}')">ลบ</button>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');
}

// Format Number
function formatNumber(num) {
    return new Intl.NumberFormat('th-TH').format(num || 0);
}

// Format Date to DD/M/YYYY (Thai format)
function formatDateThai(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-'); // YYYY-MM-DD
    if (parts.length !== 3) return dateStr;
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[0];
    return `${day}/${month}/${year}`;
}

// Populate Product Dropdown
function populateProductDropdown() {
    const select = document.getElementById('entryProductCode');
    if (!select) return;
    select.innerHTML = '<option value="">-- เลือกสินค้า --</option>';
    productMasterData.forEach(p => {
        select.innerHTML += `<option value="${p.code}">${p.code} - ${p.name}</option>`;
    });
}

// Print Single Card
function printSingleCard(cardId, productName, productCode) {
    const card = document.getElementById(cardId);
    if (!card) return;

    const printHeader = document.createElement('div');
    printHeader.className = 'print-header';
    printHeader.innerHTML = `
        <img src="logo.png" alt="Logo" style="height:50px;">
        <div>
            <h2 style="margin:0;">${productName}</h2>
            <p style="margin:0;color:#666;">${productCode} | วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH')}</p>
        </div>
    `;

    document.querySelectorAll('.stock-card').forEach(c => {
        if (c.id !== cardId) c.style.display = 'none';
    });

    card.insertBefore(printHeader, card.firstChild);
    window.print();

    printHeader.remove();
    document.querySelectorAll('.stock-card').forEach(c => c.style.display = '');
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
    }).then(() => {
        setTimeout(async () => {
            showToast('ลบเรียบร้อย!');
            await fetchDataFromSheets();
            hideLoading();
        }, 2000);
    }).catch(e => { alert(e); hideLoading(); });
}

// ========== MODAL FUNCTIONS ==========
function openEntryModal() {
    const modal = document.getElementById('entryModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';

        // ตั้งวันที่เป็นวันปัจจุบัน
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('entryDate').value = `${yyyy}-${mm}-${dd}`;
    }
}

function closeEntryModal() {
    const modal = document.getElementById('entryModal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
    }
}

// Save Entry
function saveEntry() {
    const productCode = document.getElementById('entryProductCode').value;
    const date = document.getElementById('entryDate').value;
    const type = document.getElementById('entryType').value;
    const inQty = parseFloat(document.getElementById('entryInQty').value) || 0;
    const outQty = parseFloat(document.getElementById('entryOutQty').value) || 0;
    const lotNo = document.getElementById('entryLotNo').value || '-';
    const docRef = document.getElementById('entryDocRef').value || '-';
    const remark = document.getElementById('entryRemark').value || '-';
    const pkId = document.getElementById('entryPkId')?.value || '-';

    if (!productCode || !date) {
        alert('กรุณากรอกรหัสสินค้าและวันที่');
        return;
    }

    // Get product name
    const prod = productMasterData.find(p => p.code === productCode);
    const productName = prod ? prod.name : productCode;

    // Calculate balance from last entry
    const lastEntry = stockData.filter(d => d.productCode === productCode).pop();
    const lastBalance = lastEntry ? lastEntry.balance : 0;
    const balance = lastBalance + inQty - outQty;

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
    }).then(() => {
        setTimeout(async () => {
            showToast('บันทึกเรียบร้อย!');
            closeEntryModal();
            document.getElementById('entryDate').value = '';
            document.getElementById('entryInQty').value = '';
            document.getElementById('entryOutQty').value = '';
            document.getElementById('entryLotNo').value = '';
            document.getElementById('entryDocRef').value = '';
            document.getElementById('entryRemark').value = '';
            await fetchDataFromSheets();
            hideLoading();
        }, 2000);
    }).catch(e => { alert(e); hideLoading(); });
}

// Stats Detail Modal
function showStatDetail(type) {
    alert('ดูรายละเอียด: ' + type);
}

function closeStatsModal() {
    const modal = document.getElementById('statsModal');
    if (modal) modal.style.display = 'none';
}

// ========== EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', () => {
    init();

    document.getElementById('searchInput')?.addEventListener('input', handleSearch);
    document.getElementById('addEntryBtn')?.addEventListener('click', openEntryModal);
    document.getElementById('saveEntry')?.addEventListener('click', saveEntry);
    document.getElementById('refreshBtn')?.addEventListener('click', init);
    document.getElementById('entryModalClose')?.addEventListener('click', closeEntryModal);
    document.getElementById('entryModalBackdrop')?.addEventListener('click', closeEntryModal);
    document.getElementById('cancelEntry')?.addEventListener('click', closeEntryModal);

    document.getElementById('entryProductCode')?.addEventListener('change', function () {
        const prod = productMasterData.find(p => p.code === this.value);
        if (prod) {
            const nameInput = document.getElementById('entryProductName');
            if (nameInput) nameInput.value = prod.name;
        }
    });
});
