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

// ✅ Global State for Filtering/Sorting
let activeAccounts = [];

// --- UPDATED FIXED FILTER LOGIC (100% REAL-TIME REACTIVE FIX) ---
const filterBtn = document.querySelector(".fa-sliders");
const filterBar = document.getElementById("filterBar");

filterBtn?.addEventListener("click", () => {
    filterBar?.classList.toggle("active");
});

// Cache structures that populate synchronously during execution loops
let cachedCurrentUserId = null;
let cachedMyFollowingList = [];

const applyFilters = async () => {
    // 🟢 STEP 1: Always load user ID & following array asynchronously inline to prevent race states
    try {
        if (!cachedCurrentUserId) {
            const { data: authData } = await supabase.auth.getUser();
            cachedCurrentUserId = authData?.user ? authData.user.id : null;
        }
        
        if (cachedCurrentUserId && window.currentGlobalProfiles) {
            const myProfileData = window.currentGlobalProfiles.find(p => p.id === cachedCurrentUserId);
            cachedMyFollowingList = myProfileData?.following?.uids || [];
        }
    } catch (e) {
        console.error("Auth routing sync warning:", e);
    }

    // 🟢 STEP 2: Instantly parse the slider values
    const maxPrice = document.getElementById('priceRange') ? parseFloat(document.getElementById('priceRange').value) : 100000;
    const minFollowers = document.getElementById('followerRange') ? parseInt(document.getElementById('followerRange').value) : 0;
    const minYear = document.getElementById('yearRange') ? parseInt(document.getElementById('yearRange').value) : 1999;
    const searchTerm = document.getElementById('assetSearch') ? document.getElementById('assetSearch').value.toLowerCase() : "";
    const followingOnlyChecked = document.getElementById('followingOnlyToggle')?.checked || false;

    // Update Text Value UI Labels
    if(document.getElementById('priceVal') && document.getElementById('priceRange')) {
        document.getElementById('priceVal').textContent = `₦${parseFloat(document.getElementById('priceRange').value).toLocaleString()}`;
    }
    if(document.getElementById('followerVal') && document.getElementById('followerRange')) {
        document.getElementById('followerVal').textContent = `${parseInt(document.getElementById('followerRange').value).toLocaleString()}+`;
    }
    if(document.getElementById('yearVal') && document.getElementById('yearRange')) {
        document.getElementById('yearVal').textContent = `${document.getElementById('yearRange').value}+`;
    }

    // 🟢 STEP 3: Pure functional filter that leaves activeAccounts unaltered so it safely scales back out
    const filtered = activeAccounts.filter(row => {
        if (row.status !== 'approved') return false;

        const meta = row.data;
        if (!meta) return false;
        
        // Handle variations in pricing fields (like idx 4 missing price)
        const price = meta.price !== undefined ? parseFloat(meta.price) : 0;
        
        // Sanitize string metrics containing 'k', 'm', or 'b' values safely
        let followersRaw = String(meta.followers || "0").toLowerCase();
        if (followersRaw.includes('b')) followersRaw = parseFloat(followersRaw) * 1000000000;
        else if (followersRaw.includes('m')) followersRaw = parseFloat(followersRaw) * 1000000;
        else if (followersRaw.includes('k')) followersRaw = parseFloat(followersRaw) * 1000;
        const followers = parseInt(followersRaw) || 0;

        const year = parseInt(String(meta.account_age || "").match(/\d{4}/)?.[0]) || 0;

        const usernameStr = String(meta.username || "").toLowerCase();
        const regionStr = String(meta.region || "").toLowerCase();

        // Structural matching boundaries
        const matchesSearch = usernameStr.includes(searchTerm) || regionStr.includes(searchTerm);
        const matchesPrice = price === 0 || price <= maxPrice;
        const matchesFollowers = followers >= minFollowers;
        const matchesYear = year === 0 || year >= minYear;
        
        // Relational profile switch checklist
        const matchesFollowingFilter = !followingOnlyChecked || cachedMyFollowingList.includes(row.user_id);

        return matchesSearch && matchesPrice && matchesFollowers && matchesYear && matchesFollowingFilter;
    });

    // Re-render layout grid dynamically
    renderGrid(filtered);
};

