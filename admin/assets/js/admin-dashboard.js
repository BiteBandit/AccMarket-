import { supabase } from '../../../assets/js/supabase-config.js';

// --- UI Elements ---
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const navItems = document.querySelectorAll('.nav-item');
const sectionTitle = document.getElementById('sectionTitle');

// Global cache for searching
let cachedUsers = [];

// --- Initialization ---
async function init() {
    // 1. Security Gate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        window.location.href = "login.html";
        return;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('username, role')
        .eq('id', user.id)
        .single();

    if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        window.location.href = "login.html";
        return;
    }

    document.getElementById('adminUsername').textContent = `Security Clear: ${profile.username}`;

    // 2. Load Dashboard Stats
    loadIntelligenceMetrics();

    // 3. Setup Directory Event Listeners (Search/Refresh)
    setupDirectoryListeners();
}

// --- UPDATED NAVIGATION LOGIC ---
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');

        // 1. Update Sidebar UI
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // 2. Clear and Reset Visibility
        // This ensures no two sections are visible at the same time
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.style.display = 'none';
        });

        // 3. Update Header Title
        if (sectionTitle) {
            sectionTitle.textContent = item.innerText.trim();
        }

        // 4. Show Target Section
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

// 5. Route Data Loading
if (section === 'users') {
    loadUserDirectory();
} else if (section === 'kyc') {
    loadPaidKYC();
} else if (section === 'banned') {
    loadRestrictedUsers();
} else if (section === 'verification') {
    loadAccountAudits(); 
} else if (section === 'conversations') {
    loadCommunicationLogs();
} else if (section === 'withdrawals') {
    loadWithdrawalRequests();
} else if (section === 'transactions') {
    loadLedgerReports();
} else if (section === 'listings') {
    // ✅ Marketplace Listing Requests (verifications table)
    window.loadListingRequests(); 
} else if (section === 'broadcast') {
    if (typeof toggleTargetFields === 'function') toggleTargetFields();
} else if (section === 'blog') {
    if (typeof loadBlogs === 'function') loadBlogs();
}

 

        // 6. Close Sidebar (For Mobile Users)
        if (typeof sidebar !== 'undefined' && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        }
    });
});


// --- User Directory Logic ---
function setupDirectoryListeners() {
    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = cachedUsers.filter(u => 
                (u.username && u.username.toLowerCase().includes(term)) || 
                (u.email && u.email.toLowerCase().includes(term))
            );
            renderUserTable(filtered);
        });
    }

    const refreshBtn = document.getElementById('refreshUsersBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadUserDirectory);
    }
}

async function loadUserDirectory() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Accessing User Records...</td></tr>';

    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        cachedUsers = users; // Store for searching
        renderUserTable(users);

    } catch (err) {
        console.error("Directory Access Error:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: #ef4444;">Unauthorized or Connection Error.</td></tr>';
    }
}

function renderUserTable(users) {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: #94a3b8;">No matching entities found.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => {
        const initials = u.username ? u.username.substring(0, 2).toUpperCase() : '??';
        const role = u.role?.toLowerCase() || 'buyer';
        const roleClass = role === 'seller' ? 'badge-seller' : 'badge-buyer';
        
        return `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${initials}</div>
                        <div class="user-details">
                            <span class="user-name">${u.username || 'Anonymous User'}</span>
                            <span class="user-email">${u.email || 'N/A'}</span>
                        </div>
                    </div>
                </td>
                <td><span class="badge ${roleClass}">${role.charAt(0).toUpperCase() + role.slice(1)}</span></td>
                <td><span class="balance-text">₦${(u.balance || 0).toLocaleString()}</span></td>
                <td class="date-text">${new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td class="table-ops" style="text-align: right;">
                    <button class="op-btn view" onclick="viewUserFile('${u.id}')" title="View Profile">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="op-btn restrict" onclick="restrictUserAccess('${u.id}')" title="Restrict Access">
                        <i class="fa-solid fa-ban"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- Exposed Operations (Must be window-scoped for onclick) ---
window.viewUserFile = async (userId) => {
    Swal.fire({ title: 'Accessing Secure File...', didOpen: () => Swal.showLoading() });

    try {
        const { data: user, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Logic to color the trust score (Green for high, Orange for medium, Red for low)
        const score = parseFloat(user.trust_score || 0);
        const scoreColor = score >= 7 ? '#22c55e' : (score >= 4 ? '#f59e0b' : '#ef4444');

        Swal.fire({
            title: `<span style="color: #0b1e5b; font-size: 18px;">Security Dossier: ${user.username}</span>`,
            width: '500px',
            html: `
                <div style="text-align: left; font-family: 'Inter', sans-serif; font-size: 13px; color: #1e293b;">
                    
                    <div style="display: flex; align-items: center; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                        <img src="${user.avatar_url || 'https://via.placeholder.com/60'}" style="width: 65px; height: 65px; border-radius: 12px; object-fit: cover; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 15px; color: #0b1e5b;">ID: <span style="font-weight: 400; color: #64748b; font-size: 11px;">${user.id}</span></div>
                            <div style="margin-top: 4px;"><b>Country:</b> ${user.country_flag ? `<img src="${user.country_flag}" width="16">` : ''} ${user.country || 'N/A'}</div>
                            <div style="margin-top: 4px;"><b>Phone:</b> ${user.country_code || ''}${user.phone || 'Not Linked'}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                        <div style="background: #f1f5f9; padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Trust Score</div>
                            <div style="font-size: 18px; font-weight: 800; color: ${scoreColor};">${score.toFixed(1)} <span style="font-size: 12px; color: #94a3b8;">/ 100</span></div>
                        </div>
                        <div style="background: #f1f5f9; padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Verification</div>
                            <div style="margin-top: 4px;">
                                <span class="badge ${user.kyc_status === 'verified' ? 'badge-buyer' : 'badge-seller'}" style="padding: 4px 10px;">${user.kyc_status.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                        <label style="font-weight: 700; display: block; margin-bottom: 5px; color: #0b1e5b;">Telegram Chat ID (Editable)</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="editTelegramId" value="${user.telegram_chat_id || ''}" 
                                style="flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;" 
                                placeholder="Enter Chat ID">
                            <button onclick="updateTelegramID('${user.id}')" style="background: #0b1e5b; color: white; border: none; padding: 0 12px; border-radius: 6px; cursor: pointer;">
                                <i class="fa-solid fa-floppy-disk"></i>
                            </button>
                        </div>
                    </div>

                    <div style="font-weight: 700; margin-bottom: 10px; color: #0b1e5b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Security Operations</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button onclick="sendAuthLink('${user.email}', 'reset')" style="padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 12px; font-weight: 600; color: #1e293b;">
                            <i class="fa-solid fa-key" style="color: #f59e0b;"></i> Send Reset Link
                        </button>
                        <button onclick="sendAuthLink('${user.email}', 'magic')" style="padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 12px; font-weight: 600; color: #1e293b;">
                            <i class="fa-solid fa-wand-magic-sparkles" style="color: #3b82f6;"></i> Send Magic Link
                        </button>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true
        });

    } catch (err) {
        Swal.fire('System Error', 'Unable to retrieve encrypted file.', 'error');
    }
};

