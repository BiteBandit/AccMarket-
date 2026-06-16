// 1. Sidebar & UI Elements
const sidebarToggle = document.getElementById("sidebarToggle");
const profileToggle = document.getElementById("profileToggle");
const leftSidebar = document.getElementById("leftSidebar");
const rightSidebar = document.getElementById("rightSidebar");
const closeLeft = document.getElementById("closeLeft");
const closeRight = document.getElementById("closeRight");

// Toggle Left Sidebar
sidebarToggle?.addEventListener("click", () => leftSidebar?.classList.add("active"));
closeLeft?.addEventListener("click", () => leftSidebar?.classList.remove("active"));

// Toggle Right Sidebar
profileToggle?.addEventListener("click", () => rightSidebar?.classList.add("active"));
closeRight?.addEventListener("click", () => rightSidebar?.classList.remove("active"));

// ✅ Global State for Filtering/Sorting managed in RAM memory
let activeAccounts = [];
let cachedCurrentUserId = null;
let cachedMyFollowingList = [];

const filterBtn = document.querySelector(".fa-sliders");
const filterBar = document.getElementById("filterBar");

filterBtn?.addEventListener("click", () => {
    filterBar?.classList.toggle("active");
});

/**
 * Synchronizes the logged-in user follow metrics safely in memory cache.
 */
function syncFollowCache() {
    if (cachedCurrentUserId && window.currentGlobalProfiles && Array.isArray(window.currentGlobalProfiles)) {
        const myProfileData = window.currentGlobalProfiles.find(p => p.id === cachedCurrentUserId);
        cachedMyFollowingList = myProfileData?.following?.uids || [];
    } else {
        cachedMyFollowingList = [];
    }
}

/**
 * ⚡ 10x FASTER INSTANT FILTERING ENGINE
 * Runs 100% synchronously with zero network requests or database race conditions.
 */
const applyFilters = () => {
    // 1. Instantly parse UI metrics
    const maxPrice = document.getElementById('priceRange') ? parseFloat(document.getElementById('priceRange').value) : 500000;
    const minFollowers = document.getElementById('followerRange') ? parseInt(document.getElementById('followerRange').value) : 0;
    const minYear = document.getElementById('yearRange') ? parseInt(document.getElementById('yearRange').value) : 1999;
    const searchTerm = document.getElementById('assetSearch') ? document.getElementById('assetSearch').value.toLowerCase().trim() : "";
    const followingOnlyChecked = document.getElementById('followingOnlyToggle')?.checked || false;

    // 2. Synchronously Update Text Label UI Objects
    if(document.getElementById('priceVal') && document.getElementById('priceRange')) {
        document.getElementById('priceVal').textContent = `₦${parseFloat(document.getElementById('priceRange').value).toLocaleString()}`;
    }
    if(document.getElementById('followerVal') && document.getElementById('followerRange')) {
        document.getElementById('followerVal').textContent = `${parseInt(document.getElementById('followerRange').value).toLocaleString()}+`;
    }
    if(document.getElementById('yearVal') && document.getElementById('yearRange')) {
        document.getElementById('yearVal').textContent = `${document.getElementById('yearRange').value}+`;
    }

    // Always keep tracking follow arrays synchronized before running filtering rules
    syncFollowCache();

    // 3. High-speed programmatic array filter matrix
    const filtered = activeAccounts.filter(row => {
        if (row.status !== 'approved') return false;

        const meta = row.data;
        if (!meta) return false;
        
        const price = meta.price !== undefined ? parseFloat(meta.price) : 0;
        
        // Fast follower structural text format parser ('k','m','b')
        let followersRaw = String(meta.followers || "0").toLowerCase();
        if (followersRaw.includes('b')) followersRaw = parseFloat(followersRaw) * 1000000000;
        else if (followersRaw.includes('m')) followersRaw = parseFloat(followersRaw) * 1000000;
        else if (followersRaw.includes('k')) followersRaw = parseFloat(followersRaw) * 1000;
        const followers = parseInt(followersRaw) || 0;

        const year = parseInt(String(meta.account_age || "").match(/\d{4}/)?.[0]) || 0;

        const usernameStr = String(meta.username || "").toLowerCase();
        const regionStr = String(meta.region || "").toLowerCase();

        // 🟢 FIXED short-circuit condition: skips filtering if input box is completely blanked out
        const matchesSearch = searchTerm === "" || usernameStr.includes(searchTerm) || regionStr.includes(searchTerm);
        const matchesPrice = price === 0 || price <= maxPrice;
        const matchesFollowers = followers >= minFollowers;
        const matchesYear = year === 0 || year >= minYear;
        
        // Verified identity checks computed without falling back to blank grids
        const matchesFollowingFilter = !followingOnlyChecked || cachedMyFollowingList.includes(row.user_id);

        return matchesSearch && matchesPrice && matchesFollowers && matchesYear && matchesFollowingFilter;
    });

    // Re-render layout grid immediately
    renderGrid(filtered);
};

