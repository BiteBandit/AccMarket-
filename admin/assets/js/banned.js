import { supabase } from '../../../assets/js/supabase-config.js';

// --- Page Lifecycle Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
    initBannedPage();
});

/**
 * STRICT SECURITY GATE
 * Verifies active browser session tokens and enforces administrative clearance rules.
 */
async function initBannedPage() {
    // 1. Basic Token Validation Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.href = "login.html";
        return;
    }

    // 2. Structural Role Authorization Check
    try {
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            throw new Error("Could not verify administrative privileges.");
        }

        // Lock out unauthorized users instantly
        if (profile.role !== "admin") {
            await supabase.auth.signOut();
            window.location.href = "login.html?error=unauthorized";
            return;
        }

        // 3. Success Context Deployment - Bind events and load the database queue
        setupBannedEventListeners();
        await window.loadRestrictedUsers();

    } catch (err) {
        console.error("Restricted Access Gate Denied:", err.message);
        await supabase.auth.signOut();
        window.location.href = "login.html?error=access_denied";
    }
}

/**
 * 1. LOAD RESTRICTED USERS QUEUE
 * Pulls profiles flagged by your custom SQL Trigger via the is_official_ban column.
 */
window.loadRestrictedUsers = async () => {
    const tbody = document.getElementById('bannedTableBody');
    const searchInput = document.getElementById('bannedSearchInput');
    if (!tbody) return;

    // Reset search bar on full reload
    if (searchInput) searchInput.value = '';

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i> Synchronizing with Auth Records...</td></tr>';

    try {
        // Fetch users flagged by the SQL Trigger via is_official_ban column
        const { data: bannedUsers, error } = await supabase
            .from('profiles')
            .select('id, username, email, is_official_ban, created_at')
            .eq('is_official_ban', true) 
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!bannedUsers || bannedUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: #64748b;">No officially restricted accounts found.</td></tr>';
            return;
        }

        tbody.innerHTML = bannedUsers.map(u => {
            return `
                <tr class="banned-row">
                    <td>
                        <div class="user-details">
                            <span style="font-weight:600; display:block; color: #0b1e5b;">${u.username || u.email}</span>
                            <span style="font-size: 10px; color: #64748b; font-family: monospace;">UID: ${u.id}</span>
                        </div>
                    </td>
                    <td>
                        <span style="color: #991b1b; font-size: 11px; font-weight: 600; background: #fee2e2; padding: 4px 8px; border-radius: 4px;">
                            SUPABASE AUTH BAN
                        </span>
                    </td>
                    <td>
                        <span class="badge" style="background: #1e293b; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                            OFFICIAL
                        </span>
                    </td>
                    <td class="date-text">${new Date(u.created_at).toLocaleDateString()}</td>
                    <td style="text-align: right;">
                        <button class="op-btn" onclick="liftOfficialBan('${u.id}')" title="Unban User" 
                            style="background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 6px; cursor:pointer;">
                            <i class="fa-solid fa-user-check"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Ban Load Error:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color: #ef4444;">Error: ${err.message}</td></tr>`;
    }
};

/**
 * 2. UNBAN OPERATION (LIFT OFFICIAL BAN)
 * Calls the Edge Function with active Session Auth Headers to securely manage Auth layer mutations.
 */
window.liftOfficialBan = async (userId) => {
    const confirm = await Swal.fire({
        title: 'Lift Official Ban?',
        text: "This will restore the user's access at the Auth Level.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Restore Access'
    });

    if (confirm.isConfirmed) {
        Swal.fire({ 
            title: 'Updating Auth Server...', 
            html: 'Please wait while we communicate with Supabase Auth API',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading() 
        });

        try {
            // Retrieve session token to verify admin authority at the Edge level
            const { data: { session } } = await supabase.auth.getSession();

            // Calling your Edge Function 'admin-ban'
            const { data, error } = await supabase.functions.invoke('admin-ban', {
                body: { 
                    userId: userId, 
                    action: 'unban' 
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                }
            });

            if (error) throw error;

            await Swal.fire({
                icon: 'success',
                title: 'Access Restored',
                text: 'The user has been officially unbanned.',
                timer: 2000,
                showConfirmButton: false
            });

            // Refresh the dashboard table queue
            window.loadRestrictedUsers();

        } catch (err) {
            console.error("Unban error:", err);
            Swal.fire({
                icon: 'error',
                title: 'Request Failed',
                text: err.message || 'Check if your Edge Function is deployed and active.'
            });
        }
    }
};

/**
 * 3. REAL-TIME SEARCH FILTER
 */
window.filterBannedTable = () => {
    const filter = document.getElementById('bannedSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#bannedTableBody tr');
    
    rows.forEach(row => {
        // Skip informational rows (e.g., "No accounts found" or "Loading spinners")
        if (row.cells.length < 5) return;
        
        // Target the first column index: Identity (Username/UID/Email)
        const identity = row.cells[0].textContent.toLowerCase();
        
        if (identity.includes(filter)) {
            row.style.display = ""; 
        } else {
            row.style.display = "none"; 
        }
    });
};

/**
 * 4. Control Listeners & Static Layout Event Bindings
 */
function setupBannedEventListeners() {
    // Dynamic text filter listener alternative invocation to handle programmatic execution safely
    const searchInput = document.getElementById('bannedSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', window.filterBannedTable);
    }

    // Manual layout refresh handler binding 
    const refreshBtn = document.getElementById('refreshBannedBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', window.loadRestrictedUsers);
    }

    // Global session logout handler interface linkage
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = "login.html";
        });
    }
}
