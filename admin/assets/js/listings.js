import { supabase } from '../../../assets/js/supabase-config.js';

// --- Page Lifecycle Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
    initListingsPage();
});

/**
 * ADMINISTRATIVE SECURITY ACCESS GATEWAY
 */
async function initListingsPage() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.href = "login.html";
        return;
    }

    try {
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) throw new Error("Verification failed.");

        if (profile.role !== "admin") {
            await supabase.auth.signOut();
            window.location.href = "login.html?error=unauthorized";
            return;
        }

        // Initialize click binds, styles, and data streams loops
        setupListingEventListeners();
        window.loadListingRequests();

    } catch (err) {
        console.error("Access Forbidden:", err.message);
        await supabase.auth.signOut();
        window.location.href = "login.html?error=access_denied";
    }
}

/**
 * ✅ Inject Listing Workspace Panel Styles dynamically into document head
 */
(function injectListingStyles() {
    if (document.getElementById('listing-panel-styles')) return;
    const styleBlock = document.createElement('style');
    styleBlock.id = 'listing-panel-styles';
    styleBlock.innerHTML = `
        /* Container for the circular buttons */
        .action-btn-group {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        /* Base circular button style */
        .listing-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: #f8fafc;
            font-size: 14px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        /* Review / Eye Button */
        .btn-review { color: #0b1e5b; }
        .btn-review:hover { background: #0b1e5b; color: white; transform: scale(1.1); }

        /* Approve / Check Button */
        .btn-approve { color: #10b981; }
        .btn-approve:hover { background: #10b981; color: white; transform: scale(1.1); }

        /* Reject / Trash Button */
        .btn-reject { color: #ef4444; }
        .btn-reject:hover { background: #ef4444; color: white; transform: scale(1.1); }

        /* Visit Profile Link Button */
        .link-icon-btn {
            padding: 7px 14px;
            background: #eff6ff;
            color: #2563eb;
            border-radius: 8px;
            text-decoration: none;
            font-size: 12px;
            font-weight: 700;
            transition: 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border: none;
            cursor: pointer;
        }
        .link-icon-btn:hover { background: #2563eb; color: white; }
    `;
    document.head.appendChild(styleBlock);
})();

/**
 * ✅ Fetch and Display Pending Marketplace Listings
 */