// 🟢 FIX LISTENERS: Fire async handler instantly on adjustments
document.addEventListener('input', async (e) => {
    if (e.target.classList.contains('filter-slider') || e.target.id === 'assetSearch') {
        await applyFilters();
    }
});

document.addEventListener('change', async (e) => {
    if (e.target.id === 'followingOnlyToggle') {
        await applyFilters();
    }
});
// --- END UPDATED FILTER LOGIC ---

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

    // Wire up quick access logout action if available
    document.querySelector('.logout')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = '../login.html';
    });
});

// ✅ Initialize Supabase
import { supabase } from './supabase-config.js';

// Get the logged-in user
async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    const userNameDisplay = document.querySelector('.user-name');
    if (userNameDisplay && user.user_metadata?.full_name) {
        userNameDisplay.textContent = user.user_metadata.full_name;
    }
    return user;
}


// 2. Main Fetch Function (REAL-TIME COMPATIBLE FIX)
async function fetchFacebookInventory() {
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

        // Get all unique user IDs from listings PLUS the current logged-in user ID
        const { data: { user } } = await supabase.auth.getUser();
        const currentUserId = user ? user.id : null;
        
        const userIds = [...new Set(inventory.map(row => row.user_id))];
        if (currentUserId && !userIds.includes(currentUserId)) {
            userIds.push(currentUserId);
        }

        // Fetch profile data including the 'following' and 'followers' JSON arrays
        const { data: profileList } = await supabase
            .from('profiles')
            .select('id, username, full_name, following, followers')
            .in('id', userIds);

        // 🟢 FIXED: Small 'w' on window to avoid undefined profile lookup race conditions
        window.currentGlobalProfiles = profileList;

        activeAccounts = inventory.map(row => {
            // Safe JSON Parsing fallback to prevent broken account drops
            let meta = row.data;
            if (typeof meta === 'string') {
                try {
                    meta = JSON.parse(meta);
                } catch(e) {
                    meta = {};
                }
            }
            const userProfile = profileList?.find(p => p.id === row.user_id);
            return {
                ...row,
                data: meta,
                profiles: userProfile || { username: "anonymous", full_name: "Anonymous Seller" }
            };
        }).filter(row => {
            // Keeps items even if platform text has varying string formatting
            const platform = row.data?.platform?.toLowerCase();
            return !platform || platform === 'facebook';
        });

        // 🟢 FIXED: Route initial load & real-time refreshes through filters instead of hard-rendering!
        await applyFilters();

    } catch (err) {
        console.error("Master Fetch Error:", err.message);
    }
}





