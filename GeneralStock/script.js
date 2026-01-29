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
            callback(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality
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
            <td class="center" data-label="สถานะ">
                <span class="status-indicator ${isLow ? 'status-low' : 'status-ok'}">
                    ${isLow ? 'ต้องสั่งซื้อ' : 'ปกติ'}
                </span>
            </td>
            <td style="cursor: pointer;" onclick="viewItemDetails(${realIndex})" title="คลิกเพื่อดูรายละเอียด" data-label="รายการ / สเปก">
                <div class="product-info" style="display: flex; flex-direction: row; align-items: center; gap: 12px;">
                    ${item.image ? `<img src="${item.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #eee;">` : '<div style="width:50px;height:50px;background:#f1f5f9;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#cbd5e1;"><i class="fa-solid fa-image"></i></div>'}
                    <div>
                        <span class="product-name" style="color: var(--primary-color); text-decoration: underline;">${item.name}</span>
                        <div class="product-spec" style="font-size: 0.8rem; color: #64748b;">
                            ${item.spec || '-'} 
                            ${item.leadTime ? ` | 🚚 ${item.leadTime}` : ''}
                        </div>
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

        // New Fields
        document.getElementById('input-price').value = item.price || '';
        document.getElementById('input-leadtime').value = item.leadTime || '';
        document.getElementById('input-supplier').value = item.supplier || '';
        document.getElementById('input-country').value = item.country || '';

        // Image
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
        // Clear image on new item
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

        // New Fields
        price: document.getElementById('input-price').value,
        leadTime: document.getElementById('input-leadtime').value,
        supplier: document.getElementById('input-supplier').value,
        country: document.getElementById('input-country').value,
        image: document.getElementById('input-image-base64').value, // Save Base64

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



// --- DETAIL VIEW LOGIC ---
window.viewItemDetails = (index) => {
    const item = items[index];
    const isLow = item.stock <= item.min;

    // Populate Data
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

    // Image Handling
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
