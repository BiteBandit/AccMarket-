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

import { supabase } from './supabase-config.js'
console.log("If this logs, the error is gone!", supabase)

// ---- FETCH USER DATA ----
async function loadDashboard() {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("No user logged in, redirecting...");
      window.location.href = "auth.html";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "username, role, balance, accounts_sold, total_deals, total_earnings"
      )
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    // Update username
    document.getElementById("userName").textContent = `${profile.username} 👋`;

    // Update wallet balance
    document.querySelector(".card:nth-child(1) h3").textContent = `₦${Number(
      profile.balance
    ).toLocaleString()}`;

    // Update total deals
    document.querySelector(".card:nth-child(2) h3").textContent =
      profile.total_deals || 0;

    // Show/hide seller-only stats
    const accountsSoldCard = document.querySelector(".card:nth-child(3)");
    const totalEarningsCard = document.querySelector(".card:nth-child(4)");
    const sellerMenuItem = document.querySelector(".seller-only"); // 👈 Sell Account button
    const analyticsMenuItem = document.querySelector(".analytics-only"); // 👈 Analytics menu item

    if (profile.role === "seller" || profile.role === "admin") {
      accountsSoldCard.style.display = "flex";
      totalEarningsCard.style.display = "flex";

      // Sell Account → show for seller or admin
      if (sellerMenuItem) sellerMenuItem.style.display = "block";

      // Analytics → show only for admin
      if (analyticsMenuItem) {
        analyticsMenuItem.style.display =
          profile.role === "admin" ? "block" : "none";
      }

      document.querySelector(".card:nth-child(3) h3").textContent =
        profile.accounts_sold;
      document.querySelector(".card:nth-child(4) h3").textContent = `₦${Number(
        profile.total_earnings
      ).toLocaleString()}`;
    } else {
      accountsSoldCard.style.display = "none";
      totalEarningsCard.style.display = "none";

      if (sellerMenuItem) sellerMenuItem.style.display = "none";
      if (analyticsMenuItem) analyticsMenuItem.style.display = "none";
    }
  } catch (err) {
    console.error("Error loading dashboard:", err.message);
  }
}

loadDashboard();

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
// ---------------------
// ✅ DASHBOARD CHART (User-specific Total Deals)
// ---------------------
const ctx = document.getElementById("userChart").getContext("2d");

async function loadDealsChart() {
  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return;

    // Fetch only this user's completed deals
    const { data, error } = await supabase
      .from("deals")
      .select("created_at, amount")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`) // ✅ updated
      .eq("status", "completed");

    if (error) throw error;

    // Group deals by month
    const monthlyDeals = {};
    data.forEach((deal) => {
      const month = new Date(deal.created_at).toLocaleString("default", {
        month: "short",
      });
      monthlyDeals[month] = (monthlyDeals[month] || 0) + deal.amount;
    });

    const allMonths = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const labels = allMonths.filter((m) => monthlyDeals[m]);
    const values = labels.map((m) => monthlyDeals[m]);

    // Render chart
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Your Total Deals",
            data: values,
            borderColor: "#0b1e5b",
            backgroundColor: "rgba(11, 30, 91, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: "#0b1e5b",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0b1e5b",
            titleColor: "#fff",
            bodyColor: "#fff",
          },
        },
        scales: {
          x: { grid: { color: "#e5e7eb" } },
          y: { grid: { color: "#e5e7eb" }, beginAtZero: true },
        },
      },
    });
  } catch (err) {
    console.error("Error loading chart:", err.message);
  }
}

loadDealsChart();
vb;

async function loadRevenueChart() {
  try {
    // Fetch all revenue records
    const { data, error } = await supabase
      .from("revenue")
      .select("created_at, amount");

    if (error) throw error;

    // Group revenue by month
    const monthlyRevenue = {};
    data.forEach((rev) => {
      const month = new Date(rev.created_at).toLocaleString("default", {
        month: "short",
      });
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(rev.amount);
    });

    const allMonths = [
      "Jan","Feb","Mar","Apr","May","Jun",
      "Jul","Aug","Sep","Oct","Nov","Dec"
    ];
    const labels = allMonths.filter((m) => monthlyRevenue[m]);
    const values = labels.map((m) => monthlyRevenue[m]);

    // Render chart
    const ctx = document.getElementById("revenueChart").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Revenue (₦)",
          data: values,
          backgroundColor: "rgba(0, 128, 255, 0.6)",
          borderColor: "#0080ff",
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => `₦${context.raw.toLocaleString()}`
            }
          }
        }
      }
    });

  } catch (err) {
    console.error("Error loading revenue chart:", err.message);
  }
}

loadRevenueChart();