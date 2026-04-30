const sidebarToggle = document.getElementById("sidebarToggle");
const profileToggle = document.getElementById("profileToggle");
const leftSidebar = document.getElementById("leftSidebar");
const rightSidebar = document.getElementById("rightSidebar");
const closeLeft = document.getElementById("closeLeft");
const closeRight = document.getElementById("closeRight");

// Left sidebar
sidebarToggle.addEventListener("click", () => {
  leftSidebar.classList.add("active");
});
closeLeft.addEventListener("click", () => {
  leftSidebar.classList.remove("active");
});

// Right sidebar
profileToggle.addEventListener("click", () => {
  rightSidebar.classList.add("active");
});
closeRight.addEventListener("click", () => {
  rightSidebar.classList.remove("active");
});

// Sidebar Search Function (Live Search)
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.querySelector(".search-box input");
  const items = document.querySelectorAll("#categoryList li a");

  // Live filter while typing
  searchInput.addEventListener("keyup", () => {
    let input = searchInput.value.toLowerCase().trim();

    items.forEach((item) => {
      if (item.textContent.toLowerCase().includes(input)) {
        item.parentElement.style.display = "block";
      } else {
        item.parentElement.style.display = "none";
      }
    });
  });
});
    
    import { supabase } from './supabase-config.js';

// =========================
// DOM ELEMENTS
// =========================
const walletBalanceEl = document.getElementById("walletBalance");
const walletTransactionsEl = document.getElementById("walletTransactions");

// =========================
// GLOBAL STATE
// =========================
let currentUser = null; // 🎯 Added this to fix the error
let allTransactions = [];
let currentFilter = "all";

// =========================
// INITIALIZATION flow
// =========================
document.addEventListener("DOMContentLoaded", async () => {
    // This fetches the user as soon as the page opens
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        console.error("Auth error:", error);
        window.location.href = "auth.html"; // Redirect if not logged in
        return;
    }

    currentUser = user; 
    console.log("Wallet session started for:", currentUser.id);

    // Call your data fetching functions here
    if (typeof fetchWalletData === 'function') fetchWalletData();
    if (typeof showSellerAndAdminLinks === 'function') showSellerAndAdminLinks();
});

// =========================
// FILTER FUNCTIONS
// =========================
// Added window. to make it accessible to HTML onclick since this is a module
window.setFilter = function(type) {
  currentFilter = type;
  if (typeof applyFilter === 'function') applyFilter();

  // active button UI
  document.querySelectorAll(".wallet-filters button").forEach(btn => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(
    `.wallet-filters button[onclick*="'${type}'"]`
  );

  if (activeBtn) activeBtn.classList.add("active");
}


// ⭐ IMPORTANT FIX: expose function to HTML (MODULE FIX)
window.setFilter = setFilter;

// =========================
// FILTER LOGIC
// =========================
function applyFilter() {
  let filtered = allTransactions;

  if (currentFilter === "deposit") {
    filtered = allTransactions.filter(
      tx => (tx.type || "").toLowerCase() === "deposit"
    );
  }

  if (currentFilter === "withdrawal") {
    filtered = allTransactions.filter(
      tx => (tx.type || "").toLowerCase() === "withdrawal"
    );
  }

  renderTransactions(filtered);
}

// =========================
// RENDER FUNCTION
// =========================
function renderTransactions(transactions) {
  if (!transactions || transactions.length === 0) {
    walletTransactionsEl.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:1rem; color:var(--secondary)">
          No transactions yet
        </td>
      </tr>
    `;
    return;
  }

  walletTransactionsEl.innerHTML = transactions.map(tx => {

    const status = (tx.status || "").toLowerCase();
    const type = (tx.type || "").toLowerCase();

    let statusClass = "status-pending";
    if (status === "success") statusClass = "status-success";
    else if (status === "failed") statusClass = "status-failed";

    let amountColor = "var(--black)";
    if (type === "deposit") amountColor = "var(--green)";
    else if (type === "withdrawal") amountColor = "var(--red)";
else if (type === "refund") amountColor = "var(--green)";
else if (type === "verification_fee") amountColor = "var(--red)";
else if (type === "credit") amountColor = "var(--green)";

    return `
      <tr>
        <td>${new Date(tx.created_at).toLocaleString()}</td>
        <td style="text-transform:capitalize; font-weight:600;">
          ${type}
        </td>
        <td style="color:${amountColor}; font-weight:600;">
          ₦${Number(tx.amount).toLocaleString()}
        </td>
        <td>${tx.note || "-"}</td>
        <td class="${statusClass}">${tx.status}</td>
        <td class="reference">${tx.reference || "-"}</td>
      </tr>
    `;
  }).join("");
}



// =========================
// MAIN WALLET LOGIC
// =========================
document.addEventListener("DOMContentLoaded", async () => {

  try {
    // 1️⃣ Get user
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) throw new Error("No user logged in");



    const userId = user.user.id;

    // 2️⃣ Get balance
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    walletBalanceEl.textContent =
      profile.balance?.toLocaleString() || "0";

    // 3️⃣ Get transactions
    const { data: transactions, error: txError } = await supabase
      .from("wallet")
      .select("created_at, type, amount, note, status, reference")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (txError) throw txError;

    // 4️⃣ Save + render
    allTransactions = transactions || [];
    applyFilter();

  } catch (err) {
    console.error("Wallet error:", err);
    walletTransactionsEl.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:1rem; color:red">
          Failed to load transactions
        </td>
      </tr>
    `;
  }

});

