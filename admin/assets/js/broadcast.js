import { supabase } from '../../../assets/js/supabase-config.js';

/**
 * ============================================================================
 * ENTERPRISE MULTI-CHANNEL BROADCAST & TRANSMISSION ENGINE
 * ============================================================================
 */

// --- 1. FIELD TOGGLING INTERACTION LOGIC ---
window.toggleTargetFields = () => {
    const type = document.getElementById('targetType').value;
    
    const singleInput = document.getElementById('singleUserInput');
    const roleInput = document.getElementById('roleSelectInput');

    if (singleInput) singleInput.style.display = type === 'single' ? 'block' : 'none';
    if (roleInput) roleInput.style.display = type === 'role' ? 'block' : 'none';
};

// --- 2. TRANSMISSION PROCESSING LOGIC ---
window.processBroadcast = async () => {
    const title = document.getElementById('broadcastTitle').value.trim();
    const message = document.getElementById('broadcastMessage').value.trim();
    const targetType = document.getElementById('targetType').value;
    
    // Channel Active Selection Flags
    const useInApp = document.getElementById('chanInApp').checked;
    const useTelegram = document.getElementById('chanTelegram').checked;
    const useEmail = document.getElementById('chanEmail').checked;

    // Check configuration inputs upfront
    if (!title || !message) {
        return Swal.fire('Error', 'Subject and Message content are required blocks.', 'error');
    }
    if (!useInApp && !useTelegram && !useEmail) {
        return Swal.fire('Error', 'Select at least one outbound delivery channel.', 'warning');
    }

    // Lock screen UI and run a loading spinner
    Swal.fire({ 
        title: 'Initializing Broadcast', 
        text: 'Preparing transmission arrays and optimizing targeting paths...', 
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading() 
    });

    try {
        // A. Build Target Resolution Filters
        let query = supabase.from('profiles').select('id, email, telegram_chat_id, telegram_alerts');

        if (targetType === 'single') {
            const uid = document.getElementById('targetUID').value.trim();
            if (!uid) throw new Error("Please provide a valid Target User UID.");
            query = query.eq('id', uid);
        } else if (targetType === 'role') {
            const role = document.getElementById('targetRole').value;
            query = query.eq('role', role);
        }

        // B. Query the Users from Supabase Profiles Registry
        const { data: targets, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        if (!targets || targets.length === 0) {
            throw new Error("No active user records found matching the designated filter specifications.");
        }

        const promises = [];
        const emailList = [];

        // C. Populate Task Pipelines concurrently 
        targets.forEach(user => {
            // Pipeline: In-App Core Notifications table insertions
            if (useInApp) {
                promises.push(
                    supabase.from('notifications').insert({
                        user_id: user.id,
                        title: title,
                        message: message,
                        icon: 'fas fa-bullhorn',
                        type: 'broadcast',
                        is_read: false
                    })
                );
            }

            // Pipeline: External Telegram Fetch Handlers
            if (useTelegram && user.telegram_chat_id && user.telegram_alerts !== false) {
                promises.push(sendTelegramRaw(user.telegram_chat_id, `🔔 *${title}*\n\n${message}`));
            }

            // Pipeline: Email String Aggregator Bucket
            if (useEmail && user.email) {
                emailList.push(user.email);
            }
        });

        // D. Trigger Supabase Edge Function to carry out full array Email Blasts
        // Note: supabase.functions.invoke securely appends the current auth Bearer JWT token autonomously
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

        // E. Resolve task pipelines parallel arrays simultaneously
        const results = await Promise.all(promises);

        // Scan the resolution stack arrays specifically checking for custom edge execution error breaks
        const edgeResponse = results.find(r => r && r.error);
        if (edgeResponse && edgeResponse.error) {
            console.error("❌ Supabase Edge Function Operational Error:", edgeResponse.error);
            throw new Error("The centralized mail transmission engine encountered a dispatch fault.");
        }

        // F. Final Success Alerts sequence display
        Swal.fire({
            icon: 'success',
            title: 'Transmission Concluded',
            text: `Global broadcast streams dispatched successfully to ${targets.length} users.`,
            confirmButtonColor: '#0b1e5b'
        });

        // Clear layout composition frames
        document.getElementById('broadcastTitle').value = '';
        document.getElementById('broadcastMessage').value = '';

    } catch (err) {
        console.error("📢 Broadcast System Cluster Breakdown:", err);
        Swal.fire('Transmission Aborted', err.message, 'error');
    }
};

/**
 * --- 3. HARD CODED TELEGRAM BOT BROADCAST BRIDGE ROUTER ---
 */
async function sendTelegramRaw(chatId, text) {
    const botToken = '8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg';
    return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            chat_id: chatId, 
            text: text, 
            parse_mode: 'Markdown' 
        })
    }).catch(err => console.error(`⚠️ Telegram packet dropped for Chat ID: ${chatId}`, err));
}
