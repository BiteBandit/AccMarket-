import { supabase } from './supabase-config.js';

// State Management
let activeChatId = new URLSearchParams(window.location.search).get('id'); 
let currentUser = null;
let messageSubscription = null;
let statusSubscription = null; 
let heartbeatInterval = null;
let replyingTo = null; 


// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("[INIT] App Starting...");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        console.error("[AUTH] No user found:", authError);
        return;
    }
    currentUser = user;
    console.log("[AUTH] User authenticated:", currentUser.id);

    await initUserPresence();
    await loadSidebar();
    initSettingsToggle(); 

    if (activeChatId) {
        document.querySelector('.app-container').classList.add('chat-open');
        initChatWindow();
    }

    // Attachment Listeners
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');

    if (attachBtn && fileInput) {
        attachBtn.onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await handleFileUpload(file);
                fileInput.value = ''; 
            }
        };
    }

    // Navigation Logic
    const backBtn = document.getElementById('backToList');
    if (backBtn) {
        backBtn.onclick = async () => {
            document.querySelector('.app-container').classList.remove('chat-open');
            if (activeChatId) await markMessagesAsRead(activeChatId);
            
            activeChatId = null;
            if (messageSubscription) supabase.removeChannel(messageSubscription);
            if (statusSubscription) supabase.removeChannel(statusSubscription);
            
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('id');
            window.history.pushState({}, '', newUrl);
            await loadSidebar();
        };
    }

    // Input Listeners
    const sendBtn = document.getElementById('sendMessageBtn'); 
    const messageInput = document.getElementById('messageInput');
    if (sendBtn) sendBtn.onclick = handleSendMessage;
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    const searchBar = document.getElementById('chatSearch');
    if(searchBar) searchBar.oninput = (e) => loadSidebar(e.target.value);


});

