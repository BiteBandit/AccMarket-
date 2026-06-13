import { supabase } from './supabase-config.js';

// State Management
let activeChatId = new URLSearchParams(window.location.search).get('id'); 
let currentUser = null;
let messageSubscription = null;    // Handles new chat messages
let partnerStatusSub = null;       // Handles partner's Online/Offline status
let conversationSub = null;        // Handles Deal Status (Cancel/Complete/Escrow)
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

            if (messageSubscription) {
                supabase.removeChannel(messageSubscription);
                messageSubscription = null;
            }
            if (partnerStatusSub) {
                supabase.removeChannel(partnerStatusSub);
                partnerStatusSub = null;
            }
            if (conversationSub) {
                supabase.removeChannel(conversationSub);
                conversationSub = null;
            }
            
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

// --- Helper Function for Badges ---
function generateGoldBadge(trustScore, uniqueId) {
    const isGoldVerified = trustScore >= 85 && trustScore <= 100;
    if (!isGoldVerified) return '';
    return `
        <svg class="meta-badge" viewBox="0 0 24 24" fill="none" style="width: 15px; height: 15px; margin-left: 2px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
            <defs>
                <linearGradient id="goldGradient-${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FFF3B0"/>
                    <stop offset="40%" stop-color="#FFD700"/>
                    <stop offset="100%" stop-color="#D4AF37"/>
                </linearGradient>
            </defs>
            <path d="M12 2L14.2 4.1L17 3.5L18.1 6.1L20.8 6.8L20.5 9.7L22.5 12L20.5 14.3L20.8 17.2L18.1 17.9L17 20.5L14.2 19.9L12 22L9.8 19.9L7 20.5L5.9 17.9L3.2 17.2L3.5 14.3L1.5 12L3.5 9.7L3.2 6.8L5.9 6.1L7 3.5L9.8 4.1L12 2Z" fill="url(#goldGradient-${uniqueId})"/>
            <path d="M9.5 12.5L11 14L15 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
}

// --- 2. UPLOAD LOGIC ---
async function handleFileUpload(file) {
    if (!activeChatId || !currentUser) return;

    const tempId = 'uploading-' + Date.now();
    const container = document.querySelector('.message-container');
    
    const tempDiv = document.createElement('div');
    tempDiv.id = tempId;
    tempDiv.className = 'message outgoing'; 
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

        const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(filePath);

        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);
        const msgType = isImage ? 'image' : 'file';
        const replyId = replyingTo ? replyingTo.id : null;

        const { error: msgError } = await supabase
            .from('messages')
            .insert([{
                conversation_id: activeChatId,
                sender_id: currentUser.id,
                content: publicUrl,
                type: msgType, 
                is_read: false,
                reply_to_id: replyId,
                file_name: file.name
            }]);

        if (msgError) throw msgError;

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
            id, last_message, updated_at, buyer_id, seller_id, admin_id, escrow_step, status, product_name, product_price, product_id,
            seller:profiles!conversations_seller_id_fkey(id, username, avatar_url, last_seen, show_online, trust_score),
            buyer:profiles!conversations_buyer_id_fkey(id, username, avatar_url, last_seen, show_online, trust_score),
            messages(is_read, sender_id)
        `)
        .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id},admin_id.eq.${currentUser.id}`)
        .order('updated_at', { ascending: false });

    if (error) return;

    chatList.innerHTML = '';
    conversations.forEach(chat => {
        const isMeBuyer = chat.buyer_id === currentUser.id;
        const isMeAdmin = chat.admin_id === currentUser.id;

        let otherUser;
        if (isMeAdmin) {
            otherUser = chat.buyer; 
        } else {
            otherUser = isMeBuyer ? chat.seller : chat.buyer;
        }

        if (!otherUser) return;
        if (filter && !otherUser.username.toLowerCase().includes(filter.toLowerCase())) return;

        const hasUnread = chat.messages.some(m => 
            m && 
            m.is_read === false && 
            m.sender_id && 
            m.sender_id !== currentUser.id &&
            chat.id !== activeChatId
        );
        const isActive = chat.id === activeChatId ? 'active' : '';

        const msgDate = new Date(chat.updated_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let timeDisplay = (msgDate.toDateString() === today.toDateString()) 
            ? msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : (msgDate.toDateString() === yesterday.toDateString()) ? "Yesterday" : msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

        const goldBadgeSvg = generateGoldBadge(otherUser?.trust_score || 0, `sidebar-${chat.id}`);

        const item = document.createElement('div');
        item.className = `chat-item ${isActive} ${hasUnread ? 'unread-item' : ''}`;
        
        const adminBadge = isMeAdmin ? `<span style="font-size:10px; background:#e0e7ff; color:#4338ca; padding:2px 5px; border-radius:4px; margin-left:5px;">Admin</span>` : '';

        item.innerHTML = `
            <img src="${otherUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`}">
            <div class="chat-info">
                <div class="chat-top">
                    <span class="user-name" style="display: inline-flex; align-items: center; gap: 1px;">
                        ${otherUser.username} ${goldBadgeSvg} ${adminBadge}
                    </span>
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