// 3. Render Function (Updated to show Seller Username instead of numerical Trust badges)
async function renderGrid(accounts) {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    // Fetch the current user to check for ownership and follow state
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user ? user.id : null;

    if (accounts.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No accounts found.</p>`;
        return;
    }

    // Find the logged-in user's profile details from the global window data we just saved
    const myProfileData = window.currentGlobalProfiles?.find(p => p.id === currentUserId);
    const myFollowingList = myProfileData?.following?.uids || [];

    // 🟢 OPTIONAL: Automatically prioritize profiles you follow by floating them to top
    accounts.sort((a, b) => {
        const aFollowed = myFollowingList.includes(a.user_id) ? 1 : 0;
        const bFollowed = myFollowingList.includes(b.user_id) ? 1 : 0;
        return bFollowed - aFollowed;
    });

    grid.innerHTML = accounts.map(row => {
        const meta = row.data; 

        const rawAge = String(meta.account_age || "");
        const yearMatch = rawAge.match(/\d{4}/); 
        const displayYear = yearMatch ? yearMatch[0] : rawAge;

        // Check if the current user is the seller of this specific account
        const isOwner = row.user_id === currentUserId;

        // RESOLVE SELLER IDENTITY FROM ATTACHED PROFILE SYSTEM 
        const sellerUsername = row.profiles?.username || row.profiles?.full_name || `User_${String(row.user_id).slice(0, 5)}`;

        // FIXED: Check against YOUR following array, not the seller's profile list
        const isFollowing = myFollowingList.includes(row.user_id);

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

                <div class="card-tag seller-username-tag">
                    <i class="fa-regular fa-user" style="font-size: 0.7rem;"></i> @${sellerUsername}
                </div>
                
                <div class="card-img">
                    <img src="https://accmarket.name.ng/images/facebook.png" alt="FB">
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

// View Details (Modal with Purchase Integration)
window.openDetails = async (id) => {
    const acc = activeAccounts.find(a => a.id === id);
    if (!acc) return;
    
    const meta = acc.data;
    const body = document.getElementById('modalBody');

    // Fetch the current user to check for ownership
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user ? user.id : null;
    const isOwner = acc.user_id === currentUserId;

    const rawAge = String(meta.account_age || "");
    const yearMatch = rawAge.match(/\d{4}/); 
    const displayYear = yearMatch ? yearMatch[0] : rawAge;
    
    body.innerHTML = `
        <img src="${acc.screenshot_url || 'https://accmarket.name.ng/images/facebook.png'}" style="width:100%; border-radius:12px; margin-bottom:15px; border:1px solid var(--border);">
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

    // Dynamic injection into footer to maintain layout standard
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

// Purchase Flow with contextual dynamic validation
window.initiatePurchase = async (id) => {
    const acc = activeAccounts.find(a => a.id === id);
    if (!acc) return;

    const basePrice = parseFloat(acc.data.price) || 0;
    const feeRate = (basePrice === 1500) ? 0.05 : 0.03;
    const fee = basePrice * feeRate;
    const total = basePrice + fee;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return Swal.fire("Authentication Required", "Please login to purchase accounts.", "info");

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
        const balance = profile?.balance || 0;

        const modal = document.getElementById('escrowModal');
        const baseEl = document.getElementById('displayBasePrice');
        const feeEl = document.getElementById('displayFee');
        const feeLabel = document.getElementById('feeLabel');
        const totalEl = document.getElementById('displayTotal');
        const balanceEl = document.getElementById('displayUserBalance');
        const continueBtn = document.getElementById('btnContinuePurchase');

        if (!modal || !baseEl || !totalEl) {
            console.error("Required Modal HTML elements are missing from facebook.html!");
            return;
        }

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
                processTransaction(acc, total, basePrice, user.id);
            };
        }

        modal.style.display = 'flex';
    } catch (err) {
        console.error("Purchase Initialization Error:", err);
    }
};