// --- 2. UPLOAD LOGIC ---
async function handleFileUpload(file) {
    if (!activeChatId || !currentUser) return;

    // 1. Generate a temporary ID to show an "Uploading" state in the UI
    const tempId = 'uploading-' + Date.now();
    const container = document.querySelector('.message-container');
    
    const tempDiv = document.createElement('div');
    tempDiv.id = tempId;
    tempDiv.className = 'message outgoing'; // Align to your side
    tempDiv.innerHTML = `
        <div class="msg-bubble" style="opacity: 0.7;">
            <p class="content">
                <i class="ph ph-circle-notch animate-spin"></i> 
                Uploading ${file.name}...
            </p>
        </div>`;
    container.appendChild(tempDiv);
    container.scrollTop = container.scrollHeight;

    try {
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${activeChatId}/${fileName}`;

        // 2. Upload to your 'chat-attachments' bucket
        const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(filePath);

        // 3. Determine if it's an image or a general file
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);
        const msgType = isImage ? 'image' : 'file';
        const replyId = replyingTo ? replyingTo.id : null;

        // 4. Insert into database with the file_name for non-image types
        const { error: msgError } = await supabase
            .from('messages')
            .insert([{
                conversation_id: activeChatId,
                sender_id: currentUser.id,
                content: publicUrl,
                type: msgType, 
                is_read: false,
                reply_to_id: replyId,
                file_name: file.name // We save this so we can show "document.pdf" in the chat
            }]);

        if (msgError) throw msgError;

        // 5. Cleanup
        document.getElementById(tempId)?.remove();
        cancelReplyUI();
        
        await supabase.from('conversations')
            .update({ 
                last_message: isImage ? '📷 Image' : `📁 ${file.name}`, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', activeChatId);

    } catch (err) {
        document.getElementById(tempId)?.remove();
        console.error("[UPLOAD ERROR]", err);
        Swal.fire('Upload Failed', err.message, 'error');
    }
}


// --- 3. HEARTBEAT / PRESENCE ---
async function initUserPresence() {
    if (heartbeatInterval) clearInterval();

    const updateStatus = async () => {
        const { data: profile } = await supabase.from('profiles').select('show_online').eq('id', currentUser.id).single();
        if (profile?.show_online) {
            await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', currentUser.id);
        }
    };

    await updateStatus(); 
    heartbeatInterval = setInterval(updateStatus, 20000); 
}

// --- 4. SIDEBAR LOGIC ---
async function loadSidebar(filter = "") {
    const chatList = document.querySelector('.chat-list');
    if (!chatList || !currentUser) return;

    let { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
            id, last_message, updated_at, buyer_id, seller_id,
            seller:profiles!conversations_seller_id_fkey(id, username, avatar_url, last_seen, show_online),
            buyer:profiles!conversations_buyer_id_fkey(id, username, avatar_url, last_seen, show_online),
            messages(is_read, sender_id)
        `)
        .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
        .order('updated_at', { ascending: false });

    if (error) return;

    chatList.innerHTML = '';
    conversations.forEach(chat => {
        const isMeBuyer = chat.buyer_id === currentUser.id;
        const otherUser = isMeBuyer ? chat.seller : chat.buyer;
        if (filter && !otherUser.username.toLowerCase().includes(filter.toLowerCase())) return;

        const hasUnread = chat.messages.some(m => !m.is_read && m.sender_id !== currentUser.id);
        const isActive = chat.id === activeChatId ? 'active' : '';
        const timeDisplay = new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const item = document.createElement('div');
        item.className = `chat-item ${isActive} ${hasUnread ? 'unread-item' : ''}`;
        item.innerHTML = `
            <img src="${otherUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`}">
            <div class="chat-info">
                <div class="chat-top"><span class="user-name">${otherUser.username}</span><span class="time">${timeDisplay}</span></div>
                <div class="chat-bottom">
                    <p class="last-msg">${chat.last_message || 'New Deal Started'}</p>
                    ${hasUnread ? '<span class="unread-dot"></span>' : ''}
                </div>
            </div>`;

        item.onclick = async () => {
            activeChatId = chat.id;
            window.history.pushState({}, '', `?id=${chat.id}`);
            document.querySelector('.app-container').classList.add('chat-open');
            await markMessagesAsRead(chat.id);
            await loadSidebar(filter); 
            initChatWindow(); 
        };
        chatList.appendChild(item);
    });
}

// --- 5. CHAT WINDOW (WITH EXPLICIT JOIN) ---
async function initChatWindow() {
    const container = document.querySelector('.message-container');
    const headerName = document.getElementById('headerName');
    const headerAvatar = document.getElementById('headerAvatar');

    if (!container || !activeChatId) return;

    console.log("[CHAT] Refreshing view for:", activeChatId);
    subscribeToMessages();


    const { data: chat } = await supabase
    .from('conversations')
    .select(`*, 
        product_id,
        product_name, 
        product_price,
        seller:profiles!conversations_seller_id_fkey(id, username, avatar_url, last_seen, show_online), 
        buyer:profiles!conversations_buyer_id_fkey(id, username, avatar_url, last_seen, show_online)`)
    .eq('id', activeChatId)
    .single();


    if (chat) {
window.activeChatData = chat; 

        const otherUser = chat.buyer_id === currentUser.id ? chat.seller : chat.buyer;
        headerName.innerText = otherUser.username;
        headerAvatar.src = otherUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`;

        // 🎯 THE AUTO-START TRIGGER
        if (chat.escrow_step === 0) {
            console.log("[ESCROW] Initializing Step 1...");
            await upgradeToStepOne(); 
        } else {
            updateEscrowUI(chat.escrow_step);
        }

// --- 🎯 LOCKDOWN LOGIC (Updated) ---
const footer = document.querySelector('.chat-footer'); 
const attachBtn = document.getElementById('attachBtn'); // The plus/clip icon
const messageInput = document.getElementById('messageInput');

if (chat.status === 'cancelled' || chat.status === 'completed') {
    if (footer) {
        // 1. Hide the typing area and attachment button
        footer.style.display = 'none'; 
        
        // 2. Extra Security: Disable the actual input element
        if (messageInput) messageInput.disabled = true;
        if (attachBtn) attachBtn.style.pointerEvents = 'none';

        // 3. Add the "Closed" banner if it doesn't exist
        if (!document.getElementById('closedNotice')) {
            const notice = document.createElement('div');
            notice.id = 'closedNotice';
            notice.className = 'chat-closed-notice';
            // Using Ph-Fill for a solid lock icon
            notice.innerHTML = `<i class="ph-fill ph-lock"></i> Transaction Closed — Messaging Disabled`;
            
            // Insert the notice where the footer used to be
            footer.parentNode.appendChild(notice);
        }
    }
} else {
    // 🔓 RE-ENABLE: If the chat is active (e.g., user switched chats)
    if (footer) footer.style.display = 'flex';
    if (messageInput) {
        messageInput.disabled = false;
        messageInput.placeholder = "Type a message...";
    }
    document.getElementById('closedNotice')?.remove();
}


// --- 🎯 PRODUCT CONTEXT BAR & LOGO LOGIC ---
const pTitle = document.getElementById('productTitle');
const pPrice = document.getElementById('productPrice');
const pImg = document.getElementById('productImg');
const viewBtn = document.querySelector('.view-listing-btn');

const logos = {
    instagram: "../images/instagram.png",
    twitter: "../images/twitter.png",
    tiktok: "../images/tiktok.png",
    facebook: "../images/facebook.png",
    snapchat: "../images/snapchat.png",
    reddit: "../images/reddit.png",
    twitch: "../images/twitch.png",
    discord: "../images/discord.png",
    linkedin: "../images/linkedin.png",
    pinterest: "../images/pinterest.png"
};

if (chat) {
    if (pTitle) pTitle.innerText = chat.product_name || "Unknown Item";
    if (pPrice) pPrice.innerText = `₦${chat.product_price || '0.00'}`;

    // Get the correct logo based on the product name
    if (pImg && chat.product_name) {
        // Normalize name (e.g., "FACEBOOK " -> "facebook")
        const platform = chat.product_name.toLowerCase().trim();
        pImg.src = logos[platform] || "../images/default-platform.png"; 
    }

    // Redirection Logic
        // --- 🎯 UPDATED REDIRECTION LOGIC ---
    if (viewBtn && chat) {
        viewBtn.onclick = () => {
            // 1. Clean the platform name (e.g., "FACEBOOK " -> "facebook")
            const platform = chat.product_name ? chat.product_name.toLowerCase().trim() : "";
            
            // 2. Get the product UUID from the conversation table
            const productId = chat.product_id;

            if (platform && productId) {
                // Redirects to: ../pages/facebook.html?id=18821243-2792...
                window.location.href = `../pages/${platform}.html?id=${productId}`;
            } 
            else if (platform) {
                // Fallback if the product_id column is empty
                window.location.href = `../pages/${platform}.html`;
            } 
            else {
                console.error("Missing platform name to redirect.");
            }
        };
    }
}

await refreshMenuVisibility();


        watchPartnerPresence(otherUser);
    }

    // 🎯 Use 'reply_link' constraint hint to solve ambiguity
      // ✅ Corrected Query
const { data: messages, error } = await supabase
    .from('messages')
    .select(`
        *, 
        sender:profiles(username, avatar_url, role), 
        reply_to:messages!reply_to_id(
            id, 
            content, 
            type, 
            sender_id,
            sender:profiles(username)
        )
    `)
    .eq('conversation_id', activeChatId)
    .order('created_at', { ascending: true });




    if (error) {
        console.error("[CHAT] Fetch messages error:", error);
    }

    container.innerHTML = ''; 

    // 🛡️ 2. ADD SAFETY WARNING (New Step)
    // We check if it's Level 1 (Step 1) or any active deal
    if (chat && chat.status === 'active') {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'system-pill-container'; // Keeps it centered
        warningDiv.innerHTML = `
            <div class="safety-warning-box">
                <div class="warning-header">
                    <i class="ph-fill ph-shield-warning"></i>
                    <span>Safety Disclaimer</span>
                </div>
                <p>To avoid scams, keep all payments and conversations inside the website. Never share your WhatsApp, Telegram, or phone number.</p>
                <ul>
                    <li>Take screenshots of the chat for evidence in case of a dispute.</li>
                    <li>Payments made outside the platform are not protected by escrow.</li>
                    <li>Report any user asking to "deal direct" to our Admins.</li>
                </ul>
            </div>
        `;
        container.appendChild(warningDiv);
    }

    if (messages) messages.forEach(msg => appendMessageUI(msg));
}