// --- 5. CHAT WINDOW ---
async function initChatWindow() {
    const container = document.querySelector('.message-container');
    const headerName = document.getElementById('headerName');
    const headerAvatar = document.getElementById('headerAvatar');

    if (!container || !activeChatId) return;

    if (!window.adminProfilesCache) {
        window.adminProfilesCache = {};
        try {
            const { data: admins } = await supabase
                .from('profiles')
                .select('id, username, role, trust_score')
                .eq('role', 'admin');
                
            if (admins) {
                admins.forEach(admin => {
                    window.adminProfilesCache[admin.id] = admin;
                });
            }
        } catch (err) {
            console.error("Failed to pre-load admin profiles:", err);
        }
    }

    console.log("[CHAT] Refreshing view for:", activeChatId);
    subscribeToMessages();
    subscribeToConversationChanges();

    const { data: chat } = await supabase
        .from('conversations')
        .select(`*, 
            product_id,
            product_name, 
            product_price,
            admin_id,
            seller:profiles!conversations_seller_id_fkey(id, username, avatar_url, last_seen, show_online, trust_score), 
            buyer:profiles!conversations_buyer_id_fkey(id, username, avatar_url, last_seen, show_online, trust_score)`)
        .eq('id', activeChatId)
        .single();

    if (chat) {
        window.activeChatData = chat; 

        await refreshMenuVisibility();

        const otherUser = chat.buyer_id === currentUser.id ? chat.seller : chat.buyer;
        
        const goldBadgeSvg = generateGoldBadge(otherUser?.trust_score || 0, `header-${chat.id}`);

        if(headerName) {
            headerName.style.display = "inline-flex";
            headerName.style.alignItems = "center";
            headerName.style.gap = "1px";
            headerName.innerHTML = `${otherUser.username} ${goldBadgeSvg}`;
        }

        if(headerAvatar) {
            headerAvatar.src = otherUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.username}`;
        }

        if (chat.escrow_step === 0) {
            console.log("[ESCROW] Initializing Step 1...");
            await upgradeToStepOne(); 
        } else {
            updateEscrowUI(chat.escrow_step);
        }

        syncLockdownUI(chat.status, chat.admin_id);

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

        if (pTitle) pTitle.innerText = chat.product_name || "Unknown Item";
        if (pPrice) pPrice.innerText = `₦${chat.product_price || '0.00'}`;

        if (pImg && chat.product_name) {
            const platform = chat.product_name.toLowerCase().trim();
            pImg.src = logos[platform] || "../images/default-platform.png"; 
        }

        if (viewBtn) {
            viewBtn.onclick = () => {
                const platform = chat.product_name ? chat.product_name.toLowerCase().trim() : "";
                const productId = chat.product_id;
                if (platform && productId) {
                    window.location.href = `../platforms/${platform}.html?id=${productId}`;
                } else if (platform) {
                    window.location.href = `../platforms/${platform}.html`;
                }
            };
        }

        watchPartnerPresence(otherUser);
    }

    const { data: messages } = await supabase
        .from('messages')
        .select(`*, sender:profiles(username, avatar_url, role, trust_score), reply_to:messages!reply_to_id(id, content, type, sender_id, sender:profiles(username))`)
        .eq('conversation_id', activeChatId)
        .order('created_at', { ascending: true });

    container.innerHTML = ''; 

    if (chat && chat.status === 'active') {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'system-pill-container'; 
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

    if (partnerStatusSub) supabase.removeChannel(partnerStatusSub);
    
    partnerStatusSub = supabase.channel(`status-${partner.id}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${partner.id}` 
        }, (payload) => {
            calculateStatus(payload.new.last_seen, payload.new.show_online);
        })
        .subscribe();
}
 
// --- 7. MESSAGING HELPERS ---
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
            
            if (document.getElementById(`msg-${payload.new.id}`)) return;

            const cachedAdmin = window.adminProfilesCache ? window.adminProfilesCache[payload.new.sender_id] : null;

            if (payload.new.type === 'system' && !cachedAdmin) {
                appendMessageUI(payload.new);
            } else {
                const { data: fullMsg } = await supabase
                    .from('messages')
                    .select(`
                        *,
                        sender:profiles(username, avatar_url, role, trust_score), 
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
            const icon = document.getElementById(`icon-${payload.new.id}`);
            if (icon && payload.new.is_read) {
                icon.className = 'ph ph-checks';
                icon.style.color = '#10b981';
            }

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

function subscribeToConversationChanges() {
    if (conversationSub) supabase.removeChannel(conversationSub);

    conversationSub = supabase.channel(`conv-status-${activeChatId}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'conversations', 
            filter: `id=eq.${activeChatId}` 
        }, (payload) => {
            console.log("[REALTIME] Deal Update:", payload.new.status);
            const updatedChat = payload.new;
            window.activeChatData = updatedChat;

            if (typeof updateEscrowUI === 'function') {
                updateEscrowUI(updatedChat.escrow_step);
            }

            refreshMenuVisibility();
            syncLockdownUI(updatedChat.status, updatedChat.admin_id);
            loadSidebar();
        })
        .subscribe();
}

// --- 9. DELETE LOGIC ---
async function deleteMessage(msgId, senderId) {
    if (!currentUser || senderId !== currentUser.id) return;

    const currentStatus = window.activeChatData?.status;
    if (['disputed', 'cancelled', 'completed'].includes(currentStatus)) {
        Swal.fire({
            title: 'Action Blocked',
            text: 'Messages cannot be deleted after a dispute is raised or a deal is closed to preserve evidence.',
            icon: 'error',
            confirmButtonColor: '#0b1e5b'
        });
        
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
        const { data: msgToDelete } = await supabase
            .from('messages')
            .select('id, conversation_id, created_at')
            .eq('id', msgId)
            .single();

        if (!msgToDelete) return;

        const { error: msgError } = await supabase
            .from('messages')
            .update({ 
                content: '🚫 This message was deleted', 
                type: 'deleted', 
                reply_to_id: null 
            })
            .eq('id', msgId);

        if (msgError) throw msgError;

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
window.deleteMessage = deleteMessage;

function setReplyUI(msg) {
    if (!msg) return;
    replyingTo = msg;
    
    const footer = document.querySelector('.chat-footer');
    if (!footer) {
        console.error("Chat footer wrapper not found!");
        return;
    }

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
    
    let displayName = "User";
    if (msg.sender_id === currentUser.id) {
        displayName = "You";
    } else if (msg.sender && msg.sender.username) {
        displayName = msg.sender.username;
    } else {
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

    const cachedAdmin = window.adminProfilesCache ? window.adminProfilesCache[msg.sender_id] : null;
    const isAdminUser = cachedAdmin || msg.sender?.role === 'admin';
    const isMe = msg.sender_id === currentUser.id;

    if (msg.type === 'system') {
        const text = msg.content || "";
        const isDisputeOrCancel = text.includes('DISPUTE') || text.includes('CANCELLED') || text.includes('⚠️') || text.includes('❌');
        
        const systemDiv = document.createElement('div');
        systemDiv.id = `msg-${msg.id}`;
        systemDiv.className = 'msg-system';
        systemDiv.innerHTML = `<div class="system-pill ${isDisputeOrCancel ? 'dispute-alert' : 'action-success-pill'}">${text}</div>`;
        
        container.appendChild(systemDiv);
        container.scrollTop = container.scrollHeight;
        return; 
    }

    const msgDate = new Date(msg.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateLabel = (msgDate.toDateString() === today.toDateString()) ? "Today" : 
                    (msgDate.toDateString() === yesterday.toDateString()) ? "Yesterday" : 
                    msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

    const time = `${dateLabel}, ${msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; 
    
    const messageClass = (isMe ? 'outgoing' : (msg.isAdminChatBubble || isAdminUser ? 'incoming admin-custom-bubble' : 'incoming'));

    const div = document.createElement('div');
    div.id = `msg-${msg.id}`;
    div.className = `message ${messageClass}`;

    let replyHTML = '';
    if (msg.reply_to_id) {
        const otherName = document.getElementById('headerName')?.innerText || 'User';
        const replyName = (msg.reply_to?.sender_id === currentUser.id) ? 'You' : (msg.reply_to?.sender?.username || otherName);
        replyHTML = `<div class="reply-badge" onclick="scrollToMessage('${msg.reply_to_id}')"><i class="ph ph-arrow-bend-up-left"></i><span>Replying to <b>${replyName}</b></span></div>`;
    }

    let contentHTML = '';
    if (msg.type === 'deleted') contentHTML = `<p class="content deleted-text">${msg.content}</p>`;
    else if (msg.type === 'image') contentHTML = `<img src="${msg.content}" class="chat-img" loading="lazy" onclick="window.open('${msg.content}', '_blank')">`;
    else if (msg.type === 'file') {
        contentHTML = `<div class="file-attachment-box" onclick="window.open('${msg.content}', '_blank')"><i class="ph-fill ph-file-text"></i><div class="file-info"><span>${msg.file_name || 'Attachment'}</span><small>Click to view</small></div></div>`;
    } else {
        contentHTML = `<p class="content">${msg.content}</p>`;
    }

    const isLocked = ['disputed', 'cancelled', 'completed'].includes(window.activeChatData?.status);

    let senderHeaderNameHTML = '';
    if (msg.isAdminChatBubble || isAdminUser) {
        const adminName = cachedAdmin?.username || msg.sender?.username || "System Admin";
        const goldBadgeSvg = generateGoldBadge(cachedAdmin?.trust_score || msg.sender?.trust_score || 0, `msg-${msg.id}`);
        senderHeaderNameHTML = `<span class="sender-name" style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; margin-bottom: 4px; color: #1e3a8a; font-weight: bold; width: 100%; justify-content: ${isMe ? 'flex-end' : 'flex-start'}; padding-${isMe ? 'right' : 'left'}: 4px;">${isMe ? '' : '<i class="ph-fill ph-shield-check"></i>'} ${adminName} (Staff) ${goldBadgeSvg} ${isMe ? '<i class="ph-fill ph-shield-check"></i>' : ''}</span>`;
    } else if (!isMe && msg.sender?.username) {
        senderHeaderNameHTML = `<span class="sender-name" style="display: inline-flex; align-items: center; gap: 1px; font-size: 0.75rem; margin-bottom: 2px; color: #475569; font-weight: 500;">${msg.sender.username} ${generateGoldBadge(msg.sender?.trust_score || 0, `msg-${msg.id}`)}</span>`;
    }

    div.innerHTML = `
        ${(isMe && !isLocked) ? `<div class="swipe-delete-btn" onclick="deleteMessage('${msg.id}', '${msg.sender_id}')"><i class="ph ph-trash"></i></div>` : ''}
        ${senderHeaderNameHTML}
        <div class="msg-bubble">
            ${replyHTML}
            ${contentHTML}
            <div class="msg-status"><span class="time">${time}</span>${isMe ? `<i class="ph ${msg.is_read ? 'ph-checks' : 'ph-check'}" id="icon-${msg.id}"></i>` : ''}</div>
        </div>`;

    const bubble = div.querySelector('.msg-bubble');
    let startX = 0, currentX = 0;
    bubble.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    bubble.addEventListener('touchmove', (e) => {
        if (isMe && !isLocked) {
            currentX = e.touches[0].clientX - startX;
            if (currentX < 0) bubble.style.transform = `translateX(${Math.max(currentX, -80)}px)`;
        }
    }, { passive: true });
    bubble.addEventListener('touchend', () => {
        if (isMe && !isLocked) bubble.style.transition = 'transform 0.3s', bubble.style.transform = currentX < -40 ? 'translateX(-70px)' : 'translateX(0)';
    });

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

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

async function upgradeToStepOne() {
    if (!activeChatId || !currentUser) return;

    const systemText= "💰 Payment confirmed. Funds are now held in Escrow. Seller, please send the login details here so the buyer can verify the account.";

    await supabase.from('conversations')
        .update({ 
            escrow_step: 1, 
            last_message: systemText, 
            updated_at: new Date().toISOString() 
        })
        .eq('id', activeChatId);

    const { error } = await supabase.from('messages').insert([{
        conversation_id: activeChatId,
        sender_id: currentUser.id, 
        content: systemText,
        type: 'system' 
    }]);

    if (error) console.error("[DATABASE ERROR] Message not saved:", error.message);

    updateEscrowUI(1);
    await loadSidebar();
}

function updateEscrowUI(step) {
    const stepPaid = document.querySelector('.status-step:nth-child(1)');
    const lineDelivery = document.querySelector('.status-line:nth-child(2)');
    const stepDelivery = document.getElementById('stepDelivery');
    const lineRelease = document.getElementById('lineRelease');
    const stepRelease = document.getElementById('stepRelease');

    [stepPaid, stepDelivery, stepRelease].forEach(el => el?.classList.remove('active', 'completed'));
    [lineDelivery, lineRelease].forEach(el => el?.classList.remove('completed'));

    if (step === 0) return;
    
    if (step >= 1) {
        stepPaid?.classList.add('completed'); 
        lineDelivery?.classList.add('completed');
    }
    if (step >= 2) {
        stepDelivery?.classList.add('completed');
        lineRelease?.classList.add('completed');
    }
    if (step >= 3) {
        stepRelease?.classList.add('completed');
    }
}
window.updateEscrowUI = updateEscrowUI;

function syncLockdownUI(status, admin_id) {
    const footer = document.querySelector('.chat-footer');
    const messageInput = document.getElementById('messageInput');
    const attachBtn = document.getElementById('attachBtn');
    
    const hasAdmin = (admin_id !== null && admin_id !== undefined && admin_id !== "");
    const isLocked = (status === 'cancelled' || status === 'completed');
    
    if (status === 'disputed') {
        if (!hasAdmin) {
            lockChatFooter("Dispute initiated. Waiting for an admin to join...");
        } else {
            unlockChatFooter(true);
        }
        return;
    }

    if (isLocked) {
        lockChatFooter("Transaction " + status.toUpperCase() + " — Messaging Disabled");
        return;
    }

    unlockChatFooter(false);

    function lockChatFooter(message) {
        if (footer) footer.style.display = 'none';
        if (messageInput) messageInput.disabled = true;
        if (attachBtn) attachBtn.style.pointerEvents = 'none';

        let notice = document.getElementById('closedNotice');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'closedNotice';
            notice.className = 'chat-closed-notice';
            if (footer && footer.parentNode) {
                footer.parentNode.appendChild(notice);
            }
        }
        notice.innerHTML = `<i class="ph-fill ph-lock"></i> ${message}`;
    }

    function unlockChatFooter(isDisputeMode) {
        if (footer) footer.style.display = 'flex';
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = isDisputeMode ? "Discuss the dispute here..." : "Type a message...";
        }
        if (attachBtn) attachBtn.style.pointerEvents = 'auto';
        
        document.getElementById('closedNotice')?.remove();
    }
}

window.toggleStatusMenu = async function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("statusMenu");
    if (!menu) return;

    menu.classList.toggle("show");
    if (menu.classList.contains("show")) {
        await refreshMenuVisibility();
    }
};

async function refreshMenuVisibility() {
    if (!activeChatId || !currentUser) return;

    const { data: chat, error } = await supabase
        .from("conversations")
        .select("seller_id, buyer_id, admin_id, escrow_step, status")
        .eq("id", activeChatId)
        .single();

    if (error || !chat) {
        console.error("Database Error:", error);
        return;
    }

    const isSeller = currentUser.id === chat.seller_id;
    const isBuyer = currentUser.id === chat.buyer_id;
    const isAssignedAdmin = (currentUser.id === chat.admin_id);
    const isDisputed = (chat.status === 'disputed');
    const step = chat.escrow_step || 1;

    const btnConfirm = document.getElementById("btnConfirmDelivery");
    const btnRelease = document.getElementById("btnReleaseFunds");
    const btnCancel = document.getElementById("btnCancel");
    const btnDispute = document.getElementById("btnDispute");
    const btnAdminRefund = document.getElementById("btnAdminRefund");
    const btnAdminRelease = document.getElementById("btnAdminRelease");

    if (isAssignedAdmin) {
        if (btnConfirm) btnConfirm.style.display = "none";
        if (btnRelease) btnRelease.style.display = "none";
        if (btnCancel) btnCancel.style.display = "none";
        if (btnDispute) btnDispute.style.display = "none";

        if (btnAdminRefund) btnAdminRefund.style.display = isDisputed ? "flex" : "none";
        if (btnAdminRelease) btnAdminRelease.style.display = isDisputed ? "flex" : "none";
        return;
    }

    if (btnAdminRefund) btnAdminRefund.style.display = "none";
    if (btnAdminRelease) btnAdminRelease.style.display = "none";

    if (chat.status === 'cancelled' || chat.status === 'completed') {
        if (btnConfirm) btnConfirm.style.display = "none";
        if (btnRelease) btnRelease.style.display = "none";
        if (btnCancel) btnCancel.style.display = "none";
        if (btnDispute) btnDispute.style.display = "none";
        return;
    }

    if (btnDispute) btnDispute.style.display = "flex"; 
    if (btnCancel) btnCancel.style.display = (step === 1) ? "flex" : "none";
    if (btnConfirm) btnConfirm.style.display = (isSeller && step === 1) ? "flex" : "none";
    if (btnRelease) btnRelease.style.display = (isBuyer && step === 2) ? "flex" : "none";
}

window.upgradeToStepTwo = () => console.log("Button clicked: Confirm Delivery");
window.upgradeToStepThree = () => console.log("Button clicked: Release Funds");
window.handleDispute = () => console.log("Button clicked: Dispute");

document.addEventListener("click", () => {
    document.getElementById("statusMenu")?.classList.remove("show");
});

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
        const basePrice = parseFloat(chat.product_price);

        const feeRate = (basePrice === 1500) ? 0.05 : 0.03;
        const totalRefund = basePrice + (basePrice * feeRate);

        const { error: rpcError } = await supabase.rpc('handle_cancel_refund', {
            target_buyer_id: chat.buyer_id,
            refund_amount: totalRefund, 
            target_conv_id: activeChatId,
            product_name: chat.product_name 
        });

        if (rpcError) throw rpcError;

        await supabase.from('conversations').update({ 
            status: 'cancelled',           
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

        const { data: profile } = await supabase
            .from('profiles')
            .select('telegram_chat_id, telegram_alerts') 
            .eq('id', notifyTargetId)
            .single();

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
        await loadSidebar();
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
        const { data: chat, error: fetchError } = await supabase
            .from('conversations')
            .select('product_name, buyer_id')
            .eq('id', activeChatId)
            .single();

        if (fetchError || !chat) throw new Error("Deal details not found.");

        const now = new Date();
        const localTime = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });

        const systemText = "📦 Seller has marked the logs as delivered. Buyer, please verify and release funds.";

        const { error: updateError } = await supabase.from('conversations')
            .update({ 
                escrow_step: 2, 
                last_message: systemText, 
                updated_at: now.toISOString() 
            })
            .eq('id', activeChatId);

        if (updateError) throw updateError;

        await supabase.from('messages').insert([{
            conversation_id: activeChatId,
            sender_id: currentUser.id, 
            content: systemText,
            type: 'system' 
        }]);

        await supabase.from('notifications').insert([{
            user_id: chat.buyer_id, 
            title: "Logs Delivered",
            message: `The seller has delivered the logs for "${chat.product_name}" at ${localTime}. Please verify and release funds.`,
            icon: "fas fa-box-open",
            is_read: false,
            type: "alert",
            created_at: now.toISOString() 
        }]);

        const { data: profile } = await supabase
            .from('profiles')
            .select('telegram_chat_id, telegram_alerts') 
            .eq('id', chat.buyer_id)
            .single();

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

        updateEscrowUI(2); 
        document.getElementById('statusMenu')?.classList.remove('show');
        await loadSidebar();
        
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
        const { data: chat, error: fetchError } = await supabase
            .from('conversations')
            .select('product_name, seller_id, product_price, buyer_id')
            .eq('id', activeChatId)
            .single();

        if (fetchError || !chat) throw new Error("Deal details not found.");

        const now = new Date();
        const localTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        const systemText = "✅ Funds released! Transaction completed successfully.";

        const { error: rpcError } = await supabase.rpc('handle_release_funds', {
            target_seller_id: chat.seller_id,
            amount_to_release: parseFloat(chat.product_price),
            target_conv_id: activeChatId,
            product_name: chat.product_name
        });

        if (rpcError) throw rpcError;

        await supabase.from('conversations').update({ 
            escrow_step: 3, 
            status: 'completed',
            last_message: systemText, 
            updated_at: now.toISOString() 
        }).eq('id', activeChatId);

        await supabase.from('messages').insert([{
            conversation_id: activeChatId,
            sender_id: currentUser.id, 
            content: systemText,
            type: 'system' 
        }]);

        await supabase.from('notifications').insert([{
            user_id: chat.seller_id, 
            title: "Payment Received",
            message: `Funds for "${chat.product_name}" (₦${chat.product_price}) were added to your wallet at ${localTime}.`,
            icon: "fas fa-wallet",
            is_read: false,
            type: "success",
            created_at: now.toISOString() 
        }]);

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

        updateEscrowUI(3);
        await loadSidebar();
        document.getElementById('ratingModal').classList.add('active'); 

    } catch (error) {
        console.error("Release failed:", error);
        Swal.fire('Error', 'Wallet update failed. Please contact support.', 'error');
    }
};

