import { supabase } from '../../../assets/js/supabase-config.js';

// --- UI Elements ---
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const navItems = document.querySelectorAll('.nav-item');
const sectionTitle = document.getElementById('sectionTitle');

// Global cache for searching
let cachedUsers = [];

// --- Initialization ---
async function init() {
    // 1. Security Gate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        window.location.href = "login.html";
        return;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('username, role')
        .eq('id', user.id)
        .single();

    if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        window.location.href = "login.html";
        return;
    }

    document.getElementById('adminUsername').textContent = `Security Clear: ${profile.username}`;

    // 2. Load Dashboard Stats
    loadIntelligenceMetrics();

    // 3. Setup Directory Event Listeners (Search/Refresh)
    setupDirectoryListeners();
}

// --- Navigation Logic ---
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const section = item.getAttribute('data-section');
        sectionTitle.textContent = item.textContent.trim();

        sidebar.classList.remove('active');
        overlay.classList.remove('active');

        // Toggle Content Sections
        document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
        const targetSection = document.getElementById(`${section}Section`);
        if (targetSection) targetSection.style.display = 'block';

        // --- FETCH DATA IF SECTION IS DIRECTORY ---
        if (section === 'users') {
            loadUserDirectory();
        }
    });
});

// --- User Directory Logic ---
function setupDirectoryListeners() {
    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = cachedUsers.filter(u => 
                (u.username && u.username.toLowerCase().includes(term)) || 
                (u.email && u.email.toLowerCase().includes(term))
            );
            renderUserTable(filtered);
        });
    }

    const refreshBtn = document.getElementById('refreshUsersBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadUserDirectory);
    }
}

async function loadUserDirectory() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Accessing User Records...</td></tr>';

    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        cachedUsers = users; // Store for searching
        renderUserTable(users);

    } catch (err) {
        console.error("Directory Access Error:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: #ef4444;">Unauthorized or Connection Error.</td></tr>';
    }
}

function renderUserTable(users) {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color: #94a3b8;">No matching entities found.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => {
        const initials = u.username ? u.username.substring(0, 2).toUpperCase() : '??';
        const role = u.role?.toLowerCase() || 'buyer';
        const roleClass = role === 'seller' ? 'badge-seller' : 'badge-buyer';
        
        return `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">${initials}</div>
                        <div class="user-details">
                            <span class="user-name">${u.username || 'Anonymous User'}</span>
                            <span class="user-email">${u.email || 'N/A'}</span>
                        </div>
                    </div>
                </td>
                <td><span class="badge ${roleClass}">${role.charAt(0).toUpperCase() + role.slice(1)}</span></td>
                <td><span class="balance-text">₦${(u.balance || 0).toLocaleString()}</span></td>
                <td class="date-text">${new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td class="table-ops" style="text-align: right;">
                    <button class="op-btn view" onclick="viewUserFile('${u.id}')" title="View Profile">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="op-btn restrict" onclick="restrictUserAccess('${u.id}')" title="Restrict Access">
                        <i class="fa-solid fa-ban"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- Exposed Operations (Must be window-scoped for onclick) ---
window.viewUserFile = async (userId) => {
    Swal.fire({ title: 'Accessing Secure File...', didOpen: () => Swal.showLoading() });

    try {
        const { data: user, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Logic to color the trust score (Green for high, Orange for medium, Red for low)
        const score = parseFloat(user.trust_score || 0);
        const scoreColor = score >= 7 ? '#22c55e' : (score >= 4 ? '#f59e0b' : '#ef4444');

        Swal.fire({
            title: `<span style="color: #0b1e5b; font-size: 18px;">Security Dossier: ${user.username}</span>`,
            width: '500px',
            html: `
                <div style="text-align: left; font-family: 'Inter', sans-serif; font-size: 13px; color: #1e293b;">
                    
                    <div style="display: flex; align-items: center; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                        <img src="${user.avatar_url || 'https://via.placeholder.com/60'}" style="width: 65px; height: 65px; border-radius: 12px; object-fit: cover; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 15px; color: #0b1e5b;">ID: <span style="font-weight: 400; color: #64748b; font-size: 11px;">${user.id}</span></div>
                            <div style="margin-top: 4px;"><b>Country:</b> ${user.country_flag ? `<img src="${user.country_flag}" width="16">` : ''} ${user.country || 'N/A'}</div>
                            <div style="margin-top: 4px;"><b>Phone:</b> ${user.country_code || ''}${user.phone || 'Not Linked'}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                        <div style="background: #f1f5f9; padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Trust Score</div>
                            <div style="font-size: 18px; font-weight: 800; color: ${scoreColor};">${score.toFixed(1)} <span style="font-size: 12px; color: #94a3b8;">/ 100</span></div>
                        </div>
                        <div style="background: #f1f5f9; padding: 12px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Verification</div>
                            <div style="margin-top: 4px;">
                                <span class="badge ${user.kyc_status === 'verified' ? 'badge-buyer' : 'badge-seller'}" style="padding: 4px 10px;">${user.kyc_status.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                        <label style="font-weight: 700; display: block; margin-bottom: 5px; color: #0b1e5b;">Telegram Chat ID (Editable)</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="editTelegramId" value="${user.telegram_chat_id || ''}" 
                                style="flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none;" 
                                placeholder="Enter Chat ID">
                            <button onclick="updateTelegramID('${user.id}')" style="background: #0b1e5b; color: white; border: none; padding: 0 12px; border-radius: 6px; cursor: pointer;">
                                <i class="fa-solid fa-floppy-disk"></i>
                            </button>
                        </div>
                    </div>

                    <div style="font-weight: 700; margin-bottom: 10px; color: #0b1e5b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Security Operations</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button onclick="sendAuthLink('${user.email}', 'reset')" style="padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 12px; font-weight: 600; color: #1e293b;">
                            <i class="fa-solid fa-key" style="color: #f59e0b;"></i> Send Reset Link
                        </button>
                        <button onclick="sendAuthLink('${user.email}', 'magic')" style="padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 12px; font-weight: 600; color: #1e293b;">
                            <i class="fa-solid fa-wand-magic-sparkles" style="color: #3b82f6;"></i> Send Magic Link
                        </button>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true
        });

    } catch (err) {
        Swal.fire('System Error', 'Unable to retrieve encrypted file.', 'error');
    }
};

