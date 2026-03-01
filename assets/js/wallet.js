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

// ---------- Wallet JS ----------
document.addEventListener("DOMContentLoaded", async () => {
  const walletBalanceEl = document.getElementById("walletBalance");
  const walletTransactionsEl = document.getElementById("walletTransactions");

  try {
    // 1️⃣ Get current user
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) throw userError || new Error("No user logged in");

    const userId = user.user.id;

    // 2️⃣ Fetch balance from profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;

    walletBalanceEl.textContent = profile.balance?.toLocaleString() || "0";

    // 3️⃣ Fetch transactions from wallet table
    const { data: transactions, error: txError } = await supabase
      .from("wallet")
      .select("created_at, type, amount, note, status, reference")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (txError) throw txError;

    // 4️⃣ Populate table
    walletTransactionsEl.innerHTML = transactions
      .map(tx => {
        let statusClass = "status-pending";
        if (tx.status === "success") statusClass = "status-success";
        if (tx.status === "failed") statusClass = "status-failed";

        return `
          <tr>
            <td>${new Date(tx.created_at).toLocaleString()}</td>
            <td>${tx.type}</td>
            <td>₦${tx.amount.toLocaleString()}</td>
            <td>${tx.note || ""}</td>
            <td class="${statusClass}">${tx.status}</td>
            <td class="reference">${tx.reference || "-"}</td>
          </tr>
        `;
      })
      .join("");

    // 5️⃣ Optional: handle empty table
    if (!transactions || transactions.length === 0) {
      walletTransactionsEl.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:1rem; color:var(--secondary)">
            No transactions yet
          </td>
        </tr>
      `;
    }
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

// ✅ Show Sell Account & Analytics links based on role
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

    // Select the menu links
    const sellAccountLink = document.querySelector(".seller-only");
    const analyticsLink = document.querySelector(".analytics-only");

    // Sell Account → admin or seller
    if (profile.role === "seller" || profile.role === "admin") {
      if (sellAccountLink) sellAccountLink.style.display = "block";
    } else {
      if (sellAccountLink) sellAccountLink.style.display = "none";
    }

    // Analytics → admin only
    if (profile.role === "admin") {
      if (analyticsLink) analyticsLink.style.display = "block";
    } else {
      if (analyticsLink) analyticsLink.style.display = "none";
    }

  } catch (err) {
    console.error("⚠️ Error checking role:", err);
  }
}

// ✅ Run it once page loads
showSellerAndAdminLinks();