window.loadListingRequests = async function() {
    const tbody = document.getElementById('listingsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align:center; padding:30px; color:#64748b;">
                <i class="fas fa-spinner fa-spin"></i> Loading pending requests...
            </td>
        </tr>`;

    try {
        const { data: listings, error } = await supabase
            .from('verifications')
            .select('*')
            .eq('status', 'pending')
            .order('submitted_at', { ascending: false });

        if (error) throw error;

        if (!listings || listings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:50px; color:#64748b;">
                        <i class="fa-solid fa-check-circle" style="font-size:30px; color:#10b981; display:block; margin-bottom:10px;"></i>
                        No pending listing requests.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = "";
        listings.forEach(item => {
            const details = typeof item.data === 'string' ? JSON.parse(item.data) : (item.data || {});
            const row = document.createElement('tr');
            row.style.borderBottom = "1px solid #f1f5f9";
            
            row.innerHTML = `
                <td style="padding:15px;">
                    <div style="width:75px; height:50px; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0; background:#000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <img src="${item.screenshot_url}" style="width:100%; height:100%; object-fit:contain; cursor:pointer;" 
                             onclick="window.open('${item.screenshot_url}', '_blank')" title="View Full Proof"
                             onerror="this.src='https://placehold.co/75x50/e2e8f0/0b1e5b?text=No+Proof'">
                    </div>
                </td>
                <td style="padding:15px; font-weight:700; color:#1e293b; text-transform: uppercase;">
                    ${details.platform || 'N/A'}
                </td>
                <td style="padding:15px; font-weight:700; color:#059669;">
                    ₦${Number(details.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td style="padding:15px;">
                    ${details.profile_link ? `
                        <a href="${details.profile_link}" target="_blank" class="link-icon-btn">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Visit Profile
                        </a>
                    ` : `<span style="color:#94a3b8; font-style:italic; font-size:12px;">No link appended</span>`}
                </td>
                <td style="padding:15px;">
                    <span class="badge bg-warning" style="padding:5px 10px; border-radius:5px; background: #fffbeb; color: #92400e; font-size:10px; font-weight:800; border: 1px solid #fef3c7;">
                        PENDING
                    </span>
                </td>
                <td style="padding:15px; text-align: right;">
                    <div class="action-btn-group">
                        <button onclick="window.viewAndEditListing('${item.id}')" class="listing-btn btn-review" title="Review Details">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </button>
                        <button onclick="window.processListing('${item.id}', 'approved')" class="listing-btn btn-approve" title="Approve Listing">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button onclick="window.processListing('${item.id}', 'rejected')" class="listing-btn btn-reject" title="Reject Listing">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Matrix generation failure:", err);
        tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444; text-align:center; padding: 20px; font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}</td></tr>`;
    }
};

/**
 * ✅ 2. Open Real Modal (Editable: Region, Account Age, Description)
 */
window.viewAndEditListing = async function(id) {
    const modal = document.getElementById('listingReviewModal');
    const modalBody = document.getElementById('modalBody');
    const saveBtn = document.getElementById('saveDetailsBtn');
    
    if (!modal || !modalBody) return;

    modal.style.display = 'block';
    modalBody.innerHTML = '<p style="text-align: center; padding: 20px; color:#64748b;"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading details...</p>';

    try {
        const { data: item, error } = await supabase.from('verifications').select('*').eq('id', id).single();
        if (error || !item) throw new Error("Could not fetch verification details.");

        const details = typeof item.data === 'string' ? JSON.parse(item.data) : (item.data || {});
        const editableFields = ['region', 'account_age', 'description'];

        modalBody.innerHTML = "";
        Object.entries(details).forEach(([key, value]) => {
            const isEditable = editableFields.includes(key);
            const container = document.createElement('div');
            container.style.marginBottom = "15px";
            
            container.innerHTML = `
                <label style="display:block; font-size:11px; font-weight:800; color:#64748b; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.5px;">
                    ${key.replace(/_/g, ' ')} ${isEditable ? '<span style="color:#2563eb; font-weight:600;">(Editable)</span>' : '🔒'}
                </label>
                ${isEditable ? 
                    `<input type="text" id="modal_edit_${key}" value="${value !== null ? value : ''}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box; font-size:14px; font-family:'Inter'; font-weight:500;">` :
                    `<div style="padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; color:#475569; font-family:monospace; word-break:break-all;">${value !== null ? value : 'N/A'}</div>`
                }
            `;
            modalBody.appendChild(container);
        });

        saveBtn.onclick = () => window.saveListingChanges(id, details);

    } catch (err) {
        console.error("Modal fetch error:", err);
        modalBody.innerHTML = `<p style="color:#ef4444; font-weight:600; text-align:center;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading details.</p>`;
    }
};

/**
 * ✅ 3. Save Changes & Close Modal
 */
window.saveListingChanges = async function(id, originalData) {
    const updatedData = { ...originalData };
    const editableFields = ['region', 'account_age', 'description'];

    editableFields.forEach(key => {
        const input = document.getElementById(`modal_edit_${key}`);
        if (input) updatedData[key] = input.value;
    });

    Swal.fire({
        title: 'Updating properties...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const { error } = await supabase.from('verifications').update({ data: updatedData }).eq('id', id);
        if (error) throw error;

        Swal.fire({ icon: 'success', title: 'Data Updated', timer: 1000, showConfirmButton: false });
        window.closeReviewModal();
        window.loadListingRequests();
    } catch (err) {
        console.error("Property save error:", err);
        Swal.fire({ icon: 'error', title: 'Update Failed', text: err.message });
    }
};

/**
 * ✅ 4. Process Status (Sync Status Column + Status in JSON)
 */
window.processListing = async function(id, newStatus) {
    const confirmVerdict = await Swal.fire({
        title: `Mark listing as ${newStatus.toUpperCase()}?`,
        text: `This changes the column layout index parameters live across database modules.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: newStatus === 'approved' ? '#10b981' : '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Proceed'
    });

    if (!confirmVerdict.isConfirmed) return;

    Swal.fire({
        title: 'Processing moderation status...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        const { data: item, error: fetchError } = await supabase.from('verifications').select('data').eq('id', id).single();
        if (fetchError || !item) throw new Error("Record fetch initialization missing.");

        const dataObj = typeof item.data === 'string' ? JSON.parse(item.data) : (item.data || {});

        // Update status string inside the JSON data object
        dataObj.status = newStatus;

        const { error } = await supabase
            .from('verifications')
            .update({ 
                status: newStatus, 
                data: dataObj,      
                verified_at: new Date().toISOString() 
            })
            .eq('id', id);

        if (error) throw error;

        Swal.fire({ icon: 'success', title: `Listing ${newStatus}`, timer: 1000, showConfirmButton: false });
        window.loadListingRequests();
    } catch (err) {
        console.error("Status alteration exception error:", err);
        Swal.fire({ icon: 'error', title: 'Moderation Error', text: err.message });
    }
};

/**
 * CLOSE MODAL UTILITY
 */
window.closeReviewModal = function() {
    const modal = document.getElementById('listingReviewModal');
    if (modal) modal.style.display = 'none';
};

/**
 * BIND CORE SYSTEM EVENT LISTENERS
 */
function setupListingEventListeners() {
    const refreshBtn = document.getElementById('refreshListingsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', window.loadListingRequests);
    }

    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const confirm = await Swal.fire({
                title: 'Terminate Session?',
                text: "You will need to sign back in to perform verification operations.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#0b1e5b',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Logout'
            });

            if (confirm.isConfirmed) {
                await supabase.auth.signOut();
                window.location.href = "login.html";
            }
        });
    }
}