// --- 6. PARTNER STATUS WATCHER ---
function watchPartnerPresence(partner) {
    const statusLabel = document.getElementById('headerStatus');
    if (!statusLabel) return;

    const calculateStatus = (lastSeenStr, showOnline) => {
        if (!showOnline || !lastSeenStr) {
            statusLabel.innerText = "Offline"; 
            statusLabel.style.color = "#9ca3af";
            return;
        }

        const lastSeen = new Date(lastSeenStr);
        const diffInSeconds = Math.floor((new Date() - lastSeen) / 1000);

        if (diffInSeconds < 60) {
            statusLabel.innerText = "Online";
            statusLabel.style.color = "#10b981";
        } else {
            statusLabel.innerText = `Last seen at ${lastSeen.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            statusLabel.style.color = "#9ca3af";
        }
    };

    calculateStatus(partner.last_seen, partner.show_online);

    if (statusSubscription) supabase.removeChannel(statusSubscription);
    statusSubscription = supabase.channel(`status-${partner.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partner.id}` }, (payload) => {
            calculateStatus(payload.new.last_seen, payload.new.show_online);
        })
        .subscribe();
}

// --- 7. MESSAGING HELPERS ---
 // --- 7. MESSAGING HELPERS (UPDATED WITH DELETE SYNC) ---
function subscribeToMessages() {
    if (messageSubscription) supabase.removeChannel(messageSubscription);

    messageSubscription = supabase.channel(`chat-${activeChatId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `conversation_id=eq.${activeChatId}` 
        }, async (payload) => {
            console.log("[REALTIME] New message incoming...");
            
            // 🎯 Handle System messages immediately
            if (payload.new.type === 'system') {
                appendMessageUI(payload.new);
            } else {
                // 🎯 UPDATED: Fetch the sender's 'role' and 'avatar_url' live
                const { data: fullMsg } = await supabase
                    .from('messages')
                    .select(`
                        *,
                        sender:profiles(username, avatar_url, role), 
                        reply_to:messages!reply_to_id (
                            id, content, type, sender_id,
                            sender:profiles (username)
                        )
                    `)
                    .eq('id', payload.new.id)
                    .single();

                if (fullMsg) appendMessageUI(fullMsg);
                else appendMessageUI(payload.new);
            }
            
            if (payload.new.sender_id !== currentUser.id) await markMessagesAsRead(activeChatId);
            await loadSidebar();
        })
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'messages', 
            filter: `conversation_id=eq.${activeChatId}` 
        }, (payload) => {
            // Handle Read Status
            const icon = document.getElementById(`icon-${payload.new.id}`);
            if (icon && payload.new.is_read) {
                icon.className = 'ph ph-checks';
                icon.style.color = '#10b981';
            }

            // Handle Real-time Deletion
            if (payload.new.type === 'deleted') {
                const msgDiv = document.getElementById(`msg-${payload.new.id}`);
                if (msgDiv) {
                    const bubble = msgDiv.querySelector('.msg-bubble');
                    if (bubble) {
                        bubble.style.transition = 'transform 0.4s ease';
                        bubble.style.transform = 'translateX(0)';
                    }
                    const contentP = msgDiv.querySelector('.content');
                    if (contentP) {
                        contentP.innerText = payload.new.content;
                        contentP.classList.add('deleted-text');
                    }
                    msgDiv.querySelector('.reply-badge')?.remove();
                    msgDiv.querySelector('.chat-img')?.remove();
                    msgDiv.querySelector('.swipe-delete-btn')?.remove(); 
                }
            }
        })
        .subscribe();
}




