// 1. Sidebar & UI Elements
const sidebarToggle = document.getElementById("sidebarToggle");
const profileToggle = document.getElementById("profileToggle");
const leftSidebar = document.getElementById("leftSidebar");
const rightSidebar = document.getElementById("rightSidebar");
const closeLeft = document.getElementById("closeLeft");
const closeRight = document.getElementById("closeRight");

// Toggle Left Sidebar
sidebarToggle?.addEventListener("click", () => leftSidebar.classList.add("active"));
closeLeft?.addEventListener("click", () => leftSidebar.classList.remove("active"));

// Toggle Right Sidebar
profileToggle?.addEventListener("click", () => rightSidebar.classList.add("active"));
closeRight?.addEventListener("click", () => rightSidebar.classList.remove("active"));

// ✅ Global State for Filtering/Sorting
let activeAccounts = [];

// --- UPDATED FILTER LOGIC (BYBIT STYLE) ---
const filterBtn = document.querySelector(".fa-sliders");
const filterBar = document.getElementById("filterBar");

filterBtn?.addEventListener("click", () => {
    filterBar?.classList.toggle("active");
});

const applyFilters = () => {
    const maxPrice = parseFloat(document.getElementById('priceRange')?.value) || 100000;
    const minFollowers = parseInt(document.getElementById('followerRange')?.value) || 0;
    const minYear = parseInt(document.getElementById('yearRange')?.value) || 1999;
    const searchTerm = document.getElementById('assetSearch')?.value.toLowerCase() || "";

    // Update UI Labels
    if(document.getElementById('priceVal')) document.getElementById('priceVal').textContent = `₦${maxPrice.toLocaleString()}`;
    if(document.getElementById('followerVal')) document.getElementById('followerVal').textContent = `${minFollowers.toLocaleString()}+`;
    if(document.getElementById('yearVal')) document.getElementById('yearVal').textContent = `${minYear}+`;

    const filtered = activeAccounts.filter(row => {
        const meta = row.data;
        const price = parseFloat(meta.price) || 0;
        const followers = parseInt(meta.followers) || 0;
        const year = parseInt(String(meta.account_age).match(/\d{4}/)?.[0]) || 0;

        const matchesSearch = meta.username.toLowerCase().includes(searchTerm) || meta.region.toLowerCase().includes(searchTerm);
        const matchesPrice = price <= maxPrice;
        const matchesFollowers = followers >= minFollowers;
        const matchesYear = year >= minYear;

        return matchesSearch && matchesPrice && matchesFollowers && matchesYear;
    });

    renderGrid(filtered);
};

// Listen for slider/search input
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('filter-slider') || e.target.id === 'assetSearch') {
        applyFilters();
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
            item.parentElement.style.display = item.textContent.toLowerCase().includes(input) ? "block" : "none";
        });
    });
});

// ✅ Initialize Supabase
import { supabase } from './supabase-config.js';

// Get the logged-in user
async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    const userNameDisplay = document.querySelector('.user-name');
    if (userNameDisplay && user.user_metadata.full_name) {
        userNameDisplay.textContent = user.user_metadata.full_name;
    }
    return user;
}

// 1. Helper for Trust Badges
const getTrustInfo = (row) => {
    const score = parseFloat(row.profiles?.trust_score) || 0;
    
    // Level 5: 95+ (The Highest Honor)
    if (score >= 95) return { 
        label: "LEGENDARY", 
        class: "trust-meta" 
    };
    
    // Level 4: 80-94
    if (score >= 80) return { label: "ELITE", class: "trust-high" };
    
    // Level 3: 60-79
    if (score >= 60) return { label: "PRO SELLER", class: "trust-pro" };
    
    // Level 2: 30-59
    if (score >= 30) return { label: "RISING", class: "trust-mid" };
    
    // Level 1: 0-29
    return { label: "NEW SELLER", class: "trust-low" };
};