// --- Helper: Update Telegram ID ---
window.updateTelegramID = async (userId) => {
    const newId = document.getElementById('editTelegramId').value;
    const { error } = await supabase.from('profiles').update({ telegram_chat_id: newId }).eq('id', userId);
    
    if (error) {
        Swal.showValidationMessage(`Update failed: ${error.message}`);
    } else {
        Swal.fire({ icon: 'success', title: 'Telegram ID Synchronized', timer: 1500, showConfirmButton: false });
    }
};

// --- Helper: Auth Operations ---
window.sendAuthLink = async (email, type) => {
    const isReset = type === 'reset';
    const { error } = isReset 
        ? await supabase.auth.resetPasswordForEmail(email) 
        : await supabase.auth.signInWithOtp({ email });

    if (error) {
        Swal.fire('Protocol Failed', error.message, 'error');
    } else {
        Swal.fire('Success', `${isReset ? 'Reset' : 'Magic'} link transmitted to ${email}`, 'success');
    }
};


window.restrictUserAccess = async (userId) => {
    const { value: hours } = await Swal.fire({
        title: '<span style="color: #ef4444;">Execute Hard Ban</span>',
        input: 'number',
        inputLabel: 'How many hours should this user be locked out?',
        inputPlaceholder: 'e.g., 24, 168, 8760',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Lock Account',
        inputValidator: (value) => {
            if (!value) return 'You must enter a duration!';
        }
    });

    if (hours) {
        Swal.fire({ title: 'Locking Auth Account...', didOpen: () => Swal.showLoading() });

        try {
            const response = await fetch('https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/admin-ban', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({ 
                    userId: userId, 
                    action: 'ban', 
                    durationHours: parseInt(hours) 
                })
            });

            if (!response.ok) throw new Error('Ban request was rejected by the server.');

            Swal.fire('Success', `User has been hard-banned for ${hours} hours.`, 'success');
            loadUserDirectory(); // Refresh the table

        } catch (err) {
            Swal.fire('Operation Failed', err.message, 'error');
        }
    }
};

// --- Data Aggregators ---
async function loadIntelligenceMetrics() {
    try {
        const { data: users } = await supabase.from('profiles').select('role, balance');
        if (users) {
            document.getElementById('statBuyers').textContent = users.filter(u => u.role === 'buyer').length;
            document.getElementById('statSellers').textContent = users.filter(u => u.role === 'seller').length;
            document.getElementById('statAdmins').textContent = users.filter(u => u.role === 'admin').length;
            const totalFunds = users.reduce((sum, u) => sum + (u.balance || 0), 0);
            document.getElementById('statTotalFunds').textContent = `₦${totalFunds.toLocaleString()}`;
        }

        const { count: pendingAccs } = await supabase.from('verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        document.getElementById('statPendingAccs').textContent = pendingAccs || 0;

        const { data: withdrawals } = await supabase.from('withdrawals').select('amount').eq('status', 'pending');
        const pendingTotal = withdrawals?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
        document.getElementById('statPendingPayouts').textContent = `₦${pendingTotal.toLocaleString()}`;

        const { count: msgCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });
        document.getElementById('statMessages').textContent = msgCount || 0;

        const { count: disputeCount } = await supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open');
        document.getElementById('statDisputes').textContent = disputeCount || 0;

    } catch (err) {
        console.error("Metric Sync Error:", err);
    }
}

/**
 * ==========================================
 * IDENTITY VERIFICATION (KYC) SYSTEM
 * ==========================================
 */

/**
 * 1. LOAD VERIFICATION QUEUE
 * Pulls 'paid' requests and joins 'profiles' using the Foreign Key.
 */