// --- 9. DELETE LOGIC WITH SWEETALERT ---
async function deleteMessage(msgId, senderId) {
    // 🛑 Safety check: ensures currentUser is loaded and owns the message
    if (!currentUser || senderId !== currentUser.id) return;

    // 🛑 1. DISPUTE LOCK: Block deletion if status is disputed, cancelled, or completed
    const currentStatus = window.activeChatData?.status;
    if (['disputed', 'cancelled', 'completed'].includes(currentStatus)) {
        Swal.fire({
            title: 'Action Blocked',
            text: 'Messages cannot be deleted after a dispute is raised or a deal is closed to preserve evidence.',
            icon: 'error',
            confirmButtonColor: '#0b1e5b'
        });
        
        // Reset the swipe UI visuals
        const msgDiv = document.getElementById(`msg-${msgId}`);
        if (msgDiv) {
            const bubble = msgDiv.querySelector('.msg-bubble');
            if (bubble) bubble.style.transform = 'translateX(0)';
        }
        return;
    }

    const result = await Swal.fire({
        title: 'Delete Message?',
        text: "This action cannot be undone!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0b1e5b',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) {
        const msgDiv = document.getElementById(`msg-${msgId}`);
        if (msgDiv) {
            const bubble = msgDiv.querySelector('.msg-bubble');
            if (bubble) bubble.style.transform = 'translateX(0)';
        }
        return;
    }

    try {
        // 2. Fetch info to check if this is the last message
        const { data: msgToDelete } = await supabase
            .from('messages')
            .select('id, conversation_id, created_at')
            .eq('id', msgId)
            .single();

        if (!msgToDelete) return;

        // 3. Update the message record (Soft Delete)
        const { error: msgError } = await supabase
            .from('messages')
            .update({ 
                content: '🚫 This message was deleted', 
                type: 'deleted', 
                reply_to_id: null 
            })
            .eq('id', msgId);

        if (msgError) throw msgError;

        // 4. Update Sidebar if this was the most recent message
        const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', msgToDelete.conversation_id)
            .gt('created_at', msgToDelete.created_at);

        if (count === 0) {
            await supabase
                .from('conversations')
                .update({ last_message: '🚫 This message was deleted' })
                .eq('id', msgToDelete.conversation_id);
        }

        // 5. Success UI
        Swal.fire({ 
            toast: true, 
            position: 'top-end', 
            icon: 'success', 
            title: 'Deleted', 
            showConfirmButton: false, 
            timer: 1500 
        });

    } catch (err) {
        console.error("[DELETE ERROR]", err.message);
        Swal.fire('Error', 'Could not delete message.', 'error');
    }
}

// 🎯 CRITICAL: Export to global scope so HTML onclick can find it
window.deleteMessage = deleteMessage;






// 🎯 UPDATED REPLY LOGIC WITH DYNAMIC NAMES & ERROR PROTECTION
function setReplyUI(msg) {
    if (!msg) return;
    replyingTo = msg;
    
    const footer = document.querySelector('.chat-footer');
    if (!footer) {
        console.error("Chat footer wrapper not found!");
        return;
    }

    // Add Styles if they don't exist yet
    if (!document.getElementById('reply-style-tag')) {
        const style = document.createElement('style');
        style.id = 'reply-style-tag';
        style.innerHTML = `
            #reply-preview-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #f8fafc;
                border-left: 4px solid #10b981;
                padding: 8px 15px;
                width: 100%;
                box-sizing: border-box;
                border-bottom: 1px solid #eee;
                animation: slideUp 0.2s ease-out;
            }
            .reply-content-wrapper {
                flex: 1;
                overflow: hidden;
                padding-right: 10px;
            }
            .reply-content-wrapper small {
                color: #10b981;
                font-weight: bold;
                font-size: 0.75rem;
                display: block;
                margin-bottom: 2px;
            }
            .reply-content-wrapper p {
                margin: 0;
                font-size: 0.85rem;
                color: #64748b;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .close-reply-btn {
                background: none;
                border: none;
                color: #94a3b8;
                font-size: 1.25rem;
                cursor: pointer;
                padding: 5px;
                line-height: 1;
            }
            .close-reply-btn:hover { color: #ef4444; }
            
            @keyframes slideUp {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    let bar = document.getElementById('reply-preview-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'reply-preview-bar';
        footer.prepend(bar); 
    }

    const text = msg.type === 'image' ? '📷 Image' : (msg.content || '');
    
    // 🎯 FIX: Correct logic for "You" vs "Username"
    let displayName = "User";
    if (msg.sender_id === currentUser.id) {
        displayName = "You";
    } else if (msg.sender && msg.sender.username) {
        displayName = msg.sender.username;
    } else {
        // Fallback: Try to find the username from the chat header if the sender object is missing
        displayName = document.getElementById('headerName')?.innerText || "User";
    }

    bar.innerHTML = `
        <div class="reply-content-wrapper">
            <small>Replying to ${displayName}</small>
            <p>${text}</p>
        </div>
        <button type="button" class="close-reply-btn" onclick="cancelReplyUI()">✕</button>
    `;
    
    document.getElementById('messageInput')?.focus();
}

function cancelReplyUI() {
    replyingTo = null;
    const bar = document.getElementById('reply-preview-bar');
    if (bar) bar.remove();
}
window.cancelReplyUI = cancelReplyUI;

   

  function appendMessageUI(msg) {
    const container = document.querySelector('.message-container');
    if (!container || document.getElementById(`msg-${msg.id}`)) return;

    // 🎯 1. Handle System Messages
    if (msg.type === 'system') {
        const systemDiv = document.createElement('div');
        systemDiv.id = `msg-${msg.id}`;
        systemDiv.className = 'msg-system';
        
        const isAlert = msg.content.includes('DISPUTE') || 
                        msg.content.includes('CANCELLED') || 
                        msg.content.includes('⚠️') || 
                        msg.content.includes('❌');
        
        systemDiv.innerHTML = `
            <div class="system-pill ${isAlert ? 'dispute-alert' : ''}">
                ${msg.content}
            </div>
        `;
        
        container.appendChild(systemDiv);
        container.scrollTop = container.scrollHeight;
        return; 
    }

    // 🎯 2. Setup Identities & Positioning
    const isMe = msg.sender_id === currentUser.id;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Standard User Positioning: My messages on the right, others on the left
    const messageClass = isMe ? 'outgoing' : 'incoming';

    // 🎯 3. Create the Base Element
    const div = document.createElement('div');
    div.id = `msg-${msg.id}`;
    div.className = `message ${messageClass}`;

    // 🎯 4. Handle Replies
    let replyHTML = '';
    if (msg.reply_to_id) {
        const otherName = document.getElementById('headerName')?.innerText || 'User';
        const replyName = (msg.reply_to?.sender_id === currentUser.id) ? 'You' : (msg.reply_to?.sender?.username || otherName);
        
        replyHTML = `
            <div class="reply-badge" onclick="scrollToMessage('${msg.reply_to_id}')">
                <i class="ph ph-arrow-bend-up-left"></i>
                <span>Replying to <b>${replyName}</b></span>
            </div>`;
    }

    // 🎯 5. Content Logic
    let contentHTML = '';
    if (msg.type === 'deleted') {
        contentHTML = `<p class="content deleted-text">${msg.content}</p>`;
    } else if (msg.type === 'image') {
        contentHTML = `<img src="${msg.content}" class="chat-img" loading="lazy" onclick="window.open('${msg.content}', '_blank')">`;
    } else if (msg.type === 'file') {
        const displayFileName = msg.file_name || 'Attachment';
        contentHTML = `
            <div class="file-attachment-box" onclick="window.open('${msg.content}', '_blank')">
                <i class="ph-fill ph-file-text"></i>
                <div class="file-info">
                    <span>${displayFileName}</span>
                    <small>Click to view/download</small>
                </div>
            </div>`;
    } else {
        contentHTML = `<p class="content">${msg.content}</p>`;
    }

    // 🎯 6. Assemble Final Structure
    const isLocked = window.activeChatData?.status === 'disputed' || 
                     window.activeChatData?.status === 'cancelled' || 
                     window.activeChatData?.status === 'completed';

    div.innerHTML = `
        ${(isMe && !isLocked) ? `<div class="swipe-delete-btn" onclick="deleteMessage('${msg.id}', '${msg.sender_id}')"><i class="ph ph-trash"></i></div>` : ''}
        
        <div class="msg-bubble">
            ${replyHTML}
            ${contentHTML}
            
            <div class="msg-status">
                <span class="time">${time}</span>
                ${isMe ? `<i class="ph ${msg.is_read ? 'ph-checks' : 'ph-check'}" id="icon-${msg.id}"></i>` : ''}
            </div>
        </div>`;


    // 🎯 7. Mobile Interactions & Rendering
    const bubble = div.querySelector('.msg-bubble');
    let pressTimer, startX = 0, currentX = 0, isSwiping = false;

    bubble.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        currentX = 0; isSwiping = false;
        bubble.style.transition = 'none';
        pressTimer = setTimeout(() => { if (!isSwiping) { if (navigator.vibrate) navigator.vibrate(40); setReplyUI(msg); } }, 600);
    }, { passive: true });

    bubble.addEventListener('touchmove', (e) => {
        currentX = e.touches[0].clientX - startX;
        if (Math.abs(currentX) > 10) { clearTimeout(pressTimer); isSwiping = true; }
        if (isMe && currentX < 0) { const move = Math.max(currentX, -80); bubble.style.transform = `translateX(${move}px)`; }
    }, { passive: true });

    bubble.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
        bubble.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        if (isMe) bubble.style.transform = currentX < -40 ? 'translateX(-70px)' : 'translateX(0)';
    });

    bubble.addEventListener('dblclick', () => setReplyUI(msg));

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}



// 🎯 COOL ADDITION: Function to jump to the message
function scrollToMessage(id) {
    const target = document.getElementById(`msg-${id}`);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('highlight-msg');
        setTimeout(() => target.classList.remove('highlight-msg'), 2000);
    }
}
window.scrollToMessage = scrollToMessage;


  

async function handleSendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !activeChatId) return;

    const replyId = replyingTo ? replyingTo.id : null;
    input.value = ''; 
    cancelReplyUI();

    const { error: msgError } = await supabase.from('messages').insert([{
        conversation_id: activeChatId, 
        sender_id: currentUser.id, 
        content: content, 
        type: 'text',
        is_read: false,
        reply_to_id: replyId
    }]);

    if (!msgError) {
        await supabase.from('conversations')
            .update({ last_message: content, updated_at: new Date().toISOString() })
            .eq('id', activeChatId);

 
    }
}

async function markMessagesAsRead(convId) {
    if (!convId || !currentUser) return;
    await supabase.from('messages').update({ is_read: true })
        .eq('conversation_id', convId).neq('sender_id', currentUser.id).eq('is_read', false); 
}

async function initSettingsToggle() {
    const toggle = document.getElementById('onlineStatusToggle'); 
    if (!toggle) return;

    const { data } = await supabase.from('profiles').select('show_online').eq('id', currentUser.id).single();
    toggle.checked = data?.show_online ?? true;

    toggle.onchange = async () => {
        const isEnabled = toggle.checked;
        await supabase.from('profiles').update({ show_online: isEnabled }).eq('id', currentUser.id);
        if (!isEnabled) await supabase.from('profiles').update({ last_seen: null }).eq('id', currentUser.id);
        initUserPresence(); 
    };
}

// 🎯 AUTO-UPGRADE TO STEP 1
async function upgradeToStepOne() {
    if (!activeChatId || !currentUser) return;

    const systemText= "💰 Payment confirmed. Funds are now held in Escrow. Seller, please send the login details here so the buyer can verify the account.";

    // 1. Update the Conversation Table
    await supabase.from('conversations')
        .update({ 
            escrow_step: 1, 
            last_message: systemText, 
            updated_at: new Date().toISOString() 
        })
        .eq('id', activeChatId);

    // 2. Insert Message (FIXED: Using real currentUser.id to pass Foreign Key check)
    const { error } = await supabase.from('messages').insert([{
        conversation_id: activeChatId,
        sender_id: currentUser.id, 
        content: systemText,
        type: 'system' 
    }]);

    if (error) console.error("[DATABASE ERROR] Message not saved:", error.message);

    // 3. Update the visual bar
    updateEscrowUI(1);
    
    // 4. Refresh the sidebar
    await loadSidebar();
}
 


// 🎯 DYNAMIC UI UPDATE
function updateEscrowUI(step) {
    const stepPaid = document.querySelector('.status-step:nth-child(1)');
    const lineDelivery = document.querySelector('.status-line:nth-child(2)');
    const stepDelivery = document.getElementById('stepDelivery');
    const lineRelease = document.getElementById('lineRelease');
    const stepRelease = document.getElementById('stepRelease');

    // Reset everything
    [stepPaid, stepDelivery, stepRelease].forEach(el => el?.classList.remove('active', 'completed'));
    [lineDelivery, lineRelease].forEach(el => el?.classList.remove('completed'));

    if (step === 0) return;
    
    // --- STEP 1: PAID ---
    if (step >= 1) {
        // Force 'completed' to ensure it uses the green background style
        stepPaid?.classList.add('completed'); 
        lineDelivery?.classList.add('completed');
    }

    // --- STEP 2: DELIVERY ---
    if (step >= 2) {
        stepDelivery?.classList.add('completed');
        lineRelease?.classList.add('completed');
    }

    // --- STEP 3: RELEASE ---
    if (step >= 3) {
        stepRelease?.classList.add('completed');
    }
}
window.updateEscrowUI = updateEscrowUI;



/**
 * 🎯 1. THE TOGGLE 
 * This fixes the 'not defined' error by attaching to window.
 */
window.toggleStatusMenu = async function(e) {
    if (e) e.stopPropagation();
    
    const menu = document.getElementById("statusMenu");
    if (!menu) return;

    // Toggle the 'show' class to open/close the box
    menu.classList.toggle("show");
    
    console.log("--- [MENU CLICKED] ---");

    // If the menu is now open, run the logic to show/hide the buttons
    if (menu.classList.contains("show")) {
        await refreshMenuVisibility();
    }
};

/**
 * 🎯 2. THE VISIBILITY LOGIC
 * Only handles showing/hiding. No functions yet.
 */
async function refreshMenuVisibility() {
    if (!activeChatId || !currentUser) return;

    // 1. Fetch the data - CRITICAL: Added 'status' to the select
    const { data: chat, error } = await supabase
        .from("conversations")
        .select("seller_id, buyer_id, escrow_step, status")
        .eq("id", activeChatId)
        .single();

    if (error || !chat) {
        console.error("Database Error:", error);
        return;
    }

    // 2. Identify the buttons in your HTML
    const btnConfirm = document.getElementById("btnConfirmDelivery");
    const btnRelease = document.getElementById("btnReleaseFunds");
    const btnCancel = document.getElementById("btnCancel");
    const btnDispute = document.getElementById("btnDispute");

    // 3. Define the roles and current step
    const isSeller = currentUser.id === chat.seller_id;
    const isBuyer = currentUser.id === chat.buyer_id;
    const step = chat.escrow_step || 1;

    // 🛑 LOCKDOWN CHECK: If the deal is cancelled or completed, hide everything and EXIT
    if (chat.status === 'cancelled' || chat.status === 'completed') {
        if (btnConfirm) btnConfirm.style.display = "none";
        if (btnRelease) btnRelease.style.display = "none";
        if (btnCancel) btnCancel.style.display = "none";
        if (btnDispute) btnDispute.style.display = "none";
        
        console.log("Result: Chat is closed (Status: " + chat.status + "). Hiding all buttons.");
        return; // This stops the function here
    }

// 🕵️ SHOW LOGIC (Only runs if status is active)

// 🎯 DISPUTE BUTTON: Show in BOTH Step 1 and Step 2
if (btnDispute) {
    // This will show the dispute button as long as the deal isn't finished
    btnDispute.style.display = "flex"; 
}

// 🎯 CANCEL BUTTON: Show ONLY in Step 1
if (btnCancel) {
    btnCancel.style.display = (step === 1) ? "flex" : "none";
}

// 🎯 SELLER BUTTON: Confirm Delivery (Only Step 1)
if (btnConfirm) {
    btnConfirm.style.display = (isSeller && step === 1) ? "flex" : "none";
}

// 🎯 BUYER BUTTON: Release Funds (Only Step 2)
if (btnRelease) {
    btnRelease.style.display = (isBuyer && step === 2) ? "flex" : "none";
}
}



// Global empty functions so you don't get errors when clicking
window.upgradeToStepTwo = () => console.log("Button clicked: Confirm Delivery");
window.upgradeToStepThree = () => console.log("Button clicked: Release Funds");
window.handleDispute = () => console.log("Button clicked: Dispute");

// Close menu if clicking anywhere else
document.addEventListener("click", () => {
    document.getElementById("statusMenu")?.classList.remove("show");
});

/**
 * 🎯 CANCEL DEAL LOGIC
 * Only works in Step 1 (Before delivery)
 */

window.handleCancelDeal = async function() {
    if (!activeChatId || !currentUser) return;

    try {
        const { data: chat, error: fetchError } = await supabase
            .from('conversations')
            .select('product_price, buyer_id, seller_id, status, product_name')
            .eq('id', activeChatId)
            .single();

        if (fetchError || !chat) throw new Error("Deal details not found.");
        if (chat.status === 'cancelled' || chat.status === 'completed') return;

        const confirm = await Swal.fire({
            title: 'Cancel & Refund?',
            text: `₦${chat.product_price} will be refunded.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, Cancel'
        });

        if (!confirm.isConfirmed) return;

        const now = new Date();
        const localTime = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        
        const systemText = `❌ Deal Cancelled. ₦${chat.product_price} was refunded to the buyer.`;

        const { error: rpcError } = await supabase.rpc('handle_cancel_refund', {
            target_buyer_id: chat.buyer_id,
            refund_amount: parseFloat(chat.product_price),
            target_conv_id: activeChatId,
            product_name: chat.product_name 
        });

        if (rpcError) throw rpcError;

        await supabase.from('conversations').update({ 
            last_message: systemText,
            updated_at: now.toISOString()
        }).eq('id', activeChatId);

        await supabase.from('messages').insert([{
            conversation_id: activeChatId,
            sender_id: currentUser.id,
            content: systemText,
            type: 'system'
        }]);

        const notifyTargetId = (currentUser.id === chat.buyer_id) ? chat.seller_id : chat.buyer_id;
        const initiator = (currentUser.id === chat.buyer_id) ? "Buyer" : "Seller";

        await supabase.from('notifications').insert([{
            user_id: notifyTargetId, 
            title: "Deal Cancelled",
            message: `The ${initiator} cancelled the deal for "${chat.product_name}" at ${localTime}. Funds returned to buyer.`,
            icon: "fas fa-history",
            is_read: false,
            type: "alert",
            created_at: now.toISOString()
        }]);

        // 4. 🎯 UPDATED TELEGRAM LOGIC WITH PREFERENCE CHECK
        const { data: profile } = await supabase
            .from('profiles')
            // Ensure you select your boolean setting column (e.g., telegram_alerts)
            .select('telegram_chat_id, telegram_alerts') 
            .eq('id', notifyTargetId)
            .single();

        // Only proceed if chat ID exists AND alerts are enabled (true)
        if (profile?.telegram_chat_id && profile?.telegram_alerts === true) {
            const botToken = "8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg";
            const telegramMsg = `🔔 *AccMarket Alert*\n\n❌ *Deal Cancelled*\nProduct: ${chat.product_name}\nInitiator: ${initiator}\nTime: ${localTime}\nStatus: Refunded to Buyer\nAmount: ₦${chat.product_price}`;
            
            try {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: profile.telegram_chat_id,
                        text: telegramMsg,
                        parse_mode: 'Markdown'
                    })
                });
            } catch (tgErr) { console.error("Telegram send failed:", tgErr); }
        }

        Swal.fire('Success', 'Deal cancelled.', 'success');
        if (typeof loadSidebar === 'function') await loadSidebar();
        initChatWindow();

    } catch (error) {
        console.error("Cancel failed:", error);
        Swal.fire('Error', 'Transaction failed.', 'error');
    }
};