async function processTransaction(account, totalWithFee, originalPrice, buyerId) {
    try {
        Swal.fire({ title: 'Processing Transaction...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // Lock down verification record status
        const { data: lockCheck, error: lockError } = await supabase
            .from('verifications')
            .update({ status: 'in_progress' })
            .eq('id', account.id)
            .eq('status', 'approved') 
            .select();

        if (lockError || !lockCheck || lockCheck.length === 0) {
            return Swal.fire("Unavailable", "This account was just taken or is no longer available.", "error");
        }

        // Verify balance
        const { data: buyer, error: balanceError } = await supabase
            .from('profiles')
            .select('username, full_name, balance')
            .eq('id', buyerId)
            .single();

        if (balanceError || buyer.balance < totalWithFee) {
            await supabase.from('verifications').update({ status: 'approved' }).eq('id', account.id);
            return Swal.fire("Insufficient Balance", "You do not have enough funds for this purchase.", "warning");
        }

        // Fetch seller details specifically for Telegram integration parameters
        const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('telegram_chat_id, telegram_alerts')
            .eq('id', account.user_id)
            .single();

        // Deduct balance from buyer profile snapshot
        await supabase.from('profiles')
            .update({ balance: buyer.balance - totalWithFee })
            .eq('id', buyerId);

        // Record buyer wallet transaction ledger history
        await supabase.from('wallet').insert([{
            user_id: buyerId,
            type: 'Payment',
            amount: `-${totalWithFee.toFixed(2)}`, 
            note: `Payment for Facebook account: @${account.data.username || 'Unknown'}`,
            status: 'success',
            reference: `PUR_${account.id.slice(0, 8)}_${Date.now()}`
        }]);

        // Create official conversation room channel tracking
        const { data: conv, error: convError } = await supabase.from('conversations').insert([{
            product_id: account.id,
            product_name: "Facebook",
            product_price: originalPrice.toString(),
            buyer_id: buyerId,
            seller_id: account.user_id,
            escrow_step: 0,
            status: 'active',
            last_message: "System: Buyer has started the escrow process. Payment is secured."
        }]).select().single();

        if (convError) throw convError;

        // Formulate details and dynamic deep-linking URL strings
        const currentBuyerName = buyer?.username || buyer?.full_name || "Someone";
        const targetAccountName = account.data?.username || "Facebook Listing";
        const chatRoomUrl = `https://accmarket.name.ng/chats?id=${conv.id}`;
        
        // 🟢 FIXED: Embeds the deep-linked chat room URL directly inside the notification text payloads
        const purchaseAlertMsg = `@${currentBuyerName} purchased your account @${targetAccountName}! Access your chat workspace here to deliver logs: ${chatRoomUrl}`;

        // 1. Dispatch inside your structural app notifications table
        const { error: notifyError } = await supabase.from('notifications').insert([{
            user_id: account.user_id, // Target Recipient: The Seller
            title: "Account Sold! 🎉",
            message: purchaseAlertMsg,
            icon: "fas fa-shopping-bag",
            type: "purchase",
            is_read: false
        }]);

        if (notifyError) {
            console.error("Purchase Notification Table Insert Failed:", notifyError.message);
        }

        // 2. Dispatch via Telegram Bot API if configured by the vendor using Markdown linking
        if (sellerProfile?.telegram_alerts === true && sellerProfile?.telegram_chat_id) {
            const TELEGRAM_BOT_TOKEN = "8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg"; 
            const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
            
            // Format link cleanly using Markdown for Telegram clickability
            const tgMarkdownText = `💰 *New Sale Notification!*\n\n@${currentBuyerName} purchased your account *${targetAccountName}*!\n\n👉 [Click Here to Access Chat Workspace](${chatRoomUrl}) to deliver logs.`;

            try {
                await fetch(tgUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: sellerProfile.telegram_chat_id,
                        text: tgMarkdownText,
                        parse_mode: "Markdown"
                    })
                });
            } catch (tgErr) {
                console.error("Telegram purchase notification delivery failed:", tgErr);
            }
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

// Utilities
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
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Product URL Copied!',
            showConfirmButton: false,
            timer: 1500
        });
    }).catch(err => {
        console.error("Could not copy marketplace URL: ", err);
    });

    document.querySelectorAll('.dropdown-content').forEach(m => m.classList.remove('show'));
};