// 🟢 EVENT REGISTRATIONS: Keep processing synchronous to stop runtime lag
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('filter-slider') || e.target.id === 'assetSearch') {
        applyFilters();
    }
});

document.addEventListener('change', (e) => {
    if (e.target.id === 'followingOnlyToggle') {
        applyFilters();
    }
});

// Sidebar Live Search
document.addEventListener("DOMContentLoaded", () => {
    const sidebarSearch = document.querySelector(".sidebar.left .search-box input");
    const categoryItems = document.querySelectorAll("#categoryList li a");

    sidebarSearch?.addEventListener("keyup", () => {
        let input = sidebarSearch.value.toLowerCase().trim();
        categoryItems.forEach((item) => {
            if (item.parentElement) {
                item.parentElement.style.display = item.textContent.toLowerCase().includes(input) ? "block" : "none";
            }
        });
    });
});

// ✅ Initialize Supabase
import { supabase } from './supabase-config.js';

// Get the logged-in user details once on startup
async function getCurrentUser() {
    const { data: authData, error } = await supabase.auth.getUser();
    if (error || !authData?.user) return null;

    const user = authData.user;
    cachedCurrentUserId = user.id;

    const userNameDisplay = document.querySelector('.user-name');
    if (userNameDisplay && user.user_metadata?.full_name) {
        userNameDisplay.textContent = user.user_metadata.full_name;
    }
    return user;
}

// 2. Main Fetch Function (UPDATED FOR SNAPCHAT INVENTORY FILTERING)
async function fetchSnapchatInventory() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const targetId = urlParams.get('id');

        let query = supabase.from('verifications').select('*');

        if (targetId) {
            query = query.or(`status.eq.approved,id.eq.${targetId}`);
        } else {
            query = query.eq('status', 'approved');
        }

        const { data: inventory, error: invError } = await query;
        if (invError) throw invError;

        // Populate baseline auth variables if they are missing
        if (!cachedCurrentUserId) {
            const { data: authData } = await supabase.auth.getUser();
            cachedCurrentUserId = authData?.user ? authData.user.id : null;
        }
        
        const userIds = [...new Set(inventory.map(row => row.user_id))];
        if (cachedCurrentUserId && !userIds.includes(cachedCurrentUserId)) {
            userIds.push(cachedCurrentUserId);
        }

        // Fetch profile structural lookups ahead of time
        const { data: profileList } = await supabase
    .from('profiles')
    .select('id, username, full_name, following, followers, trust_score')
    .in('id', userIds);

        window.currentGlobalProfiles = profileList || [];

        // Pre-fill lookup variables securely before setting active accounts
        syncFollowCache();

        activeAccounts = inventory.map(row => {
            let meta = row.data;
            if (typeof meta === 'string') {
                try {
                    meta = JSON.parse(meta);
                } catch(e) {
                    meta = {};
                }
            }
            const userProfile = window.currentGlobalProfiles.find(p => p.id === row.user_id);
            return {
                ...row,
                data: meta,
                profiles: userProfile || { username: "anonymous", full_name: "Anonymous Seller" }
            };
        }).filter(row => {
            const platform = row.data?.platform?.toLowerCase();
            return platform === 'snapchat'; // 🌟 Only target Snapchat items
        });

        // Run rendering array pipelines
        applyFilters();

    } catch (err) {
        console.error("Master Fetch Error:", err.message);
    }
}

