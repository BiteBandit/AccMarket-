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

// --- Navigation Logic ---
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const section = item.getAttribute('data-section');
        sectionTitle.textContent = item.textContent.trim();

        sidebar.classList.remove('active');
        overlay.classList.remove('active');

        // Toggle Content Sections
        document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
        const targetSection = document.getElementById(`${section}Section`);
        if (targetSection) targetSection.style.display = 'block';

   // --- UPDATED LOGIC ---
if (section === 'users') {
    loadUserDirectory();
} else if (section === 'kyc') {
    loadPaidKYC();
} else if (section === 'banned') {
    loadRestrictedUsers();
} else if (section === 'verification') {
    loadAccountAudits(); // New function for the Audit section
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
 * ADVANCED ACCOUNT AUDITS + DISPUTE MONITORING
 */
window.loadAccountAudits = async () => {
    const tbody = document.getElementById('verificationTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:60px;"><i class="fa-solid fa-shield-halved fa-beat-low fa-2xl" style="color: #0b1e5b;"></i><div>Analyzing System Integrity & Active Disputes...</div></td></tr>`;

    try {
        // Fetch profiles
        const { data: profiles, error: pError } = await supabase
            .from('profiles')
            .select('id, username, email, role, is_official_ban, kyc_status, created_at, balance, trust_score, telegram_chat_id')
            .or('role.neq.buyer,is_official_ban.eq.true') 
            .order('created_at', { ascending: false });

        if (pError) throw pError;

        // Fetch count of open disputes for these users
        // We assume your disputes table has 'buyer_id' or 'seller_id' and a 'status'
        const { data: disputes, error: dError } = await supabase
            .from('disputes')
            .select('buyer_id, seller_id, status')
            .eq('status', 'open');

        if (dError) throw dError;

        tbody.innerHTML = profiles.map(u => {
            // Check if this specific user ID appears in any open disputes
            const activeDisputes = disputes.filter(d => d.buyer_id === u.id || d.seller_id === u.id).length;
            
            let disputeWarning = '';
            if (activeDisputes > 0) {
                disputeWarning = `<div style="margin-top:5px; color: #f59e0b; font-size: 10px; font-weight: 800; background: #fffbeb; padding: 2px 6px; border-radius: 4px; border: 1px solid #fef3c7;">
                    <i class="fa-solid fa-gavel"></i> ${activeDisputes} OPEN DISPUTE(S)
                </div>`;
            }

            const trust = u.trust_score || 0;
            const trustColor = trust >= 80 ? '#22c55e' : (trust >= 50 ? '#f59e0b' : '#ef4444');
            const roleStyles = u.role === 'admin' ? 'background: #7c3aed; color: white;' : 'background: #2563eb15; color: #2563eb;';

            return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td>
                        <div class="user-details">
                            <span style="font-weight:700; display:block; color: #0b1e5b;">${u.username || u.email}</span>
                            <span style="font-size: 10px; color: #94a3b8; font-family: monospace;">${u.id}</span>
                            ${disputeWarning}
                        </div>
                    </td>
                    <td>
                        <span style="padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 900; ${roleStyles}">
                            ${u.role.toUpperCase()}
                        </span>
                        <div style="font-size: 12px; font-weight: 700; margin-top: 5px;">₦${(u.balance || 0).toLocaleString()}</div>
                    </td>
                    <td>
                        <div style="font-size: 10px; font-weight: 600; color: #64748b; margin-bottom: 4px;">TRUST LEVEL</div>
                        <div style="height: 6px; width: 80px; background: #e2e8f0; border-radius: 3px; margin-bottom: 4px;">
                            <div style="width: ${trust}%; background: ${trustColor}; height: 100%; border-radius: 3px;"></div>
                        </div>
                        <span style="font-size: 10px; font-weight: 800; color: ${trustColor}">${trust}%</span>
                    </td>
                    <td>
                        <div style="font-size: 11px; color: #1e293b;">${new Date(u.created_at).toLocaleDateString()}</div>
                        <div style="font-size: 10px; color: ${u.is_official_ban ? '#ef4444' : '#22c55e'}; font-weight: 700;">
                            ${u.is_official_ban ? 'BANNED' : 'CLEAR'}
                        </div>
                    </td>
                    <td style="text-align: right;">
                        <button class="op-btn" onclick="viewUserFile('${u.id}')" style="background: #0b1e5b; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 12px;">
                            <i class="fa-solid fa-fingerprint"></i> Inspect
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #ef4444;">${err.message}</td></tr>`;
    }
};

window.runAITransactionScan = async (userId) => {
    const output = document.getElementById('ai-output');
    output.innerHTML = '<span class="fa-beat">AI ANALYZING TRANSACTIONS & DISPUTES...</span>';

    try {
        // 1. Fetch Transactions
        const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', userId).limit(20);
        
        // 2. Fetch Disputes
        const { data: disputes } = await supabase.from('disputes').select('*').or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

        // 3. Send to AI
        const { data: aiResult, error } = await supabase.functions.invoke('ai-fraud-detector', {
            body: { 
                transactions, 
                disputes, 
                userId 
            }
        });

        if (error) throw error;

        // The AI will return a verdict based on both
        // Example: "User has high wash-trading patterns and 2 open disputes for non-delivery."
        output.innerHTML = `
            <div style="border-left: 3px solid ${aiResult.riskScore > 60 ? '#ef4444' : '#22c55e'}; padding-left: 10px;">
                <div style="font-weight: 800; font-size: 11px;">AI VERDICT:</div>
                <div style="font-size: 12px; color: #fff;">${aiResult.summary}</div>
                <div style="margin-top: 5px; font-size: 10px; opacity: 0.7;">RISK RATING: ${aiResult.riskScore}%</div>
            </div>
        `;

    } catch (err) {
        output.innerHTML = "SCAN FAILED: " + err.message;
    }
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