window.upgradeToStepTwo = async function() {
    if (!activeChatId || !currentUser) return;

    const confirm = await Swal.fire({
        title: 'Confirm Delivery?',
        text: "Are you sure you have sent the account logs? This will notify the buyer.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, Delivered'
    });

    if (!confirm.isConfirmed) return;

    try {
        // 1. Fetch deal details to get Product Name and Buyer ID
        const { data: chat, error: fetchError } = await supabase
            .from('conversations')
            .select('product_name, buyer_id')
            .eq('id', activeChatId)
            .single();

        if (fetchError || !chat) throw new Error("Deal details not found.");

        const now = new Date();
        // Format time for local display (e.g., 6:00 PM)
        const localTime = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });

        const systemText = "📦 Seller has marked the logs as delivered. Buyer, please verify and release funds.";

        // 2. Update Conversation Step
        const { error: updateError } = await supabase.from('conversations')
            .update({ 
                escrow_step: 2, 
                last_message: systemText, 
                updated_at: now.toISOString() 
            })
            .eq('id', activeChatId);

        if (updateError) throw updateError;

        // 3. Insert System Message
        await supabase.from('messages').insert([{
            conversation_id: activeChatId,
            sender_id: currentUser.id, 
            content: systemText,
            type: 'system' 
        }]);

        // 4. 🎯 IN-APP NOTIFICATION FOR BUYER
        await supabase.from('notifications').insert([{
            user_id: chat.buyer_id, 
            title: "Logs Delivered",
            message: `The seller has delivered the logs for "${chat.product_name}" at ${localTime}. Please verify and release funds.`,
            icon: "fas fa-box-open",
            is_read: false,
            type: "alert",
            created_at: now.toISOString() 
        }]);

        // 5. 🚀 TELEGRAM NOTIFICATION (Check preference first)
        const { data: profile } = await supabase
            .from('profiles')
            .select('telegram_chat_id, telegram_alerts') 
            .eq('id', chat.buyer_id)
            .single();

        // Only send if linked AND telegram_alerts is true
        if (profile?.telegram_chat_id && profile?.telegram_alerts === true) {
            const botToken = "8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg"; 
            const telegramMsg = `🔔 *AccMarket Alert*\n\n📦 *Logs Delivered*\nProduct: ${chat.product_name}\nTime: ${localTime}\n\n*Action Required:* Please login to the app, verify the account details, and release the funds.`;
            
            try {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: profile.telegram_chat_id,
                        text: telegramMsg,
                        parse_mode: 'Markdown'
                    })
                });
            } catch (tgErr) { console.error("Telegram error:", tgErr); }
        }

        // 6. Refresh UI
        updateEscrowUI(2); 
        document.getElementById('statusMenu')?.classList.remove('show');
        if (typeof loadSidebar === 'function') await loadSidebar();
        
        Swal.fire('Success', 'Delivery confirmed. Buyer has been notified.', 'success');

    } catch (error) {
        console.error("Delivery confirmation failed:", error);
        Swal.fire('Error', 'Could not confirm delivery.', 'error');
    }
};