// 3. Pure Synchronous Render Function (UPDATED WITH SNAPCHAT IMAGE URLS)
function renderGrid(accounts) {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    const currentUserId = cachedCurrentUserId;

    if (accounts.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No accounts found.</p>`;
        return;
    }

    // Sort listings using memory cache instantly
    accounts.sort((a, b) => {
        const aFollowed = cachedMyFollowingList.includes(a.user_id) ? 1 : 0;
        const bFollowed = cachedMyFollowingList.includes(b.user_id) ? 1 : 0;
        return bFollowed - aFollowed;
    });

    grid.innerHTML = accounts.map(row => {
        const meta = row.data; 

        const rawAge = String(meta.account_age || "");
        const yearMatch = rawAge.match(/\d{4}/); 
        const displayYear = yearMatch ? yearMatch[0] : rawAge;

        const isOwner = row.user_id === currentUserId;
        const sellerUsername = row.profiles?.username || row.profiles?.full_name || `User_${String(row.user_id).slice(0, 5)}`;
        const isFollowing = cachedMyFollowingList.includes(row.user_id);

        // Gold Verified Badge Logic
        const trustScore = row.profiles?.trust_score || 0;
        const isGoldVerified = trustScore >= 85 && trustScore <= 100;

        const goldBadgeSvg = isGoldVerified ? `
            <svg class="meta-badge" viewBox="0 0 24 24" fill="none" style="width: 19px; height: 19px; margin-left: 5px; flex-shrink: 0; vertical-align: middle;">
                <defs>
                    <linearGradient id="goldGradient-${row.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#FFF3B0"/>
                        <stop offset="40%" stop-color="#FFD700"/>
                        <stop offset="100%" stop-color="#D4AF37"/>
                    </linearGradient>
                </defs>
                <path
                d="M12 2L14.2 4.1L17 3.5L18.1 6.1L20.8 6.8L20.5 9.7L22.5 12L20.5 14.3L20.8 17.2L18.1 17.9L17 20.5L14.2 19.9L12 22L9.8 19.9L7 20.5L5.9 17.9L3.2 17.2L3.5 14.3L1.5 12L3.5 9.7L3.2 6.8L5.9 6.1L7 3.5L9.8 4.1L12 2Z"
                fill="url(#goldGradient-${row.id})"/>
                <path
                d="M9.5 12.5L11 14L15 10"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"/>
            </svg>
        ` : '';

        return `
            <div class="card">
                <div class="options-menu">
                    <button class="dots-btn" onclick="toggleDropdown(event, '${row.id}')">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    <div class="dropdown-content" id="dropdown-${row.id}">
                        <button onclick="window.open('${meta.profile_link || '#'}', '_blank')">
                            <i class="fa-solid fa-eye"></i> View Live
                        </button>
                        <button onclick="copyMarketplaceUrl(event, '${row.id}')">
                            <i class="fa-solid fa-link"></i> Copy URL
                        </button>
                        
                        <button onclick="toggleFollowSeller(event, '${row.user_id}', '${sellerUsername}')">
                            <i class="${isFollowing ? 'fa-solid fa-user-minus' : 'fa-solid fa-user-plus'}"></i> 
                            ${isFollowing ? 'Unfollow Seller' : 'Follow Seller'}
                        </button>
                    </div>
                </div>

                 <div class="card-tag seller-username-tag" style="display: inline-flex; align-items: center; gap: 1px;"> <i class="fa-regular fa-user" style="font-size: 0.7rem;"></i> <span>@${sellerUsername}</span> ${goldBadgeSvg}
</div>

                <div class="card-img">
                    <img src="https://accmarket.name.ng/images/snapchat.png" alt="Snapchat">
                </div>
                <p class="title">@${meta.username || 'Unknown'}</p>
                <div class="meta">
                    <span><i class="fa-solid fa-earth-africa"></i> ${meta.region || 'N/A'}</span>
                    <span><i class="fa-solid fa-users"></i> ${(meta.followers || 0).toLocaleString()}</span>
                    <span><i class="fa-regular fa-calendar"></i> ${displayYear}</span>
                </div>
                <button class="view-details-btn" onclick="openDetails('${row.id}')">View more details</button>
                <div class="price-row">
                    <span class="price">₦${parseFloat(meta.price || 0).toLocaleString()}</span>
                </div>
                
                <div class="card-action-container">
                    <button class="btn purchase-btn ${isOwner ? 'owner-btn' : ''}" 
                            onclick="${isOwner ? '' : `initiatePurchase('${row.id}')`}"
                            ${isOwner ? 'disabled' : ''}>
                        ${isOwner ? 'YOUR LISTING' : 'PURCHASE'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Main Marketplace Search Input Route Binding
document.getElementById('assetSearch')?.addEventListener('input', () => {
    applyFilters();
});

// View Details Modal
window.openDetails = async (id) => {
    const acc = activeAccounts.find(a => a.id === id);
    if (!acc) return;
    
    const meta = acc.data;
    const body = document.getElementById('modalBody');
    const isOwner = acc.user_id === cachedCurrentUserId;

    const rawAge = String(meta.account_age || "");
    const yearMatch = rawAge.match(/\d{4}/); 
    const displayYear = yearMatch ? yearMatch[0] : rawAge;
    
    body.innerHTML = `
        <img src="${acc.screenshot_url || 'https://accmarket.name.ng/images/snapchat.png'}" style="width:100%; border-radius:12px; margin-bottom:15px; border:1px solid var(--border);">
        <div class="detail-item"><span class="detail-label">Username</span><span class="detail-value">@${meta.username || 'Unknown'}</span></div>
        <div class="detail-item"><span class="detail-label">Verification Code</span><span class="detail-value" style="color:var(--primary); font-weight:bold;">${meta.verification_code || 'N/A'}</span></div>
        <div class="detail-item"><span class="detail-label">Region</span><span class="detail-value">${meta.region || 'N/A'}</span></div>
        <div class="detail-item"><span class="detail-label">Followers</span><span class="detail-value">${(meta.followers || 0).toLocaleString()}</span></div>
        <div class="detail-item"><span class="detail-label">Account Year</span><span class="detail-value">${displayYear}</span></div>
        <div class="detail-item"><span class="detail-label">Formats</span><span class="detail-value">${meta.login_formats ? meta.login_formats.join(', ') : 'N/A'}</span></div>
        
        <div style="margin-top:15px; padding-top:10px; border-top:1px solid #eee;">
            <span class="detail-label" style="display:block; margin-bottom:5px;">Description</span>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">${meta.description || 'No description provided.'}</p>
        </div>
    `;

    const footer = document.querySelector('#modalOverlay .modal-footer');
    if (footer) {
        footer.innerHTML = `
            <button class="btn-cancel" onclick="closeModal()">Close Window</button>
            <button class="btn purchase-btn ${isOwner ? 'owner-btn' : ''}" 
                onclick="${isOwner ? '' : `closeModal(); initiatePurchase('${acc.id}')`}"
                ${isOwner ? 'disabled' : ''}
                style="flex: 2; margin: 0; ${isOwner ? 'background: #94a3b8; cursor: not-allowed;' : ''}">
                ${isOwner ? 'YOUR LISTING' : 'PROCEED TO PURCHASE'}
            </button>
        `;
    }
    
    document.getElementById('modalOverlay').style.display = 'flex';
};

// Purchase Initialization Flow
window.initiatePurchase = async (id) => {
    const acc = activeAccounts.find(a => a.id === id);
    if (!acc) return;

    const basePrice = parseFloat(acc.data.price) || 0;
    const feeRate = (basePrice === 1500) ? 0.05 : 0.03;
    const fee = basePrice * feeRate;
    const total = basePrice + fee;

    try {
        if (!cachedCurrentUserId) return Swal.fire("Authentication Required", "Please login to purchase accounts.", "info");

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', cachedCurrentUserId).single();
        const balance = profile?.balance || 0;

        const modal = document.getElementById('escrowModal');
        const baseEl = document.getElementById('displayBasePrice');
        const feeEl = document.getElementById('displayFee');
        const feeLabel = document.getElementById('feeLabel');
        const totalEl = document.getElementById('displayTotal');
        const balanceEl = document.getElementById('displayUserBalance');
        const continueBtn = document.getElementById('btnContinuePurchase');

        if (!modal || !baseEl || !totalEl) return;

        baseEl.innerText = `₦${basePrice.toLocaleString()}`;
        if (feeLabel) feeLabel.innerText = `Escrow Fee (${feeRate * 100}%)`;
        if (feeEl) feeEl.innerText = `₦${fee.toLocaleString()}`;
        totalEl.innerText = `₦${total.toLocaleString()}`;
        if (balanceEl) {
            balanceEl.innerText = `₦${balance.toLocaleString()}`;
            balanceEl.style.color = (balance < total) ? "red" : "green";
        }

        if (continueBtn) {
            continueBtn.disabled = (balance < total);
            continueBtn.innerText = (balance < total) ? "Insufficient Balance" : "Continue Purchase";
            continueBtn.onclick = () => {
                window.closeEscrowModal();
                processTransaction(acc, total, basePrice, cachedCurrentUserId);
            };
        }

        modal.style.display = 'flex';
    } catch (err) {
        console.error("Purchase Initialization Error:", err);
    }
};


// Escrow Processing Transaction Pipeline (UPDATED FOR SNAPCHAT ENGINE LOGS)
async function processTransaction(account, totalWithFee, originalPrice, buyerId) {
    try {
        Swal.fire({ title: 'Processing Transaction...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const { data: lockCheck, error: lockError } = await supabase
            .from('verifications')
            .update({ status: 'in_progress' })
            .eq('id', account.id)
            .eq('status', 'approved') 
            .select();

        if (lockError || !lockCheck || lockCheck.length === 0) {
            return Swal.fire("Unavailable", "This account was just taken or is no longer available.", "error");
        }

        const { data: buyer, error: balanceError } = await supabase
            .from('profiles')
            .select('username, full_name, balance')
            .eq('id', buyerId)
            .single();

        if (balanceError || buyer.balance < totalWithFee) {
            await supabase.from('verifications').update({ status: 'approved' }).eq('id', account.id);
            return Swal.fire("Insufficient Balance", "You do not have enough funds for this purchase.", "warning");
        }

        const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('email, username, full_name, telegram_chat_id, telegram_alerts, onesignal_id, push_notifications_enabled')
            .eq('id', account.user_id)
            .single();

        await supabase.from('profiles').update({ balance: buyer.balance - totalWithFee }).eq('id', buyerId);

        await supabase.from('wallet').insert([{
            user_id: buyerId,
            type: 'Payment',
            amount: `-${totalWithFee.toFixed(2)}`, 
            note: `Payment for Snapchat account: @${account.data.username || 'Unknown'}`,
            status: 'success',
            reference: `PUR_${account.id.slice(0, 8)}_${Date.now()}`
        }]);

        const { data: conv, error: convError } = await supabase.from('conversations').insert([{
            product_id: account.id,
            product_name: "Snapchat",
            product_price: originalPrice.toString(),
            buyer_id: buyerId,
            seller_id: account.user_id,
            escrow_step: 0,
            status: 'active',
            last_message: "System: Buyer has started the escrow process. Payment is secured."
        }]).select().single();

        if (convError) throw convError;

        const currentBuyerName = buyer?.username || buyer?.full_name || "Someone";
        const targetAccountName = account.data?.username || "Snapchat Listing";
        const chatRoomUrl = `https://accmarket.name.ng/chats?id=${conv.id}`;
        
        const purchaseAlertMsg = `@${currentBuyerName} purchased your Snapchat account @${targetAccountName}! Access your chat workspace here to deliver logs: ${chatRoomUrl}`;

        await supabase.from('notifications').insert([{
            user_id: account.user_id, 
            title: "Account Sold! 🎉",
            message: purchaseAlertMsg,
            icon: "fas fa-shopping-bag",
            type: "purchase",
            is_read: false
        }]);

        if (sellerProfile?.telegram_alerts === true && sellerProfile?.telegram_chat_id) {
            const TELEGRAM_BOT_TOKEN = "8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg"; 
            const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
            const tgMarkdownText = `💰 *New Sale Notification!*\n\n@${currentBuyerName} purchased your Snapchat account *${targetAccountName}*!\n\n👉 [Click Here to Access Chat Workspace](${chatRoomUrl}) to deliver logs.`;

            try {
                await fetch(tgUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: sellerProfile.telegram_chat_id, text: tgMarkdownText, parse_mode: "Markdown" })
                });
            } catch (tgErr) { console.error(tgErr); }
        }

        if (sellerProfile?.email) {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                const jwtToken = sessionData?.session?.access_token || supabase.supabaseKey; 
                const sellerDisplayName = sellerProfile.username || "Seller";

                await fetch("https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/sales-notification", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwtToken}` },
                    body: JSON.stringify({
                        seller_email: sellerProfile.email,
                        seller_name: sellerDisplayName,
                        buyer_name: currentBuyerName,
                        account_name: targetAccountName,
                        chat_url: chatRoomUrl,
                        onesignal_id: sellerProfile.onesignal_id,
                        push_enabled: sellerProfile.push_notifications_enabled
                    })
                });
            } catch (funcErr) { console.error(funcErr); }
        }

        Swal.fire({ icon: 'success', title: 'Purchase Secured!', text: 'Redirecting to your escrow workspace...', timer: 2000, showConfirmButton: false });
        setTimeout(() => { window.location.href = `../chats?id=${conv.id}`; }, 2000);

    } catch (err) {
        console.error("Transaction Error:", err);
        await supabase.from('verifications').update({ status: 'approved' }).eq('id', account.id);
        Swal.fire("Error", "Transaction failed. Please contact support.", "error");
    }
}

window.closeEscrowModal = () => {
    document.getElementById('escrowModal').style.display = 'none';
};

// Utilities & Following Interface LOOKUPS
window.toggleDropdown = (event, id) => {
    event.stopPropagation();
    document.querySelectorAll('.dropdown-content').forEach(m => m.id !== `dropdown-${id}` && m.classList.remove('show'));
    document.getElementById(`dropdown-${id}`)?.classList.toggle('show');
};

window.copyMarketplaceUrl = (event, id) => {
    event.stopPropagation(); 
    const baseUri = window.location.origin + window.location.pathname;
    const shareableLink = `${baseUri}?id=${id}`;

    navigator.clipboard.writeText(shareableLink).then(() => {
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Product URL Copied!', showConfirmButton: false, timer: 1500 });
    });
    document.querySelectorAll('.dropdown-content').forEach(m => m.classList.remove('show'));
};

window.toggleFollowSeller = async (event, sellerId, sellerUsername) => {
    event.stopPropagation(); 
    try {
        if (!cachedCurrentUserId) return Swal.fire("Authentication Required", "Please log in to follow sellers.", "info");
        if (cachedCurrentUserId === sellerId) return Swal.fire("Action Denied", "You cannot follow your own profile listing.", "warning");

        Swal.fire({ title: 'Updating follow status...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const { data: buyerProfile } = await supabase.from('profiles').select('username, full_name, following').eq('id', cachedCurrentUserId).single();
        const { data: sellerProfile } = await supabase.from('profiles').select('followers, telegram_chat_id, telegram_alerts').eq('id', sellerId).single();

        let buyerFollowing = buyerProfile?.following?.uids || [];
        let sellerFollowers = sellerProfile?.followers?.uids || [];

        const isCurrentlyFollowing = buyerFollowing.includes(sellerId);
        let alertTitle = "";
        let alertIcon = "success";
        let shouldSendNotification = false;

        if (isCurrentlyFollowing) {
            buyerFollowing = buyerFollowing.filter(id => id !== sellerId);
            sellerFollowers = sellerFollowers.filter(id => id !== cachedCurrentUserId);
            alertTitle = `Unfollowed @${sellerUsername}`;
            alertIcon = "info";
        } else {
            buyerFollowing.push(sellerId);
            sellerFollowers.push(cachedCurrentUserId);
            alertTitle = `Now following @${sellerUsername}`;
            alertIcon = "success";
            shouldSendNotification = true; 
        }

        await Promise.all([
            supabase.from('profiles').update({ following: { uids: buyerFollowing } }).eq('id', cachedCurrentUserId),
            supabase.from('profiles').update({ followers: { uids: sellerFollowers } }).eq('id', sellerId)
        ]);

        if (shouldSendNotification) {
            const currentBuyerName = buyerProfile?.username || buyerProfile?.full_name || "Someone";
            const messageText = `@${currentBuyerName} started following you!`;
            
            await supabase.from('notifications').insert([{
                user_id: sellerId, title: "New Follower", message: messageText, icon: "fas fa-user-plus", type: "follow", is_read: false
            }]);

            if (sellerProfile?.telegram_alerts === true && sellerProfile?.telegram_chat_id) {
                const TELEGRAM_BOT_TOKEN = "8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg"; 
                const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
                try {
                    await fetch(tgUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: sellerProfile.telegram_chat_id, text: `🔔 *New Follower Alert!*\n\n${messageText}`, parse_mode: "Markdown" })
                    });
                } catch (tgErr) { console.error(tgErr); }
            }
        }

        if (window.currentGlobalProfiles) {
            const index = window.currentGlobalProfiles.findIndex(p => p.id === cachedCurrentUserId);
            if(index !== -1) window.currentGlobalProfiles[index].following = { uids: buyerFollowing };
        }

        cachedMyFollowingList = buyerFollowing;
        Swal.fire({ toast: true, position: 'top-end', icon: alertIcon, title: alertTitle, showConfirmButton: false, timer: 2000 });
        applyFilters(); 

    } catch (err) {
        console.error(err);
        Swal.fire("Error", "Could not complete follow update action.", "error");
    }
    document.querySelectorAll('.dropdown-content').forEach(m => m.classList.remove('show'));
};

window.onclick = () => document.querySelectorAll('.dropdown-content').forEach(m => m.classList.remove('show'));
window.closeModal = () => document.getElementById('modalOverlay').style.display = 'none';

// Initialize System on load
async function init() {
    await getCurrentUser();
    await fetchSnapchatInventory(); 

    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');

    if (targetId) {
        setTimeout(() => {
            const exists = activeAccounts.find(a => a.id === targetId);
            if (exists) window.openDetails(targetId);
        }, 500); 
    }

    supabase
        .channel('public:verifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'verifications' }, () => {
            fetchSnapchatInventory(); 
        })
        .subscribe();
}

init();

// ✅ Get unread notification count for current user
async function loadNotificationCount() {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("No logged-in user, skipping notification count.");
      return;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("Error loading notification count:", error.message);
      return;
    }

    const badge = document.getElementById("notification-count");
    const unreadCount = count || 0;

    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.style.display = "inline-block";
      badge.classList.add("pop");
      setTimeout(() => badge.classList.remove("pop"), 200);
    } else {
      badge.style.display = "none";
    }
  } catch (err) {
    console.error("Unexpected error loading notification count:", err);
  }
}

loadNotificationCount();
setInterval(loadNotificationCount, 30000);

const notificationSound = new Audio("notification.mp3");

async function setupNotificationRealtime() {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return;

    supabase
      .channel("notifications-realtime-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "*", 
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("🔔 Realtime notification event:", payload.eventType);
          await loadNotificationCount();

          if (payload.eventType === "INSERT") {
            notificationSound.play().catch((e) => console.warn(e));
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.error("Error setting up realtime notifications:", err);
  }
}

setupNotificationRealtime();

// ✅ Preload the chat notification sound
const chatNotificationSound = new Audio("notification.mp3");

// ✅ Get total unread messages
async function loadTotalChatCount() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false)
      .neq("sender_id", user.id); 

    if (error) throw error;

    const badge = document.getElementById("chat-notification-count");
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = "inline-block";
      badge.classList.add("pop");
      setTimeout(() => badge.classList.remove("pop"), 200);
    } else {
      badge.style.display = "none";
    }
  } catch (err) {
    console.error("Error loading chat count:", err);
  }
}

// ✅ Real-time listener WITH SOUND
async function setupGlobalChatRealtime() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  supabase
    .channel("global-chat-updates")
    .on(
      "postgres_changes",
      {
        event: "*", 
        schema: "public",
        table: "messages",
      },
      async (payload) => {
        await loadTotalChatCount();
        
        if (payload.eventType === "INSERT" && payload.new.sender_id !== user.id) {
            chatNotificationSound.play().catch((e) => console.warn("Sound blocked by browser:", e));
        }
      }
    )
    .subscribe();
}

loadTotalChatCount();
setupGlobalChatRealtime();

(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; 

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .single();

  if (profile && profile.is_active === false) {
    Swal.fire({
      title: "Account Deactivated",
      text: "Your account has been deactivated. Please contact support for assistance.",
      icon: "error",
      confirmButtonColor: "#0b1e5b", 
      confirmButtonText: "Close",
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(async () => {
      await supabase.auth.signOut();
      window.location.href = "../auth";
    });
    return; 
  }
})();

// ---- LOGOUT FUNCTIONALITY ----
document.addEventListener("click", async (e) => {
  if (e.target.closest(".logout")) {
    e.preventDefault(); // stop redirect

    try {
      // Clear cached dashboard data locally to refresh memory states safely
      localStorage.clear();
      sessionStorage.clear();

      // Redirect the interface directly to the auth page
      window.location.href = "../auth";
    } catch (err) {
      console.error("Interface redirection failed:", err.message);
    }
  }
});

// ✅ Show Sell Account link ONLY for Sellers
async function showSellerAndAdminLinks() {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("⚠️ No logged-in user found.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("❌ Error fetching user role:", profileError.message);
      return;
    }

    const sellAccountLink = document.querySelector(".seller-only");

    if (sellAccountLink) {
      if (profile.role === "seller") {
        sellAccountLink.style.display = "block";
      } else {
        sellAccountLink.style.display = "none";
      }
    }

  } catch (err) {
    console.error("⚠️ Error checking role:", err);
  }
}

showSellerAndAdminLinks();