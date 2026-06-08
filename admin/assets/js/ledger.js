import { supabase } from '../../../assets/js/supabase-config.js';

// --- Page Lifecycle Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
    initLedgerPage();
});

/**
 * ADMINISTRATIVE SECURITY GATE
 */
async function initLedgerPage() {
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

        // Initialize event listener triggers and fetch ledger reports matrices rows
        setupLedgerEventListeners();
        await window.loadLedgerReports();

    } catch (err) {
        console.error("Access Forbidden:", err.message);
        await supabase.auth.signOut();
        window.location.href = "login.html?error=access_denied";
    }
}

/**
 * 1. SYNCHRONIZE CORE WALLET TRANSACTIONS LEDGER
 */
window.loadLedgerReports = async () => {
    const tbody = document.getElementById('ledgerTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align:center; padding: 40px; color:#64748b;">
                <i class="fa-solid fa-circle-notch fa-spin fa-2xl" style="color: #0b1e5b; margin-bottom: 15px; display: block;"></i>
                <div style="font-weight:700; color:#0b1e5b; letter-spacing:0.5px;">PARSING FINANCIAL LEDGER...</div>
            </td>
        </tr>`;

    try {
        // Fetch raw balances, audits, and transactions from the master financial registry table ('wallet')
        const { data: transactions, error } = await supabase
            .from('wallet')
            .select(`id, user_id, amount, type, status, note, created_at, profiles(username)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748b;">No ledger records found across system histories.</td></tr>';
            return;
        }

        tbody.innerHTML = transactions.map(t => {
            const txType = (t.type || 'funding').toLowerCase();
            const statusLower = (t.status || 'pending').toLowerCase();

            // Config transaction context styling colors (green for entry credits, red for exit payouts)
            let typeColor = '#22c55e';
            let prefix = '+';
            if (txType.includes('withdrawal') || txType.includes('payout') || parseFloat(t.amount) < 0) {
                typeColor = '#ef4444';
                prefix = '';
            }

            // Map Status indicators attributes structural frameworks
            let statusStyle = 'background: #f1f5f9; color: #475569;';
            if (statusLower === 'success' || statusLower === 'completed' || statusLower === 'approved') {
                statusStyle = 'background: #dcfce7; color: #166534;';
            } else if (statusLower === 'pending') {
                statusStyle = 'background: #fffbeb; color: #92400e;';
            } else if (statusLower === 'failed' || statusLower === 'rejected') {
                statusStyle = 'background: #fee2e2; color: #991b1b;';
            }

            // Humanize transaction description logic values
            const descriptionNote = t.note ? `<div style="font-size:11px; color:#64748b; margin-top:2px; font-style:italic;">"${t.note}"</div>` : '';

            return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: 0.2s;">
                <td style="padding: 14px 12px; font-size: 12px; color: #475569; white-space: nowrap;">
                    <div>${new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    <div style="font-size:10px; color:#94a3b8; margin-top:2px;">${new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                
                <td style="padding: 14px 12px;">
                    <div style="font-weight: 700; color: #0b1e5b; font-size: 13px;">${t.profiles?.username || 'Trader'}</div>
                    <div class="copyable-id" onclick="copyIdToClipboard('${t.user_id}', 'User UID')" title="Click to copy full UID"
                         style="font-family: monospace; font-size: 10px; color: #94a3b8; cursor: pointer; margin-top: 2px; display: inline-block;">
                        UID: #:${t.user_id.substring(0,8)}... <i class="fa-regular fa-copy" style="font-size:9px;"></i>
                    </div>
                </td>

                <td style="padding: 14px 12px;">
                    <div class="copyable-id" onclick="copyIdToClipboard('${t.id}', 'Transaction ID')" title="Click to copy reference token"
                         style="font-family: monospace; font-size: 11px; font-weight: 600; color: #1e293b; cursor: pointer; background: #f8fafc; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0; display: inline-block;">
                        #${t.id.substring(0,13)}... <i class="fa-regular fa-copy" style="font-size:10px; opacity: 0.6;"></i>
                    </div>
                </td>

                <td style="padding: 14px 12px;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0b1e5b; letter-spacing: 0.5px;">
                        ${txType}
                    </span>
                    ${descriptionNote}
                </td>

                <td style="padding: 14px 12px; font-size: 14px; font-weight: 800; color: ${typeColor};">
                    ${prefix}₦${parseFloat(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>

                <td style="padding: 14px 12px;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; ${statusStyle}">
                        ${statusLower}
                    </span>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error("Ledger acquisition engine runtime exception fail:", err);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:#ef4444; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> LEDGER RUNTIME FAILURE: ${err.message}</td></tr>`;
    }
};

/**
 * 2. CLIPBOARD CONTROLLER ACTION UTILITY
 */
window.copyIdToClipboard = async (textString, valueLabel) => {
    try {
        await navigator.clipboard.writeText(textString);
        
        // Show a temporary miniature toast confirmation alert layer directly near mouse coordinates
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: false
        });
        
        Toast.fire({
            icon: 'success',
            title: `${valueLabel} copied securely`
        });
    } catch (err) {
        console.error("Clipboard copy operation interrupted:", err);
    }
};

/**
 * 3. CONTROL EVENT ACTION WIREUPS REGISTER LISTENER
 */
function setupLedgerEventListeners() {
    const refreshBtn = document.getElementById('refreshLedgerBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', window.loadLedgerReports);
    }

    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const confirm = await Swal.fire({
                title: 'Terminate Session?',
                text: "You will need to re-authenticate to view security logs.",
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
