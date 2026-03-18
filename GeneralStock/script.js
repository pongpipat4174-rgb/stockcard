// ============================================================
// GeneralStock - Frontend Script
// ============================================================
// เชื่อมต่อกับ Node.js API Server แทน Google Apps Script
// ============================================================

// --- CONFIGURATION ---
let API_BASE = ''; // จะถูก set อัตโนมัติจาก /api/config
let APPS_SCRIPT_GENERALSTOCK = '';
let SHEET_GENERALSTOCK_ID = '';

let items = [];
let transactions = [];
let categoryFilter = 'all';
let currentDetailIndex = null;

// DOM Elements
const tableBody = document.getElementById('table-body');
const loader = document.getElementById('app-loader');
const itemForm = document.getElementById('item-form');
const transForm = document.getElementById('trans-form');

// --- Detect API Base URL ---
async function detectApiBase() {
    // ลองดึงจาก server config ก่อน
    try {
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
            const config = await configRes.json();
            API_BASE = config.apiBase || '/api';
            APPS_SCRIPT_GENERALSTOCK = config.appsScriptGeneralStock || '';
            SHEET_GENERALSTOCK_ID = config.sheetGeneralStockId || '';
            console.log('[Config] API Base:', API_BASE);
            return;
        }
    } catch (e) {
        console.warn('[Config] ไม่สามารถดึง config จาก server:', e.message);
    }
    // Fallback: ใช้ relative path (หลีกเลี่ยง Mixed Content)
    API_BASE = '/api';
    console.log('[Config] Fallback API Base:', API_BASE);
}

async function syncGeneralStockToSheet() {
    if (!APPS_SCRIPT_GENERALSTOCK) return;

    const payload = {
        action: 'save_all_general',
        spreadsheetId: SHEET_GENERALSTOCK_ID,
        items: items,
        transactions: transactions
    };

    const response = await fetch(APPS_SCRIPT_GENERALSTOCK, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error('Sheet sync failed: ' + response.status);
    }
}

