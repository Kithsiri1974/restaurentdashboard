// Global arrays to store data in memory
let stockData = [];
let orderReqData = [];
let autoRefreshInterval = null;

// Dynamic Base API URL (supports both localhost and Vercel hosting)
const API_BASE_URL = window.location.origin;

// Execute on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    // Attach event listener for Item Type change
    const typeSelect = document.getElementById('itemTypeSelect');
    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            updateCategoryDropdown();
            filterStockItems();
        });
    }

    // Attach event listener for Item Category change
    const catSelect = document.getElementById('itemCatSelect');
    if (catSelect) {
        catSelect.addEventListener('change', filterStockItems);
    }

    // Attach event listener for Stock Search input
    const stockSearch = document.getElementById('searchInput');
    if (stockSearch) {
        stockSearch.addEventListener('input', filterStockItems);
    }

    // Attach event listener for Order Request Search input
    const ordSearch = document.getElementById('ordSearchInput');
    if (ordSearch) {
        ordSearch.addEventListener('input', filterOrderRequests);
    }

    // Stock Form submit event
    const form = document.getElementById('detailsForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    // Stock Form cancel button click event
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetForm);
    }

    // Order Request Form submit event
    const ordForm = document.getElementById('ordReqForm');
    if (ordForm) {
        ordForm.addEventListener('submit', handleOrdFormSubmit);
    }

    // Order Request Form cancel button click event
    const ordCancelBtn = document.getElementById('ordCancelBtn');
    if (ordCancelBtn) {
        ordCancelBtn.addEventListener('click', resetOrdForm);
    }

    // Event listener for Picture Link changes (live picture preview)
    const picLinkInput = document.getElementById('inpPicLink');
    if (picLinkInput) {
        picLinkInput.addEventListener('input', updatePicturePreview);
    }

    // Load initial workspace if available
    const ordWorkspace = document.getElementById('orderReqWorkspace');
    if (ordWorkspace && ordWorkspace.style.display !== 'none') {
        showOrderReq();
    } else {
        showStockMast();
    }
});

// ==========================================================
// WORKSPACE SWITCHING MANAGEMENT
// ==========================================================
async function showStockMast() {
    stopAutoRefresh();
    const stockWorkspace = document.getElementById('stockMastWorkspace');
    const ordWorkspace = document.getElementById('orderReqWorkspace');

    if (ordWorkspace) ordWorkspace.style.display = 'none';
    if (stockWorkspace) {
        stockWorkspace.style.display = 'block';
        stockWorkspace.classList.remove('hidden-workspace');
    }

    await fetchStockData();
}

async function showOrderReq() {
    const stockWorkspace = document.getElementById('stockMastWorkspace');
    const ordWorkspace = document.getElementById('orderReqWorkspace');

    if (stockWorkspace) stockWorkspace.style.display = 'none';
    if (ordWorkspace) {
        ordWorkspace.style.display = 'block';
        ordWorkspace.classList.remove('hidden-workspace');
    }

    await fetchOrderReqData();
    startAutoRefresh();
}