// =========================
// MODAL & PAYMENT BRIDGE
// =========================

// 1. Select the elements
const depositModal = document.getElementById("depositModal");
const openModalBtn = document.getElementById("depositBtn"); // Button on dashboard
const closeModalBtn = document.getElementById("closeModal");
const confirmBtn = document.getElementById("confirmDepositBtn"); // Button inside modal
const amountInput = document.getElementById("depositAmount");

// 2. Open Modal
if (openModalBtn && depositModal) {
  openModalBtn.addEventListener("click", (e) => {
    e.preventDefault();
    depositModal.classList.add("active");
  });
}

// 3. Close Modal Logic
const handleClose = () => {
  if (depositModal) {
    depositModal.classList.remove("active");
    if (amountInput) amountInput.value = ""; // Clear input for next time
  }
};

if (closeModalBtn) closeModalBtn.addEventListener("click", handleClose);

// Close if clicking the dark background
window.addEventListener("click", (e) => {
  if (e.target === depositModal) handleClose();
});

// 4. THE BRIDGE: Connect button click to fundWallet()
if (confirmBtn) {
  confirmBtn.addEventListener("click", async () => {
    // Get the amount from the modal input
    const amount = amountInput ? parseFloat(amountInput.value) : 0;

    // Validation
    if (!amount || amount < 100) {
      alert("Please enter a valid amount (Minimum ₦100).");
      return;
    }

    // UI Feedback: Loading state
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Redirecting to Payment...";

    try {
      // Get the current user session from Supabase
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("Your session has expired. Please log in again.");
        window.location.href = "auth.html";
        return;
      }

      // CALL YOUR PAYMENT LOGIC
      // Passes the 'amount' from input and 'user' from Supabase
      await fundWallet(amount, user);

    } catch (err) {
      console.error("Deposit Error:", err);
      alert("Failed to initiate payment. Please check your connection.");
      
      // Reset button if it fails
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Deposit Now";
    }
  });
}

// --- 🎯 WITHDRAWAL SYSTEM LOGIC ---
const withdrawModal = document.getElementById('withdrawModal');
const withdrawBtn = document.getElementById('withdrawBtn'); 
const closeWithdrawModal = document.getElementById('closeWithdrawModal');
const confirmWithdrawBtn = document.getElementById('confirmWithdrawBtn');

// 1. Open Modal Logic
if (withdrawBtn) {
    withdrawBtn.onclick = (e) => {
        e.preventDefault();
        if (!currentUser) {
            Swal.fire('Please wait', 'Your account details are still loading...', 'info');
            return;
        }
        withdrawModal.classList.add('active');
    };
}

// 2. Close Modal Logic
if (closeWithdrawModal) {
    closeWithdrawModal.onclick = () => {
        withdrawModal.classList.remove('active');
    };
}

