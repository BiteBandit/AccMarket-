import { supabase } from '../../../assets/js/supabase-config.js';

/**
 * ============================================================================
 * ENTERPRISE MARKETPLACE DISPUTE ARBITRATION ENGINE
 * ============================================================================
 */

const ARBITRATION_CONFIG = {
    pollingIntervalMs: 15000,
    redirectBaseUrl: 'https://accmarket.name.ng/chats',
    edgeFunctionUrl: 'https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/notifyDisputeAdminJoined',
    accentColor: '#0b1e5b',
    errorColor: '#ef4444'
};

let arbitrationPollingTracker = null;

// --- 1. NOTIFICATION & EDGE FUNCTION RELAY ---
window.dispatchDisputeNotifications = async function(conversationId, adminUsername, disputeId) {
    try {
        // Fetch conversation along with complete Buyer and Seller profile/auth relations
        const { data: convInfo, error: convError } = await supabase
            .from('conversations')
            .select(`
                buyer_id, 
                seller_id, 
                product_name, 
                status,
                buyer:profiles!conversations_buyer_id_fkey(username, onesignal_id, email),
                seller:profiles!conversations_seller_id_fkey(username, onesignal_id, email)
            `)
            .eq('id', conversationId)
            .maybeSingle();

        if (convError || !convInfo || convInfo.status !== 'disputed') return;

        const title = `⚖️ Dispute Update: ${convInfo.product_name}`;
        const body = `Admin ${adminUsername} has joined the conversation session.`;
        const targetIds = [convInfo.buyer_id, convInfo.seller_id].filter(Boolean);

        // A. In-App Database Notifications
        await supabase.from('notifications').insert(targetIds.map(uid => ({
            user_id: uid, title, message: body, icon: "fas fa-scale-balanced", is_read: false, type: "dispute_alert"
        })));
        if (typeof window.playNotificationSound === 'function') window.playNotificationSound();

        // B. Telegram Alerts Broker
        const { data: profiles } = await supabase.from('profiles').select('id, telegram_chat_id').in('id', targetIds);
        if (profiles) {
            for (const p of profiles) {
                if (p.telegram_chat_id) {
                    await fetch(`https://api.telegram.org/bot8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg/sendMessage`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ 
                            chat_id: p.telegram_chat_id, 
                            text: `*${title}*\n\n${body}`, 
                            parse_mode: 'Markdown' 
                        })
                    }).catch(console.error);
                }
            }
        }

        // C. Trigger External Supabase Edge Function with Required JSON Structure
        const edgePayload = {
            buyerEmail: convInfo.buyer?.email || "buyer@example.com",
            sellerEmail: convInfo.seller?.email || "seller@example.com",
            buyerUsername: convInfo.buyer?.username || "Buyer",
            sellerUsername: convInfo.seller?.username || "Seller",
            buyerOnesignalId: convInfo.buyer?.onesignal_id || "ONESIGNAL_PLAYER_ID_1",
            sellerOnesignalId: convInfo.seller?.onesignal_id || "ONESIGNAL_PLAYER_ID_2",
            adminName: adminUsername,
            caseId: disputeId || `CASE-${conversationId.substring(0, 4).toUpperCase()}`
        };

        // Securely read the active session token to pass along authorization headers if needed
        const { data: { session } } = await supabase.auth.getSession();

        await fetch(ARBITRATION_CONFIG.edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
            },
            body: JSON.stringify(edgePayload)
        })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP network error status: ${res.status}`);
            console.log("🚀 Edge Notification Function dispatched successfully.");
        })
        .catch(err => console.error("❌ Edge Notification Trigger Failed:", err));

    } catch (err) { 
        console.error("❌ Notification Relay Core Error:", err); 
    }
};

// --- 2. CORE ENGINE FUNCTIONS ---
async function loadActiveDisputes() {
    const tbody = document.getElementById('disputes-table-body');
    if (!tbody) return;

    try {
        const { data: disputes, error } = await supabase
            .from('disputes')
            .select('*')
            .eq('status', 'open')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!disputes || disputes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;"><i class="fa-solid fa-square-check" style="color:#10b981;"></i> No pending disputes.</td></tr>`;
            return;
        }

        tbody.innerHTML = disputes.map(d => `
            <tr id="dispute-row-${d.id}" style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;">
                <td style="padding: 16px; font-size:13px; color:#64748b;">${new Date(d.created_at).toLocaleDateString()}</td>
                <td style="padding: 16px; font-weight: 700; color: ${ARBITRATION_CONFIG.accentColor}; text-transform: capitalize;">${(d.reason || 'General').replace(/_/g, ' ')}</td>
                <td style="padding: 16px; color:#334155; font-size:13px;">${d.description || 'No summary configured'}</td>
                <td style="padding: 16px;"><span style="padding:4px 8px; font-size:10px; font-weight:800; background:#fee2e2; color:#991b1b; border-radius:4px; text-transform:uppercase;">${d.status}</span></td>
                <td style="padding: 16px; text-align: right;">
                    <button id="claim-btn-${d.id}" onclick="claimAndInvestigateDispute('${d.id}', '${d.conversation_id}')" 
                        style="padding: 8px 14px; cursor: pointer; border: none; background: ${ARBITRATION_CONFIG.accentColor}; color: white; font-weight: 600; border-radius: 6px; font-size: 12px; transition: 0.2s ease;">
                        <i class="fa-solid fa-gavel"></i> Acquire
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) { 
        console.error("❌ Failed to pull conflict log grids updates:", e); 
    }
}

async function claimAndInvestigateDispute(disputeId, conversationId) {
    const actionBtn = document.getElementById(`claim-btn-${disputeId}`);
    if (actionBtn) {
        actionBtn.disabled = true;
        actionBtn.style.background = '#94a3b8';
        actionBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Securing Case...`;
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Administrative session expired. Re-authenticate.");

        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        const adminName = profile?.username || 'Staff Magistrate';

        // Perform transactional database additions including the structured system message
        const [convUpdate, disputeUpdate, messageInsert] = await Promise.all([
            supabase.from('conversations').update({ admin_id: user.id }).eq('id', conversationId),
            supabase.from('disputes').update({ status: 'under_investigation' }).eq('id', disputeId),
            supabase.from('messages').insert([{
                conversation_id: conversationId,
                sender_id: user.id,
                content: `⚖️ ARBITRATOR JOINED\nAdmin ${adminName} has joined this chat session to review and resolve the active dispute. Please provide your evidence below.`,
                type: 'system',
                is_read: false,
                reply_to_id: null,
                file_name: null
            }])
        ]);

        if (convUpdate.error) throw convUpdate.error;
        if (disputeUpdate.error) throw disputeUpdate.error;
        if (messageInsert.error) throw messageInsert.error;

        // Trigger Notification Routines & Edge Function calls
        await window.dispatchDisputeNotifications(conversationId, adminName, disputeId);

        // Success Feedback banner sequence before router redirection
        Swal.fire({
            icon: 'success',
            title: 'Jurisdiction Formed',
            text: 'System message logged. Moving context to target communication workspace.',
            timer: 1500,
            showConfirmButton: false
        });

        setTimeout(() => {
            window.location.href = `${ARBITRATION_CONFIG.redirectBaseUrl}?id=${conversationId}`;
        }, 1500);

    } catch (err) {
        console.error("Arbitration access exception:", err);
        Swal.fire('Arbitration Error', err.message, 'error');
        if (actionBtn) {
            actionBtn.disabled = false;
            actionBtn.style.background = ARBITRATION_CONFIG.accentColor;
            actionBtn.innerHTML = `<i class="fa-solid fa-gavel"></i> Acquire`;
        }
    }
}

// --- 3. GLOBAL EXPOSURE & BOOTSTRAP ---
window.loadActiveDisputes = loadActiveDisputes;
window.claimAndInvestigateDispute = claimAndInvestigateDispute;

document.addEventListener('DOMContentLoaded', () => {
    loadActiveDisputes();
    // Continuously checks for newly initialized system records 
    arbitrationPollingTracker = setInterval(loadActiveDisputes, ARBITRATION_CONFIG.pollingIntervalMs);
});