window.upgradeToStepThree = async function() {
    if (!activeChatId || !currentUser) return;

    const confirm = await Swal.fire({
        title: 'Release Funds?',
        text: "Only do this if you have received and verified the logs. This action is final!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        confirmButtonText: 'Yes, Release Funds'
    });

    if (!confirm.isConfirmed) return;

    try {
        // 1. Fetch deal details
        const { data: chat, error: fetchError } = await supabase
            .from('conversations')
            .select('product_name, seller_id, product_price, buyer_id')
            .eq('id', activeChatId)
            .single();

        if (fetchError || !chat) throw new Error("Deal details not found.");

        const now = new Date();
        const localTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        const systemText = "✅ Funds released! Transaction completed successfully.";

        // 2. 💰 EXECUTE WALLET TRANSACTION (RPC)
        // This function must: 
        // a) Update seller's balance 
        // b) Insert into 'wallets' or 'transactions' history table
        const { error: rpcError } = await supabase.rpc('handle_release_funds', {
            target_seller_id: chat.seller_id,
            amount_to_release: parseFloat(chat.product_price),
            target_conv_id: activeChatId,
            product_name: chat.product_name
        });

        if (rpcError) throw rpcError;

        // 3. Update Conversation Status
        await supabase.from('conversations').update({ 
            escrow_step: 3, 
            status: 'completed',
            last_message: systemText, 
            updated_at: now.toISOString() 
        }).eq('id', activeChatId);

        // 4. Insert System Message
        await supabase.from('messages').insert([{
            conversation_id: activeChatId,
            sender_id: currentUser.id, 
            content: systemText,
            type: 'system' 
        }]);

        // 5. In-App Notification (Seller)
        await supabase.from('notifications').insert([{
            user_id: chat.seller_id, 
            title: "Payment Received",
            message: `Funds for "${chat.product_name}" (₦${chat.product_price}) were added to your wallet at ${localTime}.`,
            icon: "fas fa-wallet",
            is_read: false,
            type: "success",
            created_at: now.toISOString() 
        }]);

        // 6. Telegram Alert (Check Preference)
        const { data: profile } = await supabase
            .from('profiles')
            .select('telegram_chat_id, telegram_alerts') 
            .eq('id', chat.seller_id)
            .single();

        if (profile?.telegram_chat_id && profile?.telegram_alerts === true) {
            const botToken = "8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg"; 
            const telegramMsg = `🔔 *AccMarket Alert*\n\n💰 *Payment Received!*\nProduct: ${chat.product_name}\nAmount: ₦${chat.product_price}\nTime: ${localTime}\n\nCheck your wallet history for details.`;
            
            try {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: profile.telegram_chat_id, text: telegramMsg, parse_mode: 'Markdown' })
                });
            } catch (tgErr) { console.error(tgErr); }
        }

        // 7. Finalize UI
        updateEscrowUI(3);
        if (typeof loadSidebar === 'function') await loadSidebar();
        document.getElementById('ratingModal').classList.add('active'); 

    } catch (error) {
        console.error("Release failed:", error);
        Swal.fire('Error', 'Wallet update failed. Please contact support.', 'error');
    }
};



