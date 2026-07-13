import { supabase } from '../../../assets/js/supabase-config.js';

// --- State Cache Variables ---
let rowCache = [];
let selectedRowId = null;
let currentSoldPoolCache = []; // Global pointer to handle fast local filtering

// --- DOM Selector Elements ---
const rowSelector = document.getElementById('rowSelector');
const modifyRowForm = document.getElementById('modifyRowForm');
const txtStockAppend = document.getElementById('txtStockAppend');
const appendCounterMessage = document.getElementById('appendCounterMessage');
const refreshStockMetricsBtn = document.getElementById('refreshStockMetricsBtn');
const salesLogTableBody = document.getElementById('salesLogTableBody');
const salesLogSearch = document.getElementById('salesLogSearch');

// ==========================================
// CORE: INITIALIZE & RE-SYNC OVERVIEW ROWS
// ==========================================
async function loadInventoryRows() {
    try {
        // Updated to target your system_bulk_stock table
        const { data, error } = await supabase.from('system_bulk_stock').select('*'); 
        if (error) throw error;
        
        rowCache = data || [];
        
        // Populate Dropdown Selection Menus
        rowSelector.innerHTML = '<option value="">-- Click to choose active row --</option>' + 
            rowCache.map(r => `<option value="${r.id}">[${r.platform.toUpperCase()}] ${r.category} - ₦${r.price} (${r.region})</option>`).join('');
            
        // Gracefully reset operational panel structures to safely lock updates
        modifyRowForm.style.opacity = "0.4";
        modifyRowForm.style.pointerEvents = "none";
        modifyRowForm.reset();
        appendCounterMessage.style.display = "none";
        salesLogTableBody.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">Select a row target above to extract sales records...</td></tr>`;
        currentSoldPoolCache = [];
    } catch (err) {
        console.error("Catalog synchronize failure:", err.message);
    }
}

// Manual Sync Button bindings
refreshStockMetricsBtn?.addEventListener('click', loadInventoryRows);

// ==========================================
// 1. OPERATION: INITIALIZE UNIQUE ROW INSTANCE
// ==========================================
document.getElementById('newRowForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const payload = {
        platform: document.getElementById('newPlatform').value,
        category: document.getElementById('newCategory').value.trim(),
        price: document.getElementById('newPrice').value.trim(), 
        region: document.getElementById('newRegion').value.trim(),
        account_age: document.getElementById('newAge').value.trim(),
        description: document.getElementById('newDescription').value.trim(),
        available_pool: JSON.stringify([]), // Instantiates clean empty stock array
        sold_pool: JSON.stringify([])       // Instantiates empty history block
    };

    try {
        Swal.fire({ title: 'Creating row entry...', didOpen: () => Swal.showLoading() });
        // Updated to target your system_bulk_stock table
        const { error } = await supabase.from('system_bulk_stock').insert([payload]);
        if (error) throw error;

        Swal.fire("Created!", "New row category was added successfully.", "success");
        e.target.reset();
        loadInventoryRows();
    } catch (err) {
        Swal.fire("Database Error", err.message, "error");
    }
});

// ==========================================
// 2. OPERATION: ROW INTERACTIVE DROPDOWN SYNC
// ==========================================
rowSelector?.addEventListener('change', (e) => {
    selectedRowId = e.target.value;
    if (!selectedRowId) {
        modifyRowForm.style.opacity = "0.4";
        modifyRowForm.style.pointerEvents = "none";
        salesLogTableBody.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">Select a row target above to extract sales records...</td></tr>`;
        return;
    }

    // Unlock interactive components inputs
    modifyRowForm.style.opacity = "1";
    modifyRowForm.style.pointerEvents = "auto";

    const selectedRow = rowCache.find(r => r.id === selectedRowId);
    if (selectedRow) {
        document.getElementById('editPrice').value = selectedRow.price;
        document.getElementById('editDescription').value = selectedRow.description || '';
        
        // Safely evaluate parsed storage models for Available Pools
        let parsedAvailable = [];
        try {
            parsedAvailable = typeof selectedRow.available_pool === 'string' ? JSON.parse(selectedRow.available_pool) : selectedRow.available_pool;
        } catch(pErr) { parsedAvailable = []; }
        
        document.getElementById('editCurrentCount').value = `${Array.isArray(parsedAvailable) ? parsedAvailable.length : 0} Accounts Available`;

        // Safely extract transaction arrays from string serialization layers
        try {
            currentSoldPoolCache = typeof selectedRow.sold_pool === 'string' ? JSON.parse(selectedRow.sold_pool) : selectedRow.sold_pool;
            if (!Array.isArray(currentSoldPoolCache)) currentSoldPoolCache = [];
        } catch (err) {
            currentSoldPoolCache = [];
        }

        renderSalesLogs(currentSoldPoolCache);
    }
});