// 3. Process the Withdrawal
confirmWithdrawBtn?.addEventListener('click', async () => {
    // 🛡️ Basic Security Check
    if (!currentUser) return Swal.fire('Error', 'Session not found. Please refresh.', 'error');

    // Get input elements
    const amountInput = document.getElementById('withdrawAmount');
    const bankInput = document.getElementById('bankName');
    const accNumInput = document.getElementById('accountNumber');
    const accNameInput = document.getElementById('accountName');

    const amount = parseFloat(amountInput.value);
    const bank = bankInput.value.trim();
    const accNum = accNumInput.value.trim();
    const accName = accNameInput.value.trim();

    // --- 🟢 VALIDATIONS ---
    if (!amount || amount < 1000) {
        return Swal.fire({
            target: withdrawModal, // 👈 Force alert on top of modal
            title: 'Invalid Amount',
            text: 'Minimum withdrawal is ₦1,000',
            icon: 'warning'
        });
    }
    if (!bank || !accNum || !accName) {
        return Swal.fire({
            target: withdrawModal, // 👈 Force alert on top of modal
            title: 'Missing Info',
            text: 'Please provide all bank details.',
            icon: 'warning'
        });
    }

    try {
        // --- 🔵 STEP 1: FETCH PROFILE (Check Balance & PIN) ---
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('balance, security_pin')
            .eq('id', currentUser.id)
            .single();

        if (profileErr) throw profileErr;
        
        // --- 🔒 SECURITY CHECK 1: FORBID DEFAULT PIN ---
        if (profile.security_pin === '0000') {
            return Swal.fire({
                target: withdrawModal,
                title: 'Secure Your Account',
                text: 'You are using the default PIN (0000). Please change it in Settings before withdrawing.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Go to Settings',
                confirmButtonColor: '#0b1e5b'
            }).then((result) => {
                if (result.isConfirmed) window.location.href = 'settings.html';
            });
        }

        // --- 🔒 SECURITY CHECK 2: PIN VERIFICATION POPUP ---
        const { value: enteredPin } = await Swal.fire({
            target: withdrawModal, // 👈 Essential for the PIN popup
            title: 'Enter Security PIN',
            input: 'password',
            inputLabel: 'Authorize this withdrawal',
            inputPlaceholder: 'Enter 4-digit PIN',
            inputAttributes: {
                maxlength: 4,
                autocapitalize: 'off',
                autocorrect: 'off',
                inputmode: 'numeric'
            },
            showCancelButton: true,
            confirmButtonColor: '#0b1e5b'
        });

        if (!enteredPin) return; // User cancelled

        if (enteredPin !== profile.security_pin) {
            return Swal.fire({
                target: withdrawModal,
                title: 'Access Denied',
                text: 'Invalid Security PIN.',
                icon: 'error'
            });
        }

        // Final balance check
        if (profile.balance < amount) {
            return Swal.fire({
                target: withdrawModal,
                title: 'Insufficient Funds',
                text: `Your balance is ₦${profile.balance.toLocaleString()}`,
                icon: 'error'
            });
        }

        // UI Feedback: Start Processing
        confirmWithdrawBtn.disabled = true;
        confirmWithdrawBtn.innerText = "Processing...";

        // --- 🟡 STEP 2: LOG TO WITHDRAWALS TABLE ---
        const { error: withdrawError } = await supabase
            .from('withdrawals')
            .insert([{
                user_id: currentUser.id,
                amount: amount,
                method: 'Transfer',
                details: `${bank} | Acc: ${accNum} | Name: ${accName}`,
                status: 'pending'
            }]);

        if (withdrawError) throw withdrawError;

        // --- 🟠 STEP 3: LOG TO WALLET TABLE ---
        const { error: walletTableError } = await supabase
            .from('wallet')
            .insert([{
                user_id: currentUser.id,
                type: 'withdrawal',
                amount: amount,
                note: `Withdrawal to ${bank} (${accNum})`,
                status: 'success',
                reference: `WDR-${Date.now()}-${currentUser.id.slice(0, 5)}`
            }]);

        if (walletTableError) throw walletTableError;

        // --- 🔴 STEP 4: DEDUCT FROM BALANCE ---
        const { error: updateError } = await supabase
            .rpc('deduct_balance', { 
                user_id: currentUser.id, 
                amount_to_deduct: amount 
            });

        if (updateError) throw updateError;

        // --- 🟢 STEP 5: SUCCESS UI ---
        Swal.fire({
            target: withdrawModal,
            title: 'Authorized!',
            text: `₦${amount.toLocaleString()} deducted. Your funds will be sent within 24 hours.`,
            icon: 'success',
            confirmButtonText: 'Done'
        }).then(() => {
            window.location.reload(); 
        });
        
    } catch (err) {
        console.error("Withdrawal Error:", err);
        Swal.fire({
            target: withdrawModal,
            title: 'System Error',
            text: err.message,
            icon: 'error'
        });
    } finally {
        if (confirmWithdrawBtn) {
            confirmWithdrawBtn.disabled = false;
            confirmWithdrawBtn.innerText = "Confirm Withdrawal";
        }
    }
});