// --- Helper: Update Telegram ID ---
window.updateTelegramID = async (userId) => {
    const newId = document.getElementById('editTelegramId').value;
    const { error } = await supabase.from('profiles').update({ telegram_chat_id: newId }).eq('id', userId);
    
    if (error) {
        Swal.showValidationMessage(`Update failed: ${error.message}`);
    } else {
        Swal.fire({ icon: 'success', title: 'Telegram ID Synchronized', timer: 1500, showConfirmButton: false });
    }
};

// --- Helper: Auth Operations ---
window.sendAuthLink = async (email, type) => {
    const isReset = type === 'reset';
    const { error } = isReset 
        ? await supabase.auth.resetPasswordForEmail(email) 
        : await supabase.auth.signInWithOtp({ email });

    if (error) {
        Swal.fire('Protocol Failed', error.message, 'error');
    } else {
        Swal.fire('Success', `${isReset ? 'Reset' : 'Magic'} link transmitted to ${email}`, 'success');
    }
};


window.restrictUserAccess = async (userId) => {
    const { value: hours } = await Swal.fire({
        title: '<span style="color: #ef4444;">Execute Hard Ban</span>',
        input: 'number',
        inputLabel: 'How many hours should this user be locked out?',
        inputPlaceholder: 'e.g., 24, 168, 8760',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Lock Account',
        inputValidator: (value) => {
            if (!value) return 'You must enter a duration!';
        }
    });

    if (hours) {
        Swal.fire({ title: 'Locking Auth Account...', didOpen: () => Swal.showLoading() });

        try {
            const response = await fetch('https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/admin-ban', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                },
                body: JSON.stringify({ 
                    userId: userId, 
                    action: 'ban', 
                    durationHours: parseInt(hours) 
                })
            });

            if (!response.ok) throw new Error('Ban request was rejected by the server.');

            Swal.fire('Success', `User has been hard-banned for ${hours} hours.`, 'success');
            loadUserDirectory(); // Refresh the table

        } catch (err) {
            Swal.fire('Operation Failed', err.message, 'error');
        }
    }
};

// --- Data Aggregators ---
async function loadIntelligenceMetrics() {
    try {
        const { data: users } = await supabase.from('profiles').select('role, balance');
        if (users) {
            document.getElementById('statBuyers').textContent = users.filter(u => u.role === 'buyer').length;
            document.getElementById('statSellers').textContent = users.filter(u => u.role === 'seller').length;
            document.getElementById('statAdmins').textContent = users.filter(u => u.role === 'admin').length;
            const totalFunds = users.reduce((sum, u) => sum + (u.balance || 0), 0);
            document.getElementById('statTotalFunds').textContent = `₦${totalFunds.toLocaleString()}`;
        }

        const { count: pendingAccs } = await supabase.from('verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        document.getElementById('statPendingAccs').textContent = pendingAccs || 0;

        const { data: withdrawals } = await supabase.from('withdrawals').select('amount').eq('status', 'pending');
        const pendingTotal = withdrawals?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
        document.getElementById('statPendingPayouts').textContent = `₦${pendingTotal.toLocaleString()}`;

        const { count: msgCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });
        document.getElementById('statMessages').textContent = msgCount || 0;

        const { count: disputeCount } = await supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open');
        document.getElementById('statDisputes').textContent = disputeCount || 0;

    } catch (err) {
        console.error("Metric Sync Error:", err);
    }
}

// --- Session Termination ---
document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    const result = await Swal.fire({
        title: 'Terminate Session?',
        text: "You will need to re-authenticate to access the command center.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0b1e5b',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, Terminate'
    });

    if (result.isConfirmed) {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.href = "login.html";
    }
});

// --- Mobile Menu Toggle ---
menuToggle.addEventListener('click', () => {
    sidebar.classList.add('active');
    overlay.classList.add('active');
});

overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
});

init();
