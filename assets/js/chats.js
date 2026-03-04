import { supabase } from './supabase-config.js';

// State Management
let activeChatId = new URLSearchParams(window.location.search).get('id'); 
let currentUser = null;
let messageSubscription = null;

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) return;
    currentUser = user;

    await loadSidebar();

    if (activeChatId) {
        document.querySelector('.app-container').classList.add('chat-open');
        initChatWindow();
    }

    // --- BACK BUTTON LOGIC ---
    const backBtn = document.getElementById('backToList');
    if (backBtn) {
        backBtn.onclick = async () => {
            document.querySelector('.app-container').classList.remove('chat-open');
            
            if (activeChatId) await markMessagesAsRead(activeChatId);
            
            activeChatId = null;
            if (messageSubscription) supabase.removeChannel(messageSubscription);
            
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('id');
            window.history.pushState({}, '', newUrl);
            
            await loadSidebar();
        };
    }

    // --- SEND MESSAGE LOGIC ---
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
    if(searchBar) {
        searchBar.oninput = (e) => loadSidebar(e.target.value);
    }
});

// --- 2. THE CHAT LIST (SIDEBAR) ---
async function loadSidebar(filter = "") {
    const chatList = document.querySelector('.chat-list');
    if (!chatList || !currentUser) return;

    let { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
            id, last_message, updated_at, buyer_id, seller_id,
            seller:profiles!conversations_seller_id_fkey(username, avatar_url),
            buyer:profiles!conversations_buyer_id_fkey(username, avatar_url),
            messages(is_read, sender_id)
        `)
        .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
        .order('updated_at', { ascending: false });

    if (error) return console.error("Sidebar Error:", error);

    chatList.innerHTML = '';

    conversations.forEach(chat => {
        const isMeBuyer = chat.buyer_id === currentUser.id;
        const otherUser = isMeBuyer ? chat.seller : chat.buyer;
        
        if (filter && !otherUser.username.toLowerCase().includes(filter.toLowerCase())) return;

        const hasUnread = chat.messages.some(m => !m.is_read && m.sender_id !== currentUser.id);
        const isActive = chat.id === activeChatId ? 'active' : '';

        // 🎯 TIME SWAP: Format the conversation timestamp for the sidebar
        const lastUpdated = new Date(chat.updated_at);
        const timeDisplay = lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const item = document.createElement('div');
        item.className = `chat-item ${isActive} ${hasUnread ? 'unread-item' : ''}`;
        item.innerHTML = `
            <img src="${otherUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`}">
            <div class="chat-info">
                <div class="chat-top">
                    <span class="user-name">${otherUser.username}</span>
                    <span class="time">${timeDisplay}</span>
                </div>
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

// --- 3. THE CHAT WINDOW ---
async function initChatWindow() {
    const container = document.querySelector('.message-container');
    const headerName = document.getElementById('headerName');
    const headerAvatar = document.getElementById('headerAvatar');

    if (!container || !activeChatId) return;

    subscribeToMessages();

    const { data: chat } = await supabase
        .from('conversations')
        .select(`*, seller:profiles!conversations_seller_id_fkey(username, avatar_url), buyer:profiles!conversations_buyer_id_fkey(username, avatar_url)`)
        .eq('id', activeChatId)
        .single();

    if (chat) {
        const otherUser = chat.buyer_id === currentUser.id ? chat.seller : chat.buyer;
        headerName.innerText = otherUser.username;
        headerAvatar.src = otherUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`;
    }

    const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeChatId)
        .order('created_at', { ascending: true });

    container.innerHTML = ''; 
    if (messages) messages.forEach(msg => appendMessageUI(msg));
}

// --- 4. HELPERS ---

async function markMessagesAsRead(convId) {
    if (!convId || !currentUser) return;
    await supabase.from('messages')
        .update({ is_read: true })
        .eq('conversation_id', convId)
        .neq('sender_id', currentUser.id);
}

function appendMessageUI(msg) {
    const container = document.querySelector('.message-container');
    if (!container) return;
    
    const isMe = msg.sender_id === currentUser.id;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const div = document.createElement('div');
    div.className = `message ${isMe ? 'outgoing' : 'incoming'}`;
    div.innerHTML = `
        <div class="msg-bubble">
            <p class="content">${msg.content}</p>
            <span class="time">${time}</span>
        </div>`;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function handleSendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !activeChatId) return;

    input.value = ''; 

    const { error: msgError } = await supabase
        .from('messages')
        .insert([{
            conversation_id: activeChatId,
            sender_id: currentUser.id,
            content: content,
            is_read: false
        }]);

    if (!msgError) {
        await supabase
            .from('conversations')
            .update({ 
                last_message: content,
                updated_at: new Date().toISOString()
            })
            .eq('id', activeChatId);
        
        await loadSidebar();
    }
}

function subscribeToMessages() {
    if (messageSubscription) supabase.removeChannel(messageSubscription);

    messageSubscription = supabase.channel(`chat-${activeChatId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `conversation_id=eq.${activeChatId}` 
        }, async (payload) => {
            appendMessageUI(payload.new);
            
            if (payload.new.sender_id !== currentUser.id) {
                await markMessagesAsRead(activeChatId);
            }
            
            // 🎯 Refresh sidebar to update time and dot in real-time
            await loadSidebar();
        })
        .subscribe();
}