// =========================
// KORAPAY PAYMENT LOGIC
// ========================= 
 async function fundWallet(amount, user) {
  try {
    // Get the active session for the token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error("You must be logged in to deposit.");
    }

    const res = await fetch(
      "https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/create-payment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          amount,
          email: user.email,
          user_id: user.id, // Kept for the Edge Function initialization
          metadata: {
            user_id: user.id // Added for the Webhook notification
          }
        })
      }
    );

    const data = await res.json();

    if (res.ok && data.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      throw new Error(data.error || data.message || "Payment initialization failed");
    }
  } catch (err) {
    console.error("Payment Error:", err);
    alert(err.message);
    
    // RESET BUTTON: This prevents the "stuck" state
    const confirmBtn = document.getElementById("confirmDepositBtn");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Deposit Now";
    }
  }
}

(async () => {
  // 1. Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // Now valid because it's inside a function

  // 2. Fetch the is_active status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .single();

  // 3. Professional Account Status Check
  if (profile && profile.is_active === false) {
    Swal.fire({
      title: "Account Deactivated",
      text: "Your account has been deactivated. Please contact support for assistance.",
      icon: "error",
      confirmButtonColor: "#0b1e5b", // Matches your dark blue theme
      confirmButtonText: "Close",
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(async () => {
      await supabase.auth.signOut();
      window.location.href = "auth.html";
    });
    return; // Exit the IIFE
  }
})();



// ✅ Get unread notification count for current user (fixed)
async function loadNotificationCount() {
  try {
    // Get current logged-in user from Supabase
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("No logged-in user, skipping notification count.");
      return;
    }

    // Fetch only count of unread notifications
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true }) // count only, no rows
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

      // Small pop animation
      badge.classList.add("pop");
      setTimeout(() => badge.classList.remove("pop"), 200);
    } else {
      badge.style.display = "none";
    }
  } catch (err) {
    console.error("Unexpected error loading notification count:", err);
  }
}

// ✅ Run when dashboard loads
loadNotificationCount();

// ✅ Auto-refresh every 30 seconds
setInterval(loadNotificationCount, 30000);

// ✅ Preload notification sound from assets folder
const notificationSound = new Audio("notification.mp3");

// ✅ Real-time updates for notifications
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
          event: "*", // listen for INSERT, UPDATE, DELETE
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("🔔 Realtime notification event:", payload.eventType);
          // Reload the badge counter
          await loadNotificationCount();

          // Play sound only on new notifications
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

// ✅ Activate realtime listener
setupNotificationRealtime();

// ✅ 1. Preload the notification sound
const chatNotificationSound = new Audio("notification.mp3");

// ✅ 2. Get total unread messages
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

// ✅ 3. Real-time listener WITH SOUND
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
        // Refresh the count regardless of event type
        await loadTotalChatCount();
        
        // 🎯 PLAY SOUND: Only on NEW messages sent by someone else
        if (payload.eventType === "INSERT" && payload.new.sender_id !== user.id) {
            chatNotificationSound.play().catch((e) => console.warn("Sound blocked by browser:", e));
        }
      }
    )
    .subscribe();
}

// ✅ 4. Initialize
loadTotalChatCount();
setupGlobalChatRealtime();


// ---- LOGOUT FUNCTIONALITY ----
document.addEventListener("click", async (e) => {
  if (e.target.closest(".logout")) {
    e.preventDefault(); // stop redirect

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Optional: clear cached data (just to be safe)
      localStorage.clear();
      sessionStorage.clear();

      // Redirect to login page
      window.location.href = "auth.html";
    } catch (err) {
      console.error("Logout failed:", err.message);
      alert("Something went wrong while logging out.");
    }
  }
});

// ✅ Show Sell Account link and Withdraw Button ONLY for Sellers
async function showSellerAndAdminLinks() {
  try {
    // 1. Get current logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("⚠️ No logged-in user found.");
      return;
    }

    // 2. Get user profile and role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("❌ Error fetching user role:", profileError.message);
      return;
    }

    // --- 🎯 TARGET THE WITHDRAW BUTTON ---
    const withdrawBtn = document.getElementById("withdrawBtn");
    if (withdrawBtn) {
      // Show only if role is 'seller', hide for 'buyer' and 'admin'
      if (profile.role === "seller") {
        withdrawBtn.style.display = "block";
      } else {
        withdrawBtn.style.display = "none";
      }
    }

    // --- 🎯 TARGET THE SELL ACCOUNT LINK ---
    const sellAccountLink = document.querySelector(".seller-only");
    if (sellAccountLink) {
      // Sell Account → ONLY visible for "seller"
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

// Ensure it runs after the page has finished loading
document.addEventListener("DOMContentLoaded", () => {
    showSellerAndAdminLinks();
});