// 2. Main Fetch Function
// 2. Main Fetch Function (Refined for Deep-Linking vs Grid Visibility)
async function fetchFacebookInventory() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const targetId = urlParams.get('id');

        let query = supabase.from('verifications').select('*');

        // Fetch approved items OR the specific ID from the URL
        if (targetId) {
            query = query.or(`status.eq.approved,id.eq.${targetId}`);
        } else {
            query = query.eq('status', 'approved');
        }

        const { data: inventory, error: invError } = await query;
        if (invError) throw invError;

        const userIds = [...new Set(inventory.map(row => row.user_id))];
        const { data: profileList } = await supabase
            .from('profiles')
            .select('id, trust_score')
            .in('id', userIds);

        activeAccounts = inventory.map(row => {
            const meta = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            const userProfile = profileList?.find(p => p.id === row.user_id);
            return {
                ...row,
                data: meta,
                profiles: userProfile || { trust_score: "0" }
            };
        }).filter(row => {
            // Check if it's a Facebook account
            return row.data && row.data.platform?.toLowerCase() === 'facebook';
        });

        // ✅ THE FIX: Separate the data used for the Modal from the data used for the Grid
        // We only want to show 'approved' accounts in the marketplace cards
        const gridAccounts = activeAccounts.filter(row => row.status === 'approved');
        
        renderGrid(gridAccounts);

    } catch (err) {
        console.error("Master Fetch Error:", err.message);
    }
}