/**
 * 🎯 DISPUTE MODAL CONTROLLER
 */
window.handleDispute = function() {
    const modal = document.getElementById('disputeModal');
    if (modal) {
        // Clear previous inputs
        document.getElementById('disputeDetails').value = '';
        modal.classList.add('active');
    }
};

// Close logic for the (X) and Cancel buttons
document.getElementById('closeDispute')?.addEventListener('click', () => {
    document.getElementById('disputeModal').classList.remove('active');
});

document.getElementById('cancelDispute')?.addEventListener('click', () => {
    document.getElementById('disputeModal').classList.remove('active');
});

/**
 * 🎯 SUBMIT DISPUTE (Updated for disputes table integration)
 */
document.getElementById('submitDispute')?.addEventListener('click', async () => {
    const reason = document.getElementById('disputeReason').value;
    const details = document.getElementById('disputeDetails').value;
    const submitBtn = document.getElementById('submitDispute');

    if (!details.trim()) {
        Swal.fire('Error', 'Please provide details about the issue.', 'error');
        return;
    }

    if (!activeChatId || !currentUser) return;

    // Disable button to prevent double-clicks
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ph ph-circle-notch animate-spin"></i> Raising dispute...';

    try {
        // 1. Fetch current deal details to get IDs for the disputes table
        const { data: chat, error: fetchError } = await supabase
            .from('conversations')
            .select('buyer_id, seller_id')
            .eq('id', activeChatId)
            .single();

        if (fetchError || !chat) throw new Error("Could not retrieve deal details.");

        const reasonLabel = document.querySelector(`#disputeReason option[value="${reason}"]`).text;
        const systemMsg = `⚠️ DISPUTE OPENED\nReason: ${reasonLabel}\nDetails: ${details}`;

        // 2. Insert record into the public.disputes table
        const { error: disputeError } = await supabase
            .from('disputes')
            .insert([{
                conversation_id: activeChatId,
                buyer_id: chat.buyer_id,
                seller_id: chat.seller_id,
                reason: reasonLabel,
                description: details,
                status: 'open'
            }]);

        if (disputeError) throw disputeError;

        // 3. Update Conversation Status to 'disputed'
        const { error: convoError } = await supabase
            .from('conversations')
            .update({ 
                status: 'disputed',
                last_message: `⚠️ Dispute: ${reasonLabel}`,
                updated_at: new Date().toISOString()
            })
            .eq('id', activeChatId);

        if (convoError) throw convoError;

        // 4. Insert System Message into Chat History
        const { error: msgError } = await supabase
            .from('messages')
            .insert([{
                conversation_id: activeChatId,
                sender_id: currentUser.id,
                content: systemMsg,
                type: 'system'
            }]);

        if (msgError) throw msgError;

        // 5. Success UI and Cleanup
        document.getElementById('disputeModal').classList.remove('active');
        Swal.fire({
            title: 'Dispute is open',
            text: 'A moderator has been notified. Funds are frozen until a decision is made.',
            icon: 'success',
            confirmButtonColor: '#0b1e5b'
        });

        // 6. Refresh Sidebar and Chat View
        if (typeof loadSidebar === 'function') await loadSidebar();
        initChatWindow(); // Refresh UI to trigger lockdown/notice states

    } catch (error) {
        console.error("Dispute failed:", error);
        Swal.fire('System Error', 'Could not open dispute. Try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Freeze Funds';
    }
});


// --- Handle Slider Movement ---
const ratingSlider = document.getElementById('ratingSlider');
if (ratingSlider) {
    ratingSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const percentValue = document.getElementById('percentValue');
        const percentLabel = document.getElementById('percentLabel');
        
        if (percentValue) percentValue.innerText = val;

        if (val >= 90) {
            percentLabel.innerText = "Excellent";
            percentLabel.style.color = "#10b981";
        } else if (val >= 50) {
            percentLabel.innerText = "Good";
            percentLabel.style.color = "#f59e0b";
        } else {
            percentLabel.innerText = "Poor";
            percentLabel.style.color = "#ef4444";
        }
    });
}

