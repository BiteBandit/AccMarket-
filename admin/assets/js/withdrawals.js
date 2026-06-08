import { supabase } from '../../../assets/js/supabase-config.js';

// --- Page Lifecycle Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
    initWithdrawalsPage();
});

/**
 * ADMINISTRATIVE SECURITY ACCESS GATE
 */
async function initWithdrawalsPage() {
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

        // Initialize click bindings and execute the database stream pull loop
        setupWithdrawalEventListeners();
        await window.loadWithdrawalRequests();

    } catch (err) {
        console.error("Access Forbidden:", err.message);
        await supabase.auth.signOut();
        window.location.href = "login.html?error=access_denied";
    }
}

/**
 * 1. RE-SYNC DISBURSEMENT QUEUES
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

        if (!requests || requests.length === 0) {
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
                <td style="padding: 14px 12px; font-weight:800; color:#0b1e5b;">₦${parseFloat(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="padding: 14px 12px; font-size:11px; color:#64748b; white-space: nowrap;">${new Date(r.created_at).toLocaleDateString()}</td>
                <td style="padding: 14px 12px;">
                    <span style="background:${config.bg}; color:${config.color}; padding:5px 10px; border-radius:8px; font-size:10px; font-weight:800; text-transform:uppercase; display:inline-flex; align-items:center; gap:5px;">
                        <i class="fa-solid ${config.icon}"></i> ${r.status}
                    </span>
                </td>
                <td style="padding: 14px 12px; text-align: right; white-space: nowrap;">
                    ${isPending ? `
                        <div style="display:flex; gap:10px; justify-content:flex-end;">
                            <button onclick="handleManualStatus('${r.id}', 'success')" 
                                    style="background:#22c55e; color:white; border:none; width:35px; height:35px; border-radius:10px; cursor:pointer; transition:0.2s; box-shadow: 0 4px 10px rgba(34, 197, 94, 0.2); display: inline-flex; align-items: center; justify-content: center;"
                                    title="Approve & Mark as Paid">
                                <i class="fa-solid fa-check"></i>
                            </button>
                            <button onclick="handleManualStatus('${r.id}', 'rejected')" 
                                    style="background:#ef4444; color:white; border:none; width:35px; height:35px; border-radius:10px; cursor:pointer; transition:0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); display: inline-flex; align-items: center; justify-content: center;"
                                    title="Reject Request">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    ` : `
                        <div style="color:#cbd5e1; font-size:13px; font-weight:600; display: inline-flex; align-items: center; gap: 5px;">
                            <i class="fa-solid fa-lock"></i> Settled
                        </div>
                    `}
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error("Fetch error:", err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding:20px; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load requests. Check console.</td></tr>';
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
 * 2. OPERATION EXECUTION CONTROL: Payout Manual Status Settlement Workflow
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

        await window.loadWithdrawalRequests();

    } catch (err) {
        console.error("Update Error:", err);
        Swal.fire({ title: 'Update Failed', text: err.message, icon: 'error', target: 'body' });
    }
};

/**
 * 3. CONTROLLER LAYERS BINDINGS
 */
function setupWithdrawalEventListeners() {
    const refreshBtn = document.getElementById('refreshWithdrawalsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', window.loadWithdrawalRequests);
    }

    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const confirm = await Swal.fire({
                title: 'Terminate Session?',
                text: "You will need to re-authenticate to view treasury ledgers.",
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
