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

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${activeChatId}/${fileName}`;

        console.log("[UPLOAD] Uploading to storage...");
        const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(filePath);

        const replyId = replyingTo ? replyingTo.id : null;

        const { error: msgError } = await supabase
            .from('messages')
            .insert([{
                conversation_id: activeChatId,
                sender_id: currentUser.id,
                content: publicUrl,
                type: 'image', 
                is_read: false,
                reply_to_id: replyId
            }]);

        if (msgError) throw msgError;

        cancelReplyUI();
        await supabase.from('conversations')
            .update({ last_message: '📷 Image', updated_at: new Date().toISOString() })
            .eq('id', activeChatId);

    } catch (err) {
        console.error("[UPLOAD ERROR]", err);
        alert(`Upload failed: ${err.message}`);
    }
}

// --- 3. HEARTBEAT / PRESENCE ---
async function initUserPresence() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

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
            seller:profiles!conversations_seller_id_fkey(id, username, avatar_url, last_seen, show_online), 
            buyer:profiles!conversations_buyer_id_fkey(id, username, avatar_url, last_seen, show_online)`)
        .eq('id', activeChatId)
        .single();

    if (chat) {
        const otherUser = chat.buyer_id === currentUser.id ? chat.seller : chat.buyer;
        headerName.innerText = otherUser.username;
        headerAvatar.src = otherUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`;
        watchPartnerPresence(otherUser);
    }

    // 🎯 Use 'reply_link' constraint hint to solve ambiguity
    const { data: messages, error } = await supabase
    .from('messages')
    .select(`
        *, 
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
// --- 7. MESSAGING HELPERS (FIXED) ---
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
            
            // 🎯 We MUST wait for the joined data, otherwise it shows "User" and "..."
            const { data: fullMsg } = await supabase
                .from('messages')
                .select(`
                    *,
                    reply_to:messages!reply_to_id (
                        id,
                        content,
                        type,
                        sender_id,
                        sender:profiles (username)
                    )
                `)
                .eq('id', payload.new.id)
                .single();

            // Only append if we successfully got the full message details
            if (fullMsg) {
                appendMessageUI(fullMsg);
            } else {
                // Fallback for non-replies
                appendMessageUI(payload.new);
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
            const icon = document.getElementById(`icon-${payload.new.id}`);
            if (icon && payload.new.is_read) {
                icon.className = 'ph ph-checks';
                icon.style.color = '#10b981';
            }
        })
        .subscribe();
}



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

    const isMe = msg.sender_id === currentUser.id;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let replyHTML = '';
    
    // 🎯 COOL REPLACEMENT: A "Jump to Reference" Badge
    if (msg.reply_to_id) {
        // We show who you are replying to, or a generic "Previous Message"
        const replyName = msg.reply_to?.sender?.username || (msg.reply_to_id ? 'Original Message' : '');
        
        replyHTML = `
            <div class="reply-badge" onclick="scrollToMessage('${msg.reply_to_id}')">
                <i class="ph ph-arrow-bend-up-left"></i>
                <span>Replying to <b>${msg.reply_to_id === currentUser.id ? 'You' : replyName}</b></span>
            </div>`;
    }

    const div = document.createElement('div');
    div.id = `msg-${msg.id}`;
    div.className = `message ${isMe ? 'outgoing' : 'incoming'}`;
    
    const contentHTML = (msg.type === 'image') 
        ? `<img src="${msg.content}" class="chat-img" loading="lazy">`
        : `<p class="content">${msg.content}</p>`;

    div.innerHTML = `
        <div class="msg-bubble">
            ${replyHTML}
            ${contentHTML}
            <div class="msg-status">
                <span class="time">${time}</span>
                ${isMe ? `<i class="ph ${msg.is_read ? 'ph-checks' : 'ph-check'}" id="icon-${msg.id}"></i>` : ''}
            </div>
        </div>`;
    
      // --- Interaction Listeners (Double-click & Long-press) ---
    const bubble = div.querySelector('.msg-bubble');
    
    // Desktop Double Click
    bubble.addEventListener('dblclick', () => setReplyUI(msg));

    // Mobile Long Press
    let pressTimer;
    bubble.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(40);
            setReplyUI(msg);
        }, 500); 
    }, { passive: true });

    bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
    bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
    

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
