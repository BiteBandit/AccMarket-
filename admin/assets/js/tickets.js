import { supabase } from '../../../assets/js/supabase-config.js';

/**
 * ============================================================================
 * ENTERPRISE SUPPORT SERVICES TICKETING GOVERNANCE ENGINE (SECURED VIA PROFILES)
 * ============================================================================
 */

// --- 1. GLOBAL SECURITY GUARDIAN GATE (DATABASE LOOKUP) ---
async function enforceAdminPrivileges() {
    try {
        // Fetch current active session token from local storage state cache
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
            throw new Error("Unauthenticated: No active session token found.");
        }

        const userId = session.user.id;

        // Query the 'profiles' table to extract the live role parameter for this user ID
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single(); 

        if (profileError || !profile) {
            console.error("Profile fetch error:", profileError);
            throw new Error("Unauthorized: Failed to retrieve user profile ledger.");
        }

        // Inspect the live database role configuration value
        if (profile.role !== 'admin') {
            throw new Error("Unauthorized: Account does not possess Administrative clearance.");
        }

        // Authorization Absolute: Proceed to initialize workspace data pipelines
        window.loadSupportTickets();

    } catch (authError) {
        console.error("🔒 Security Intercept Exception:", authError.message);
        
        // Wipe out the DOM workspace immediately to prevent interface leakage
        document.body.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0f172a; color:white; font-family:'Inter',sans-serif;">
                <i class="fa-solid fa-shield-halved" style="font-size:50px; color:#ef4444; margin-bottom:20px;"></i>
                <h1 style="font-size:24px; margin:0;">Access Denied</h1>
                <p style="color:#94a3b8; font-size:14px; margin-top:8px;">${authError.message}</p>
                <p style="color:#64748b; font-size:12px; margin-top:20px;">Redirecting to terminal authentication entry gateway...</p>
            </div>
        `;

        // Force-eject browser redirect to security entry point after a brief delay
        setTimeout(() => {
            window.location.href = "login.html"; 
        }, 2500);
    }
}

// --- 2. LAYOUT STYLE DESIGN INJECTION ENGINE ---
(function injectTicketStyles() {
    if (document.getElementById('ticket-panel-styles')) return;
    const styleBlock = document.createElement('style');
    styleBlock.id = 'ticket-panel-styles';
    styleBlock.innerHTML = `
        .ticket-btn-group {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .ticket-action-btn {
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
        .ticket-btn-inspect { color: #0b1e5b; }
        .ticket-btn-inspect:hover { background: #0b1e5b; color: white; transform: scale(1.1); }

        .ticket-btn-close { color: #10b981; }
        .ticket-btn-close:hover { background: #10b981; color: white; transform: scale(1.1); }

        .ticket-btn-drop { color: #ef4444; }
        .ticket-btn-drop:hover { background: #ef4444; color: white; transform: scale(1.1); }

        .attachment-thumbnail-btn {
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
        }
        .attachment-thumbnail-btn:hover { background: #2563eb; color: white; }
    `;
    document.head.appendChild(styleBlock);
})();

// --- 3. INTERACTIVE CLIPBOARD UTILITIES ---
window.copyUidToClipboard = function(fullUid, event) {
    event.stopPropagation(); 
    
    navigator.clipboard.writeText(fullUid).then(() => {
        const targetBtn = event.currentTarget;
        const icon = targetBtn.querySelector('i');
        
        icon.className = "fa-solid fa-check";
        targetBtn.style.color = "#10b981";
        targetBtn.style.background = "#d1fae5";
        
        setTimeout(() => {
            icon.className = "fa-solid fa-copy";
            targetBtn.style.color = "#475569";
            targetBtn.style.background = "#f1f5f9";
        }, 1500);
    }).catch(err => {
        console.error("❌ Clipboard access denied:", err);
    });
};

// Cross-browser helper to safely normalize and parse PostgreSQL space-separated timestamps
function parseTicketDate(dateStr) {
    if (!dateStr) return "N/A";
    const normalized = dateStr.replace(" ", "T");
    const dateObj = new Date(normalized);
    return isNaN(dateObj.getTime()) ? dateStr : dateObj.toLocaleDateString();
}

// --- 4. READ VECTOR: LIVE ACTIVE ISSUES SYNC ---
window.loadSupportTickets = async function() {
    const tbody = document.getElementById('ticketsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = `
    <tr>
        <td colspan="6" style="text-align:center; padding:40px; color:#64748b;">
            <i class="fas fa-spinner fa-spin"></i> Retrieving live global support array...
        </td>
    </tr>`;

    try {
        const { data: tickets, error } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:50px; color:#64748b;">
                    <i class="fa-solid fa-square-check" style="font-size:30px; color:#10b981; display:block; margin-bottom:10px;"></i>
                    All customer issues resolved. Helpdesk is clear!
                </td>
            </tr>`;
            return;
        }

        tbody.innerHTML = tickets.map(ticket => {
            const attachmentContent = ticket.attachment_url ? 
                `<a href="${ticket.attachment_url}" target="_blank" class="attachment-thumbnail-btn">
                    <i class="fa-solid fa-image"></i> View Proof
                 </a>` : `<span style="color:#94a3b8; font-size:12px;">None</span>`;

            return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s;">
                <td style="padding:15px; font-weight:700; color:#0b1e5b; vertical-align: middle;">${ticket.ticket_number || 'N/A'}</td>
                <td style="padding:15px; font-weight:600; color:#1e293b; vertical-align: middle;">${ticket.subject || 'No Subject'}</td>
                <td style="padding:15px; vertical-align: middle;">
                    <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <span style="color:#64748b; font-size:13px; font-family:monospace; background:#f8fafc; padding:4px 8px; border:1px solid #e2e8f0; border-radius:6px;" title="${ticket.user_id}">
                            ${ticket.user_id ? ticket.user_id.substring(0, 8) : 'N/A'}...
                        </span>
                        ${ticket.user_id ? `
                        <button onclick="window.copyUidToClipboard('${ticket.user_id}', event)" 
                                style="border:none; background:#f1f5f9; color:#475569; padding:5px 8px; border-radius:6px; cursor:pointer; font-size:12px; transition:all 0.2s;" 
                                title="Copy Full UID">
                            <i class="fa-solid fa-copy"></i>
                        </button>` : ''}
                    </div>
                </td>
                <td style="padding:15px; vertical-align: middle;">${attachmentContent}</td>
                <td style="padding:15px; vertical-align: middle;">
                    <span class="badge-status status-pending">${ticket.status.toUpperCase()}</span>
                </td>
                <td style="padding:15px; text-align: right; vertical-align: middle;">
                    <div class="ticket-btn-group">
                        <button onclick="window.inspectTicket('${ticket.id}')" class="ticket-action-btn ticket-btn-inspect" title="Read Message">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </button>
                        <button onclick="window.updateTicketStatus('${ticket.id}', 'resolved')" class="ticket-action-btn ticket-btn-close" title="Mark Resolved">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button onclick="window.updateTicketStatus('${ticket.id}', 'dismissed')" class="ticket-action-btn ticket-btn-drop" title="Dismiss Ticket">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error("❌ Support ticket retrieval breakdown:", err);
        tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444; text-align:center; padding: 20px;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading tickets: ${err.message}</td></tr>`;
    }
};

// --- 5. INSPECTION OVERLAY ELEMENT MANAGERS ---
window.inspectTicket = async function(id) {
    const modal = document.getElementById('ticketReviewModal');
    const modalBody = document.getElementById('ticketModalBody');
    const resolveBtn = document.getElementById('resolveTicketBtn');
    
    if (!modal || !modalBody) return;

    modal.style.display = 'flex'; 
    modalBody.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;"><i class="fas fa-spinner fa-spin"></i> Reading ticket record details...</p>';

    try {
        const { data: ticket, error } = await supabase.from('support_tickets').select('*').eq('id', id).single();
        if (error) throw error;
        if (!ticket) throw new Error("Target support ticket data row has missing references.");

        modalBody.innerHTML = `
            <div style="margin-bottom:18px;">
                <label style="display:block; font-size:11px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Ticket Reference</label>
                <div style="padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; font-size:14px; font-weight:600; color:#0b1e5b;">${ticket.ticket_number}</div>
            </div>
            <div style="margin-bottom:18px;">
                <label style="display:block; font-size:11px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Subject</label>
                <div style="padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; font-size:14px; color:#1e293b; font-weight:500;">${ticket.subject || 'No Subject'}</div>
            </div>
            <div style="margin-bottom:18px;">
                <label style="display:block; font-size:11px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">User Message</label>
                <div style="padding:15px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:10px; font-size:14px; color:#334155; line-height:1.5; white-space:pre-wrap;">${ticket.message || 'No written message body content.'}</div>
            </div>
            <div style="margin-bottom:18px;">
                <label style="display:block; font-size:11px; font-weight:800; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px;">Submitted On</label>
                <div style="padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; font-size:13px; color:#64748b;">${parseTicketDate(ticket.created_at)}</div>
            </div>
        `;

        if (resolveBtn) {
            resolveBtn.onclick = () => {
                window.closeTicketModal();
                window.updateTicketStatus(id, 'resolved');
            };
        }
    } catch (err) {
        console.error("❌ Error setting modal data view elements:", err);
        modalBody.innerHTML = `<div style="padding:20px; color:#ef4444; font-weight:600; text-align:center;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to inspect record details: ${err.message}</div>`;
    }
};


// --- 6. WRITE VECTOR: STATUS MUTATION WORKFLOWS ---
window.updateTicketStatus = async function(id, nextStatus) {
    console.log(`🚀 Dispatching update query. Ticket UUID: "${id}" | New Status: "${nextStatus}"`);

    if (!id || id === 'undefined') {
        console.error("❌ Aborted: The row ID passed to the function is invalid.");
        return Swal.fire("Action Blocked", "The interface passed an invalid or empty row ID key reference.", "error");
    }

    try {
        if (nextStatus === 'dismissed') {
            const { isConfirmed } = await Swal.fire({
                title: 'Dismiss Support Ticket?',
                text: "This flags the task item closed/dismissed permanently without response.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Yes, dismiss it'
            });
            if (!isConfirmed) return;
        }

        // Execute the update query strictly targeting the unique 'id' primary key
        const { data, error } = await supabase
            .from('support_tickets')
            .update({ status: nextStatus })
            .eq('id', id)
            .select(); 

        if (error) throw error;

        // If data returns empty, it means your RLS policies are blocking updates
        if (!data || data.length === 0) {
            console.warn("⚠️ Database transaction returned empty. This points directly to an RLS permission issue.");
            return Swal.fire({
                icon: 'warning',
                title: 'Permission Denied (RLS)',
                text: 'The query executed but your account lacks permission to update this table. Please verify your Supabase Row Level Security (RLS) UPDATE policy.',
                confirmButtonColor: '#0b1e5b'
            });
        }

        console.log("✅ Database status mutation confirmed:", data);

        Swal.fire({ 
            icon: 'success', 
            title: `Ticket ${nextStatus.toUpperCase()}`, 
            text: `Workflow transaction applied accurately to database row references.`, 
            timer: 1500, 
            showConfirmButton: false 
        });
        
        // Refresh the table interface automatically
        window.loadSupportTickets();

    } catch (err) {
        console.error("❌ Operational status transformation failed:", err);
        Swal.fire("System Interrupted", err.message || "Failed to commit ticket mutation status records.", "error");
    }
};


window.closeTicketModal = function() {
    const modal = document.getElementById('ticketReviewModal');
    if (modal) modal.style.display = 'none';
};

// --- 7. ENGINE INITIALIZATION RUNTIME ANCHOR ---
document.addEventListener('DOMContentLoaded', () => {
    // Intercept DOM compilation immediately to assert security criteria constraints before loading database assets
    enforceAdminPrivileges();
});