// --- HELPER: Resize Image to Base64 ---
function resizeImage(file, maxWidth, maxHeight, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Image Input Listener - Camera
document.getElementById('input-image-camera').addEventListener('change', function (e) {
    handleImageUpload(e.target.files[0]);
});

// Image Input Listener - File Picker
document.getElementById('input-image-file').addEventListener('change', function (e) {
    handleImageUpload(e.target.files[0]);
});

function handleImageUpload(file) {
    if (file) {
        resizeImage(file, 300, 300, (base64) => {
            document.getElementById('image-preview').src = base64;
            document.getElementById('image-preview').style.display = 'block';
            document.getElementById('input-image-base64').value = base64;
            document.getElementById('remove-image-btn').style.display = 'block';
        });
    }
}

// Capture Image (Camera)
window.captureImage = function () {
    document.getElementById('input-image-camera').click();
};

// Pick Image (File)
window.pickImage = function () {
    document.getElementById('input-image-file').click();
};

// Remove Image
window.removeImage = function () {
    document.getElementById('image-preview').src = '';
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('input-image-base64').value = '';
    document.getElementById('remove-image-btn').style.display = 'none';
    document.getElementById('input-image-camera').value = '';
    document.getElementById('input-image-file').value = '';
};

// --- INITIALIZATION ---
async function initApp() {
    showLoading();
    await detectApiBase();
    await loadData();
    hideLoading();
    renderTable();
    updateStats();
}
window.initApp = initApp;

function showLoading() { loader.style.display = 'flex'; }
function hideLoading() { loader.style.display = 'none'; }

// --- DATA MANAGEMENT ---
async function loadData() {
    // === 1. ลอง DB API ก่อน (เร็วกว่า) ===
    try {
        const itemsRes = await fetch(`${API_BASE}/items`);
        if (!itemsRes.ok) throw new Error('Items API error: ' + itemsRes.status);
        items = await itemsRes.json();

        const transRes = await fetch(`${API_BASE}/transactions`);
        if (!transRes.ok) throw new Error('Transactions API error: ' + transRes.status);
        transactions = await transRes.json();

        // Ensure numbers
        items.forEach(item => {
            item.stock = parseFloat(item.stock) || 0;
            item.min = parseFloat(item.min) || 0;
        });
        transactions.forEach(t => {
            t.qty = parseFloat(t.qty) || 0;
            t.remaining = parseFloat(t.remaining) || 0;
        });

        // ถ้า DB มีข้อมูล → ใช้เลย
        if (items.length > 0) {
            localStorage.setItem('genItems', JSON.stringify(items));
            localStorage.setItem('genTransactions', JSON.stringify(transactions));
            console.log(`✅ Loaded from DB: ${items.length} items, ${transactions.length} transactions`);
            return;
        }

        console.warn('[GeneralStock] DB returned empty, trying Google Sheets...');
    } catch (e) {
        console.warn('[GeneralStock] DB API failed:', e.message);
    }

    // === 2. Fallback: Google Sheets (ผ่าน Apps Script) ===
    if (APPS_SCRIPT_GENERALSTOCK) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const sheetRes = await fetch(
                `${APPS_SCRIPT_GENERALSTOCK}?action=load_all&sheet=GeneralStock&t=${Date.now()}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);

            if (sheetRes.ok) {
                const data = await sheetRes.json();
                if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                    items = data.items.map(item => ({
                        id: item.id || item.ID || Date.now().toString(),
                        name: item.name || item['ชื่อรายการ'] || '',
                        spec: item.spec || item['สเปก'] || '',
                        category: item.category || item['หมวดหมู่'] || 'Other',
                        unit: item.unit || item['หน่วย'] || 'ชิ้น',
                        stock: parseFloat(item.stock || item['คงเหลือ'] || 0),
                        min: parseFloat(item.min || item['จุดสั่งซื้อ'] || 0),
                        price: item.price || item['ราคา'] || '',
                        leadTime: item.leadTime || item['Lead Time'] || '',
                        supplier: item.supplier || item['ผู้จำหน่าย'] || '',
                        country: item.country || item['ประเทศ'] || '',
                        image: item.image || ''
                    }));

                    if (data.transactions && Array.isArray(data.transactions)) {
                        transactions = data.transactions.map(t => ({
                            id: t.id || t.ID || Date.now().toString(),
                            itemId: t.itemId || t['itemId'] || '',
                            itemName: t.itemName || t['ชื่อรายการ'] || '',
                            type: t.type || t['ประเภท'] || '',
                            qty: parseFloat(t.qty || t['จำนวน'] || 0),
                            remaining: parseFloat(t.remaining || t['คงเหลือ'] || 0),
                            date: t.date || t['วันที่'] || '',
                            time: t.time || t['เวลา'] || '',
                            note: t.note || t['หมายเหตุ'] || ''
                        }));
                    }

                    localStorage.setItem('genItems', JSON.stringify(items));
                    localStorage.setItem('genTransactions', JSON.stringify(transactions));
                    console.log(`✅ Loaded from Google Sheets: ${items.length} items, ${transactions.length} transactions`);
                    return;
                }
            }
            console.warn('[GeneralStock] Google Sheets returned empty or error');
        } catch (sheetErr) {
            console.warn('[GeneralStock] Google Sheets failed:', sheetErr.message);
        }
    }

    // === 3. Fallback สุดท้าย: LocalStorage ===
    items = JSON.parse(localStorage.getItem('genItems')) || [];
    transactions = JSON.parse(localStorage.getItem('genTransactions')) || [];
    console.log(`📦 Loaded from LocalStorage: ${items.length} items, ${transactions.length} transactions`);

    // แสดง error UI ถ้าไม่มีข้อมูลจากทุก source
    if (items.length === 0) {
        const tb = document.getElementById('table-body');
        if (tb) {
            tb.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px 20px;">
                <div style="color:#dc2626;font-size:1.1rem;font-weight:600;margin-bottom:8px;">
                    ไม่สามารถโหลดข้อมูลได้
                </div>
                <div style="color:#64748b;font-size:0.9rem;">
                    ตรวจสอบการเชื่อมต่อ DB หรือ Google Sheets
                </div>
            </td></tr>`;
        }
    }
}

