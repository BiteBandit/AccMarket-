import { supabase } from './supabase-config.js';

// ==========================================
// 1. GLOBAL STATE & MEMORY CACHES
// ==========================================
let activeAccounts = [];
let cachedCurrentUserId = null;
let cachedMyFollowingList = [];
const notificationSound = new Audio("notification.mp3");
const chatNotificationSound = new Audio("notification.mp3");

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
    pinterest: "../images/pinterest.png",
    gmail: "../images/gmail.png",
    outlook: "../images/outlook.png",
    yahoo: "../images/yahoo.png",
    rambler: "../images/rambler.png",
    hotmail: "../images/hotmail.png",
    protonmail: "../images/protonmail.png",
    gmx: "../images/gmx.png",
    yandex: "../images/yandex.png",
    o2: "../images/o2.png",
    mail_ru: "../images/mail.ru.png", 
    mail_com: "../images/mail.com.png",
    atomicmail: "../images/atomicmail.png",
    onet: "../images/onet.png",
    aol: "../images/aol.png",
    default_mail: "../images/default_mail.png"
};

// ==========================================
// 2. SIDEBARS, DROPDOWNS & NAVIGATION UTILITIES
// ==========================================
const sidebarToggle = document.getElementById("sidebarToggle");
const profileToggle = document.getElementById("profileToggle");
const leftSidebar = document.getElementById("leftSidebar");
const rightSidebar = document.getElementById("rightSidebar");
const closeLeft = document.getElementById("closeLeft");
const closeRight = document.getElementById("closeRight");
const filterBtn = document.querySelector(".fa-sliders");
const filterBar = document.getElementById("filterBar");

sidebarToggle?.addEventListener("click", () => leftSidebar?.classList.add("active"));
closeLeft?.addEventListener("click", () => leftSidebar?.classList.remove("active"));
profileToggle?.addEventListener("click", () => rightSidebar?.classList.add("active"));
closeRight?.addEventListener("click", () => rightSidebar?.classList.remove("active"));
filterBtn?.addEventListener("click", () => filterBar?.classList.toggle("active"));

// Sidebar Sub-list Accordion Navigation Toggle
document.querySelectorAll(".category-list > li > a").forEach((link) => {
  link.addEventListener("click", (e) => {
    const parentLi = link.parentElement;
    const hasSubmenu = parentLi.querySelector(".sub-list");
    if (hasSubmenu) {
      e.preventDefault();
      parentLi.classList.toggle("active");
    }
  });
});

// Sidebar Category Search Filter
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

// --- DROPDOWN ACTION INTERFACES ---
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

window.onclick = () => document.querySelectorAll('.dropdown-content').forEach(m => m.classList.remove('show'));
window.closeModal = () => document.getElementById('modalOverlay').style.display = 'none';
window.closeEscrowModal = () => document.getElementById('escrowModal').style.display = 'none';

// ==========================================
// 3. SYNCHRONOUS FILTERING ENGINE
// ==========================================
function syncFollowCache() {
    if (cachedCurrentUserId && window.currentGlobalProfiles && Array.isArray(window.currentGlobalProfiles)) {
        const myProfileData = window.currentGlobalProfiles.find(p => p.id === cachedCurrentUserId);
        cachedMyFollowingList = myProfileData?.following?.uids || [];
    } else {
        cachedMyFollowingList = [];
    }
}

const applyFilters = () => {
    const maxPrice = document.getElementById('priceRange') ? parseFloat(document.getElementById('priceRange').value) : 500000;
    const minMails = document.getElementById('followerRange') ? parseInt(document.getElementById('followerRange').value) : 0;
    const minYear = document.getElementById('yearRange') ? parseInt(document.getElementById('yearRange').value) : 1999;
    const searchTerm = document.getElementById('assetSearch') ? document.getElementById('assetSearch').value.toLowerCase().trim() : "";
    const followingOnlyChecked = document.getElementById('followingOnlyToggle')?.checked || false;

    if(document.getElementById('priceVal') && document.getElementById('priceRange')) {
        document.getElementById('priceVal').textContent = `₦${parseFloat(document.getElementById('priceRange').value).toLocaleString()}`;
    }
    if(document.getElementById('followerVal') && document.getElementById('followerRange')) {
        document.getElementById('followerVal').textContent = `${parseInt(document.getElementById('followerRange').value).toLocaleString()}+ Mails`;
    }
    if(document.getElementById('yearVal') && document.getElementById('yearRange')) {
        document.getElementById('yearVal').textContent = `${document.getElementById('yearRange').value}+`;
    }

    syncFollowCache();

    const filtered = activeAccounts.filter(row => {
        if (!row.is_system && row.status !== 'approved') return false;
        const meta = row.data;
        if (!meta) return false;
        
        const price = meta.price !== undefined ? parseFloat(meta.price) : 0;
        
        let mailsRaw = String(meta.followers || "0").toLowerCase();
        if (mailsRaw.includes('b')) mailsRaw = parseFloat(mailsRaw) * 1000000000;
        else if (mailsRaw.includes('m')) mailsRaw = parseFloat(mailsRaw) * 1000000;
        else if (mailsRaw.includes('k')) mailsRaw = parseFloat(mailsRaw) * 1000;
        const totalMails = parseInt(mailsRaw) || 0;

        const year = parseInt(String(meta.account_age || "").match(/\d{4}/)?.[0]) || 0;
        const emailStr = String(meta.username || "").toLowerCase();
        const regionStr = String(meta.region || "").toLowerCase();

        const matchesSearch = searchTerm === "" || emailStr.includes(searchTerm) || regionStr.includes(searchTerm) || String(meta.category || "").toLowerCase().includes(searchTerm);
        const matchesPrice = price === 0 || price <= maxPrice;
        const matchesMails = row.is_system || totalMails >= minMails;
        const matchesYear = row.is_system || year === 0 || year >= minYear;
        const matchesFollowingFilter = row.is_system || !followingOnlyChecked || cachedMyFollowingList.includes(row.user_id);

        return matchesSearch && matchesPrice && matchesMails && matchesYear && matchesFollowingFilter;
    });

    renderGrid(filtered);
};

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