// --- Handle Rating Submission (Using RPC to bypass RLS) ---
document.getElementById('submitRating')?.addEventListener('click', async () => {
    const slider = document.getElementById('ratingSlider');
    const commentArea = document.getElementById('ratingComment');
    const btn = document.getElementById('submitRating');

    if (!activeChatId || !slider) return;

    const ratingValue = parseInt(slider.value);
    const comment = commentArea.value.trim();

    // 1. Get Seller ID
    const { data: chat } = await supabase
        .from('conversations')
        .select(`seller_id`)
        .eq('id', activeChatId)
        .single();

    if (!chat?.seller_id) return;
    const sellerId = chat.seller_id;

    // 🎯 2. CALCULATE BOOST
    let boost = 0;
    if (ratingValue >= 90) boost = 1.5;
    else if (ratingValue >= 50) boost = 0.5;
    else boost = -3.0;

    btn.disabled = true;
    btn.innerText = "Updating...";

    try {
        // 3. Save the Review
        const { error: revError } = await supabase.from('reviews').insert([{
            conversation_id: activeChatId,
            reviewer_id: currentUser.id,
            seller_id: sellerId,
            rating: ratingValue,
            comment: comment
        }]);
        if (revError) throw revError;

        // 🎯 4. CALL THE DATABASE FUNCTION (Bypasses RLS)
        const { error: rpcError } = await supabase.rpc('update_seller_trust', {
            target_seller_id: sellerId,
            target_buyer_id: currentUser.id,
            boost_amount: boost
        });

        if (rpcError) throw rpcError;

        // 5. Success & Reset
        document.getElementById('ratingModal').classList.remove('active');
        
        // UI Reset
        slider.value = 100;
        commentArea.value = "";
        document.getElementById('percentValue').innerText = "100";
        document.getElementById('percentLabel').innerText = "Excellent";
        document.getElementById('percentLabel').style.color = "#10b981";

        // 🎯 6. REFRESH CHAT TO ACTIVATE LOCKDOWN
        // This ensures the footer disappears and the "Transaction Closed" notice appears immediately.
        await initChatWindow(); 

        Swal.fire('Success', 'Rating submitted! The transaction is now officially closed.', 'success');

        // Optional: Refresh sidebar to show new score
        if (typeof loadSidebar === 'function') await loadSidebar();

    } catch (err) {
        console.error("Critical Error:", err);
        Swal.fire('Error', 'Could not update seller trust.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Feedback";
    }
});


// Close the rating modal when the (X) is clicked
document.getElementById('closeRating')?.addEventListener('click', () => {
    document.getElementById('ratingModal').classList.remove('active');
});
