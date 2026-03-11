import { supabase } from './supabase-config.js';

// State Management
let activeChatId = new URLSearchParams(window.location.search).get('id'); 
let currentUser = null;
let messageSubscription = null;
let statusSubscription = null; 
let heartbeatInterval = null;
let lastTypingSent = 0; 
let typingTimeout = null; 

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) return;
    currentUser = user;

    await initUserPresence();
    await loadSidebar();
    initSettingsToggle(); 

    if (activeChatId) {
        document.querySelector('.app-container').classList.add('chat-open');
        initChatWindow();
    }

    // --- BACK BUTTON ---
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

    // --- SEND MESSAGE & TYPING LOGIC ---
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

        // 📡 Throttled Typing Signal
        messageInput.addEventListener('input', () => {
            const now = Date.now();
            if (now - lastTypingSent > 2000) { 
                sendTypingSignal();
                lastTypingSent = now;
            }
        });
    }

    const searchBar = document.getElementById('chatSearch');
    if(searchBar) {
        searchBar.oninput = (e) => loadSidebar(e.target.value);
    }
});

// --- 2. THE HEARTBEAT (SELF) ---
async function initUserPresence() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    const updateStatus = async () => {
        const { data: profile } = await supabase
            .from('profiles')
            .select('show_online')
            .eq('id', currentUser.id)
            .single();

        if (profile?.show_online) {
            await supabase
                .from('profiles')
                .update({ last_seen: new Date().toISOString() })
                .eq('id', currentUser.id);
        }
    };

    await updateStatus(); 
    heartbeatInterval = setInterval(updateStatus, 20000); 
}

// --- 3. THE TOGGLE SETTING ---
async function initSettingsToggle() {
    const toggle = document.getElementById('onlineStatusToggle'); 
    if (!toggle) return;

    const { data } = await supabase.from('profiles').select('show_online').eq('id', currentUser.id).single();
    toggle.checked = data?.show_online ?? true;

    toggle.onchange = async () => {
        const isEnabled = toggle.checked;
        await supabase.from('profiles').update({ show_online: isEnabled }).eq('id', currentUser.id);
        
        if (!isEnabled) {
            await supabase.from('profiles').update({ last_seen: null }).eq('id', currentUser.id);
        }
        initUserPresence(); 
    };
}

// --- 4. THE SIDEBAR ---
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

// --- 5. THE CHAT WINDOW ---
async function initChatWindow() {
    const container = document.querySelector('.message-container');
    const headerName = document.getElementById('headerName');
    const headerAvatar = document.getElementById('headerAvatar');

    if (!container || !activeChatId) return;

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

    const { data: messages } = await supabase
        .from('messages')
        .select('*').eq('conversation_id', activeChatId).order('created_at', { ascending: true });

    container.innerHTML = ''; 
    if (messages) messages.forEach(msg => appendMessageUI(msg));
}

// --- 6. PRESENCE & TYPING WATCHERS ---
function watchPartnerPresence(partner) {
    const statusLabel = document.getElementById('headerStatus');
    
    const calculateStatus = (lastSeenStr, showOnline) => {
        // Stop the heartbeat from overwriting the "Typing..." text
        if (statusLabel.innerText === "Typing...") return;

        if (!showOnline || !lastSeenStr) {
            statusLabel.innerText = "Offline"; 
            statusLabel.style.color = "#9ca3af";
            return;
        }

        const lastSeen = new Date(lastSeenStr);
        const diffInSeconds = Math.floor((new Date() - lastSeen) / 1000);

        if (diffInSeconds < 45) {
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

// 📡 Send signal using the ACTIVE global subscription
async function sendTypingSignal() {
    if (!activeChatId || !currentUser || !messageSubscription) return;

    if (messageSubscription.state === 'joined') {
        console.log("📡 Outgoing: Broadcasting typing signal...");
        await messageSubscription.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: currentUser.id }
        });
    }
}

function handlePartnerTyping(typingUserId) {
    // ⚠️ For testing on one device, comment out the line below!
    if (typingUserId === currentUser.id) return; 

    const statusLabel = document.getElementById('headerStatus');
    if (!statusLabel) return;

    console.log("📥 Incoming: Partner is typing...");

    // Store original text if we aren't already in typing mode
    if (statusLabel.innerText !== "Typing...") {
        statusLabel.dataset.preTypingStatus = statusLabel.innerText;
        statusLabel.dataset.preTypingColor = statusLabel.style.color;
    }

    statusLabel.innerText = "Typing...";
    statusLabel.style.color = "#10b981";
    statusLabel.classList.add('typing-text'); 

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        console.log("⏲️ Typing stopped: Reverting status.");
        statusLabel.classList.remove('typing-text');
        // Revert to exactly what was there before
        statusLabel.innerText = statusLabel.dataset.preTypingStatus || "Online";
        statusLabel.style.color = statusLabel.dataset.preTypingColor || "#9ca3af";
    }, 3500);
}

// --- 7. MESSAGING HELPERS ---
function subscribeToMessages() {
    if (messageSubscription) supabase.removeChannel(messageSubscription);

    messageSubscription = supabase.channel(`chat-${activeChatId}`, {
        config: {
            broadcast: { self: false },
        }
    })
    .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `conversation_id=eq.${activeChatId}` 
    }, async (payload) => {
        appendMessageUI(payload.new);
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
            icon.style.color = '#9ca3af';
        }
    })
    .on('broadcast', { event: 'typing' }, (payload) => {
        handlePartnerTyping(payload.payload.userId);
    })
    .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log("✅ Joined Chat Room:", activeChatId);
    });
}

function appendMessageUI(msg) {
    const container = document.querySelector('.message-container');
    if (!container || document.getElementById(`msg-${msg.id}`)) return;

    const isMe = msg.sender_id === currentUser.id;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tickIcon = msg.is_read ? 'ph-checks' : 'ph-check';

    const div = document.createElement('div');
    div.id = `msg-${msg.id}`;
    div.className = `message ${isMe ? 'outgoing' : 'incoming'}`;
    div.innerHTML = `
        <div class="msg-bubble">
            <p class="content" style="margin:0;">${msg.content}</p>
            <div class="msg-status" style="display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:4px;">
                <span class="time" style="font-size:0.65rem; color:#9ca3af;">${time}</span>
                ${isMe ? `<i class="ph ${tickIcon}" id="icon-${msg.id}" style="font-size:0.9rem; color:#9ca3af;"></i>` : ''}
            </div>
        </div>`;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function handleSendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !activeChatId) return;

    input.value = ''; 
    const { error: msgError } = await supabase.from('messages').insert([{
        conversation_id: activeChatId, sender_id: currentUser.id, content: content, is_read: false
    }]);

    if (!msgError) {
        await supabase.from('conversations').update({ last_message: content, updated_at: new Date().toISOString() }).eq('id', activeChatId);
    }
}

async function markMessagesAsRead(convId) {
    if (!convId || !currentUser) return;
    await supabase.from('messages').update({ is_read: true })
        .eq('conversation_id', convId).neq('sender_id', currentUser.id).eq('is_read', false); 
}
