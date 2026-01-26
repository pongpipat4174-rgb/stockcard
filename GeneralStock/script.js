// --- CONFIGURATION ---
const API_URL = "https://script.google.com/macros/s/AKfycbxJglmGvcDbVBSTcGlCXg0NFDXIJm-RyIXe_-G-70nIlK3rxZVFT_tWAbHYP-mb-zOG3w/exec";
// Note: You might want to use a different 'sheetName' in your Apps Script for this folder.

let items = [];
let transactions = [];
let categoryFilter = 'all';

// DOM Elements
const tableBody = document.getElementById('table-body');
const loader = document.getElementById('app-loader');
const itemForm = document.getElementById('item-form');
const transForm = document.getElementById('trans-form');

// --- INITIALIZATION ---
async function initApp() {
    showLoading();
    await loadData();
    hideLoading();
    renderTable();
    updateStats();
}

function showLoading() { loader.style.display = 'flex'; }
function hideLoading() { loader.style.display = 'none'; }

// --- DATA MANAGEMENT ---
async function loadData() {
    // 1. Try Google Sheets
    try {
        const response = await fetch(`${API_URL}?action=load_all&sheet=GeneralStock`);
        const data = await response.json();
        if (data.items) items = data.items;
        if (data.transactions) transactions = data.transactions;
        console.log("Loaded from Sheets");
    } catch (e) {
        console.warn("API Load failed, using LocalStorage", e);
        items = JSON.parse(localStorage.getItem('genItems')) || [];
        transactions = JSON.parse(localStorage.getItem('genTransactions')) || [];
    }
}

async function saveData() {
    // Save to LocalStorage
    localStorage.setItem('genItems', JSON.stringify(items));
    localStorage.setItem('genTransactions', JSON.stringify(transactions));

    // Save to Google Sheets
    try {
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_all',
                sheet: 'GeneralStock',
                items: items,
                transactions: transactions
            })
        });
        console.log("Saved to Sheets");
    } catch (e) {
        console.error("API Save failed", e);
    }
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
            <td class="center">
                <span class="status-indicator ${isLow ? 'status-low' : 'status-ok'}">
                    ${isLow ? 'ต้องสั่งซื้อ' : 'ปกติ'}
                </span>
            </td>
            <td>
                <div class="product-info">
                    <span class="product-name">${item.name}</span>
                    <span class="product-spec">${item.spec || '-'}</span>
                </div>
            </td>
            <td class="center"><span class="cat-badge">${item.category}</span></td>
            <td class="center">
                <span class="stock-badge" style="color: ${isLow ? 'var(--danger)' : 'var(--primary-color)'}">
                    ${item.stock}
                </span>
                <span style="font-size: 0.8rem; color: var(--text-muted)"> ${item.unit}</span>
            </td>
            <td class="center">${item.min}</td>
            <td class="center no-print">
                <div style="display: flex; gap: 4px; justify-content: center;">
                    <button class="btn icon in" title="รับเข้า" onclick="openTransModal(${realIndex}, 'IN')"><i class="fa-solid fa-plus"></i></button>
                    <button class="btn icon out" title="เบิกออก" onclick="openTransModal(${realIndex}, 'OUT')"><i class="fa-solid fa-minus"></i></button>
                    <button class="btn icon hist" title="ประวัติ" onclick="openHistoryModal(${realIndex})"><i class="fa-solid fa-clock-rotate-left"></i></button>
                    <button class="btn icon secondary" title="แก้ไข" onclick="editItem(${realIndex})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn icon secondary" style="color:red" title="ลบ" onclick="deleteItem(${realIndex})"><i class="fa-solid fa-trash"></i></button>
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
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.includes(cat === 'Spare Part' ? 'อะไหล่' : cat === 'Cleaning' ? 'น้ำยา' : cat === 'Other' ? 'อื่นๆ' : 'ทั้งหมด'));
    });
    // Fix: the toggle logic above is a bit hardcoded, let's simplify
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
        id: index !== '' ? items[index].id : Date.now().toString()
    };

    if (index !== '') {
        items[index] = newItem;
    } else {
        items.push(newItem);
    }

    closeModal('item-modal');
    renderTable();
    updateStats();
    await saveData();
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
    if (type === 'IN') {
        item.stock += qty;
    } else {
        if (item.stock < qty) {
            if (!confirm(`ยอดเบิก (${qty}) มากกว่าคงเหลือ (${item.stock}) ยืนยันที่จะติดลบหรือไม่?`)) return;
        }
        item.stock -= qty;
    }

    const trans = {
        id: Date.now().toString(),
        itemId: item.id,
        itemName: item.name,
        type: type,
        qty: qty,
        date: date,
        note: note,
        remaining: item.stock
    };

    transactions.unshift(trans);

    closeModal('trans-modal');
    renderTable();
    updateStats();
    await saveData();
});

// --- HISTORY LOGIC ---
window.openHistoryModal = (index) => {
    const item = items[index];
    const itemTrans = transactions.filter(t => t.itemId === item.id);
    const hBody = document.getElementById('history-body');
    hBody.innerHTML = '';

    itemTrans.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${t.date}</td>
            <td>
                <span style="color: ${t.type === 'IN' ? '#059669' : '#dc2626'}; font-weight:600">
                    ${t.type === 'IN' ? 'รับเข้า' : 'เบิกออก'}
                </span>
            </td>
            <td class="center">${t.qty}</td>
            <td class="center" style="font-weight:700">${t.remaining}</td>
            <td>${t.note || '-'}</td>
        `;
        hBody.appendChild(row);
    });

    if (itemTrans.length === 0) {
        hBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8">ไม่พบประวัติ</td></tr>';
    }

    document.getElementById('history-modal').style.display = 'flex';
};

// --- DELETE LOGIC ---
window.deleteItem = async (index) => {
    if (confirm(`ยืนยันการลบรายการ: ${items[index].name}?`)) {
        items.splice(index, 1);
        renderTable();
        updateStats();
        await saveData();
    }
};

window.editItem = (index) => openModal(index);

// --- START APP ---
initApp();