// ==========================================
// 4. CORE DATA SOURCE INVENTORY FETCH (FILTERED FOR OUTLOOK)
// ==========================================
async function fetchOutlookInventory() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const targetId = urlParams.get('id');

        // A. Fetch normal individual seller escrow listings
        let userQuery = supabase.from('verifications').select('*');
        if (targetId) {
            userQuery = userQuery.or(`status.eq.approved,id.eq.${targetId}`);
        } else {
            userQuery = userQuery.eq('status', 'approved');
        }
        const { data: userInventory, error: invError } = await userQuery;
        if (invError) throw invError;

        // B. Fetch system bulk batch stock rows
        const { data: systemInventory, error: sysError } = await supabase.from('system_bulk_stock').select('*');
        if (sysError) throw sysError;

        if (!cachedCurrentUserId) {
            const { data: authData } = await supabase.auth.getUser();
            cachedCurrentUserId = authData?.user ? authData.user.id : null;
        }
        
        const userIds = [...new Set(userInventory.map(row => row.user_id))];
        if (cachedCurrentUserId && !userIds.includes(cachedCurrentUserId)) {
            userIds.push(cachedCurrentUserId);
        }

        const { data: profileList } = await supabase
            .from('profiles')
            .select('id, username, full_name, following, followers, trust_score')
            .in('id', userIds);

        window.currentGlobalProfiles = profileList || [];
        syncFollowCache();

        // Process standard escrow accounts
        const processedUsers = userInventory.map(row => {
            let meta = row.data;
            if (typeof meta === 'string') {
                try { meta = JSON.parse(meta); } catch(e) { meta = {}; }
            }
            const userProfile = window.currentGlobalProfiles.find(p => p.id === row.user_id);
            return {
                ...row,
                is_system: false,
                data: meta,
                profiles: userProfile || { username: "anonymous", full_name: "Anonymous Seller" }
            };
        });

        // Process unified system bulk batches
        const processedSystem = systemInventory.map(row => {
            const poolArray = Array.isArray(row.available_pool) ? row.available_pool : [];
            return {
                id: row.id,
                user_id: 'system_admin',
                is_system: true,
                status: 'approved',
                available_pool: poolArray,
                data: {
                    platform: row.platform,
                    category: row.category,
                    price: parseFloat(row.price),
                    region: row.region || 'Global',
                    account_age: row.account_age || 'N/A',
                    description: row.description || '',
                    stock_left: poolArray.length
                }
            };
        });

        // CALIBRATED FOR OUTLOOK PLATFORM DATA ONLY
        activeAccounts = [...processedSystem, ...processedUsers].filter(row => {
            const platform = row.data?.platform?.toLowerCase();
            return platform === 'outlook';
        });

        applyFilters();
    } catch (err) {
        console.error("Outlook Engine Fetch Failure:", err.message);
    }
}

