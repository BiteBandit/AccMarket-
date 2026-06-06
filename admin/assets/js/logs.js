import { supabase } from '../../../assets/js/supabase-config.js';

// --- Page Lifecycle Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
    initLogsPage();
});

/**
 * ADMINISTRATIVE SECURITY GATE
 */
async function initLogsPage() {
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

        // Initialize actions, events, search attachments, and fetch the ledger matrix
        setupLogEventListeners();
        await window.loadCommunicationLogs();

    } catch (err) {
        console.error("Access Forbidden:", err.message);
        await supabase.auth.signOut();
        window.location.href = "login.html?error=access_denied";
    }
}

/**
 * 1. RE-SYNC COMMUNICATION LEDGERS
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
                <div style="font-size: 11px; color: #64748b; font-family: monospace; margin-top: 5px;">Accessing Encrypted Communication Logs</div>
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
            <tr id="row-${c.id}" class="chat-row" style="border-bottom: 1px solid #f1f5f9; transition: 0.3s;">
                <td><span style="font-family:monospace; font-size:10px; opacity:0.6;">#${c.id.substring(0,8)}</span></td>
                <td>
                    <div style="font-size:13px; font-weight:600;">
                        <span class="buyer-tag" style="color:#2563eb;">${c.buyer?.username || 'Buyer'}</span> 
                        <i class="fa-solid fa-right-left" style="margin:0 8px; opacity:0.2; font-size: 10px;"></i>
                        <span class="seller-tag" style="color:#7c3aed;">${c.seller?.username || 'Seller'}</span>
                    </div>
                </td>
                <td id="last-msg-${c.id}" style="font-size:12px; color:#64748b; font-style:italic;">
                    Manual audit required for security verdict.
                </td>
                <td class="date-text" style="font-size:11px; color: #94a3b8; white-space: nowrap;">
                    ${new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td style="text-align: right; min-width: 140px;" id="status-${c.id}">
                    <button class="ai-scan-trigger-btn" onclick="runAiAudit('${c.id}')" 
                            title="Run AI Security Audit"
                            style="background: #f1f5f9; color: #0b1e5b; border: none; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-microchip"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Automatically clear any stale search criteria inputs during sync loops
        const searchInput = document.getElementById('chatSearchInput');
        if (searchInput) searchInput.value = '';

    } catch (err) {
        console.error("Feed Error:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:red; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> FEED ERROR: ${err.message}</td></tr>`;
    }
};

/**
 * 2. THE TRIGGER: Gathers history, applies noise filters, and calls the Edge Function with JWT
 */
