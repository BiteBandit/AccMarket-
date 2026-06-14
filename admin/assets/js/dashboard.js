import { supabase } from '../../../assets/js/supabase-config.js';

/**
 * ============================================================================
 * NEO-BRUTALIST PLATFORM OPERATIONS INTELLIGENCE ENGINE (DEBUG RE-FORTIFIED)
 * ============================================================================
 */

// --- 0. HELPER FUNCTION TO HELP TRACK VISUAL LOADING ---
function updateCardLoadingState(isLoading) {
    const indicators = ['statBuyers', 'statSellers', 'statAdmins', 'statPendingAccs', 'statMessages', 'statDisputes'];
    indicators.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = isLoading ? "..." : "0";
        }
    });
}

// --- 1. CORE AUTHENTICATION & ROLE VALIDATION GATES ---
async function enforceAdminPrivileges() {
    console.log("🔒 Security Gate: Initiating authorization audit sequence...");
    try {
        // Assert session token state cache validity via absolute user profile retrieval
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.warn("⚠️ Security Gate Notice: No active authenticated user found.", authError);
            throw new Error("Unauthenticated: Active session context missing or expired.");
        }

        console.log(`🆔 Authenticated User ID verified: ${user.id}. Querying administrative ledger...`);

        // Perform server-side profile verification check
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle(); // Prevents crashing if table rows are missing entirely

        if (profileError) {
            console.error("❌ Database connection error reading profile:", profileError);
            throw new Error(`Database Error: ${profileError.message}`);
        }

        if (!profile) {
            throw new Error("Unauthorized: Profile row registry not found on database infrastructure.");
        }

        console.log(`📋 User profile role resolved: [${profile.role}]`);

        // Lock workspace metrics behind strict administrative claim check
        if (profile.role !== 'admin') {
            throw new Error(`Unauthorized: Role '${profile.role}' lacks administrative clearance permissions.`);
        }

        console.log("✅ Authorization clear. Initializing operational telemetry sync pipelines...");
        // Validation clear. Fire async telemetry pipelines.
        await loadIntelligenceMetrics();

    } catch (authError) {
        console.error("⛔ Critical Security Exception intercepted:", authError.message);
        
        // Immediate clean UI teardown to block raw metric leakage
        document.body.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#000000; color:#ffffff; font-family:'SF Mono', monospace; border: 10px solid #ef4444; padding: 20px; box-sizing: border-box; text-align: center;">
                <i class="fa-solid fa-shield-halved" style="font-size:48px; color:#ef4444; margin-bottom:20px;"></i>
                <h1 style="font-size:20px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin:0;">Access Denied</h1>
                <p style="color:#666666; font-size:13px; margin-top:8px; max-width: 500px;">${authError.message}</p>
                <p style="color:#2563eb; font-size:11px; margin-top:24px; text-transform:uppercase; letter-spacing: 1px;">Ejecting to core authorization gateway...</p>
            </div>
        `;

        setTimeout(() => {
            window.location.href = "login.html"; 
        }, 3000);
    }
}

// --- 2. LIVE METRIC TELEMETRY ENGINE ---
async function loadIntelligenceMetrics() {
    console.log("📊 Fetching core platform metrics across relational schema indices...");
    updateCardLoadingState(true);
    
    try {
        // pipeline A: User Directory Distributions & Total Liquidity Volume
        console.log("-> Syncing profile distribution matrix...");
        const { data: users, error: usersError } = await supabase
            .from('profiles')
            .select('role, balance');
            
        if (usersError) {
            console.error("Profiles Table Read Error:", usersError);
            throw usersError;
        }

        if (users) {
            console.log(`Found ${users.length} registration entries inside profiles schema.`);
            const buyers = users.filter(u => u.role === 'buyer').length;
            const sellers = users.filter(u => u.role === 'seller').length;
            const admins = users.filter(u => u.role === 'admin').length;
            
            if (document.getElementById('statBuyers')) document.getElementById('statBuyers').textContent = buyers;
            if (document.getElementById('statSellers')) document.getElementById('statSellers').textContent = sellers;
            if (document.getElementById('statAdmins')) document.getElementById('statAdmins').textContent = admins;

            const totalFunds = users.reduce((sum, u) => sum + (Number(u.balance) || 0), 0);
            if (document.getElementById('statTotalFunds')) {
                document.getElementById('statTotalFunds').textContent = `₦${totalFunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
        }

        // Pipeline B: Pending Asset Verification Tasks
        console.log("-> Syncing verifications tally tracker...");
        const { count: pendingAccs, error: kycError } = await supabase
            .from('verifications')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
            
        if (kycError) console.error("Verifications table access failure:", kycError);
        if (document.getElementById('statPendingAccs')) document.getElementById('statPendingAccs').textContent = pendingAccs || 0;

        // Pipeline C: Escrow Payout Liability Summary
        console.log("-> Syncing withdrawals liability summary calculations...");
        const { data: withdrawals, error: payoutError } = await supabase
            .from('withdrawals')
            .select('amount')
            .eq('status', 'pending');
            
        if (payoutError) console.error("Withdrawals table access failure:", payoutError);
        
        const pendingTotal = withdrawals?.reduce((sum, w) => sum + (Number(w.amount) || 0), 0) || 0;
        if (document.getElementById('statPendingPayouts')) {
            document.getElementById('statPendingPayouts').textContent = `₦${pendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }

        // Pipeline D: Chat Messaging Network Load Tally
        console.log("-> Counting platform conversation database matrices...");
        const { count: msgCount, error: msgError } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true });
            
        if (msgError) console.error("Messages table access failure:", msgError);
        if (document.getElementById('statMessages')) document.getElementById('statMessages').textContent = msgCount || 0;

        // Pipeline E: Open Dispute Queue Tally
        console.log("-> Compiling open order disputes totals...");
        const { count: disputeCount, error: disputeError } = await supabase
            .from('disputes')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'open');
            
        if (disputeError) console.error("Disputes table access failure:", disputeError);
        if (document.getElementById('statDisputes')) document.getElementById('statDisputes').textContent = disputeCount || 0;

        console.log("✅ Platform telemetry matrix update successfully completed.");

    } catch (err) {
        console.error("❌ Operational telemetry sync system crash:", err);
        updateCardLoadingState(false);
        Swal.fire({
            icon: 'error',
            title: 'Telemetry Exception Detected',
            text: err.message || 'Database error occurred during live data indexing compilation loop.',
            confirmButtonColor: '#0b1e5b'
        });
    }
}

// --- 3. SESSION TERMINATION CLEANER ---
async function handleAdminLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        Swal.fire({
            icon: 'success',
            title: 'Session Terminated',
            text: 'Admin session context revoked successfully.',
            timer: 1500,
            showConfirmButton: false
        });

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);
    } catch (err) {
        console.error("SignOut Error:", err);
        window.location.href = "login.html";
    }
}

// --- 4. ENGINE LIFECYCLE RUNTIME ANCHOR ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Admin Workspace Document Loaded. Initializing core privileges check...");
    // Lock workspace behind authorization walls immediately
    enforceAdminPrivileges();

    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleAdminLogout);
    }
});
