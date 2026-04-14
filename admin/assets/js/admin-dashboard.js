import { supabase } from '../../../assets/js/supabase-config.js';

// --- UI Elements ---
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const navItems = document.querySelectorAll('.nav-item');
const sectionTitle = document.getElementById('sectionTitle');

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

    // 2. Load Stats
    loadIntelligenceMetrics();
}

// --- Navigation Logic ---
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Update UI state
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const section = item.getAttribute('data-section');
        sectionTitle.textContent = item.textContent.trim();

        // Close mobile menu if open
        sidebar.classList.remove('active');
        overlay.classList.remove('active');

        // Toggle Content Sections
        document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
        const targetSection = document.getElementById(`${section}Section`);
        if (targetSection) targetSection.style.display = 'block';
    });
});

// --- Data Aggregators ---
async function loadIntelligenceMetrics() {
    try {
        // 1. Fetch Profiles for User Stats & Liquidity
        const { data: users, error: userErr } = await supabase
            .from('profiles')
            .select('role, balance');

        if (users) {
            const buyers = users.filter(u => u.role === 'buyer').length;
            const sellers = users.filter(u => u.role === 'seller').length;
            const admins = users.filter(u => u.role === 'admin').length;
            const totalFunds = users.reduce((sum, u) => sum + (u.balance || 0), 0);

            document.getElementById('statBuyers').textContent = buyers;
            document.getElementById('statSellers').textContent = sellers;
            document.getElementById('statAdmins').textContent = admins;
            document.getElementById('statTotalFunds').textContent = `₦${totalFunds.toLocaleString()}`;
        }

        // ✅ 2. Fetch Pending Assets (FROM VERIFICATIONS TABLE)
        const { count: pendingAccs, error: verErr } = await supabase
            .from('verifications')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        document.getElementById('statPendingAccs').textContent = pendingAccs || 0;

        // ✅ 3. Fetch Outstanding Payouts (FROM WITHDRAWALS TABLE)
        const { data: withdrawals, error: payErr } = await supabase
            .from('withdrawals')
            .select('amount')
            .eq('status', 'pending');

        if (!payErr && withdrawals) {
            const pendingTotal = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
            document.getElementById('statPendingPayouts').textContent = `₦${pendingTotal.toLocaleString()}`;
        } else {
            document.getElementById('statPendingPayouts').textContent = "₦0";
        }


        // 4. Communication Volume
        const { count: msgCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true });

        document.getElementById('statMessages').textContent = msgCount || 0;

        // 5. Active Disputes (Placeholder until table is created)
        document.getElementById('statDisputes').textContent = "0";

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
