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
let allTransactions = [];
let currentFilter = "all";

// =========================
// FILTER FUNCTIONS
// =========================
function setFilter(type) {
  currentFilter = type;
  applyFilter();

  // active button UI
  document.querySelectorAll(".wallet-filters button").forEach(btn => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(
    `.wallet-filters button[onclick="setFilter('${type}')"]`
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

// ✅ Show Sell Account link ONLY for Sellers
async function showSellerAndAdminLinks() {
  try {
    // Get current logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("⚠️ No logged-in user found.");
      return;
    }

    // Get user profile and role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("❌ Error fetching user role:", profileError.message);
      return;
    }

    // Select the Sell Account menu link
    const sellAccountLink = document.querySelector(".seller-only");

    // Sell Account → ONLY visible for "seller"
    // This will now hide the link for both "buyer" and "admin"
    if (sellAccountLink) {
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

// Run it once page loads
showSellerAndAdminLinks();