window.handleDispute = function() {
    const modal = document.getElementById('disputeModal');
    if (modal) {
        document.getElementById('disputeDetails').value = '';
        modal.classList.add('active');
    }
};

window.handleAdminAction = async function(actionType) {
    if (!activeChatId || !currentUser) return;

    const confirm = await Swal.fire({
        title: actionType === 'refund' ? 'Refund Buyer?' : 'Release Funds to Seller?',
        text: "This action is final and will resolve the dispute.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: actionType === 'refund' ? '#ef4444' : '#22c55e',
        confirmButtonText: 'Yes, Proceed'
    });

    if (!confirm.isConfirmed) return;

    try {
        const { data: chat } = await supabase
            .from('conversations')
            .select('product_price, buyer_id, seller_id, product_name')
            .eq('id', activeChatId)
            .single();

        if (!chat) throw new Error("Conversation not found.");

        let rpcError;
        let systemText;

        if (actionType === 'refund') {
            const { error } = await supabase.rpc('handle_cancel_refund', {
                target_buyer_id: chat.buyer_id,
                refund_amount: parseFloat(chat.product_price),
                target_conv_id: activeChatId,
                product_name: chat.product_name
            });
            rpcError = error;
            systemText = "⚖️ Admin resolved: Refunded to Buyer.";
        } else {
            const { error } = await supabase.rpc('handle_release_funds', {
                target_seller_id: chat.seller_id,
                amount_to_release: parseFloat(chat.product_price),
                target_conv_id: activeChatId,
                product_name: chat.product_name
            });
            rpcError = error;
            systemText = "⚖️ Admin resolved: Released to Seller.";
        }

        if (rpcError) throw rpcError;

        await supabase.from('conversations').update({ 
            status: 'completed', 
            last_message: systemText
        }).eq('id', activeChatId);

        await supabase.from('messages').insert([{
            conversation_id: activeChatId,
            sender_id: currentUser.id,
            content: systemText,
            type: 'system'
        }]);

        Swal.fire('Success', 'Dispute resolved successfully.', 'success');
        await initChatWindow(); 

    } catch (error) {
        console.error("Admin Action Failed:", error);
        Swal.fire('Error', error.message || 'Action failed.', 'error');
    }
};

