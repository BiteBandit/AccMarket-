import { supabase } from '../../../assets/js/supabase-config.js';

// --- State ---
let cachedUsers = [];

document.addEventListener('DOMContentLoaded', () => {
    initUsersPage();
});

async function initUsersPage() {
    // --- 1. Authentication Gate (Is anyone logged in?) ---
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.href = "login.html";
        return;
    }

    // --- 2. Authorization Gate (Are they an Admin?) ---
    try {
        // Fetch user profile to verify "admin" role
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            throw new Error("Could not verify administrative privileges.");
        }

        // Strict Security Check: Only "admin" allowed
        if (profile.role !== "admin") {
            // Force log out unauthorized users immediately to clear local tokens
            await supabase.auth.signOut();
            window.location.href = "login.html?error=unauthorized";
            return;
        }

        // --- 3. Protected Content Deployment ---
        // Only run these if the user successfully passes the admin check
        await loadUserDirectory();
        setupDirectoryListeners();

    } catch (err) {
        console.error("Security Gateway Exception:", err.message);
        
        // Safety fallback: Clear session and boot the user out if validation fails
        await supabase.auth.signOut();
        window.location.href = "login.html?error=access_denied";
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

        cachedUsers = users; // Store for local searching
        renderUserTable(cachedUsers);

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

function setupDirectoryListeners() {
    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = cachedUsers.filter(u => 
                u.username?.toLowerCase().includes(term) || 
                u.email?.toLowerCase().includes(term)
            );
            renderUserTable(filtered);
        });
    }
}

// Global window helpers for the dynamic table buttons
// Updated viewUserFile to use the helper
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
                            <div style="font-size: 18px; font-weight: 800; color: ${scoreColor};">${score.toFixed(1)} <span style="font-size: 12px; color: #94⁷ya3b8;">/ 100</span></div>
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
    const input = document.getElementById('editTelegramId');
    if (!input) return;

    const newId = input.value;
    
    // Use Swal.showLoading() directly to show a loader inside the current modal
    // We add a temporary status element to the DOM if you want to be fancy, 
    // or just trigger a loading overlay that doesn't kill the modal.
    Swal.fire({
        title: 'Synchronizing...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ telegram_chat_id: newId })
            .eq('id', userId);
        
        if (error) throw error;

        // Use a Toast or a quick update to keep the user in the flow
        Swal.fire({ 
            icon: 'success', 
            title: 'Synchronized', 
            text: 'Telegram ID updated.',
            timer: 2000, 
            showConfirmButton: false,
            toast: true,
            position: 'top-end',
            timerProgressBar: true,
            target: 'body' 
        });
    } catch (err) {
        Swal.fire('Error', `Update failed: ${err.message}`, 'error');
    }
};


// --- Helper: Auth Operations ---
window.sendAuthLink = async (email, type) => {
    const isReset = type === 'reset';
    const destination = isReset 
        ? 'https://accmarket.name.ng/reset' 
        : 'https://accmarket.name.ng/dashboard';

    let result;

    if (isReset) {
        // Reset uses redirectTo
        result = await supabase.auth.resetPasswordForEmail(email, { 
            redirectTo: destination 
        });
    } else {
        // Magic link (signInWithOtp) uses emailRedirectTo
        result = await supabase.auth.signInWithOtp({ 
            email, 
            options: { 
                emailRedirectTo: destination 
            } 
        });
    }

    const { error } = result;

    if (error) {
        Swal.fire('Protocol Failed', error.message, 'error');
    } else {
        await Swal.fire('Success', `${isReset ? 'Reset' : 'Magic'} link transmitted to ${email}`, 'success');
    }
};


window.restrictUserAccess = async (userId) => {
    const { value: hours } = await Swal.fire({
        title: '<span style="color: #0b1e5b;">Execute Hard Ban</span>', // Professional Dark Blue Accent
        input: 'number',
        inputLabel: 'How many hours should this user be banned?',
        inputPlaceholder: 'e.g., 24, 168, 8760',
        showCancelButton: true,
        confirmButtonColor: '#0b1e5b',
        confirmButtonText: 'Lock Account',
        inputValidator: (value) => {
            if (!value) return 'You must enter a duration!';
        }
    });

    if (hours) {
        Swal.fire({ title: 'Processing Suspension System...', didOpen: () => Swal.showLoading() });

        try {
            // 1️⃣ Grab active admin authorization token safely
            const sessionData = await supabase.auth.getSession();
            const token = sessionData.data.session?.access_token;
            
            if (!token) throw new Error("Your administrative session has expired. Please re-authenticate.");

            const sharedHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            // 2️⃣ TASK 1: Run your existing database restriction function
            console.log(`Executing account status mutation via admin-ban...`);
            const banResponse = await fetch('https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/admin-ban', {
                method: 'POST',
                headers: sharedHeaders,
                body: JSON.stringify({ 
                    userId: userId, 
                    action: 'ban', 
                    durationHours: parseInt(hours) 
                })
            });

            if (!banResponse.ok) throw new Error('The database ban mutation request was rejected by the server.');

            // 3️⃣ FETCH USER DATA: Safely lookup target user metadata from your profiles directory table
            console.log(`Pulling email metadata profile properties for User ID: ${userId}...`);
            const { data: profile, error: profileErr } = await supabase
                .from('profiles') // Adjust table name if you store user data elsewhere (e.g., 'users')
                .select('email, username')
                .eq('id', userId)
                .single();

            if (profileErr || !profile?.email) {
                console.warn("Could not find client email metadata in custom tables. Attempting direct fallback fallback context lookups.");
            }

            const targetEmail = profile?.email;
            const targetUsername = profile?.username || "Marketplace Partner";

            // 4️⃣ TASK 2: Fire your email-only routing notification with direct string parameters
            if (targetEmail) {
                console.log(`Dispatching HTML compliance warning template via Ban-notification channel...`);
                try {
                    const notifyResponse = await fetch('https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/Ban-notification', {
                        method: 'POST',
                        headers: sharedHeaders,
                        body: JSON.stringify({ 
                            targetEmail: targetEmail,
                            targetUsername: targetUsername,
                            durationHours: parseInt(hours) 
                        })
                    });

                    if (!notifyResponse.ok) console.error("⚠️ Email dispatch endpoint flagged a delivery reject.");
                } catch (emailErr) {
                    console.error("⚠️ Downstream background email dispatch engine failure:", emailErr.message);
                }
            } else {
                console.warn("⚠️ Account suspension notification skipped: Missing target user email address mapping reference.");
            }

            // 5️⃣ Success UI Notification Update
            Swal.fire('Operation Executed', `User has been successfully restricted. Notification packet forwarded to target inbox via Mailtrap nodes.`, 'success');
            loadUserDirectory(); // Refresh dashboard table view matrix

        } catch (err) {
            Swal.fire('Operation Failed', err.message, 'error');
        }
    }
};