// ==========================================
// 5. DOM GRID RENDERING LOGIC (OUTLOOK COMPLIANT)
// ==========================================
function renderGrid(accounts) {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    if (accounts.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No verified Outlook accounts found matching your criteria.</p>`;
        return;
    }

    accounts.sort((a, b) => {
        if (a.is_system && !b.is_system) return -1;
        if (!a.is_system && b.is_system) return 1;
        const aFollowed = cachedMyFollowingList.includes(a.user_id) ? 1 : 0;
        const bFollowed = cachedMyFollowingList.includes(b.user_id) ? 1 : 0;
        return bFollowed - aFollowed;
    });

    grid.innerHTML = accounts.map(row => {
        const meta = row.data;
        let platformKey = String(meta.platform || "outlook").toLowerCase().trim();
        if (platformKey === "mail.ru") platformKey = "mail_ru";
        else if (platformKey === "mail.com") platformKey = "mail_com";
        const platformLogo = logos[platformKey] || logos.default_mail;

        // --- TYPE A: SYSTEM BULK STOCK COMPONENT ---
        if (row.is_system) {
            const stockCount = parseInt(meta.stock_left || 0);
            const isOutOfStock = stockCount <= 0;

            return `
                <div class="card system-stock-card" style="border: 1.5px dashed #4735ea; background: #fbfbfe; opacity: ${isOutOfStock ? '0.7' : '1'}; position: relative; padding: 14px; min-height: 290px !important; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; box-sizing: border-box;">
                    <div style="display: flex; flex-direction: column; justify-content: space-between; flex-grow: 1;">
                        <div>
                            <div class="card-tag system-tag" style="background: ${isOutOfStock ? '#64748b' : '#4735ea'}; color: #fff; font-weight: 700; font-size: 0.65rem; border-radius: 4px; padding: 2px 6px; position: absolute; top: 10px; left: 10px; display: inline-flex; align-items: center; gap: 3px;">
                                <i class="fa-solid fa-bolt-lightning" style="color: #ffd700;"></i> SYSTEM INSTANT
                            </div>
                            
                            <div class="card-img" style="margin-top: 18px; height: 42px; display: flex; align-items: center; justify-content: center;">
                                <img src="${platformLogo}" alt="${meta.platform || 'Email'}" style="max-height: 100%; object-fit: contain;">
                            </div>
                            
                            <p class="title" style="word-break: break-all; font-weight: 700; color: #0b1e5b; font-size: 1.05rem; margin: 4px 0 1px 0; text-align: center; line-height: 1.2;">
                                 ${meta.platform.toUpperCase()}
                            </p>
                            <span style="font-size: 0.75rem; color: var(--text-muted); display: block; text-align: center; margin-bottom: 2px;">${meta.category || 'Standard PVA'}</span>
                        </div>

                        <div style="margin: auto 0;">
                            <div class="stock-status-row" style="font-size: 0.8rem; font-weight: 600; color: ${isOutOfStock ? '#ef4444' : '#10b981'}; text-align: center; margin-bottom: 4px;">
                                <i class="fa-solid fa-boxes-stacked"></i> <span id="stock-count-${row.id}">${stockCount}</span> ${stockCount === 1 ? 'unit left' : 'units left'}
                            </div>

                            <div class="quantity-selector-container" style="display: flex; align-items: center; justify-content: center; gap: 8px; display: ${isOutOfStock ? 'none' : 'flex'};">
                                <button type="button" class="qty-btn" onclick="event.stopPropagation(); adjustQty('${row.id}', -1)" style="width:26px; height:26px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.85rem;">-</button>
                                <input type="number" id="qty-input-${row.id}" value="1" min="1" max="${stockCount}" readonly style="width: 42px; height: 26px; text-align: center; font-weight: bold; border-radius: 4px; border: 1px solid #cbd5e1; padding: 0; font-size:0.85rem;">
                                <button type="button" class="qty-btn" onclick="event.stopPropagation(); adjustQty('${row.id}', 1, ${stockCount})" style="width:26px; height:26px; background:#fff; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.85rem;">+</button>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: auto; display: flex; flex-direction: column; gap: 6px;">
                        <div class="price-row" style="text-align: center;">
                            <span style="font-size: 0.75rem; color: var(--text-muted); margin-right: 2px;">Per unit:</span>
                            <span class="price" style="color:#4735ea; font-weight:800; font-size: 1.1rem;">₦${parseFloat(meta.price || 0).toLocaleString()}</span>
                        </div>

                        <div class="card-action-container" style="margin: 0; padding: 0;">
                            <button class="btn purchase-btn" onclick="${isOutOfStock ? '' : `initiateBulkSystemPurchase('${row.id}')`}" ${isOutOfStock ? 'disabled' : ''} style="background: ${isOutOfStock ? '#94a3b8' : '#4735ea'}; width:100%; padding: 9px; font-size: 0.8rem; font-weight: 700; border-radius: 6px;">
                                ${isOutOfStock ? 'OUT OF STOCK' : 'PURCHASE'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        // --- TYPE B: ORIGINAL SELLER ESCROW CARD ---
        const rawAge = String(meta.account_age || "");
        const yearMatch = rawAge.match(/\d{4}/); 
        const displayYear = yearMatch ? yearMatch[0] : rawAge;

        const isOwner = row.user_id === cachedCurrentUserId;
        const sellerUsername = row.profiles?.username || row.profiles?.full_name || `User_${String(row.user_id).slice(0, 5)}`;
        const isFollowing = cachedMyFollowingList.includes(row.user_id);

        const trustScore = row.profiles?.trust_score || 0;
        const isGoldVerified = trustScore >= 85 && trustScore <= 100;
        const goldBadgeSvg = isGoldVerified ? `
            <svg class="meta-badge" viewBox="0 0 24 24" fill="none" style="width: 14px; height: 14px; margin-left: 3px; flex-shrink: 0; display: inline-block; vertical-align: middle;">
                <defs>
                    <linearGradient id="goldGradient-${row.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#FFF3B0"/><stop offset="40%" stop-color="#FFD700"/><stop offset="100%" stop-color="#D4AF37"/>
                    </linearGradient>
                </defs>
                <path d="M12 2L14.2 4.1L17 3.5L18.1 6.1L20.8 6.8L20.5 9.7L22.5 12L20.5 14.3L20.8 17.2L18.1 17.9L17 20.5L14.2 19.9L12 22L9.8 19.9L7 20.5L5.9 17.9L3.2 17.2L3.5 14.3L1.5 12L3.5 9.7L3.2 6.8L5.9 6.1L7 3.5L9.8 4.1L12 2Z" fill="url(#goldGradient-${row.id})"/>
                <path d="M9.5 12.5L11 14L15 10" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>` : '';

        let displayEmail = 'Hidden';
        if (meta.username) {
            const cleanUsername = meta.username.split('@')[0];
            if (cleanUsername.length > 3) {
                displayEmail = cleanUsername.slice(0, 2) + '******' + cleanUsername.slice(-1);
            } else {
                displayEmail = '******';
            }
        }

        return `
            <div class="card" style="padding: 14px; min-height: 290px !important; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; position: relative; box-sizing: border-box;">
                <div style="display: flex; flex-direction: column; justify-content: space-between; flex-grow: 1;">
                    <div>
                        <div class="options-menu" style="position: absolute; top: 10px; right: 10px; z-index: 10;">
                            <button class="dots-btn" onclick="toggleDropdown(event, '${row.id}')" style="background: none; border: none; color: #64748b; cursor: pointer; padding: 2px;"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                            <div class="dropdown-content" id="dropdown-${row.id}">
                                <button onclick="copyMarketplaceUrl(event, '${row.id}')"><i class="fa-solid fa-link"></i> Copy URL</button>
                                <button onclick="toggleFollowSeller(event, '${row.user_id}', '${sellerUsername}')">
                                    <i class="${isFollowing ? 'fa-solid fa-user-minus' : 'fa-solid fa-user-plus'}"></i> 
                                    ${isFollowing ? 'Unfollow' : 'Follow'}
                                </button>
                            </div>
                        </div>

                        <div class="card-tag seller-username-tag" style="background: #f1f5f9; color: #334155; font-weight: 600; font-size: 0.65rem; border-radius: 4px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 2px; max-width: 75%;">
                            <i class="fa-regular fa-user" style="font-size: 0.6rem;"></i> 
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">@${sellerUsername}</span> 
                            ${goldBadgeSvg}
                        </div>

                        <div class="card-img" style="margin-top: 14px; height: 42px; display: flex; align-items: center; justify-content: center;">
                            <img src="${platformLogo}" alt="${meta.platform || 'Email'}" style="max-height: 100%; object-fit: contain;">
                        </div>
                        
                        <p class="title" style="word-break: break-all; font-weight: 600; color: var(--dark-blue); font-size: 1.05rem; margin: 4px 0 4px 0; text-align: center; line-height: 1.2;">
                            ${displayEmail}
                        </p>
                    </div>

                    <div class="meta" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 6px; font-size: 0.72rem; color: #64748b; margin: auto 0 4px 0; padding: 0 4px;">
                        <span style="display: flex; align-items: center; gap: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="fa-solid fa-earth-africa" style="color: #4735ea;"></i> ${meta.region || 'Global'}</span>
                        <span style="display: flex; align-items: center; gap: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="fa-solid fa-envelope" style="color: #4735ea;"></i> ${(meta.followers || 0)} Mails</span>
                        <span style="display: flex; align-items: center; gap: 3px;"><i class="fa-regular fa-calendar" style="color: #4735ea;"></i> ${displayYear}</span>
                        <span onclick="openDetails('${row.id}')" style="display: flex; align-items: center; gap: 3px; color: #4735ea; font-weight: 700; cursor: pointer; white-space: nowrap;"><i class="fa-solid fa-circle-info"></i> Details</span>
                    </div>
                </div>

                <div style="margin-top: auto; display: flex; flex-direction: column; gap: 6px;">
                    <div class="price-row" style="text-align: center;">
                        <span class="price" style="color:#0b1e5b; font-weight:800; font-size: 1.15rem;">₦${parseFloat(meta.price || 0).toLocaleString()}</span>
                    </div>
                    <div class="card-action-container" style="margin: 0; padding: 0;">
                        <button class="btn purchase-btn ${isOwner ? 'owner-btn' : ''}" 
                                onclick="${isOwner ? '' : `initiatePurchase('${row.id}')`}" ${isOwner ? 'disabled' : ''} style="background:#0b1e5b; width:100%; padding: 9px; font-size: 0.8rem; font-weight: 700; border-radius: 6px;">
                            ${isOwner ? 'YOUR LISTING' : 'PURCHASE'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// 6. DETAIL OVERLAYS & PURCHASE ESCROW FLOWS
// ==========================================
window.openDetails = async (id) => {
    const acc = activeAccounts.find(a => a.id === id);
    if (!acc) return;
    
    const meta = acc.data;
    const body = document.getElementById('modalBody');
    const isOwner = acc.user_id === cachedCurrentUserId;

    const displayYear = String(meta.account_age || "").match(/\d{4}/)?.[0] || meta.account_age || 'N/A';
    
    let modalDisplayEmail = 'Hidden Address';
    if (meta.username && meta.username.includes('@')) {
        const parts = meta.username.split('@');
        modalDisplayEmail = `******@${parts[1]}`;
    }

    body.innerHTML = `
        <div class="detail-item"><span class="detail-label">Asset Address</span><span class="detail-value" style="word-break: break-all; font-weight: 600;">${modalDisplayEmail}</span></div>
        <div class="detail-item"><span class="detail-label">Verification Token</span><span class="detail-value" style="color:#4735ea; font-weight:bold;">${meta.verification_code || 'N/A'}</span></div>
        <div class="detail-item"><span class="detail-label">Region Node</span><span class="detail-value">${meta.region || 'N/A'}</span></div>
        <div class="detail-item"><span class="detail-label">Inbox Content Size</span><span class="detail-value">${(meta.followers || 0).toLocaleString()} Mails</span></div>
        <div class="detail-item"><span class="detail-label">Registration Year</span><span class="detail-value">${displayYear}</span></div>
        <div class="detail-item"><span class="detail-label">Security Profile</span><span class="detail-value">${meta.login_formats ? meta.login_formats.join(', ') : 'PV Verified Standard'}</span></div>
        <div style="margin-top:15px; padding-top:10px; border-top:1px solid #eee;">
            <span class="detail-label" style="display:block; margin-bottom:5px;">Product Description Context</span>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">${meta.description || 'No custom notes provided.'}</p>
        </div>
    `;

    const footer = document.querySelector('#modalOverlay .modal-footer');
    if (footer) {
        footer.innerHTML = `
            <button class="btn-cancel" onclick="closeModal()">Close Window</button>
            <button class="btn purchase-btn ${isOwner ? 'owner-btn' : ''}" 
                onclick="${isOwner ? '' : `closeModal(); initiatePurchase('${acc.id}')`}" ${isOwner ? 'disabled' : ''}
                style="flex: 2; margin: 0; background:${isOwner ? '#94a3b8' : '#0b1e5b'}">
                ${isOwner ? 'YOUR LISTING' : 'BUY VIA ESCROW'}
            </button>
        `;
    }
    document.getElementById('modalOverlay').style.display = 'flex';
};

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
            .select('username, full_name, balance').eq('id', buyerId).single();

        if (balanceError || buyer.balance < totalWithFee) {
            await supabase.from('verifications').update({ status: 'approved' }).eq('id', account.id);
            return Swal.fire("Insufficient Balance", "You do not have enough funds for this purchase.", "warning");
        }

        const { data: sellerProfile } = await supabase
            .from('profiles')
            .select('email, username, full_name, telegram_chat_id, telegram_alerts, onesignal_id, push_notifications_enabled')
            .eq('id', account.user_id).single();

        await supabase.from('profiles').update({ balance: buyer.balance - totalWithFee }).eq('id', buyerId);

        await supabase.from('wallet').insert([{
            user_id: buyerId,
            type: 'Payment',
            amount: `-${totalWithFee.toFixed(2)}`, 
            note: `Payment for Outlook account: ${account.data.username || 'Unknown'}`,
            status: 'success',
            reference: `PUR_${account.id.slice(0, 8)}_${Date.now()}`
        }]);

        const { data: conv, error: convError } = await supabase.from('conversations').insert([{
            product_id: account.id,
            product_name: "Outlook",
            product_price: originalPrice.toString(),
            buyer_id: buyerId,
            seller_id: account.user_id,
            escrow_step: 0,
            status: 'active',
            last_message: "System: Buyer has started the escrow process. Payment is secured."
        }]).select().single();

        if (convError) throw convError;

        const currentBuyerName = buyer?.username || buyer?.full_name || "Someone";
        const targetAccountName = account.data?.username || "Outlook Listing";
        const chatRoomUrl = `https://accmarket.name.ng/chats?id=${conv.id}`;
        const purchaseAlertMsg = `@${currentBuyerName} purchased your account ${targetAccountName}! Access your chat workspace here to deliver logs: ${chatRoomUrl}`;

        await supabase.from('notifications').insert([{
            user_id: account.user_id, title: "Account Sold! 🎉", message: purchaseAlertMsg, icon: "fas fa-shopping-bag", type: "purchase", is_read: false
        }]);

        if (sellerProfile?.telegram_alerts === true && sellerProfile?.telegram_chat_id) {
            const TELEGRAM_BOT_TOKEN = "8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg"; 
            const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
            const tgMarkdownText = `💰 *New Sale Notification!*\n\n@${currentBuyerName} purchased your account *${targetAccountName}*!\n\n👉 [Click Here to Access Chat Workspace](${chatRoomUrl}) to deliver logs.`;
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
                await fetch("https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/sales-notification", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${jwtToken}` },
                    body: JSON.stringify({
                        seller_email: sellerProfile.email, seller_name: sellerProfile.username || "Seller",
                        buyer_name: currentBuyerName, account_name: targetAccountName, chat_url: chatRoomUrl,
                        onesignal_id: sellerProfile.onesignal_id, push_enabled: sellerProfile.push_notifications_enabled
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

// ==========================================
// 6B. AUTOMATED SYSTEM BULK DELIVERY ENGINE
// ==========================================
window.initiateBulkSystemPurchase = async (id) => {
    if (!cachedCurrentUserId) {
        Swal.fire("Authentication Required", "Please log in to purchase items.", "info");
        return;
    }
    
    const targetItem = activeAccounts.find(a => a.id === id);
    if (!targetItem) return;

    const qtyInput = document.getElementById(`qty-input-${id}`);
    const selectedQty = qtyInput ? parseInt(qtyInput.value) : 1;
    
    const unitPrice = parseFloat(targetItem.data.price);
    const totalCost = unitPrice * selectedQty;

    // --- STEP 1: CREATE AND SHOW CUSTOM DOM OVERLAY MODAL ---
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'custom-modal-overlay';
    
    modalOverlay.innerHTML = `
    <div class="custom-modal-card">
        <h3 style="margin-top: 0; color: #0b1e5b; font-size: 1.25rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px;">Confirm Instant Purchase</h3>
        <div style="font-size: 0.95rem; line-height: 1.6; color: #334155; margin-bottom: 20px;">
            <p style="margin: 4px 0;"><strong>Item:</strong> Bulk Verified Hotmail (${targetItem.data.category || 'Standard PVA'})</p>
            <p style="margin: 4px 0;"><strong>Quantity:</strong> ${selectedQty} units</p>
            <p style="margin: 4px 0;"><strong>Price per unit:</strong> ₦${unitPrice.toLocaleString()}</p>
            
            <!-- Professional Description Container -->
            <div style="margin: 16px 0; padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                <p style="margin: 0; font-size: 0.85rem; color: #475569;">
                    <strong style="color: #0b1e5b;">Description:</strong> ${targetItem.data.description || 'No specific product notes provided.'}
                </p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;">
            <p style="font-size: 1.15rem; color: #6001D2; margin: 0;"><strong>Total Cost:</strong> ₦${totalCost.toLocaleString()}</p>
            <p style="font-size: 0.8rem; color: #64748b; margin-top: 12px; line-height: 1.4;"><i class="fa-solid fa-circle-info"></i> Funds will be deducted immediately from your balance. Credentials deliver straight to this window session.</p>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="custom-modal-btn custom-modal-btn-secondary" id="modalCancelBtn">Cancel</button>
            <button class="custom-modal-btn custom-modal-btn-primary" id="modalConfirmBtn">Pay & Deliver Now</button>
        </div>
    </div>
`;

    document.body.appendChild(modalOverlay);

    // Bind Close Actions
    document.getElementById('modalCancelBtn').onclick = () => modalOverlay.remove();
    
    document.getElementById('modalConfirmBtn').onclick = async () => {
        // Transition card into Loading state dynamically
        const modalBox = modalOverlay.querySelector('.custom-modal-card');
        modalBox.innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; color: #6001D2; margin-bottom: 16px;"></i>
                <h4 style="margin: 0 0 8px 0; color: #0b1e5b; font-size: 1.1rem;">Processing Secure Transaction...</h4>
                <p style="margin: 0; font-size: 0.85rem; color: #64748b;">Verifying balances and building delivery packages.</p>
            </div>
        `;

        try {
            // Invoke the PostgreSQL Transaction RPC to execute atomic account distribution
            const { data: itemsToDeliver, error: transactionError } = await supabase.rpc('purchase_system_bulk', {
                target_id: id,
                buyer_id: cachedCurrentUserId,
                qty: selectedQty,
                total_cost: totalCost
            });

            if (transactionError) throw transactionError;

            // --- STEP 2: PARSE & RENDER SECURED ACCOUNT DELIVERIES IN RAW PIPE FORMAT ---
            let outputLogsHtml = `<div style="text-align: left; max-height: 200px; overflow-y: auto; background: #0f172a; color: #fff; font-family: monospace; padding: 14px; border-radius: 6px; font-size: 0.9rem; margin-top: 14px; border: 1px solid #1e293b; white-space: pre-wrap; line-height: 1.6;">`;
            
            let rawTxtContent = ""; // Clear string container for clean text file extraction

            itemsToDeliver.forEach((account) => {
                // Construct the strict raw string format line
                let accountLine = `${account.email || 'N/A'}|${account.password || 'N/A'}`;
                
                if (account.recovery) {
                    accountLine += `|${account.recovery}`;
                }

                // Append cleanly to raw text layout array
                rawTxtContent += `${accountLine}\n`;

                // Render into screen log element
                outputLogsHtml += `<span>${accountLine}</span><br>`;
                
                // If an associated browser cookie payload exists, provide it cleanly below the line
                if (account.cookie) {
                    outputLogsHtml += `<textarea readonly style="width:100%; height:34px; background:#1e293b; color:#10b981; border:none; font-size:0.75rem; margin: 4px 0 8px 0; border-radius:4px; font-family:monospace; resize:none;">Cookie: ${typeof account.cookie === 'object' ? JSON.stringify(account.cookie) : account.cookie}</textarea><br>`;
                }
            });
            outputLogsHtml += `</div>`;

            // Swap out inner modal box layout with complete transaction delivery review screen
            modalBox.innerHTML = `
                <h3 style="margin-top: 0; color: #10b981; font-size: 1.25rem; text-align: center;"><i class="fa-solid fa-circle-check"></i> Purchase Successful!</h3>
                <p style="font-size:0.9rem; color: #334155; text-align: center; margin-bottom: 12px;">₦${totalCost.toLocaleString()} successfully processed. Save your units below:</p>
                
                <p style="font-size: 0.8rem; color: #64748b; text-align: center; margin-bottom: 10px;">
                    Format: <b>email|password</b> (or <b>email|password|recovery</b>)
                </p>

                <button class="custom-modal-btn" id="modalDownloadTxtBtn" style="background: #0f172a; color: #38bdf8; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; border: 1px solid #1e293b; margin-bottom: 10px;">
                    <i class="fa-solid fa-file-arrow-down"></i> Download Accounts (.txt File)
                </button>

                ${outputLogsHtml}
                <p style="font-size:0.78rem; color:#ef4444; font-weight:700; margin: 12px 0; line-height: 1.4;"><i class="fa-solid fa-triangle-exclamation"></i> Copy or download these credentials right now. They are shown strictly for this session and won't display again.</p>
                <button class="custom-modal-btn custom-modal-btn-success" id="modalCloseDeliveryBtn">Done, I Have Saved It</button>
            `;

            // Process dynamic downloading of account credentials context array
            document.getElementById('modalDownloadTxtBtn').onclick = () => {
                const blob = new Blob([rawTxtContent], { type: 'text/plain;charset=utf-8;' });
                const link = document.createElement('a');
                const filename = `Accmarket_Bulk_${targetItem.data.platform}_${Date.now()}.txt`;
                
                if (navigator.msSaveBlob) { 
                    navigator.msSaveBlob(blob, filename);
                } else {
                    link.href = URL.createObjectURL(blob);
                    link.setAttribute('download', filename);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            };

            document.getElementById('modalCloseDeliveryBtn').onclick = () => {
                modalOverlay.remove();
                fetchHotmailInventory(); // Refresh view state counts
            };

        } catch (err) {
            console.error("System Transaction Error Context:", err);
            
            modalBox.innerHTML = `
                <div style="text-align: center; padding: 10px 0;">
                    <i class="fa-solid fa-circle-xmark" style="font-size: 2.5rem; color: #ef4444; margin-bottom: 12px;"></i>
                    <h4 style="margin: 0 0 8px 0; color: #0b1e5b; font-size: 1.1rem;">Transaction Failed</h4>
                    <p style="margin: 0 0 16px 0; font-size: 0.88rem; color: #64748b; line-height: 1.4;">${err.message || 'An unexpected database writing error occurred.'}</p>
                    <button class="custom-modal-btn custom-modal-btn-secondary" id="modalErrorCloseBtn" style="width: 100%;">Close Window</button>
                </div>
            `;
            document.getElementById('modalErrorCloseBtn').onclick = () => modalOverlay.remove();
        }
    };
};


window.adjustQty = (id, direction, maxStock) => {
    const input = document.getElementById(`qty-input-${id}`);
    if (!input) return;
    let currentVal = parseInt(input.value) || 1;
    currentVal += direction;
    if (currentVal < 1) currentVal = 1;
    if (maxStock && currentVal > maxStock) currentVal = maxStock;
    input.value = currentVal;
};

// ==========================================
// 7. INTERACTIVE SELLER FOLLOWING SUBSYSTEM
// ==========================================
window.toggleFollowSeller = async (event, sellerId, sellerUsername) => {
    event.stopPropagation(); 
    if(sellerId === 'system_admin') return;
    try {
        if (!cachedCurrentUserId) return Swal.fire("Authentication Required", "Please log in to follow sellers.", "info");
        if (cachedCurrentUserId === sellerId) return Swal.fire("Action Denied", "You cannot follow your own profile listing.", "warning");

        Swal.fire({ title: 'Updating follow status...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const { data: buyerProfile } = await supabase.from('profiles').select('username, full_name, following').eq('id', cachedCurrentUserId).single();
        const { data: sellerProfile } = await supabase.from('profiles').select('followers, telegram_chat_id, telegram_alerts').eq('id', sellerId).single();

        let buyerFollowing = buyerProfile?.following?.uids || [];
        let sellerFollowers = sellerProfile?.followers?.uids || [];
        const isCurrentlyFollowing = buyerFollowing.includes(sellerId);
        let alertTitle = "", alertIcon = "success", shouldSendNotification = false;

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

// ==========================================
// 8. SYSTEM ACCOUNT ROLES & DEACTIVATION POLICIES
// ==========================================
async function showSellerAndAdminLinks() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const sellAccountLink = document.querySelector(".seller-only");
    if (sellAccountLink) {
      sellAccountLink.style.display = (profile?.role === "seller") ? "block" : "none";
    }
  } catch (err) { console.error("Error evaluating role visibility context:", err); }
}

// ---- LOGOUT DELEGATION REALM ----
document.addEventListener("click", async (e) => {
  if (e.target.closest(".logout")) {
    e.preventDefault();
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "../auth";
    } catch (err) { console.error("Interface redirect crash:", err.message); }
  }
});

// ==========================================
// 9. REALTIME TRACKING NOTIFICATIONS & CHATS
// ==========================================
async function loadNotificationCount() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
    const badge = document.getElementById("notification-count");
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  } catch (err) { console.error(err); }
}

async function setupNotificationRealtime() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    supabase.channel("notifications-realtime-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, async (payload) => {
          await loadNotificationCount();
          if (payload.eventType === "INSERT") {
            notificationSound.play().catch((e) => console.warn(e));
          }
      }).subscribe();
  } catch (err) { console.error(err); }
}