window.loadPaidKYC = async () => {
    const tbody = document.getElementById('kycTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i> Accessing Linked Records...</td></tr>';

    try {
        const { data: verifications, error } = await supabase
            .from('user_verifications') 
            .select(`
                id,
                user_id,
                email,
                amount,
                created_at,
                dispatch_status,
                profiles:user_id (
                    telegram_chat_id, 
                    telegram_alerts
                )
            `)
            .eq('status', 'paid')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!verifications || verifications.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: #64748b;">No pending paid verifications found.</td></tr>';
            return;
        }

        tbody.innerHTML = verifications.map(v => {
            // Normalize the status string for comparison
            const dStatus = v.dispatch_status ? v.dispatch_status.trim().toLowerCase() : 'pending';

            // --- UI LOGIC FOR STATUS BADGE ---
            let statusBadge = '';
            if (dStatus === 'sent') {
                statusBadge = `<span class="badge" style="background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">LINK SENT</span>`;
            } else if (dStatus === 'rejected') {
                statusBadge = `<span class="badge" style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">REJECTED</span>`;
            } else {
                statusBadge = `<span class="badge" style="background: #fefce8; color: #854d0e; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">PENDING LINK</span>`;
            }

            // --- UI LOGIC FOR VERIFY BUTTON ---
            // Only allow verification if the link has been successfully sent
            const isDispatched = dStatus === 'sent';
            const verifyBtnStyle = isDispatched 
                ? 'background: #22c55e; cursor: pointer;' 
                : 'background: #cbd5e1; cursor: not-allowed; opacity: 0.6;';
            
            const verifyOnClick = isDispatched 
                ? `onclick="promoteToSeller('${v.user_id}', '${v.id}')"` 
                : `onclick="Swal.fire('Locked', 'You must dispatch a verification link before promoting this user.', 'info')"`;

            return `
                <tr class="kyc-row">
                    <td>
                        <div class="user-details">
                            <span style="font-weight:600; display:block; color: #0b1e5b;">${v.email}</span>
                            <span style="font-size: 10px; color: #64748b; font-family: monospace;">UID: ${v.user_id}</span>
                        </div>
                    </td>
                    <td><b style="color: #0b1e5b;">₦${parseFloat(v.amount).toLocaleString()}</b></td>
                    <td>${statusBadge}</td>
                    <td class="date-text">${new Date(v.created_at).toLocaleDateString()}</td>
                    <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="op-btn" onclick="openDispatchModal('${v.user_id}', '${v.email}', '${v.id}')" title="Dispatch Link" style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor:pointer;">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                        
                        <button class="op-btn" ${verifyOnClick} title="Verify & Promote" style="${verifyBtnStyle} color: white; border: none; padding: 8px 12px; border-radius: 4px;">
                            <i class="fa-solid fa-user-check"></i>
                        </button>

                        <button class="op-btn" onclick="rejectVerification('${v.user_id}', '${v.id}')" title="Reject Request" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor:pointer;">
                            <i class="fa-solid fa-user-xmark"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Verification Load Error:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color: #ef4444;">Error: ${err.message}</td></tr>`;
    }
};


/**
 * 2. REAL-TIME SEARCH FILTER
 */
window.filterKYCTable = () => {
    const input = document.getElementById('kycSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('.kyc-row');

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(input) ? '' : 'none';
    });
};

/**
 * 3. DISPATCH MODAL (With Session Auth)
 */
window.openDispatchModal = async (userId, email, requestId) => {
    const { value: link } = await Swal.fire({
        title: 'Dispatch Accmarket Link',
        input: 'url',
        inputLabel: `Sending verification to ${email}`,
        inputPlaceholder: 'https://verify.accmarket.name.ng/status/...',
        showCancelButton: true,
        confirmButtonColor: '#0b1e5b',
        confirmButtonText: 'Send to Email & Telegram'
    });

    if (link) {
        Swal.fire({ title: 'Broadcasting to Accmarket...', didOpen: () => Swal.showLoading() });

        try {
            // 1. Get Active Session Token
            const { data: { session } } = await supabase.auth.getSession();
            
            // 2. Fetch profile data for Telegram/Username
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('username, telegram_chat_id, telegram_alerts')
                .eq('id', userId)
                .single();

            if (profileError) throw new Error("Could not find user profile.");

            // 3. Trigger the Edge Function (Email & Telegram)
            const { error: funcError } = await supabase.functions.invoke('kyc-notifications', {
                body: { 
                    userId,
                    email, 
                    link, 
                    username: profile?.username,
                    action: 'dispatch_kyc',
                    telegramId: profile?.telegram_chat_id,
                    canSendTelegram: profile?.telegram_alerts || false 
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                }
            });

            if (funcError) throw new Error(`Function Error: ${funcError.message}`);

            // 4. UPDATE DISPATCH PROGRESS
            // We now update the explicit 'dispatch_status' column to 'sent'
            const { error: updateError } = await supabase
                .from('user_verifications')
                .update({ 
                    dispatch_status: 'sent',
                    updated_at: new Date().toISOString() 
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            console.log("Database updated: dispatch_status set to 'sent'");

            // 5. Success Feedback & Table Reload
            Swal.fire({
                icon: 'success',
                title: 'Dispatched!',
                text: 'Notification sent and status updated to LINK SENT.',
                confirmButtonColor: '#0b1e5b'
            });
            
            if (typeof loadPaidKYC === 'function') {
                loadPaidKYC(); // This will now catch the 'sent' status and show the green badge
            }

        } catch (err) {
            console.error("Dispatch Error:", err);
            Swal.fire('Notification Failed', err.message, 'error');
        }
    }
};


/**
 * 4. APPROVE & PROMOTE (With Session Auth)
 */
window.promoteToSeller = async (userId, requestId) => {
    const result = await Swal.fire({
        title: 'Verify & Promote?',
        text: "User will be upgraded to 'Seller' status on Accmarket.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        confirmButtonText: 'Yes, Promote'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Upgrading Profile...', didOpen: () => Swal.showLoading() });
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const { data: profile } = await supabase
                .from('profiles')
                .select('email, username, telegram_chat_id, telegram_alerts')
                .eq('id', userId)
                .single();

            // 1. Upgrade User Role
            await supabase.from('profiles')
                .update({ role: 'seller', kyc_status: 'verified' })
                .eq('id', userId);

            // 2. Update Verification Record 
            // We set status to 'verified' and dispatch_status to 'verified'
            const { error: updateError } = await supabase
                .from('user_verifications')
                .update({ 
                    status: 'verified', 
                    dispatch_status: 'verified', // Synchronize tracking
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            // 3. Notify the User (Rebranded to Accmarket in Edge Function)
            await supabase.functions.invoke('kyc-notifications', {
                body: { 
                    email: profile?.email,
                    username: profile?.username,
                    action: 'notify_approval',
                    telegramId: profile?.telegram_chat_id,
                    canSendTelegram: profile?.telegram_alerts || false 
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                }
            });

            Swal.fire('Approved', 'User is now a verified seller.', 'success');
            
            // Refresh table (This row will now disappear from the 'Paid' list)
            loadPaidKYC(); 
            
        } catch (err) {
            console.error("Promotion Error:", err);
            Swal.fire('Failed', err.message, 'error');
        }
    }
};
 

/**
 * 5. REJECT & NOTIFY (With Session Auth)
 */
window.rejectVerification = async (userId, requestId) => {
    const { value: reason } = await Swal.fire({
        title: 'Reject Accmarket Request?',
        input: 'textarea',
        inputLabel: 'Reason for rejection',
        inputPlaceholder: 'e.g. Please provide a clearer ID...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Mark as Rejected'
    });

    if (reason) {
        Swal.fire({ title: 'Updating Dispatch Status...', didOpen: () => Swal.showLoading() });
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const { data: profile } = await supabase
                .from('profiles')
                .select('email, username, telegram_chat_id, telegram_alerts')
                .eq('id', userId)
                .single();

            // KEEP status as 'paid', but change dispatch_status to 'rejected'
            const { error: updateError } = await supabase
                .from('user_verifications')
                .update({ 
                    dispatch_status: 'rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (updateError) throw updateError;
            
            // Send the notification via Edge Function
            await supabase.functions.invoke('kyc-notifications', {
                body: { 
                    email: profile?.email,
                    username: profile?.username,
                    reason: reason,
                    action: 'notify_rejection',
                    telegramId: profile?.telegram_chat_id,
                    canSendTelegram: profile?.telegram_alerts || false 
                },
                headers: {
                    Authorization: `Bearer ${session?.access_token}`
                }
            });

            Swal.fire('Rejected', 'User remains in the "Paid" list with a REJECTED status.', 'success');
            loadPaidKYC(); // Refresh to show the new badge

        } catch (err) {
            console.error("Rejection Error:", err);
            Swal.fire('Error', err.message, 'error');
        }
    }
};


/**
 * OFFICIAL BANNED USERS SECTION
 * Logic for managing users with an official Supabase Auth ban
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
                <tr>
                    <td>
                        <div class="user-details">
                            <span style="font-weight:600; display:block; color: #0b1e5b;">${u.username || u.email}</span>
                            <span style="font-size: 10px; color: #64748b; font-family: monospace;">UID: ${u.id}</span>
                        </div>
                    </td>
                    <td>
                        <span style="color: #991b1b; font-size: 11px; font-weight: 600; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">
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
 * UNBAN OPERATION (LIFT OFFICIAL BAN)
 * Calls the Edge Function to reset ban_duration to 'none'
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
            // Calling your Edge Function 'manage-bans'
            const { data, error } = await supabase.functions.invoke('admin-ban', {
                body: { 
                    userId: userId, 
                    action: 'unban' 
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

            // Refresh the table
            loadRestrictedUsers();

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

window.filterBannedTable = () => {
    const filter = document.getElementById('bannedSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#bannedTableBody tr');
    
    rows.forEach(row => {
        // Skip the "No accounts found" or "Loading" rows (they don't have 5 cells)
        if (row.cells.length < 5) return;
        
        // Target the first column: Identity (Username/UID)
        const identity = row.cells[0].textContent.toLowerCase();
        
        if (identity.includes(filter)) {
            row.style.display = ""; // Show
        } else {
            row.style.display = "none"; // Hide
        }
    });
};

/**
 * SYSTEM LIVE INTELLIGENCE FEED (v4.0)
 * Aggregates: Wallet, Withdrawals, KYC, New Users, Blogs, and Chat Spaces.
 * No action buttons - Pure AI-monitored observation.
 */
window.loadAccountAudits = async () => {
    const tbody = document.getElementById('verificationTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center; padding:60px;">
                <i class="fa-solid fa-satellite-dish fa-spin fa-2xl" style="color: #0b1e5b; margin-bottom: 15px; display: block;"></i>
                <div style="font-weight: 800; color: #0b1e5b; letter-spacing: 1px;">SYNCING SYSTEM LEDGERS...</div>
                <div style="font-size: 11px; color: #64748b; font-family: monospace;">Accessing: Wallet | Withdrawals | KYC | Chats | Logs</div>
            </td>
        </tr>`;

    try {
        // 1. DATA ACQUISITION
        const [wallet, withdrawals, verifications, newUsers, blogs, chats] = await Promise.all([
            supabase.from('wallet').select('*, profiles(username)').order('created_at', { ascending: false }).limit(8),
            supabase.from('withdrawals').select('*, profiles(username)').order('created_at', { ascending: false }).limit(8),
            supabase.from('user_verifications').select('*, profiles(username)').order('created_at', { ascending: false }).limit(8),
            supabase.from('profiles').select('username, created_at, id, trust_score').order('created_at', { ascending: false }).limit(8),
            supabase.from('blogs').select('title, author, created_at').order('created_at', { ascending: false }).limit(3),
            // Assuming 'conversations' table handles chat spaces
            supabase.from('conversations').select('*, buyer:profiles!buyer_id(username), seller:profiles!seller_id(username)').order('created_at', { ascending: false }).limit(8)
        ]);

        let events = [];

        // --- Process Wallet Credits ---
        wallet.data?.forEach(w => events.push({
            time: new Date(w.created_at),
            type: 'WALLET',
            icon: '<i class="fa-solid fa-circle-arrow-down" style="color: #22c55e;"></i>',
            desc: `Credit: <b>${w.profiles?.username || 'User'}</b> received ₦${w.amount} (<i>${w.note}</i>)`,
            status: `<span style="color:#166534; font-weight:700;">SUCCESS</span>`,
            risk: w.amount > 20000 ? 'MODERATE' : 'LOW'
        }));

        // --- Process Withdrawals ---
        withdrawals.data?.forEach(wd => events.push({
            time: new Date(wd.created_at),
            type: 'WITHDRAWAL',
            icon: '<i class="fa-solid fa-bank" style="color: #ef4444;"></i>',
            desc: `Payout: <b>${wd.profiles?.username || 'User'}</b> requested ₦${wd.amount} via ${wd.method}`,
            status: `<span style="color:#991b1b; font-weight:700;">${wd.status.toUpperCase()}</span>`,
            risk: wd.status === 'pending' ? 'HIGH' : 'LOW'
        }));

        // --- Process KYC ---
        verifications.data?.forEach(v => events.push({
            time: new Date(v.created_at),
            type: 'KYC',
            icon: '<i class="fa-solid fa-user-shield" style="color: #7c3aed;"></i>',
            desc: `Verification request: <b>${v.email}</b> paid ₦${v.amount}`,
            status: `<span style="color:#7e22ce; font-weight:700;">${v.status.toUpperCase()}</span>`,
            risk: 'LOW'
        }));

        // --- Process Chat Spaces ---
        chats.data?.forEach(c => events.push({
            time: new Date(c.created_at),
            type: 'CHAT',
            icon: '<i class="fa-solid fa-comments" style="color: #3b82f6;"></i>',
            desc: `New Space: <b>${c.buyer?.username}</b> & <b>${c.seller?.username}</b> initiated trade chat`,
            status: `<span style="color:#1e40af; font-weight:700;">ACTIVE</span>`,
            risk: 'LOW'
        }));

        // --- Process New Users ---
        newUsers.data?.forEach(u => events.push({
            time: new Date(u.created_at),
            type: 'NEW USER',
            icon: '<i class="fa-solid fa-user-plus" style="color: #0b1e5b;"></i>',
            desc: `Registration: <b>${u.username || 'Anonymous'}</b> created a profile`,
            status: `<span style="color:#64748b;">SCORE: ${u.trust_score || 0}%</span>`,
            risk: (u.trust_score || 0) < 50 ? 'REVIEW' : 'LOW'
        }));

        // --- Process Blogs ---
        blogs.data?.forEach(b => events.push({
            time: new Date(b.created_at),
            type: 'BLOG',
            icon: '<i class="fa-solid fa-newspaper" style="color: #f59e0b;"></i>',
            desc: `Editorial: "<b>${b.title}</b>" published by ${b.author}`,
            status: `PUBLISHED`,
            risk: 'NONE'
        }));

        // 2. SORT BY RECENT
        events.sort((a, b) => b.time - a.time);

        // 3. RENDER FEED
        tbody.innerHTML = events.map(e => {
            // AI Intelligence Color Logic
            let aiColor = '#94a3b8'; // Default grey
            if (e.risk === 'HIGH') aiColor = '#ef4444';
            if (e.risk === 'MODERATE') aiColor = '#f59e0b';
            if (e.risk === 'LOW') aiColor = '#22c55e';

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td>
                        <div style="display:flex; align-items:center; gap:10px;">
                            ${e.icon}
                            <span style="font-size:10px; font-weight:900; color:#64748b; letter-spacing:0.5px;">${e.type}</span>
                        </div>
                    </td>
                    <td style="font-size:13px; color:#0b1e5b; font-weight:500;">${e.desc}</td>
                    <td style="font-size:11px; font-weight:800;">${e.status}</td>
                    <td class="date-text" style="font-size:11px; color:#64748b;">
                        ${e.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td style="text-align: right;">
                        <div style="display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:900; color:${aiColor}; font-family: monospace;">
                            <i class="fa-solid fa-robot"></i> ${e.risk}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Audit System Failure:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:#ef4444;">SYSTEM OFFLINE: ${err.message}</td></tr>`;
    }
};

/**
 * COMMUNICATION INTELLIGENCE (AI-POWERED)
 * Pulls conversation logs and triggers Groq Llama 3 analysis on demand.
 */
window.loadCommunicationLogs = async () => {
    const tbody = document.getElementById('conversationsTableBody');
    if (!tbody) return;

    // High-tech sync state
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center; padding:60px;">
                <i class="fa-solid fa-microchip fa-spin fa-2xl" style="color: #0b1e5b; margin-bottom: 20px; display: block;"></i>
                <div style="font-weight: 800; color: #0b1e5b; letter-spacing: 1px;">SYNCHRONIZING SECURE CHANNELS...</div>
                <div style="font-size: 11px; color: #64748b; font-family: monospace;">Accessing Encrypted Communication Logs</div>
            </td>
        </tr>`;

    try {
        const { data: channels, error } = await supabase
            .from('conversations')
            .select(`id, created_at, buyer:profiles!buyer_id(username), seller:profiles!seller_id(username)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!channels || channels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#64748b;">No active communication channels found.</td></tr>';
            return;
        }

        tbody.innerHTML = channels.map(c => `
            <tr id="row-${c.id}" style="border-bottom: 1px solid #f1f5f9; transition: 0.3s;">
                <td><span style="font-family:monospace; font-size:10px; opacity:0.6;">#${c.id.substring(0,8)}</span></td>
                <td>
                    <div style="font-size:13px; font-weight:600;">
                        <span style="color:#2563eb;">${c.buyer?.username || 'Buyer'}</span> 
                        <i class="fa-solid fa-right-left" style="margin:0 8px; opacity:0.2; font-size: 10px;"></i>
                        <span style="color:#7c3aed;">${c.seller?.username || 'Seller'}</span>
                    </div>
                </td>
                <td id="last-msg-${c.id}" style="font-size:12px; color:#64748b; font-style:italic;">
                    Manual audit required for security verdict.
                </td>
                <td class="date-text" style="font-size:11px; color: #94a3b8;">
                    ${new Date(c.created_at).toLocaleDateString()}
                </td>
                <td style="text-align: right;" id="status-${c.id}">
                    <button onclick="runAiAudit('${c.id}')" 
                            title="Run AI Security Audit"
                            style="background: #f1f5f9; color: #0b1e5b; border: none; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-microchip"></i>
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Feed Error:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">FEED ERROR: ${err.message}</td></tr>`;
    }
};

/**
 * THE TRIGGER: Gathers history and calls the Edge Function with JWT
 */
window.runAiAudit = async (chatId) => {
    const statusCell = document.getElementById(`status-${chatId}`);
    const row = document.getElementById(`row-${chatId}`);
    if (!statusCell) return;

    // 1. Robot "Thinking" State
    statusCell.innerHTML = `
        <div style="text-align: right;">
            <i class="fa-solid fa-robot fa-spin-pulse" style="color: #0b1e5b;"></i>
            <span style="font-size: 8px; display: block; color: #64748b; font-weight: bold; margin-top: 2px;">AUDITING</span>
        </div>`;

    try {
        // 2. Fetch transcript from 'messages' table
        const { data: messages, error: msgError } = await supabase
            .from('messages')
            .select('content, sender_id')
            .eq('conversation_id', chatId)
            .order('created_at', { ascending: true });

        if (msgError) throw msgError;
        const transcriptText = messages.map(m => `User: ${m.content}`).join('\n');

        // 3. GET JWT FROM SESSION
        // We need the access_token to prove to Supabase that an Admin is calling this.
        const { data: { session } } = await supabase.auth.getSession();
        const jwt = session?.access_token;

        if (!jwt) throw new Error("No active session found");

        // 4. CALL THE URL DIRECTLY
        const response = await fetch('https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/ai-chat-auditor', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`, // The JWT for authentication
                'apikey': supabase.supabaseKey   // The project's public anon key for routing
            },
            body: JSON.stringify({ transcript: transcriptText })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Audit Request Failed');

        // 5. PROCESS VERDICT
        let icon = 'fa-circle-check';
        let color = '#22c55e';
        let bg = '';

        if (data.verdict === 'DANGEROUS') {
            icon = 'fa-triangle-exclamation';
            color = '#ef4444';
            bg = '#fff1f2';
        } else if (data.verdict === 'SUSPICIOUS') {
            icon = 'fa-eye';
            color = '#f59e0b';
            bg = '#fffbeb';
        }

        // Apply highlights
        row.style.background = bg;
        statusCell.innerHTML = `
            <div title="${data.reason}" style="color: ${color}; cursor: help; display: flex; flex-direction: column; align-items: flex-end;">
                <i class="fa-solid ${icon} fa-xl"></i>
                <span style="font-size: 8px; font-weight: 900; margin-top: 4px;">${data.verdict}</span>
            </div>
        `;

    } catch (err) {
        console.error("AI Audit Error:", err);
        statusCell.innerHTML = `
            <button onclick="runAiAudit('${chatId}')" style="background:none; border:none; color:red; cursor:pointer;">
                <i class="fa-solid fa-circle-exmark"></i>
                <small style="display:block; font-size:7px;">RETRY</small>
            </button>`;
    }
};


window.runAiAudit = async (chatId) => {
    const statusCell = document.getElementById(`status-${chatId}`);
    const row = document.getElementById(`row-${chatId}`);
    if (!statusCell) return;

    // 1. Initial State
    statusCell.innerHTML = `<i class="fa-solid fa-robot fa-spin-pulse" style="color: #0b1e5b;"></i>`;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // 2. Fetch fresh messages with sender_id to distinguish between Human and System
        const { data: messages, error: fetchError } = await supabase
            .from('messages')
            .select('content, sender_id')
            .eq('conversation_id', chatId)
            .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;

        // 3. NOISE FILTERING
        // We filter out the standard Escrow system messages so the AI doesn't get confused
        const humanMessages = messages.filter(m => {
            const content = m.content.toLowerCase();
            const isSystem = content.includes('funds are now held in escrow') || 
                             content.includes('seller, please send the login details') ||
                             content.includes('payment confirmed');
            return !isSystem && m.sender_id !== null; // Also ignore null senders (usually system)
        });

        // 4. FAST PASS: If chat is empty after filtering, it's SAFE
        if (humanMessages.length === 0) {
            statusCell.innerHTML = `
                <div style="color: #22c55e; text-align: right;">
                    <i class="fa-solid fa-circle-check"></i> 
                    <span style="font-size: 10px; font-weight: 800; display: block;">SAFE</span>
                    <div style="color: #64748b; font-size: 8px;">No human activity yet.</div>
                </div>`;
            return;
        }

        const history = humanMessages.map(m => `User: ${m.content}`).join('\n');

        // 5. Invoke Edge Function
        const { data, error } = await supabase.functions.invoke('ai-chat-auditor', {
            body: { transcript: history }, 
            headers: {
                Authorization: `Bearer ${session?.access_token}`
            }
        });

        if (error) throw error;

        // 6. UI Render based on Verdict
        const isDanger = data.verdict === 'DANGEROUS';
        const color = isDanger ? '#ef4444' : (data.verdict === 'SUSPICIOUS' ? '#f59e0b' : '#22c55e');
        const icon = isDanger ? 'fa-triangle-exclamation' : (data.verdict === 'SUSPICIOUS' ? 'fa-eye' : 'fa-circle-check');

        if (row && isDanger) row.style.background = '#fff1f2';

        statusCell.innerHTML = `
            <div title="${data.reason}" style="color: ${color}; text-align: right; cursor: help;">
                <i class="fa-solid ${icon}"></i> 
                <span style="font-size: 10px; font-weight: 800; display: block;">${data.verdict}</span>
                <div style="color: #64748b; font-weight: 400; font-size: 8px; line-height: 1.1;">${data.reason}</div>
            </div>`;

    } catch (err) {
        console.error("Audit Error:", err);
        statusCell.innerHTML = `
            <div style="color:red; cursor:pointer;" onclick="runAiAudit('${chatId}')">
                <i class="fa-solid fa-circle-exclamation"></i>
                <div style="font-size: 8px;">RETRY</div>
            </div>`;
    }
};


/**
 * 1. Load Payout Requests from Database
 */
window.loadWithdrawalRequests = async () => {
    const tbody = document.getElementById('payoutsTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align:center; padding: 30px;">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 24px; color: #0b1e5b;"></i>
                <div style="margin-top: 10px; font-size: 13px; color: #64748b;">Fetching payout requests...</div>
            </td>
        </tr>`;

    try {
        const { data: requests, error } = await supabase
            .from('withdrawals')
            .select(`*, profiles(username, full_name)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">No withdrawal requests found.</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(r => {
            const isPending = r.status === 'pending';
            
            // Status Badge Config
            const statusMap = {
                pending: { color: '#f59e0b', bg: '#fffbeb', icon: 'fa-clock' },
                success: { color: '#22c55e', bg: '#f0fdf4', icon: 'fa-check-circle' },
                rejected: { color: '#ef4444', bg: '#fef2f2', icon: 'fa-times-circle' }
            };
            const config = statusMap[r.status] || statusMap.pending;

            return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: 0.3s;">
                <td style="padding: 14px 12px;">
                    <div style="font-weight:700; color:#0b1e5b;">${r.profiles?.username || 'User'}</div>
                    <div style="font-size:11px; color:#64748b;">${r.profiles?.full_name || ''}</div>
                </td>
                <td style="padding: 14px 12px;">
                    <div style="font-size:12px; color:#1e293b; line-height:1.4;">
                        <i class="fa-solid fa-university" style="font-size:11px; color:#94a3b8; margin-right: 5px;"></i> 
                        ${r.details || 'No details'}
                    </div>
                </td>
                <td style="padding: 14px 12px; font-weight:800; color:#0b1e5b;">₦${parseFloat(r.amount).toLocaleString()}</td>
                <td style="padding: 14px 12px; font-size:11px; color:#64748b;">${new Date(r.created_at).toLocaleDateString()}</td>
                <td style="padding: 14px 12px;">
                    <span style="background:${config.bg}; color:${config.color}; padding:5px 10px; border-radius:8px; font-size:10px; font-weight:800; text-transform:uppercase; display:inline-flex; align-items:center; gap:5px;">
                        <i class="fa-solid ${config.icon}"></i> ${r.status}
                    </span>
                </td>
                <td style="padding: 14px 12px; text-align: right;">
                    ${isPending ? `
                        <div style="display:flex; gap:10px; justify-content:flex-end;">
                            <button onclick="handleManualStatus('${r.id}', 'success')" 
                                    style="background:#22c55e; color:white; border:none; width:35px; height:35px; border-radius:10px; cursor:pointer; transition:0.2s; box-shadow: 0 4px 10px rgba(34, 197, 94, 0.2);"
                                    title="Approve & Mark as Paid">
                                <i class="fa-solid fa-check"></i>
                            </button>
                            <button onclick="handleManualStatus('${r.id}', 'rejected')" 
                                    style="background:#ef4444; color:white; border:none; width:35px; height:35px; border-radius:10px; cursor:pointer; transition:0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);"
                                    title="Reject Request">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    ` : `
                        <div style="color:#cbd5e1; font-size:14px; font-weight:600;">
                            <i class="fa-solid fa-lock"></i> Settled
                        </div>
                    `}
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error("Fetch error:", err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">Failed to load requests. Check console.</td></tr>';
    }
};

/**
 * Helper to send Telegram alerts to the User (Recipient)
 */
const sendUserTelegramAlert = async (chatId, username, amount, status) => {
    const botToken = '8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg';
    const emoji = status === 'success' ? '✅' : '❌';
    
    const message = `
🔔 *Withdrawal Update*
Hello ${username},
Your withdrawal of ₦${parseFloat(amount).toLocaleString()} has been ${status.toUpperCase()} ${emoji}.
${status === 'rejected' ? 'The funds have been returned to your wallet.' : 'Please check your wallet.'}
    `.trim();

    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown'
            })
        });
    } catch (err) {
        console.error("User Telegram Alert Failed:", err);
    }
};

/**
 * Main Status Handler
 */
window.handleManualStatus = async (withdrawalId, newStatus) => {
    const isApprove = newStatus === 'success';
    
    const result = await Swal.fire({
        title: isApprove ? 'Confirm Payment' : 'Reject Request',
        text: `Mark this withdrawal as ${newStatus}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: isApprove ? '#22c55e' : '#ef4444',
        confirmButtonText: 'Yes, Proceed',
        target: 'body'
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: 'Processing...',
        allowOutsideClick: false,
        showConfirmButton: false,
        target: 'body',
        didOpen: () => Swal.showLoading()
    });

    try {
        // --- STEP 1: Fetch Withdrawal & Recipient's Profile Preferences ---
        const { data: withdrawal, error: fetchError } = await supabase
            .from('withdrawals')
            .select(`
                transaction_id, 
                user_id, 
                amount, 
                profiles(username, telegram_chat_id, telegram_alerts)
            `)
            .eq('id', withdrawalId)
            .single();

        if (fetchError || !withdrawal) throw new Error("Withdrawal record not found.");

        const recipient = withdrawal.profiles;

        // --- STEP 2: Update the Wallet Table ---
        if (withdrawal.transaction_id) {
            await supabase
                .from('wallet')
                .update({ status: newStatus })
                .eq('id', withdrawal.transaction_id);
        }

        // --- STEP 3: Update the Withdrawals Table ---
        const { error: withdrawUpdateError } = await supabase
            .from('withdrawals')
            .update({ 
                status: newStatus, 
                processed_at: new Date().toISOString() 
            })
            .eq('id', withdrawalId);

        if (withdrawUpdateError) throw withdrawUpdateError;

        // --- STEP 4: Insert In-App Notification (Always) ---
        const notifTitle = isApprove ? "Withdrawal Approved" : "Withdrawal Rejected";
        const notifMsg = isApprove 
            ? `Your withdrawal of ₦${parseFloat(withdrawal.amount).toLocaleString()} has been paid.` 
            : `Your withdrawal of ₦${parseFloat(withdrawal.amount).toLocaleString()} was rejected and refunded.`;

        await supabase.from('notifications').insert([{
            user_id: withdrawal.user_id,
            title: `💰 ${notifTitle}`,
            message: notifMsg,
            icon: isApprove ? 'fas fa-check-circle' : 'fas fa-times-circle',
            is_read: false,
            type: 'payout'
        }]);

        // --- STEP 5: Handle Refund if Rejected ---
        if (newStatus === 'rejected') {
            await supabase.rpc('add_wallet_balance', {
                target_user_id: withdrawal.user_id,
                amount_to_add: Math.abs(parseFloat(withdrawal.amount))
            });
        }

        // --- STEP 6: Send Telegram Alert if USER has it enabled ---
        if (recipient?.telegram_alerts && recipient?.telegram_chat_id) {
            sendUserTelegramAlert(
                recipient.telegram_chat_id,
                recipient.username,
                withdrawal.amount,
                newStatus
            );
        }

        Swal.fire({
            title: 'Successfully Updated',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            target: 'body'
        });

        loadWithdrawalRequests();

    } catch (err) {
        console.error("Update Error:", err);
        Swal.fire({ title: 'Update Failed', text: err.message, icon: 'error', target: 'body' });
    }
};

// ---ledger report---
// Helper function to copy text
window.copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `${label} Copied!`,
            showConfirmButton: false,
            timer: 1500
        });
    });
};

window.loadLedgerReports = async () => {
    const tbody = document.getElementById('ledgerTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading Ledger...</td></tr>';

    try {
        const { data: logs, error } = await supabase
            .from('wallet')
            .select(`*, profiles(username)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = logs.map(log => {
            const isNegative = parseFloat(log.amount) < 0;
            const amountFormatted = Math.abs(parseFloat(log.amount)).toLocaleString();
            
            return `
            <tr>
                <td style="font-size: 11px; color: #64748b;">
                    ${new Date(log.created_at).toLocaleDateString()}
                </td>
                <td>
                    <div style="font-weight: 700; color: #0b1e5b;">${log.profiles?.username || 'User'}</div>
                    <div onclick="copyToClipboard('${log.user_id}', 'User UID')" 
                         style="font-size: 10px; color: #94a3b8; cursor: pointer; text-decoration: underline;" 
                         title="Click to copy UID">
                         ID: ${log.user_id.substring(0, 8)}... <i class="fa-regular fa-copy"></i>
                    </div>
                </td>
                <td>
                    <div onclick="copyToClipboard('${log.id}', 'Transaction ID')" 
                         style="font-size: 11px; color: #475569; cursor: pointer; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; display: inline-block;" 
                         title="Click to copy Transaction ID">
                         #${log.id.substring(0, 12)} <i class="fa-regular fa-copy" style="font-size: 9px;"></i>
                    </div>
                </td>
                <td>
                    <span style="font-size: 10px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 800;">
                        ${log.type.toUpperCase()}
                    </span>
                </td>
                <td style="font-weight: 800; color: ${isNegative ? '#ef4444' : '#22c55e'};">
                    ${isNegative ? '-' : '+'}₦${amountFormatted}
                </td>
                <td>
                    <span style="font-size: 10px; font-weight: 800; color: ${log.status === 'success' ? '#22c55e' : '#f59e0b'};">
                        ${log.status.toUpperCase()}
                    </span>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error("Ledger Error:", err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading ledger.</td></tr>';
    }
};

// Toggle Visibility of targeting inputs
window.toggleTargetFields = () => {
    const type = document.getElementById('targetType').value;
    document.getElementById('singleUserInput').style.display = type === 'single' ? 'block' : 'none';
    document.getElementById('roleSelectInput').style.display = type === 'role' ? 'block' : 'none';
};

window.processBroadcast = async () => {
    const title = document.getElementById('broadcastTitle').value.trim();
    const message = document.getElementById('broadcastMessage').value.trim();
    const targetType = document.getElementById('targetType').value;
    
    // Channels
    const useInApp = document.getElementById('chanInApp').checked;
    const useTelegram = document.getElementById('chanTelegram').checked;
    const useEmail = document.getElementById('chanEmail').checked;

    if (!title || !message) return Swal.fire('Error', 'Subject and Message are required.', 'error');
    if (!useInApp && !useTelegram && !useEmail) return Swal.fire('Error', 'Select at least one channel.', 'warning');

    Swal.fire({ 
        title: 'Initializing Broadcast', 
        text: 'Preparing transmission...', 
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading() 
    });

    try {
        // 1. Resolve Target Users
        let query = supabase.from('profiles').select('id, email, telegram_chat_id, telegram_alerts');

        if (targetType === 'single') {
            const uid = document.getElementById('targetUID').value.trim();
            if (!uid) throw new Error("Please provide a valid User UID");
            query = query.eq('id', uid);
        } else if (targetType === 'role') {
            const role = document.getElementById('targetRole').value;
            query = query.eq('role', role);
        }

        const { data: targets, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        if (!targets || targets.length === 0) throw new Error("No users found matching these criteria.");

        const promises = [];
        const emailList = [];

        // 2. Queue Channel Tasks
        targets.forEach(user => {
            // Channel: In-App
            if (useInApp) {
                promises.push(supabase.from('notifications').insert({
                    user_id: user.id,
                    title: title,
                    message: message,
                    icon: 'fas fa-bullhorn',
                    type: 'broadcast'
                }));
            }

            // Channel: Telegram
            if (useTelegram && user.telegram_chat_id && user.telegram_alerts !== false) {
                promises.push(sendTelegramRaw(user.telegram_chat_id, `🔔 *${title}*\n\n${message}`));
            }

            // Channel: Email Collection
            if (useEmail && user.email) {
                emailList.push(user.email);
            }
        });

        // 3. Trigger Edge Function for Emails
        // Note: supabase.functions.invoke automatically includes the Authorization Bearer token
        if (useEmail && emailList.length > 0) {
            promises.push(
                supabase.functions.invoke('Broadcast', {
                    body: { 
                        emails: emailList, 
                        title: title, 
                        message: message 
                    }
                })
            );
        }

        // 4. Wait for results
        const results = await Promise.all(promises);

        // Check if the Edge Function call returned an error in its response body
        const edgeResponse = results.find(r => r && r.error);
        if (edgeResponse && edgeResponse.error) {
            console.error("Edge Function Error:", edgeResponse.error);
            throw new Error("Email service encountered an error.");
        }

        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: `Broadcast sent to ${targets.length} users.`,
            confirmButtonColor: '#0b1e5b'
        });

        // Clean up
        document.getElementById('broadcastTitle').value = '';
        document.getElementById('broadcastMessage').value = '';

    } catch (err) {
        console.error("Broadcast Error:", err);
        Swal.fire('Failed', err.message, 'error');
    }
};

// Raw Telegram Fetch
async function sendTelegramRaw(chatId, text) {
    const botToken = '8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg';
    return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' })
    });
}


// --- Platform News Global Logic ---

/** * CSS FIX FOR Z-INDEX 
 * Adding this snippet to ensure SweetAlert is always on top of your modal
 */
const style = document.createElement('style');
style.innerHTML = `.swal2-container { z-index: 999999 !important; }`;
document.head.appendChild(style);

window.loadBlogs = async function() {
    const tbody = document.getElementById('blogTableBody');
    if (!tbody) return;

    const { data: blogs, error } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });
    if (error) return console.error(error);

    tbody.innerHTML = blogs.map(post => {
        // ✅ Detect if it's a video by checking the video_url field
        const hasVideo = post.video_url && post.video_url.trim() !== "";
        
        return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 15px;">
                ${hasVideo ? 
                    `<div style="width:45px; height:30px; background:#0b1e5b; border-radius:4px; display:flex; align-items:center; justify-content:center; color:white;" title="Video Post">
                        <i class="fa-solid fa-video"></i>
                     </div>` : 
                    `<img src="${post.image_url}" style="width:45px; height:30px; object-fit:cover; border-radius:4px;" onerror="this.src='https://via.placeholder.com/45x30?text=Empty'">`
                }
            </td>
            <td style="padding:15px; font-weight:600; color:#1e293b;">${post.title}</td>
            <td style="padding:15px; color:#64748b;">${post.author}</td>
            <td style="padding:15px; font-size:12px;">${new Date(post.created_at).toLocaleDateString()}</td>
            <td style="padding:15px; text-align:center;">
                <button onclick="window.editBlog('${post.id}')" style="color:#0b1e5b; background:none; border:none; cursor:pointer; margin-right:10px;"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="window.deleteBlogPost('${post.id}')" style="color:#ef4444; background:none; border:none; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
};

window.openBlogModal = function() {
    document.getElementById('editBlogId').value = "";
    document.getElementById('blogTitle').value = "";
    document.getElementById('blogAuthor').value = "Admin";
    document.getElementById('blogContent').value = "";
    document.getElementById('blogFile').value = "";
    document.getElementById('modalTitle').innerText = "Create News Post";
    document.getElementById('blogModal').style.display = "flex";
};

window.closeBlogModal = function() {
    document.getElementById('blogModal').style.display = "none";
};

window.editBlog = async function(id) {
    const { data: post } = await supabase.from('blogs').select('*').eq('id', id).single();
    if (post) {
        document.getElementById('editBlogId').value = post.id;
        document.getElementById('blogTitle').value = post.title;
        document.getElementById('blogAuthor').value = post.author;
        document.getElementById('blogContent').value = post.content;
        document.getElementById('blogFile').value = ""; 
        document.getElementById('modalTitle').innerText = "Edit News Post";
        document.getElementById('blogModal').style.display = "flex";
    }
};

window.saveBlogPost = async function() {
    const id = document.getElementById('editBlogId').value;
    const title = document.getElementById('blogTitle').value;
    const author = document.getElementById('blogAuthor').value;
    const content = document.getElementById('blogContent').value;
    const file = document.getElementById('blogFile').files[0];

    if (!title || !content) {
        return Swal.fire({ icon: "error", title: "Required", text: "Title and content are missing" });
    }
    
    if (!id && !file) {
        return Swal.fire({ icon: "warning", title: "Media Required", text: "Please upload an image or video" });
    }

    // Loading State
    Swal.fire({ title: 'Processing...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        let uploadedUrl = null;
        let isVideoFile = false;
        
        if (file) {
            // ✅ Improved detection: Check MIME type and extension
            isVideoFile = file.type.startsWith('video/') || file.name.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
            
            const folder = isVideoFile ? 'videos' : 'images';
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const path = `${folder}/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('blog-media').upload(path, file);
            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('blog-media').getPublicUrl(path);
            uploadedUrl = urlData.publicUrl;
        }

        const payload = { title, author, content };
        
        // ✅ Media Mapping: Save to the correct DB column
        if (uploadedUrl) {
            if (isVideoFile) {
                payload.video_url = uploadedUrl;
                payload.image_url = ""; // Clear image link if we upload a video
            } else {
                payload.image_url = uploadedUrl;
                payload.video_url = ""; // Clear video link if we upload an image
            }
        }

        const { error: dbError } = id 
            ? await supabase.from('blogs').update(payload).eq('id', id)
            : await supabase.from('blogs').insert([payload]);

        if (dbError) throw dbError;

        // ✅ Success logic: Close modal before showing success alert
        window.closeBlogModal();
        Swal.fire({ icon: "success", title: "Success", text: "News post saved!" });
        window.loadBlogs();

    } catch (err) {
        console.error(err);
        Swal.fire({ icon: "error", title: "Error", text: err.message || "Failed to save post" });
    }
};

window.deleteBlogPost = async function(id) {
    const { isConfirmed } = await Swal.fire({
        title: 'Delete Post?',
        text: "This action cannot be undone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Yes, delete it'
    });

    if (isConfirmed) {
        const { error } = await supabase.from('blogs').delete().eq('id', id);
        if (!error) {
            Swal.fire("Deleted", "Post removed.", "success");
            window.loadBlogs();
        } else {
            Swal.fire("Error", "Could not delete post", "error");
        }
    }
};


// --- Listing Moderation Logic ---

// ✅ 1. Load ONLY Pending Listings
window.loadListingRequests = async function() {
    const tbody = document.getElementById('listingsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">
        <i class="fas fa-spinner fa-spin"></i> Loading pending requests...</td></tr>`;

    const { data: listings, error } = await supabase
        .from('verifications')
        .select('*')
        .eq('status', 'pending')
        .order('submitted_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444; text-align:center;">Error: ${error.message}</td></tr>`;
        return;
    }

    if (listings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:50px; color:#64748b;">
            <i class="fa-solid fa-check-circle" style="font-size:30px; color:#10b981; display:block; margin-bottom:10px;"></i>
            No pending listing requests.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    listings.forEach(item => {
        const details = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid #f1f5f9";
        
  row.innerHTML = `
    <td style="padding:15px;">
        <div style="width:75px; height:50px; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0; background:#000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <img src="${item.screenshot_url}" style="width:100%; height:100%; object-fit:contain; cursor:pointer;" 
                 onclick="window.open('${item.screenshot_url}')" title="View Full Proof">
        </div>
    </td>
    <td style="padding:15px; font-weight:700; color:#1e293b;">${details.platform?.toUpperCase() || 'N/A'}</td>
    <td style="padding:15px; font-weight:700; color:#059669;">₦${Number(details.price).toLocaleString()}</td>
    <td style="padding:15px;">
        <a href="${details.profile_link}" target="_blank" class="link-icon-btn">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Visit Profile
        </a>
    </td>
    <td style="padding:15px;"><span class="badge bg-warning" style="padding:5px 10px; border-radius:5px;">PENDING</span></td>
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
};

// ✅ 2. Open Real Modal (Editable: Region, Account Age, Description)
window.viewAndEditListing = async function(id) {
    const modal = document.getElementById('listingReviewModal');
    const modalBody = document.getElementById('modalBody');
    const saveBtn = document.getElementById('saveDetailsBtn');
    
    modal.style.display = 'block';
    modalBody.innerHTML = '<p>Loading details...</p>';

    const { data: item } = await supabase.from('verifications').select('*').eq('id', id).single();
    if (!item) return;

    const details = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
    const editableFields = ['region', 'account_age', 'description'];

    modalBody.innerHTML = "";
    Object.entries(details).forEach(([key, value]) => {
        const isEditable = editableFields.includes(key);
        const container = document.createElement('div');
        container.style.marginBottom = "15px";
        
        container.innerHTML = `
            <label style="display:block; font-size:11px; font-weight:800; color:#64748b; margin-bottom:5px; text-transform:uppercase;">
                ${key.replace(/_/g, ' ')} ${isEditable ? '<span style="color:#2563eb;">(Editable)</span>' : '🔒'}
            </label>
            ${isEditable ? 
                `<input type="text" id="modal_edit_${key}" value="${value}" style="width:100%; padding:10px; border:2px solid #0b1e5b; border-radius:8px; box-sizing:border-box;">` :
                `<div style="padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:14px; color:#64748b;">${value}</div>`
            }
        `;
        modalBody.appendChild(container);
    });

    saveBtn.onclick = () => window.saveListingChanges(id, details);
};

// ✅ 3. Save Changes & Close Modal
window.saveListingChanges = async function(id, originalData) {
    const updatedData = { ...originalData };
    const editableFields = ['region', 'account_age', 'description'];

    editableFields.forEach(key => {
        const input = document.getElementById(`modal_edit_${key}`);
        if (input) updatedData[key] = input.value;
    });

    const { error } = await supabase.from('verifications').update({ data: updatedData }).eq('id', id);

    if (!error) {
        Swal.fire({ icon: 'success', title: 'Data Updated', timer: 1000, showConfirmButton: false });
        window.closeReviewModal();
        window.loadListingRequests();
    }
};

// ✅ 4. Process Status (Sync Status Column + Status in JSON)
window.processListing = async function(id, newStatus) {
    const { data: item } = await supabase.from('verifications').select('data').eq('id', id).single();
    const dataObj = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;

    // Update status string inside the JSON data
    dataObj.status = newStatus;

    const { error } = await supabase
        .from('verifications')
        .update({ 
            status: newStatus, // Column
            data: dataObj,      // JSON
            verified_at: new Date().toISOString() 
        })
        .eq('id', id);

    if (!error) {
        Swal.fire({ icon: 'success', title: `Listing ${newStatus}`, timer: 1000, showConfirmButton: false });
        window.loadListingRequests();
    }
};

window.closeReviewModal = function() {
    document.getElementById('listingReviewModal').style.display = 'none';
};



// --- Session Termination ---
document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    const result = await Swal.fire({
        title: 'Terminate Session?',
        text: "You will need to re-authenticate to access the command center.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0b1e5b',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, Terminate'
    });

    if (result.isConfirmed) {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = "login.html";
    }
});

// --- Mobile Menu Toggle ---
menuToggle.addEventListener('click', () => {
    sidebar.classList.add('active');
    overlay.classList.add('active');
});

overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
});

init();