// 3. Render Function (Updated to handle self-purchase protection)
async function renderGrid(accounts) {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    // Fetch the current user to check for ownership
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user ? user.id : null;

    if (accounts.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No accounts found.</p>`;
        return;
    }

    grid.innerHTML = accounts.map(row => {
        const meta = row.data; 
        const trust = getTrustInfo(row);

        const rawAge = String(meta.account_age || "");
        const yearMatch = rawAge.match(/\d{4}/); 
        const displayYear = yearMatch ? yearMatch[0] : rawAge;

        // Check if the current user is the seller of this specific account
        const isOwner = row.user_id === currentUserId;

        return `
            <div class="card">
                <div class="options-menu">
                    <button class="dots-btn" onclick="toggleDropdown(event, '${row.id}')">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    <div class="dropdown-content" id="dropdown-${row.id}">
                        <button onclick="window.open('${meta.profile_link}', '_blank')"><i class="fa-solid fa-eye"></i> View Live</button>
                        <button onclick="copyToClipboard('${row.id}')"><i class="fa-solid fa-copy"></i> Copy ID</button>
                    </div>
                </div>
                
                <div class="card-tag ${trust.class}">${trust.label}</div>
                
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




// Main Marketplace Search
document.getElementById('assetSearch')?.addEventListener('input', (e) => {
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
        <img src="${acc.screenshot_url}" style="width:100%; border-radius:12px; margin-bottom:15px; border:1px solid var(--border);">
        <div class="detail-item"><span class="detail-label">Username</span><span class="detail-value">@${meta.username}</span></div>
        <div class="detail-item"><span class="detail-label">Verification Code</span><span class="detail-value" style="color:var(--primary); font-weight:bold;">${meta.verification_code || 'N/A'}</span></div>
        <div class="detail-item"><span class="detail-label">Region</span><span class="detail-value">${meta.region}</span></div>
        <div class="detail-item"><span class="detail-label">Followers</span><span class="detail-value">${(meta.followers || 0).toLocaleString()}</span></div>
        <div class="detail-item"><span class="detail-label">Account Year</span><span class="detail-value">${displayYear}</span></div>
        <div class="detail-item"><span class="detail-label">Formats</span><span class="detail-value">${meta.login_formats ? meta.login_formats.join(', ') : 'N/A'}</span></div>
        
        <div style="margin-top:15px; padding-top:10px; border-top:1px solid #eee;">
            <span class="detail-label" style="display:block; margin-bottom:5px;">Description</span>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">${meta.description || 'No description provided.'}</p>
        </div>

        <div class="card-action-container" style="padding-top:20px; display: flex; justify-content: center;">
             <button class="btn purchase-btn ${isOwner ? 'owner-btn' : ''}" 
                onclick="${isOwner ? '' : `closeModal(); initiatePurchase('${acc.id}')`}"
                ${isOwner ? 'disabled' : ''}
                style="width: 100%; ${isOwner ? 'background: #94a3b8; cursor: not-allowed;' : ''}">
                ${isOwner ? 'YOUR LISTING' : 'PROCEED TO PURCHASE'}
            </button>
        </div>
    `;
    
    document.getElementById('modalOverlay').style.display = 'flex';
};


// Purchase Flow
window.initiatePurchase = async (id) => {
    const acc = activeAccounts.find(a => a.id === id);
    if (!acc) return;

    const basePrice = parseFloat(acc.data.price) || 0;
    // 5% fee for 1500 accounts, otherwise 3%
    const feeRate = (basePrice === 1500) ? 0.05 : 0.03;
    const fee = basePrice * feeRate;
    const total = basePrice + fee;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alert("Please login to purchase.");

        const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
        const balance = profile?.balance || 0;

        // Ensure elements exist before setting values
        const modal = document.getElementById('escrowModal');
        const baseEl = document.getElementById('displayBasePrice');
        const feeEl = document.getElementById('displayFee');
        const totalEl = document.getElementById('displayTotal');
        const balanceEl = document.getElementById('displayUserBalance');
        const continueBtn = document.getElementById('btnContinuePurchase');

        if (!modal || !baseEl || !totalEl) {
            console.error("Required Modal HTML elements are missing from facebook.html!");
            return;
        }

        // Fill Data
        baseEl.innerText = `₦${basePrice.toLocaleString()}`;
        if (feeEl) feeEl.innerText = `₦${fee.toLocaleString()}`;
        totalEl.innerText = `₦${total.toLocaleString()}`;
        if (balanceEl) {
            balanceEl.innerText = `₦${balance.toLocaleString()}`;
            balanceEl.style.color = (balance < total) ? "red" : "green";
        }

        if (continueBtn) {
            continueBtn.disabled = (balance < total);
            continueBtn.innerText = (balance < total) ? "Insufficient Balance" : "Continue Purchase";
            continueBtn.onclick = () => processTransaction(acc, total, basePrice, user.id);
        }

        modal.style.display = 'flex';
    } catch (err) {
        console.error("Purchase Initialization Error:", err);
    }
};

async function processTransaction(account, totalWithFee, originalPrice, buyerId) {
    try {
        // 1. Atomic Status Change: Lock the account so no one else can buy it
        const { data: lockCheck, error: lockError } = await supabase
            .from('verifications')
            .update({ status: 'in_progress' })
            .eq('id', account.id)
            .eq('status', 'approved') // Only update if still available
            .select();

        if (lockError || !lockCheck || lockCheck.length === 0) {
            return Swal.fire("Unavailable", "This account was just taken or is no longer available.", "error");
        }

        // 2. Deduct Balance from Buyer Profile
        const { data: buyer, error: balanceError } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', buyerId)
            .single();

        if (balanceError || buyer.balance < totalWithFee) {
            // Rollback: set status back to approved if balance is insufficient
            await supabase.from('verifications').update({ status: 'approved' }).eq('id', account.id);
            return Swal.fire("Insufficient Balance", "You do not have enough funds for this purchase.", "warning");
        }

        await supabase.from('profiles')
            .update({ balance: buyer.balance - totalWithFee })
            .eq('id', buyerId);

        // 3. Insert into Transactions Table (Matching your schema)
        const { error: transError } = await supabase.from('wallet').insert([{
            user_id: buyerId,
            type: 'Payment',
            amount: `-${totalWithFee.toFixed(2)}`, // Negative decimal string
            note: `Payment for Facebook account: @${account.data.username}`,
            status: 'success',
            reference: `PUR_${account.id.slice(0, 8)}_${Date.now()}`
        }]);

        if (transError) console.error("History Log Error:", transError);

        // 4. Create the Conversation record
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

        // 5. Success - Redirect to Chats
        window.location.href = `../chats?id=${conv.id}`;

    } catch (err) {
        console.error("Transaction Error:", err);
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
    document.getElementById(`dropdown-${id}`).classList.toggle('show');
};

window.copyToClipboard = (id) => {
    navigator.clipboard.writeText(id);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ID Copied', showConfirmButton: false, timer: 1500 });
};

window.onclick = () => document.querySelectorAll('.dropdown-content').forEach(m => m.classList.remove('show'));
window.closeModal = () => document.getElementById('modalOverlay').style.display = 'none';

// Start App with URL Deep-Linking and Real-time Subscription
async function init() {
    // 1. Initial Identity & Data Load
    await getCurrentUser();
    await fetchFacebookInventory(); 

    // 2. Handle Deep Linking (Read ID from URL)
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('id');

    if (targetId) {
        // Small delay ensures activeAccounts is fully mapped before opening
        setTimeout(() => {
            const exists = activeAccounts.find(a => a.id === targetId);
            if (exists) {
                window.openDetails(targetId);
            } else {
                console.warn("Deep-linked account ID not found or not approved.");
            }
        }, 500); 
    }

    // 3. 🔴 Real-time Listener
    // Instantly refreshes the grid if an account is bought (status change) or added
    supabase
        .channel('public:verifications')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'verifications' 
        }, (payload) => {
            console.log('Real-time update received:', payload.eventType);
            fetchFacebookInventory(); // Re-fetch and re-render grid
        })
        .subscribe();
}

// Initialize the application
init();