async function loadTotalChatCount() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("is_read", false).neq("sender_id", user.id); 
    const badge = document.getElementById("chat-notification-count");
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  } catch (err) { console.error(err); }
}

async function setupGlobalChatRealtime() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  supabase.channel("global-chat-updates")
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, async (payload) => {
        await loadTotalChatCount();
        if (payload.eventType === "INSERT" && payload.new.sender_id !== user.id) {
            chatNotificationSound.play().catch((e) => console.warn(e));
        }
    }).subscribe();
}

// ==========================================
// 10. INITIALIZATION PIPELINE
// ==========================================
async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        cachedCurrentUserId = user.id;
        const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).single();
        if (profile && profile.is_active === false) {
            Swal.fire({
                title: "Account Deactivated", text: "Your account has been deactivated. Please contact support.", icon: "error", allowOutsideClick: false
            }).then(async () => {
                await supabase.auth.signOut();
                window.location.href = "auth.html";
            });
            return;
        }
        
        const userNameDisplay = document.querySelector('.user-name');
        if (userNameDisplay && user.user_metadata?.full_name) {
            userNameDisplay.textContent = user.user_metadata.full_name;
        }
    }

    showSellerAndAdminLinks();
    loadNotificationCount();
    setupNotificationRealtime();
    loadTotalChatCount();
    setupGlobalChatRealtime();
    setInterval(loadNotificationCount, 30000);

    await fetchOutlookInventory(); 

    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');
    if (targetId) {
        setTimeout(() => {
            const exists = activeAccounts.find(a => a.id === targetId);
            if (exists) window.openDetails(targetId);
        }, 500); 
    }

    // Real-time standard user verification updates
    supabase.channel('public:verifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'verifications' }, () => {
            fetchOutlookInventory(); 
        }).subscribe();

    // Real-time system bulk table changes
    supabase.channel('public:system_bulk_stock')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'system_bulk_stock' }, () => {
            fetchOutlookInventory();
        }).subscribe();
}

init();      