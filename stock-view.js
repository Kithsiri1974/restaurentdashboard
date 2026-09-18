async function loadStockMastData() {
    try {
        const response = await fetch('/api/stock-view');
        const items = await response.json();
        
        const tbody = document.getElementById('tableData');
        tbody.innerHTML = ''; // Clear existing rows

        items.forEach((item, index) => {
            const row = document.createElement('tr');
            
            const itemCode = item.it_code || '';
            const desc = item.it_desc || '';
            const cat = item.item_cat || '';
            const size = item.item_size || '';
            const unit = item.it_unit || '';
            const qty = item.stock_in_hnd || 0;
            const purPrice = item.it_uprise_pur ? parseFloat(item.it_uprise_pur).toFixed(2) : '0.00';
            const salPrice = item.it_uprise_sal ? parseFloat(item.it_uprise_sal).toFixed(2) : '0.00';
            const status = item.stock_status || 'IN STOCK';
            const picLink = item.pic_link ? `<img src="${item.pic_link}" width="30" height="30" style="object-fit:cover;">` : 'No Img';

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${picLink}</td>
                <td><strong>${itemCode}</strong></td>
                <td>${desc}</td>
                <td>${cat}</td>
                <td>${size}</td>
                <td>${unit}</td>
                <td>${qty}</td>
                <td>${purPrice}</td>
                <td>${salPrice}</td>
                <td><span class="status-badge">${status}</span></td>
                <td>
                    <button type="button" onclick="populateStockForm(${JSON.stringify(item).replace(/"/g, '&quot;')})">[Edit]</button>
                </td>
            `;
            
            row.onclick = () => populateStockForm(item);
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Failed to load stock mast data:', error);
    }
}