// Visual save status indicator
function showSaveStatus(success) {
    const existing = document.getElementById('save-status-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'save-status-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 10px;
        color: white;
        font-size: 0.9rem;
        font-weight: 600;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        background: ${success ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #dc2626, #ef4444)'};
    `;
    toast.innerHTML = success
        ? '<i class="fa-solid fa-database"></i> บันทึกลง DB สำเร็จ'
        : '<i class="fa-solid fa-triangle-exclamation"></i> บันทึก DB ล้มเหลว (ข้อมูลอยู่ใน Local)';

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, success ? 2000 : 5000);
}

// --- UI RENDERING ---
function renderTable() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();

    tableBody.innerHTML = '';

    const filtered = items.filter(item => {
        const matchSearch = item.name.toLowerCase().includes(searchTerm) || (item.spec && item.spec.toLowerCase().includes(searchTerm));
        const matchCat = categoryFilter === 'all' || item.category === categoryFilter;
        return matchSearch && matchCat;
    });

    filtered.forEach((item, index) => {
        const realIndex = items.indexOf(item);
        const isLow = item.stock <= item.min;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="center" data-label="สถานะ">
                <span class="status-indicator ${isLow ? 'status-low' : 'status-ok'}">
                    ${isLow ? 'ต้องสั่งซื้อ' : 'ปกติ'}
                </span>
            </td>
            <td style="cursor: pointer;" onclick="viewItemDetails(${realIndex})" title="คลิกเพื่อดูรายละเอียด" data-label="รายการ / สเปก">
                <div class="product-info" style="display: flex; flex-direction: row; align-items: center; gap: 10px;">
                    ${item.image ? `<img src="${item.image}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 6px; border: 1px solid #eee;">` : '<div style="width:45px;height:45px;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#cbd5e1;"><i class="fa-solid fa-image"></i></div>'}
                    <div style="flex:1;">
                        <span class="product-name" style="color: var(--primary-color);">${item.name}</span>
                        <div class="product-spec" style="font-size: 0.75rem; color: #64748b;">
                            ${item.spec || '-'}${item.leadTime ? ` | 🚚 ${item.leadTime}` : ''}
                        </div>
                    </div>
                    <div class="stock-inline" style="text-align:right;">
                        <span style="font-size:1.1rem; font-weight:700; color:${isLow ? 'var(--danger)' : 'var(--primary-color)'}">${item.stock}</span>
                        <span style="font-size:0.7rem; color:#64748b; display:block;">${item.unit}</span>
                    </div>
                </div>
            </td>
            <td class="center" data-label="หมวดหมู่"><span class="cat-badge">${item.category === 'Spare Part' ? 'อะไหล่เครื่องจักร' : item.category === 'Cleaning' ? 'อุปกรณ์ทั่วไป' : 'อื่นๆ'}</span></td>
            <td class="center" data-label="คงเหลือ">
                <span class="stock-badge" style="color: ${isLow ? 'var(--danger)' : 'var(--primary-color)'}">
                    ${item.stock}
                </span>
                <span style="font-size: 0.8rem; color: var(--text-muted)"> ${item.unit}</span>
            </td>
            <td class="center" data-label="จุดสั่งซื้อ">${item.min}</td>
            <td class="center no-print" data-label="จัดการ">
                <div style="display: flex; gap: 4px; justify-content: center;">
                    <button class="btn icon in" title="รับเข้า" onclick="openTransModal(${realIndex}, 'IN')"><i class="fa-solid fa-plus"></i></button>
                    <button class="btn icon out" title="เบิกออก" onclick="openTransModal(${realIndex}, 'OUT')"><i class="fa-solid fa-minus"></i></button>
                    <button class="btn icon hist" title="ประวัติ" onclick="openHistoryModal(${realIndex})"><i class="fa-solid fa-clock-rotate-left"></i></button>
                    <button class="btn icon secondary" title="แก้ไข" onclick="editItem(${realIndex})"><i class="fa-solid fa-pen"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function updateStats() {
    document.getElementById('stat-total-items').textContent = items.length;
    const lowCount = items.filter(i => i.stock <= i.min).length;
    document.getElementById('stat-low-stock').textContent = lowCount;
    document.getElementById('stat-healthy-stock').textContent = items.length - lowCount;
}

function setCategoryFilter(cat) {
    categoryFilter = cat;
    const btns = document.querySelectorAll('.filter-btn');
    btns[0].classList.toggle('active', cat === 'all');
    btns[1].classList.toggle('active', cat === 'Spare Part');
    btns[2].classList.toggle('active', cat === 'Cleaning');
    btns[3].classList.toggle('active', cat === 'Other');
    renderTable();
}

// --- MODAL LOGIC ---
window.openModal = (index = null) => {
    const modal = document.getElementById('item-modal');
    itemForm.reset();
    document.getElementById('edit-index').value = index !== null ? index : '';
    document.getElementById('modal-title').textContent = index !== null ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่';

    if (index !== null) {
        const item = items[index];
        document.getElementById('input-name').value = item.name;
        document.getElementById('input-spec').value = item.spec || '';
        document.getElementById('input-category').value = item.category;
        document.getElementById('input-unit').value = item.unit;
        document.getElementById('input-stock').value = item.stock;
        document.getElementById('input-min').value = item.min;
        document.getElementById('input-price').value = item.price || '';
        document.getElementById('input-leadtime').value = item.leadTime || '';
        document.getElementById('input-supplier').value = item.supplier || '';
        document.getElementById('input-country').value = item.country || '';

        if (item.image) {
            document.getElementById('image-preview').src = item.image;
            document.getElementById('image-preview').style.display = 'block';
            document.getElementById('input-image-base64').value = item.image;
            document.getElementById('remove-image-btn').style.display = 'block';
        } else {
            document.getElementById('image-preview').style.display = 'none';
            document.getElementById('image-preview').src = '';
            document.getElementById('input-image-base64').value = '';
            document.getElementById('remove-image-btn').style.display = 'none';
        }
    } else {
        document.getElementById('image-preview').style.display = 'none';
        document.getElementById('image-preview').src = '';
        document.getElementById('input-image-base64').value = '';
        document.getElementById('remove-image-btn').style.display = 'none';
    }

    modal.style.display = 'flex';
};

window.closeModal = (id) => {
    document.getElementById(id).style.display = 'none';
};

itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const index = document.getElementById('edit-index').value;
    const newItem = {
        name: document.getElementById('input-name').value,
        spec: document.getElementById('input-spec').value,
        category: document.getElementById('input-category').value,
        unit: document.getElementById('input-unit').value,
        stock: parseFloat(document.getElementById('input-stock').value),
        min: parseFloat(document.getElementById('input-min').value),
        price: document.getElementById('input-price').value,
        leadTime: document.getElementById('input-leadtime').value,
        supplier: document.getElementById('input-supplier').value,
        country: document.getElementById('input-country').value,
        image: document.getElementById('input-image-base64').value,
        id: index !== '' ? items[index].id : Date.now().toString()
    };

    // DB-first: บันทึก DB ก่อน — ต้องสำเร็จก่อนจึง backup ไป Sheet
    try {
        const res = await fetch(`${API_BASE}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem),
        });
        if (!res.ok) throw new Error('Save failed: ' + res.status);

        // Update local state
        if (index !== '') {
            items[index] = newItem;
        } else {
            items.push(newItem);
        }
        localStorage.setItem('genItems', JSON.stringify(items));

        closeModal('item-modal');

        // DB success → backup to Sheet (fire-and-forget)
        syncGeneralStockToSheet().catch(sheetErr => {
            console.warn('[GeneralStock] Sheet backup failed:', sheetErr);
        });

        renderTable();
        updateStats();
        showSaveStatus(true);
    } catch (err) {
        console.error('[GeneralStock] Save item failed:', err);
        showSaveStatus(false);
    }
});