function startAutoRefresh() {
    stopAutoRefresh();
    // Refresh order request list every 10 seconds automatically
    autoRefreshInterval = setInterval(() => {
        fetchOrderReqData(true);
    }, 10000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// ==========================================================
// 1. STOCK_MAST: FETCH & DROPDOWNS
// ==========================================================
async function fetchStockData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/stock-view`);
        if (!response.ok) throw new Error('Failed to fetch stock records');
        
        stockData = await response.json();
        
        populateTypeDropdown(stockData);
        updateCategoryDropdown();
        filterStockItems();
    } catch (err) {
        console.error('Error loading stock data:', err);
    }
}

function populateTypeDropdown(data) {
    const typeSelect = document.getElementById('itemTypeSelect');
    if (!typeSelect) return;

    const currentSelectedType = typeSelect.value;
    const types = [...new Set(data.map(item => item.item_type).filter(Boolean))].sort();

    typeSelect.innerHTML = '<option value="">All Types</option>';
    types.forEach(type => {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        typeSelect.appendChild(opt);
    });

    if (types.some(t => t.toLowerCase() === currentSelectedType.toLowerCase())) {
        typeSelect.value = currentSelectedType;
    }
}

function updateCategoryDropdown() {
    const typeSelect = document.getElementById('itemTypeSelect');
    const catSelect = document.getElementById('itemCatSelect');
    if (!typeSelect || !catSelect) return;

    const selectedType = typeSelect.value.toLowerCase();

    const matchingItems = selectedType 
        ? stockData.filter(item => item.item_type && item.item_type.toLowerCase() === selectedType)
        : stockData;

    const categories = [...new Set(matchingItems.map(item => item.item_cat).filter(Boolean))].sort();

    const currentSelectedCat = catSelect.value;
    catSelect.innerHTML = '<option value="">All Categories</option>';

    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });

    if (categories.some(c => c.toLowerCase() === currentSelectedCat.toLowerCase())) {
        catSelect.value = currentSelectedCat;
    } else {
        catSelect.value = '';
    }
}

// ==========================================================
// 2. STOCK_MAST: RENDER TABLE & FILTERING
// ==========================================================
function renderTable(items) {
    const tbody = document.getElementById('tableData');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center;">No matching stock records found.</td></tr>';
        return;
    }

    items.forEach((item, index) => {
        const tr = document.createElement('tr');
        const statusClass = item.stock_status === 'IN STOCK' ? 'status-in-stock' : 'status-out-of-stock';
        
        const imageCell = item.pic_link 
            ? `<img src="${item.pic_link}" alt="${item.it_code}" class="table-img-thumb" onerror="this.onerror=null; this.src=''; this.alt='No Image';">`
            : '<span style="color: #888;">N/A</span>';

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="text-align: center;">${imageCell}</td>
            <td><strong>${item.it_code || ''}</strong></td>
            <td>${item.it_desc || ''}</td>
            <td>${item.item_cat || ''}</td>
            <td><strong>${item.item_size || ''}</strong></td>
            <td>${item.it_unit || ''}</td>
            <td>${item.stock_in_hnd ?? 0}</td>
            <td>${Number(item.it_uprise_pur || 0).toFixed(2)}</td>
            <td>${Number(item.it_uprise_sal || 0).toFixed(2)}</td>
            <td class="${statusClass}">${item.stock_status || ''}</td>
            <td>
                <button type="button" class="btn-text-action" onclick="populateForm('${item.it_code}', '${item.item_size}')">[Edit]</button>
                <button type="button" class="btn-text-action" onclick="deleteStockItem('${item.it_code}', '${item.item_size}')">[Delete]</button>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

function filterStockItems() {
    const typeValue = document.getElementById('itemTypeSelect')?.value.toLowerCase() || '';
    const catValue = document.getElementById('itemCatSelect')?.value.toLowerCase() || '';
    const searchValue = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

    const filtered = stockData.filter(item => {
        const matchesType = !typeValue || (item.item_type && item.item_type.toLowerCase() === typeValue);
        const matchesCat = !catValue || (item.item_cat && item.item_cat.toLowerCase() === catValue);

        const combinedCodeSize = `${item.it_code || ''} ${item.item_size || ''}`.toLowerCase();
        const matchesSearch = !searchValue || combinedCodeSize.includes(searchValue) || 
                              (item.it_desc && item.it_desc.toLowerCase().includes(searchValue));

        return matchesType && matchesCat && matchesSearch;
    });

    renderTable(filtered);
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const typeSelect = document.getElementById('itemTypeSelect');
    
    if (searchInput) searchInput.value = '';
    if (typeSelect) typeSelect.value = '';

    updateCategoryDropdown();
    renderTable(stockData);
}

function focusNewItem() {
    showStockMast();
    resetForm();
    const inpCode = document.getElementById('inpCode');
    if (inpCode) inpCode.focus();
}

// ==========================================================
// 3. STOCK_MAST: FORM POPULATION, SUBMIT & DELETE
// ==========================================================
function populateForm(itCode, itemSize) {
    const item = stockData.find(i => String(i.it_code) === String(itCode) && String(i.item_size) === String(itemSize));
    if (!item) return;

    document.getElementById('selectItCode').value = item.it_code || '';
    document.getElementById('selectItSize').value = item.item_size || '';

    document.getElementById('inpCode').value = item.it_code || '';
    document.getElementById('inpDesc').value = item.it_desc || '';
    document.getElementById('inpCat').value = item.item_cat || '';
    document.getElementById('inpSize').value = item.item_size || '';
    document.getElementById('inpUnit').value = item.it_unit || '';
    document.getElementById('inpType').value = item.item_type || '';
    document.getElementById('inpQty').value = item.stock_in_hnd ?? 0;
    document.getElementById('inpReorder').value = item.reorderlevel ?? 0;
    document.getElementById('inpOpenStock').value = item.open_stock ?? 0;
    document.getElementById('inpFowdQty').value = item.fowd_qty || '';
    document.getElementById('inpDayOpenBal').value = item.dayopenbal ?? 0;
    document.getElementById('inpDayCloseBal').value = item.dayclosebal ?? 0;
    document.getElementById('inpPurPrice').value = item.it_uprise_pur ?? 0;
    document.getElementById('inpSalPrice').value = item.it_uprise_sal ?? 0;

    document.getElementById('inpOpenStockDate').value = formatDateForInput(item.open_stock_date, true);
    document.getElementById('inpProcesDate').value = formatDateForInput(item.proces_date, true);
    document.getElementById('inpLastPurchDate').value = formatDateForInput(item.last_purch_date, false);

    document.getElementById('inpRack').value = item.rack_no || '';
    document.getElementById('inpUser').value = item.user_name || '';
    document.getElementById('inpSoftDrBeer').value = item.softdrbeer || '';
    document.getElementById('inpMapItCode').value = item.mapit_code || '';
    document.getElementById('inpTdSpecial').value = item.td_special || '';
    document.getElementById('inpPicLink').value = item.pic_link || '';
    document.getElementById('inpRemarks').value = item.remarks || '';

    updatePicturePreview();
}

function formatDateForInput(dateString, isDateTime) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const isoStr = d.toISOString();
    return isDateTime ? isoStr.substring(0, 16) : isoStr.substring(0, 10);
}

function formatDateTimeForDisplay(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function updatePicturePreview() {
    const picLink = document.getElementById('inpPicLink')?.value.trim();
    const imgPreview = document.getElementById('imgPreview');
    if (imgPreview) {
        if (picLink) {
            imgPreview.src = picLink;
            imgPreview.style.display = 'block';
        } else {
            imgPreview.src = '';
            imgPreview.style.display = 'none';
        }
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const origCode = document.getElementById('selectItCode').value;
    const origSize = document.getElementById('selectItSize').value;

    const itemData = {
        it_code: document.getElementById('inpCode').value,
        it_desc: document.getElementById('inpDesc').value,
        item_cat: document.getElementById('inpCat').value,
        item_size: document.getElementById('inpSize').value,
        it_unit: document.getElementById('inpUnit').value,
        item_type: document.getElementById('inpType').value,
        stock_in_hnd: parseFloat(document.getElementById('inpQty').value) || 0,
        reorderlevel: parseFloat(document.getElementById('inpReorder').value) || 0,
        open_stock: parseFloat(document.getElementById('inpOpenStock').value) || 0,
        fowd_qty: document.getElementById('inpFowdQty').value,
        dayopenbal: parseFloat(document.getElementById('inpDayOpenBal').value) || 0,
        dayclosebal: parseFloat(document.getElementById('inpDayCloseBal').value) || 0,
        it_uprise_pur: parseFloat(document.getElementById('inpPurPrice').value) || 0,
        it_uprise_sal: parseFloat(document.getElementById('inpSalPrice').value) || 0,
        open_stock_date: document.getElementById('inpOpenStockDate').value || null,
        proces_date: document.getElementById('inpProcesDate').value || null,
        last_purch_date: document.getElementById('inpLastPurchDate').value || null,
        rack_no: document.getElementById('inpRack').value,
        user_name: document.getElementById('inpUser').value,
        softdrbeer: document.getElementById('inpSoftDrBeer').value,
        mapit_code: document.getElementById('inpMapItCode').value,
        td_special: document.getElementById('inpTdSpecial').value,
        pic_link: document.getElementById('inpPicLink').value,
        remarks: document.getElementById('inpRemarks').value
    };

    const isEditing = Boolean(origCode && origSize);
    const url = isEditing 
        ? `${API_BASE_URL}/api/stock/${encodeURIComponent(origCode)}/${encodeURIComponent(origSize)}`
        : `${API_BASE_URL}/api/stock`;

    const method = isEditing ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemData)
        });

        if (!response.ok) throw new Error(`Failed to ${isEditing ? 'update' : 'create'} record`);

        alert(`Item ${isEditing ? 'updated' : 'created'} successfully!`);
        resetForm();
        fetchStockData();
    } catch (err) {
        console.error('Error saving stock item:', err);
        alert(`Could not save item. ${err.message}`);
    }
}

async function deleteStockItem(itCode, itemSize) {
    if (!confirm(`Are you sure you want to delete item ${itCode} (${itemSize})?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/stock/${encodeURIComponent(itCode)}/${encodeURIComponent(itemSize)}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete item');

        alert('Item deleted successfully!');
        fetchStockData();
    } catch (err) {
        console.error('Error deleting stock item:', err);
        alert('Could not delete item.');
    }
}