// Modals Handling Event Listeners Setup
document.getElementById('closeDispute')?.addEventListener('click', () => {
    document.getElementById('disputeModal').classList.remove('active');
});

document.getElementById('cancelDispute')?.addEventListener('click', () => {
    document.getElementById('disputeModal').classList.remove('active');
});

document.getElementById('submitDispute')?.addEventListener('click', async () => {
    const reason = document.getElementById('disputeReason').value;
    const details = document.getElementById('disputeDetails').value;
    const submitBtn = document.getElementById('submitDispute');

    if (!details.trim()) {
        Swal.fire('Error', 'Please provide details about the issue.', 'error');
        return;
    }

    if (!activeChatId || !currentUser) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="ph ph-circle-notch animate-spin"></i> Raising dispute...';

    try {
        const { data: chat, error: fetchError } = await supabase
            .from('conversations')
            .select('buyer_id, seller_id')
            .eq('id', activeChatId)
            .single();

        if (fetchError || !chat) throw new Error("Could not retrieve deal details.");

        const reasonLabel = document.querySelector(`#disputeReason option[value="${reason}"]`).text;
        const systemMsg = `⚠️ DISPUTE OPENED\nReason: ${reasonLabel}\nDetails: ${details}`;

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

        const { error: convoError } = await supabase
            .from('conversations')
            .update({ 
                status: 'disputed',
                last_message: `⚠️ Dispute: ${reasonLabel}`,
                updated_at: new Date().toISOString()
            })
            .eq('id', activeChatId);

        if (convoError) throw convoError;

        const { error: msgError } = await supabase
            .from('messages')
            .insert([{
                conversation_id: activeChatId,
                sender_id: currentUser.id,
                content: systemMsg,
                type: 'system'
            }]);

        if (msgError) throw msgError;

        document.getElementById('disputeModal').classList.remove('active');
        Swal.fire({
            title: 'Dispute is open',
            text: 'A moderator has been notified. Funds are frozen until a decision is made.',
            icon: 'success',
            confirmButtonColor: '#0b1e5b'
        });

        await loadSidebar();
        initChatWindow();

    } catch (error) {
        console.error("Dispute failed:", error);
        Swal.fire('System Error', 'Could not open dispute. Try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Freeze Funds';
    }
});

const ratingSlider = document.getElementById('ratingSlider');
if (ratingSlider) {
    ratingSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const percentValue = document.getElementById('percentValue');
        const percentLabel = document.getElementById('percentLabel');
        
        if (percentValue) percentValue.innerText = val;

        if (val >= 90) {
            if(percentLabel) {
                percentLabel.innerText = "Excellent";
                percentLabel.style.color = "#10b981";
            }
        } else if (val >= 50) {
            if(percentLabel) {
                percentLabel.innerText = "Good";
                percentLabel.style.color = "#f59e0b";
            }
        } else {
            if(percentLabel) {
                percentLabel.innerText = "Poor";
                percentLabel.style.color = "#ef4444";
            }
        }
    });
}

