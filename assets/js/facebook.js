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
async function fetchFacebookInventory() {
    try {
        // Fetch accounts
        const { data: inventory, error: invError } = await supabase
            .from('verifications')
            .select('*')
            .eq('status', 'approved');

        if (invError) throw invError;

        // Fetch profiles separately (to avoid join errors)
        const userIds = [...new Set(inventory.map(row => row.user_id))];
        const { data: profileList, error: profError } = await supabase
            .from('profiles')
            .select('id, trust_score')
            .in('id', userIds);

        // Merge and Parse
        activeAccounts = inventory.map(row => {
            // CRITICAL: Parse the 'data' string into an object
            const meta = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            const userProfile = profileList?.find(p => p.id === row.user_id);
            
            return {
                ...row,
                data: meta,
                profiles: userProfile || { trust_score: "0" }
            };
        }).filter(row => row.data && row.data.platform?.toLowerCase() === 'facebook');

        renderGrid(activeAccounts);

    } catch (err) {
        console.error("Master Fetch Error:", err.message);
    }
}

// 3. Render Function
function renderGrid(accounts) {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    if (accounts.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No accounts found.</p>`;
        return;
    }

    grid.innerHTML = accounts.map(row => {
        const meta = row.data; 
        const trust = getTrustInfo(row); // Now defined and works

        const rawAge = String(meta.account_age || "");
        const yearMatch = rawAge.match(/\d{4}/); 
        const displayYear = yearMatch ? yearMatch[0] : rawAge;

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
                
                <div style="width: 100%; display: flex; justify-content: center; align-items: center; margin: 15px 0 5px 0;">
                    <button class="btn" style="width: 90%;" onclick="initiatePurchase('${row.id}')">
                        PURCHASE
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

// View Details (Modal)
window.openDetails = (id) => {
    const acc = activeAccounts.find(a => a.id === id);
    const meta = acc.data;
    const body = document.getElementById('modalBody');

    const rawAge = String(meta.account_age || "");
    const yearMatch = rawAge.match(/\d{4}/); 
    const displayYear = yearMatch ? yearMatch[0] : rawAge;
    
    body.innerHTML = `
        <img src="${acc.screenshot_url}" style="width:100%; border-radius:12px; margin-bottom:15px; border:1px solid var(--border);">
        <div class="detail-item"><span class="detail-label">Username</span><span class="detail-value">@${meta.username}</span></div>
        <div class="detail-item"><span class="detail-label">Verification Code</span><span class="detail-value" style="color:var(--primary); font-weight:bold;">${meta.verification_code || 'N/A'}</span></div>
        <div class="detail-item"><span class="detail-label">Region</span><span class="detail-value">${meta.region}</span></div>
        <div class="detail-item"><span class="detail-label">Followers</span><span class="detail-value">${meta.followers.toLocaleString()}</span></div>
        <div class="detail-item"><span class="detail-label">Account Year</span><span class="detail-value">${displayYear}</span></div>
        <div class="detail-item"><span class="detail-label">Formats</span><span class="detail-value">${meta.login_formats.join(', ')}</span></div>
        <div style="margin-top:15px; padding-top:10px; border-top:1px solid #eee;">
            <span class="detail-label" style="display:block; margin-bottom:5px;">Description</span>
            <p style="font-size:0.8rem; color:var(--text-muted); line-height:1.4; margin:0;">${meta.description || 'No description provided.'}</p>
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
        // 1. Change status to hide from others
        await supabase.from('verifications').update({ status: 'in_progress' }).eq('id', account.id);

        // 2. Deduct Balance
        const { data: buyer } = await supabase.from('profiles').select('balance').eq('id', buyerId).single();
        await supabase.from('profiles').update({ balance: buyer.balance - totalWithFee }).eq('id', buyerId);

        // 3. Create Conversation
        const { data: conv, error } = await supabase.from('conversations').insert([{
            product_id: account.id,
product_name: "Facebook",
            product_price: originalPrice.toString(),
            buyer_id: buyerId,
            seller_id: account.user_id,
            escrow_step: 0,
            status: 'active',
            last_message: "System: Buyer has started the escrow process."
        }]).select().single();

        if (error) throw error;
        window.location.href = `../chats?id=${conv.id}`;
    } catch (err) {
        console.error("Transaction Error:", err);
        alert("Transaction failed. Please try again.");
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

// Start App
async function init() {
    await getCurrentUser();
    await fetchFacebookInventory();
}
init();