function resetForm() {
    const form = document.getElementById('detailsForm');
    if (form) form.reset();
    document.getElementById('selectItCode').value = '';
    document.getElementById('selectItSize').value = '';
    updatePicturePreview();
}

// ==========================================================
// 4. ORDER REQUEST (ord_req): FETCH & RENDER
// ==========================================================
// ==========================================================
// 4. ORDER REQUEST (ord_req): FETCH & RENDER
// ==========================================================
async function fetchOrderReqData(isSilent = false) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/ord-req`);
        if (!response.ok) throw new Error('Failed to fetch order requests');
        
        const data = await response.json();
        
        // Deterministic sort to prevent rows from jumping around on refresh/update
        orderReqData = data.sort((a, b) => {
            const dateA = new Date(a.req_date || 0);
            const dateB = new Date(b.req_date || 0);
            if (dateB - dateA !== 0) return dateB - dateA;
            
            const reqNoCompare = String(b.req_no || '').localeCompare(String(a.req_no || ''));
            if (reqNoCompare !== 0) return reqNoCompare;
            
            return String(b.it_code || '').localeCompare(String(a.it_code || ''));
        });

        filterOrderRequests();
    } catch (err) {
        if (!isSilent) {
            console.error('Error loading order request data:', err);
        }
    }
}
function renderOrdTable(items) {
    const tbody = document.getElementById('ordTableData');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center;">No order requests found.</td></tr>';
        return;
    }

    items.forEach((item, index) => {
        const tr = document.createElement('tr');
        const reqDateTimeFormatted = formatDateTimeForDisplay(item.req_date);

        // Render Status column with OK button when req_ok is false
        const isOk = item.req_ok === true || String(item.req_ok).toLowerCase() === 'true';
        const okButtonHtml = isOk 
            ? '<span style="color: green; font-weight: bold; margin-left: 5px;">[OK ✓]</span>' 
            : `<button type="button" class="btn-text-action" style="margin-left: 5px;" onclick="setOrderReqOk('${item.req_no}', '${item.it_code}')">[OK]</button>`;

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${item.req_no || ''}</strong></td>
            <td>${reqDateTimeFormatted}</td>
            <td>${item.table_no || ''}</td>
            <td><strong>${item.it_code || ''}</strong></td>
            <td>${item.it_desc || ''}</td>
            <td>${item.item_size || ''}</td>
            <td>${item.req_qty ?? 0}</td>
            <td>${item.teleno || ''}</td>
            <td>
                <strong>${item.status || 'PENDING'}</strong>
                ${okButtonHtml}
            </td>
            <td>
                <button type="button" class="btn-text-action" onclick="populateOrdForm('${item.req_no}', '${item.it_code}')">[Edit]</button>
                <button type="button" class="btn-text-action" onclick="deleteOrderReq('${item.req_no}', '${item.it_code}')">[Delete]</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Function to update req_ok = true via flexible API routing
async function setOrderReqOk(reqNo, itCode) {
    const item = orderReqData.find(i => String(i.req_no) === String(reqNo) && String(i.it_code) === String(itCode));
    if (!item) return;

    try {
        const updatedPayload = { 
            ...item, 
            req_ok: true,
            req_date: item.req_date ? formatDateForInput(item.req_date, true) : null
        };

        // Try primary root PUT route first
        let response = await fetch(`${API_BASE_URL}/api/ord-req`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedPayload)
        });

        // Fallback to dual-parameter key route
        if (!response.ok) {
            response = await fetch(`${API_BASE_URL}/api/ord-req/${encodeURIComponent(reqNo)}/${encodeURIComponent(itCode)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPayload)
            });
        }

        // Fallback to single-parameter key route
        if (!response.ok) {
            response = await fetch(`${API_BASE_URL}/api/ord-req/${encodeURIComponent(reqNo)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPayload)
            });
        }

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(errBody || 'Failed to update status on server');
        }

        await fetchOrderReqData();
    } catch (err) {
        console.error('Error setting req_ok:', err);
        alert(`Could not confirm order: ${err.message}`);
    }
}

function filterOrderRequests() {
    const searchValue = document.getElementById('ordSearchInput')?.value.toLowerCase().trim() || '';

    const filtered = orderReqData.filter(item => {
        const combined = `${item.req_no || ''} ${item.table_no || ''} ${item.it_code || ''} ${item.it_desc || ''} ${item.teleno || ''}`.toLowerCase();
        return !searchValue || combined.includes(searchValue);
    });

    renderOrdTable(filtered);
}

function clearOrdSearch() {
    const input = document.getElementById('ordSearchInput');
    if (input) input.value = '';
    renderOrdTable(orderReqData);
}

// ==========================================================
// 5. ORDER REQUEST (ord_req): FORM POPULATION, SUBMIT & DELETE
// ==========================================================
function populateOrdForm(reqNo, itCode) {
    const item = orderReqData.find(i => String(i.req_no) === String(reqNo) && (!itCode || String(i.it_code) === String(itCode)));
    if (!item) return;

    document.getElementById('selectOrdReqNo').value = item.req_no || '';
    document.getElementById('inpOrdReqNo').value = item.req_no || '';
    document.getElementById('inpOrdReqDate').value = formatDateForInput(item.req_date, true);
    
    const tableNoInput = document.getElementById('inpOrdTableNo');
    if (tableNoInput) tableNoInput.value = item.table_no || '';

    document.getElementById('inpOrdItCode').value = item.it_code || '';
    document.getElementById('inpOrdItDesc').value = item.it_desc || '';
    document.getElementById('inpOrdItSize').value = item.item_size || '';
    document.getElementById('inpOrdReqQty').value = item.req_qty ?? 0;
    document.getElementById('inpOrdUnit').value = item.it_unit || '';
    
    const teleInput = document.getElementById('inpOrdTeleNo');
    if (teleInput) teleInput.value = item.teleno || '';

    document.getElementById('inpOrdStatus').value = item.status || 'PENDING';
    
    const reqOkSelect = document.getElementById('inpOrdReqOk');
    if (reqOkSelect) reqOkSelect.value = String(Boolean(item.req_ok));

    document.getElementById('inpOrdRemarks').value = item.remarks || '';
}

async function handleOrdFormSubmit(e) {
    e.preventDefault();

    const origReqNo = document.getElementById('selectOrdReqNo').value;
    const teleInput = document.getElementById('inpOrdTeleNo');
    const tableNoInput = document.getElementById('inpOrdTableNo');
    const reqOkSelect = document.getElementById('inpOrdReqOk');

    const reqData = {
        req_no: document.getElementById('inpOrdReqNo').value,
        req_date: document.getElementById('inpOrdReqDate').value,
        table_no: tableNoInput ? tableNoInput.value : '',
        it_code: document.getElementById('inpOrdItCode').value,
        it_desc: document.getElementById('inpOrdItDesc').value,
        item_size: document.getElementById('inpOrdItSize').value,
        req_qty: parseFloat(document.getElementById('inpOrdReqQty').value) || 0,
        it_unit: document.getElementById('inpOrdUnit').value,
        teleno: teleInput ? teleInput.value : '',
        status: document.getElementById('inpOrdStatus').value,
        req_ok: reqOkSelect ? (reqOkSelect.value === 'true') : false,
        remarks: document.getElementById('inpOrdRemarks').value
    };

    const isEditing = Boolean(origReqNo);
    const method = isEditing ? 'PUT' : 'POST';

    try {
        let response = await fetch(`${API_BASE_URL}/api/ord-req`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqData)
        });

        if (!response.ok && isEditing) {
            response = await fetch(`${API_BASE_URL}/api/ord-req/${encodeURIComponent(origReqNo)}/${encodeURIComponent(reqData.it_code)}`, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqData)
            });
        }

        if (!response.ok && isEditing) {
            response = await fetch(`${API_BASE_URL}/api/ord-req/${encodeURIComponent(origReqNo)}`, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqData)
            });
        }

        if (!response.ok) throw new Error(`Failed to ${isEditing ? 'update' : 'create'} order request`);

        alert(`Order request ${isEditing ? 'updated' : 'created'} successfully!`);
        resetOrdForm();
        fetchOrderReqData();
    } catch (err) {
        console.error('Error saving order request:', err);
        alert(`Could not save order request. ${err.message}`);
    }
}

async function deleteOrderReq(reqNo, itCode) {
    if (!confirm(`Are you sure you want to delete order request ${reqNo} (${itCode})?`)) return;

    try {
        let response = await fetch(`${API_BASE_URL}/api/ord-req/${encodeURIComponent(reqNo)}/${encodeURIComponent(itCode)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            response = await fetch(`${API_BASE_URL}/api/ord-req/${encodeURIComponent(reqNo)}`, {
                method: 'DELETE'
            });
        }

        if (!response.ok) throw new Error('Failed to delete order request');

        alert('Order request deleted successfully!');
        fetchOrderReqData();
    } catch (err) {
        console.error('Error deleting order request:', err);
        alert('Could not delete order request.');
    }
}

function resetOrdForm() {
    const form = document.getElementById('ordReqForm');
    if (form) form.reset();
    const hiddenInput = document.getElementById('selectOrdReqNo');
    if (hiddenInput) hiddenInput.value = '';
}