window.toggleFollowSeller = async (event, sellerId, sellerUsername) => {
    event.stopPropagation(); 
    
    try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return Swal.fire("Authentication Required", "Please log in to follow sellers.", "info");
        }
        
        const buyerId = user.id;
        if (buyerId === sellerId) {
            return Swal.fire("Action Denied", "You cannot follow your own profile listing.", "warning");
        }

        Swal.fire({ title: 'Updating follow status...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const { data: buyerProfile } = await supabase.from('profiles').select('username, full_name, following').eq('id', buyerId).single();
        
        // 🟢 FIXED: Select telegram_chat_id and telegram_alerts directly from the seller's profile
        const { data: sellerProfile } = await supabase.from('profiles').select('followers, telegram_chat_id, telegram_alerts').eq('id', sellerId).single();

        let buyerFollowing = buyerProfile?.following?.uids || [];
        let sellerFollowers = sellerProfile?.followers?.uids || [];

        const isCurrentlyFollowing = buyerFollowing.includes(sellerId);
        let alertTitle = "";
        let alertIcon = "success";
        let shouldSendNotification = false;

        if (isCurrentlyFollowing) {
            buyerFollowing = buyerFollowing.filter(id => id !== sellerId);
            sellerFollowers = sellerFollowers.filter(id => id !== buyerId);
            alertTitle = `Unfollowed @${sellerUsername}`;
            alertIcon = "info";
        } else {
            buyerFollowing.push(sellerId);
            sellerFollowers.push(buyerId);
            alertTitle = `Now following @${sellerUsername}`;
            alertIcon = "success";
            shouldSendNotification = true; 
        }

        const updateBuyer = supabase.from('profiles').update({ following: { uids: buyerFollowing } }).eq('id', buyerId);
        const updateSeller = supabase.from('profiles').update({ followers: { uids: sellerFollowers } }).eq('id', sellerId);

        const [buyerRes, sellerRes] = await Promise.all([updateBuyer, updateSeller]);
        if (buyerRes.error || sellerRes.error) throw new Error("Database sync failed");

        if (shouldSendNotification) {
            const currentBuyerName = buyerProfile?.username || buyerProfile?.full_name || "Someone";
            const messageText = `@${currentBuyerName} started following you!`;
            
            // 1. Send in-app table notification
            const { error: notifyError } = await supabase.from('notifications').insert([{
                user_id: sellerId, 
                title: "New Follower",
                message: messageText,
                icon: "fas fa-user-plus",
                type: "follow",
                is_read: false
            }]);

            if (notifyError) {
                console.error("Notification Insert Failed:", notifyError.message);
            }

            // 2. 🟢 NEW: Check if seller's telegram alerts switch is explicitly TRUE and chat ID is configured
            if (sellerProfile?.telegram_alerts === true && sellerProfile?.telegram_chat_id) {
                const TELEGRAM_BOT_TOKEN = "8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg"; // ⚠️ Replace this with your real Telegram Bot Token
                const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
                
                try {
                    await fetch(tgUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: sellerProfile.telegram_chat_id,
                            text: `🔔 *New Follower Alert!*\n\n${messageText}`,
                            parse_mode: "Markdown"
                        })
                    });
                } catch (tgErr) {
                    console.error("Telegram delivery system failed:", tgErr);
                }
            }
        }

        if (window.currentGlobalProfiles) {
            const index = window.currentGlobalProfiles.findIndex(p => p.id === buyerId);
            if(index !== -1) window.currentGlobalProfiles[index].following = { uids: buyerFollowing };
        }

        if (typeof cachedMyFollowingList !== 'undefined') {
            cachedMyFollowingList = buyerFollowing;
        }

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: alertIcon,
            title: alertTitle,
            showConfirmButton: false,
            timer: 2000
        });

        await applyFilters(); 

    } catch (err) {
        console.error("Follow System Error:", err);
        Swal.fire("Error", "Could not complete follow update action.", "error");
    }
    document.querySelectorAll('.dropdown-content').forEach(m => m.classList.remove('show'));
};





window.onclick = () => document.querySelectorAll('.dropdown-content').forEach(m => m.classList.remove('show'));
window.closeModal = () => document.getElementById('modalOverlay').style.display = 'none';


// Start App with URL Deep-Linking and Real-time Subscription
async function init() {
    await getCurrentUser();
    await fetchFacebookInventory(); 

    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');

    if (targetId) {
        setTimeout(() => {
            const exists = activeAccounts.find(a => a.id === targetId);
            if (exists) {
                window.openDetails(targetId);
            } else {
                console.warn("Deep-linked account ID not found or not approved.");
            }
        }, 500); 
    }

    supabase
        .channel('public:verifications')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'verifications' 
        }, () => {
            fetchFacebookInventory(); 
        })
        .subscribe();
}

init();