// --- TRANSACTION LOGIC ---
window.openTransModal = (index, type) => {
    const item = items[index];
    document.getElementById('trans-item-index').value = index;
    document.getElementById('trans-type').value = type;
    document.getElementById('trans-title').textContent = type === 'IN' ? 'รับของเข้า (IN)' : 'เบิกของออก (OUT)';
    document.getElementById('trans-item-name-display').textContent = `${item.name} (${item.spec || '-'})`;
    document.getElementById('trans-label-qty').textContent = `จำนวนที่ต้องการ (${item.unit})`;
    document.getElementById('trans-qty').value = '';

    const now = new Date();
    document.getElementById('trans-date').value = now.toISOString().split('T')[0];

    document.getElementById('trans-modal').style.display = 'flex';
    document.getElementById('trans-qty').focus();
};

transForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('trans-item-index').value);
    const type = document.getElementById('trans-type').value;
    const qty = parseFloat(document.getElementById('trans-qty').value);
    const date = document.getElementById('trans-date').value;
    const note = document.getElementById('trans-note').value;

    const item = items[index];

    if (type === 'OUT' && item.stock < qty) {
        if (!confirm(`ยอดเบิก (${qty}) มากกว่าคงเหลือ (${item.stock}) ยืนยันที่จะติดลบหรือไม่?`)) return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const transData = {
        id: Date.now().toString(),
        itemId: item.id,
        itemName: item.name,
        type: type,
        qty: qty,
        date: date,
        time: timeStr,
        note: note,
    };

    // DB-first: บันทึก DB ก่อน — ต้องสำเร็จก่อนจึง backup ไป Sheet
    try {
        const res = await fetch(`${API_BASE}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transData),
        });

        if (!res.ok) throw new Error('Transaction save failed: ' + res.status);
        const result = await res.json();

        // Update local state
        item.stock = result.remaining !== undefined ? result.remaining : (type === 'IN' ? item.stock + qty : item.stock - qty);
        transData.remaining = item.stock;
        transactions.unshift(transData);
        localStorage.setItem('genItems', JSON.stringify(items));
        localStorage.setItem('genTransactions', JSON.stringify(transactions));

        closeModal('trans-modal');

        // DB success → backup to Sheet (fire-and-forget)
        syncGeneralStockToSheet().catch(sheetErr => {
            console.warn('[GeneralStock] Sheet backup failed:', sheetErr);
        });

        renderTable();
        updateStats();
        showSaveStatus(true);
    } catch (err) {
        console.error('[GeneralStock] Transaction failed:', err);
        showSaveStatus(false);
    }
});

// --- DETAIL VIEW LOGIC ---
window.viewItemDetails = (index) => {
    currentDetailIndex = index;
    const item = items[index];
    const isLow = item.stock <= item.min;

    document.getElementById('detail-name').textContent = item.name;
    document.getElementById('detail-category').textContent = item.category === 'Spare Part' ? 'อะไหล่เครื่องจักร' :
        item.category === 'Cleaning' ? 'อุปกรณ์ทั่วไป' : 'อื่นๆ';

    const statusEl = document.getElementById('detail-status');
    statusEl.textContent = isLow ? 'ต้องสั่งซื้อ' : 'ปกติ';
    statusEl.className = `status-indicator ${isLow ? 'status-low' : 'status-ok'}`;

    document.getElementById('detail-stock').textContent = item.stock;
    document.getElementById('detail-unit').textContent = item.unit;
    document.getElementById('detail-min').textContent = item.min;

    document.getElementById('detail-price').textContent = item.price ? (parseFloat(item.price).toLocaleString() + ' บ.') : '-';
    document.getElementById('detail-leadtime').textContent = item.leadTime || '-';
    document.getElementById('detail-spec').textContent = item.spec || '-';
    document.getElementById('detail-supplier').textContent = item.supplier || '-';
    document.getElementById('detail-country').textContent = item.country || '-';

    const imgEl = document.getElementById('detail-image');
    const placeholderEl = document.getElementById('detail-image-placeholder');

    if (item.image) {
        imgEl.src = item.image;
        imgEl.style.display = 'block';
        placeholderEl.style.display = 'none';
    } else {
        imgEl.style.display = 'none';
        placeholderEl.style.display = 'flex';
    }

    document.getElementById('detail-modal').style.display = 'flex';
};

// --- HISTORY LOGIC ---
let currentHistoryItemIndex = null;

window.openHistoryModal = (index) => {
    currentHistoryItemIndex = index;
    const item = items[index];
    const itemTrans = transactions.filter(t => t.itemId === item.id);
    const hBody = document.getElementById('history-body');
    hBody.innerHTML = '';

    itemTrans.forEach((t, tIndex) => {
        let timeDisplay = '';
        if (t.time && typeof t.time === 'string' && t.time.match(/^\d{1,2}:\d{2}/)) {
            timeDisplay = t.time;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${t.date}${timeDisplay ? ' <span style="color:#64748b;font-size:0.85em">' + timeDisplay + '</span>' : ''}</td>
            <td>
                <span style="color: ${t.type === 'IN' ? '#059669' : '#dc2626'}; font-weight:600">
                    ${t.type === 'IN' ? 'รับเข้า' : 'เบิกออก'}
                </span>
            </td>
            <td class="center">${t.qty}</td>
            <td class="center" style="font-weight:700">${t.remaining}</td>
            <td>${t.note || '-'}</td>
            <td class="center" style="white-space:nowrap">
                <button onclick="editTransaction('${t.id}')" class="action-btn edit" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteTransaction('${t.id}')" class="action-btn delete" title="ลบ"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        hBody.appendChild(row);
    });

    if (itemTrans.length === 0) {
        hBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#94a3b8">ไม่พบประวัติ</td></tr>';
    }

    document.getElementById('history-modal').style.display = 'flex';
};

// --- DELETE TRANSACTION ---
window.deleteTransaction = async (transId) => {
    const transIndex = transactions.findIndex(t => t.id === transId);
    if (transIndex === -1) return;

    const trans = transactions[transIndex];
    if (!confirm(`ยืนยันลบรายการ: ${trans.type === 'IN' ? 'รับเข้า' : 'เบิกออก'} ${trans.qty} ชิ้น วันที่ ${trans.date}?`)) return;

    try {
        const res = await fetch(`${API_BASE}/transactions/${transId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed: ' + res.status);
        const result = await res.json();

        // Update local state
        const itemIndex = items.findIndex(i => i.id === trans.itemId);
        if (itemIndex !== -1 && result.remaining !== undefined) {
            items[itemIndex].stock = result.remaining;
        }
        transactions.splice(transIndex, 1);
        localStorage.setItem('genItems', JSON.stringify(items));
        localStorage.setItem('genTransactions', JSON.stringify(transactions));

        closeModal('history-modal');

        // Sheet sync removed — use Admin Backup button instead

        renderTable();
        updateStats();
        showSaveStatus(true);

        if (currentHistoryItemIndex !== null) {
            openHistoryModal(currentHistoryItemIndex);
        }
    } catch (err) {
        console.error('[GeneralStock] Delete transaction failed:', err);
        showSaveStatus(false);
    }
};

// --- EDIT TRANSACTION ---
window.editTransaction = async (transId) => {
    const trans = transactions.find(t => t.id === transId);
    if (!trans) return;

    const newQty = prompt(`แก้ไขจำนวน (ปัจจุบัน: ${trans.qty}):`, trans.qty);
    if (newQty === null) return;

    const parsedQty = parseFloat(newQty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
        alert('กรุณาใส่จำนวนที่ถูกต้อง');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/transactions/${transId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newQty: parsedQty }),
        });
        if (!res.ok) throw new Error('Edit failed: ' + res.status);
        const result = await res.json();

        // Update local
        const itemIndex = items.findIndex(i => i.id === trans.itemId);
        if (itemIndex !== -1 && result.remaining !== undefined) {
            items[itemIndex].stock = result.remaining;
        }
        trans.qty = parsedQty;
        trans.remaining = items[itemIndex]?.stock || trans.remaining;
        localStorage.setItem('genItems', JSON.stringify(items));
        localStorage.setItem('genTransactions', JSON.stringify(transactions));

        closeModal('history-modal');

        // Sheet sync removed — use Admin Backup button instead

        renderTable();
        updateStats();
        showSaveStatus(true);

        if (currentHistoryItemIndex !== null) {
            openHistoryModal(currentHistoryItemIndex);
        }
    } catch (err) {
        console.error('[GeneralStock] Edit transaction failed:', err);
        showSaveStatus(false);
    }
};