// Real-time text payload metrics parser counter
txtStockAppend?.addEventListener('input', (e) => {
    const rawLines = e.target.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length > 0) {
        appendCounterMessage.innerHTML = `<i class="fa-solid fa-circle-info"></i> Detected ${rawLines.length} pending account entries to merge.`;
        appendCounterMessage.style.display = "flex";
    } else {
        appendCounterMessage.style.display = "none";
    }
});

// ==========================================
// 3. OPERATION: UPDATE FIELDS & INJECT STOCK
// ==========================================
modifyRowForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedRowId) return;

    const targetRowRecord = rowCache.find(r => r.id === selectedRowId);
    if (!targetRowRecord) return;

    // 1. Correctly parse existing pool
    let baseStockPool = [];
    try {
        const pool = targetRowRecord.available_pool;
        // If it's a string (double-serialized), parse it. If it's an object/array, use it.
        baseStockPool = typeof pool === 'string' ? JSON.parse(pool) : (pool || []);
        if (typeof baseStockPool === 'string') baseStockPool = JSON.parse(baseStockPool);
    } catch(err) {
        baseStockPool = [];
    }

    // 2. Parse new items from textarea
    const rawLinesToInject = txtStockAppend.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const structuredNewItems = rawLinesToInject.map(line => {
        const parts = line.split('|');
        return {
            email: parts[0] ? parts[0].trim() : '',
            password: parts[1] ? parts[1].trim() : '',
            recovery: parts[2] && parts[2].trim() !== '' ? parts[2].trim() : null,
            cookie: parts[3] && parts[3].trim() !== '' ? parts[3].trim() : null 
        };
    }).filter(acc => acc.email !== '' && acc.password !== '');

    // 3. Create the clean, combined array
    const combinedUpdatedPool = [...baseStockPool, ...structuredNewItems];

    // 4. Update Database
    try {
        Swal.fire({ title: 'Applying row changes...', didOpen: () => Swal.showLoading() });
        
        const { error } = await supabase
            .from('system_bulk_stock') 
            .update({
                price: document.getElementById('editPrice').value.trim(),
                description: document.getElementById('editDescription').value.trim(),
                // FIX: Send the ARRAY directly. 
                // Do NOT use JSON.stringify() for jsonb columns.
                available_pool: combinedUpdatedPool 
            })
            .eq('id', selectedRowId);

        if (error) throw error;

        Swal.fire("Updated Successfully", `Injected ${structuredNewItems.length} accounts.`, "success");
        txtStockAppend.value = '';
        loadInventoryRows();
    } catch (err) {
        Swal.fire("Transaction Error", err.message, "error");
    }
});

// ==========================================
// 4. PRESENTATION: HISTORICAL LOG DELIVERIES VIEW
// ==========================================
function renderSalesLogs(logsArray) {
    if (!logsArray || logsArray.length === 0) {
        salesLogTableBody.innerHTML = `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #64748b;">No items have been purchased from this row category yet.</td></tr>`;
        return;
    }

    salesLogTableBody.innerHTML = logsArray.map(item => {
        const email = item.log?.email || 'N/A';
        const password = item.log?.password || '••••••••';
        const buyer = item.buyer_id || 'Unknown ID';
        
        let dateString = 'Recent';
        if (item.sold_at) {
            try { dateString = new Date(item.sold_at).toLocaleString(); } catch(e){}
        }

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px 10px; font-weight: 600; color: #0b1e5b; font-family: monospace; word-break: break-all;">${email}</td>
                <td style="padding: 12px 10px; color: #475569; font-family: monospace; word-break: break-all;">${password}</td>
                <td style="padding: 12px 10px; color: #2563eb; font-size: 0.8rem; font-family: monospace;">
                    <span title="${buyer}" style="background: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe; display: inline-block; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;">${buyer}</span>
                </td>
                <td style="padding: 12px 10px; color: #64748b; font-size: 0.8rem; white-space: nowrap;">${dateString}</td>
            </tr>
        `;
    }).join('');
}

// Client-side text verification string lookup filters
salesLogSearch?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    if (!searchTerm) {
        renderSalesLogs(currentSoldPoolCache);
        return;
    }

    const filtered = currentSoldPoolCache.filter(item => {
        const emailMatch = (item.log?.email || '').toLowerCase().includes(searchTerm);
        const buyerMatch = (item.buyer_id || '').toLowerCase().includes(searchTerm);
        return emailMatch || buyerMatch;
    });

    renderSalesLogs(filtered);
});

// Run catalog index pipeline once DOM loads
document.addEventListener('DOMContentLoaded', loadInventoryRows);