window.runAiAudit = async (chatId) => {
    const statusCell = document.getElementById(`status-${chatId}`);
    const row = document.getElementById(`row-${chatId}`);
    if (!statusCell) return;

    // Robot "Thinking" Pulse State
    statusCell.innerHTML = `
        <div style="text-align: right; display: inline-block;">
            <i class="fa-solid fa-robot fa-spin-pulse" style="color: #0b1e5b;"></i>
            <span style="font-size: 8px; display: block; color: #64748b; font-weight: bold; margin-top: 2px; letter-spacing:0.5px;">AUDITING</span>
        </div>`;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("No active administrative session found.");
        
        // Fetch fresh messages with sender_id to distinguish between Human and System entries
        const { data: messages, error: fetchError } = await supabase
            .from('messages')
            .select('content, sender_id')
            .eq('conversation_id', chatId)
            .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;

        // NOISE FILTERING: Drop automated escrow strings so LLM processing token contexts aren't confused
        const humanMessages = (messages || []).filter(m => {
            if (!m.content || m.sender_id === null) return false; // Ignore system null pointers
            const content = m.content.toLowerCase();
            const isSystem = content.includes('funds are now held in escrow') || 
                             content.includes('seller, please send the login details') ||
                             content.includes('payment confirmed');
            return !isSystem;
        });

        // FAST PASS: If chat contains no human text entries, assign instant security clear
        if (humanMessages.length === 0) {
            if (row) row.style.background = 'transparent';
            statusCell.innerHTML = `
                <div style="color: #22c55e; text-align: right;">
                    <i class="fa-solid fa-circle-check"></i> 
                    <span style="font-size: 10px; font-weight: 800; display: block;">SAFE</span>
                    <div style="color: #64748b; font-size: 8px; font-weight: 400;">No human activity yet.</div>
                </div>`;
            return;
        }

        const history = humanMessages.map(m => `User: ${m.content}`).join('\n');

        // Invoke Edge Function securely passing administrative context tokens
        const { data, error } = await supabase.functions.invoke('ai-chat-auditor', {
            body: { transcript: history }, 
            headers: {
                Authorization: `Bearer ${session.access_token}`
            }
        });

        if (error) throw error;

        // UI Evaluation Render based on AI Verdict Engine Return Matrix values
        const verdict = data?.verdict?.toUpperCase() || 'SAFE';
        const isDanger = verdict === 'DANGEROUS';
        const isSuspicious = verdict === 'SUSPICIOUS';

        let color = '#22c55e';
        let icon = 'fa-circle-check';
        let bgStyle = 'transparent';

        if (isDanger) {
            color = '#ef4444';
            icon = 'fa-triangle-exclamation';
            bgStyle = '#fff1f2';
        } else if (isSuspicious) {
            color = '#f59e0b';
            icon = 'fa-eye';
            bgStyle = '#fffbeb';
        }

        if (row) row.style.background = bgStyle;

        statusCell.innerHTML = `
            <div title="${data?.reason || 'Clear'}" style="color: ${color}; text-align: right; cursor: help; display: flex; flex-direction: column; align-items: flex-end;">
                <i class="fa-solid ${icon} fa-lg"></i> 
                <span style="font-size: 10px; font-weight: 800; display: block; margin-top: 2px;">${verdict}</span>
                <div style="color: #64748b; font-weight: 400; font-size: 9px; line-height: 1.2; text-align: right; max-width: 150px; margin-top: 1px;">
                    ${data?.reason || 'Verified clear.'}
                </div>
            </div>`;

    } catch (err) {
        console.error("Audit Error:", err);
        statusCell.innerHTML = `
            <div style="color:#ef4444; cursor:pointer; text-align: right;" onclick="runAiAudit('${chatId}')" title="${err.message || 'Network Timeout'}">
                <i class="fa-solid fa-circle-exclamation fa-lg"></i>
                <div style="font-size: 9px; font-weight:700; margin-top: 2px;">RETRY SCAN</div>
            </div>`;
    }
};

/**
 * 3. CONTROL ELEMENT LOOKUP FILTER (Client-side Search Input Engine)
 */
window.filterChatTable = () => {
    const input = document.getElementById('chatSearchInput');
    if (!input) return;
    
    const filter = input.value.toLowerCase().trim();
    const rows = document.querySelectorAll('.chat-row');

    rows.forEach(row => {
        const buyer = row.querySelector('.buyer-tag')?.textContent.toLowerCase() || '';
        const seller = row.querySelector('.seller-tag')?.textContent.toLowerCase() || '';
        
        if (buyer.includes(filter) || seller.includes(filter)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
};

/**
 * 4. EVENT CONTROLLER WIREUPS
 */
function setupLogEventListeners() {
    // Refresh Button Element Attachment
    const refreshBtn = document.getElementById('refreshChatsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', window.loadCommunicationLogs);
    }

    // Dynamic Live Keyboard Listener for Real-Time Filtering
    const searchInput = document.getElementById('chatSearchInput');
    if (searchInput) {
        searchInput.addEventListener('keyup', window.filterChatTable);
    }

    // Administrative Logout Sequence Wireup
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const confirm = await Swal.fire({
                title: 'Terminate Session?',
                text: "You will need to authenticate again to view chat analysis nodes.",
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