// --- DELETE LOGIC ---
window.deleteItem = async (index) => {
    if (!confirm(`ยืนยันการลบรายการ: ${items[index].name}?`)) return;

    try {
        const res = await fetch(`${API_BASE}/items/${items[index].id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed: ' + res.status);

        items.splice(index, 1);
        localStorage.setItem('genItems', JSON.stringify(items));

        // Sheet sync removed — use Admin Backup button instead

        renderTable();
        updateStats();
        showSaveStatus(true);
    } catch (err) {
        console.error('[GeneralStock] Delete item failed:', err);
        showSaveStatus(false);
    }
};

window.editItem = (index) => openModal(index);

// --- EDIT ITEM FROM DETAIL ---
window.editItemFromDetail = function () {
    if (currentDetailIndex !== null) {
        closeModal('detail-modal');
        openModal(currentDetailIndex);
    }
};

// --- EDIT IMAGE FROM DETAIL ---
window.editImageFromDetail = function () {
    if (currentDetailIndex !== null) {
        closeModal('detail-modal');
        openModal(currentDetailIndex);
        setTimeout(() => {
            document.querySelector('.image-upload-options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
};

// --- PRINT DETAIL ---
window.printDetail = function () {
    const modal = document.getElementById('detail-modal');
    const printContent = modal.querySelector('.modal-body').innerHTML;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>รายละเอียดสินค้า</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Sarabun', sans-serif; padding: 20px; }
                img { max-width: 200px; border-radius: 8px; }
                h3 { color: #1e3a8a; margin-bottom: 10px; }
                .cat-badge, .status-indicator { padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; display: inline-block; margin-right: 8px; }
                .status-ok { background: #ecfdf5; color: #059669; }
                .status-low { background: #fef2f2; color: #dc2626; }
                .modal-actions { display: none; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>${printContent}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
};

// --- ADMIN: BACKUP TO SHEET ---
window.backupToSheet = async function () {
    if (!confirm('ต้องการ Backup ข้อมูลปัจจุบันไป Google Sheet หรือไม่?\n\n(ข้อมูลใน Sheet จะถูกเขียนทับด้วยข้อมูลจาก DB)')) return;

    showLoading();
    showSaveStatus(true); // show "กำลัง backup..."

    try {
        await syncGeneralStockToSheet();
        hideLoading();
        const toast = document.getElementById('save-status-toast');
        if (toast) toast.remove();
        showSaveStatusMsg('✅ Backup สำเร็จ! ข้อมูลใน Sheet อัปเดตแล้ว');
    } catch (e) {
        console.error('[GeneralStock] Backup to Sheet failed:', e);
        hideLoading();
        showSaveStatusMsg('❌ Backup ล้มเหลว: ' + e.message, false);
    }
};

function showSaveStatusMsg(msg, success = true) {
    const existing = document.getElementById('save-status-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'save-status-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 10px;
        color: white;
        font-size: 0.9rem;
        font-weight: 600;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        background: ${success ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #dc2626, #ef4444)'};
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- START APP ---
initApp();