document.getElementById('submitRating')?.addEventListener('click', async () => {
    const slider = document.getElementById('ratingSlider');
    const commentArea = document.getElementById('ratingComment');
    const btn = document.getElementById('submitRating');

    if (!activeChatId || !slider) return;

    const ratingValue = parseInt(slider.value);
    const comment = commentArea.value.trim();

    const { data: chat } = await supabase
        .from('conversations')
        .select(`seller_id`)
        .eq('id', activeChatId)
        .single();

    if (!chat?.seller_id) return;
    const sellerId = chat.seller_id;

    let boost = 0;
    if (ratingValue >= 90) boost = 1.5;
    else if (ratingValue >= 50) boost = 0.5;
    else boost = -3.0;

    btn.disabled = true;
    btn.innerText = "Updating...";

    try {
        const { error: revError } = await supabase.from('reviews').insert([{
            conversation_id: activeChatId,
            reviewer_id: currentUser.id,
            seller_id: sellerId,
            rating: ratingValue,
            comment: comment
        }]);
        if (revError) throw revError;

        const { error: rpcError } = await supabase.rpc('update_seller_trust', {
            target_seller_id: sellerId,
            target_buyer_id: currentUser.id,
            boost_amount: boost
        });

        if (rpcError) throw rpcError;

        document.getElementById('ratingModal').classList.remove('active');
        
        slider.value = 100;
        commentArea.value = "";
        
        const pVal = document.getElementById('percentValue');
        const pLabel = document.getElementById('percentLabel');
        if(pVal) pVal.innerText = "100";
        if(pLabel) {
            pLabel.innerText = "Excellent";
            pLabel.style.color = "#10b981";
        }

        await initChatWindow(); 
        Swal.fire('Success', 'Rating submitted! The transaction is now officially closed.', 'success');
        await loadSidebar();

    } catch (err) {
        console.error("Critical Error:", err);
        Swal.fire('Error', 'Could not update seller trust.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Feedback";
    }
});

document.getElementById('closeRating')?.addEventListener('click', () => {
    document.getElementById('ratingModal').classList.remove('active');
});