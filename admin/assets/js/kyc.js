import { supabase } from '../../../assets/js/supabase-config.js';

// --- Page Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
    initKycPage();
});

/**
 * 1. Strict Security Gate: Authenticates and Authorizes Admin Status
 */
async function initKycPage() {
    // A. Basic Token Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.href = "login.html";
        return;
    }

    // B. Role Authorization Check
    try {
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            throw new Error("Could not verify administrative privileges.");
        }

        // Strict Check: Drop the hammer on any non-admin trying to peek
        if (profile.role !== "admin") {
            await supabase.auth.signOut();
            window.location.href = "login.html?error=unauthorized";
            return;
        }

        // C. Success Deployment
        setupKycEventListeners();
        await window.loadPaidKYC();

    } catch (err) {
        console.error("KYC Gate Access Denied:", err.message);
        await supabase.auth.signOut();
        window.location.href = "login.html?error=access_denied";
    }
}

/**
 * 2. LOAD VERIFICATION QUEUE
 * Pulls 'paid' requests and joins 'profiles' using the Foreign Key.
 */
window.loadPaidKYC = async () => {
    const tbody = document.getElementById('kycTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Accessing Linked Records...</td></tr>';

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
 * 3. REAL-TIME SEARCH FILTER
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
 * 4. DISPATCH MODAL (With Session Auth)
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
            const { data: { session } } = await supabase.auth.getSession();
            
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('username, telegram_chat_id, telegram_alerts')
                .eq('id', userId)
                .single();

            if (profileError) throw new Error("Could not find user profile.");

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

            const { error: updateError } = await supabase
                .from('user_verifications')
                .update({ 
                    dispatch_status: 'sent',
                    updated_at: new Date().toISOString() 
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            Swal.fire({
                icon: 'success',
                title: 'Dispatched!',
                text: 'Notification sent and status updated to LINK SENT.',
                confirmButtonColor: '#0b1e5b'
            });
            
            window.loadPaidKYC();

        } catch (err) {
            console.error("Dispatch Error:", err);
            Swal.fire('Notification Failed', err.message, 'error');
        }
    }
};

/**
 * 5. APPROVAL & PLATFORM PROMOTION
 * Triggered after verification checks out. Mutates user profile state.
 */
window.promoteToSeller = async (userId, requestId) => {
    const { isConfirmed } = await Swal.fire({
        title: 'Approve & Promote User?',
        text: "This upgrades the user profile classification to 'seller' and closes the ledger ticket.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        confirmButtonText: 'Verify Account'
    });

    if (isConfirmed) {
        Swal.fire({ title: 'Processing Structural Upgrades...', didOpen: () => Swal.showLoading() });

        try {
            // 1. Fetch live user profile data needed for the notification payload
            const { data: profile, error: profileFetchError } = await supabase
                .from("profiles")
                .select("email, username, telegram_chat_id, telegram_alerts")
                .eq("id", userId)
                .single();

            if (profileFetchError) throw new Error(`Profile Fetch Failed: ${profileFetchError.message}`);

            // 2. Fetch current session to get the access token for authorization
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error("Could not retrieve valid session token.");

            // 3. Mutate the main profile classification role to seller and set verification status
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ 
                    role: 'seller',
                    kyc_status: 'verified'
                })
                .eq('id', userId);

            if (profileError) throw profileError;

            // 4. Mark the verification table status track as completed
            const { error: verificationError } = await supabase
                .from('user_verifications')
                .update({ 
                    status: 'verified', 
                    dispatch_status: 'verified', // Ensures state alignment across both columns
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (verificationError) throw verificationError;

            // 5. Notify the User (Rebranded to Accmarket in Edge Function)
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

            // 6. Success Alert & Table Refresh
            Swal.fire('Approved', 'User is now a verified seller.', 'success');
            
            // Re-runs the dashboard loader wrapper cleanly
            if (typeof window.loadPaidKYC === 'function') {
                window.loadPaidKYC();
            } else if (typeof loadPaidKYC === 'function') {
                loadPaidKYC();
            }

        } catch (err) {
            console.error("Promotion Error:", err);
            Swal.fire('Failed', err.message, 'error');
        }
    }
};


/**
 * 6. REJECT VERIFICATION PIPELINE
 */
Window.rejectVerification = async (userId, requestId) => {
    const { value: reason } = await Swal.fire({
        title: 'Reject Compliance Application',
        input: 'text',
        inputLabel: 'Provide rejection rationale for the audit logs:',
        inputPlaceholder: 'e.g., Expired credentials, payment discrepancy...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'File Rejection',
        inputValidator: (value) => {
            if (!value) return 'A justification reason must be logged!';
        }
    });

    if (reason) {
        Swal.fire({ title: 'Logging System Mutation...', didOpen: () => Swal.showLoading() });

        try {
            // 1. Fetch user profile data needed for the notification payload
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("email, username, telegram_chat_id, telegram_alerts")
                .eq("id", userId)
                .single();

            if (profileError) throw new Error(`Profile Fetch Failed: ${profileError.message}`);

            // 2. Fetch current session to get the access token for authorization
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error("Could not retrieve valid session token.");

            // 3. Update the database record
            const { error: updateError } = await supabase
                .from('user_verifications')
                .update({ 
                    status: 'rejected',
                    dispatch_status: 'rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (updateError) throw updateError;

            // 4. Trigger the Edge Function to notify the user
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

            // 5. Success Notifications and UI Refresh
            Swal.fire('Rejected', 'User remains in the "Paid" list with a REJECTED status.', 'success');
            
            // Runs whichever loader variant your global state utilizes
            if (typeof window.loadPaidKYC === 'function') {
                window.loadPaidKYC();
            } else if (typeof loadPaidKYC === 'function') {
                loadPaidKYC();
            }

        } catch (err) {
            console.error("Rejection Error:", err);
            Swal.fire('Error', err.message, 'error');
        }
    }
};


/**
 * 7. Control Listeners & Global Registrations
 */
function setupKycEventListeners() {
    // Dynamic input interception
    const searchInput = document.getElementById('kycSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', window.filterKYCTable);
    }

    // Refresh layout call trigger mapping
    const refreshBtn = document.getElementById('refreshKycBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', window.loadPaidKYC);
    }

    // Admin Session Termination Handler
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = "login.html";
        });
    }
}
