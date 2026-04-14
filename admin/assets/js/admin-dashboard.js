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
window.viewUserFile = (userId) => {
    Swal.fire({
        title: 'User Profile',
        text: `Opening records for ID: ${userId}`,
        icon: 'info',
        confirmButtonColor: '#0b1e5b'
    });
};

window.restrictUserAccess = (userId) => {
    Swal.fire({
        title: 'Restrict Access?',
        text: "This user will be suspended from all marketplace activities.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Yes, Restrict'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { error } = await supabase.from('profiles').update({ role: 'banned' }).eq('id', userId);
            if (!error) {
                Swal.fire('Restricted', 'User has been banned.', 'success');
                loadUserDirectory(); // Refresh table
            }
        }
    });
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
