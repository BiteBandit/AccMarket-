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





    // ✅ Fetch trust_score instead of total_earnings
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "username, role, balance, accounts_sold, total_deals, trust_score,is_active"
      )
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

// ✅ PROFESSIONAL SWEET ALERT CHECK
    if (profile.is_active === false) {
      Swal.fire({
        title: "Account Deactivated",
        text: "Your account has been deactivated. Please contact support for assistance.",
        icon: "error",
        confirmButtonColor: "#0b1e5b", // Matches your chart theme
        confirmButtonText: "Close",
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(async () => {
        await supabase.auth.signOut();
        window.location.href = "auth.html";
      });
      return;
    }



    // Update username
    document.getElementById("userName").textContent = `${profile.username} 👋`;

    // Update wallet balance (Card 1)
    document.querySelector(".card:nth-child(1) h3").textContent = `₦${Number(
      profile.balance
    ).toLocaleString()}`;

    // Update total deals (Card 2)
    document.querySelector(".card:nth-child(2) h3").textContent =
      profile.total_deals || 0;

    // Show/hide seller-only stats
    const accountsSoldCard = document.querySelector(".card:nth-child(3)");
    const trustScoreCard = document.querySelector(".card:nth-child(4)"); // 👈 Target for Trust Score
    const sellerMenuItem = document.querySelector(".seller-only"); // 👈 Sell Account button

    // ✅ Sell Account & Stats → show ONLY for sellers
    // Admins and Buyers will not see these cards or the sell link
    if (profile.role === "seller") {
      accountsSoldCard.style.display = "flex";
      trustScoreCard.style.display = "flex";

      if (sellerMenuItem) sellerMenuItem.style.display = "block";

      // Card 3: Accounts Sold
      document.querySelector(".card:nth-child(3) h3").textContent =
        profile.accounts_sold || 0;

      // Card 4: Trust Score (Formatted as percentage)
      const score = profile.trust_score || 0;
      const scoreEl = document.querySelector(".card:nth-child(4) h3");
      scoreEl.textContent = `${Math.round(score)}%`;

// ✅ Updated 3-Color Logic
      if (score >= 80) {
        scoreEl.style.color = "#2aec58"; // Green (80% and above)
      } else if (score >= 50) {
        scoreEl.style.color = "#f59e0b"; // Orange (Between 50% and 79%)
      } else {
        scoreEl.style.color = "#ff4d4d"; // Red (Below 50%)
      }


    } else {
      // Hide for Buyers and Admins
      accountsSoldCard.style.display = "none";
      trustScoreCard.style.display = "none";
      if (sellerMenuItem) sellerMenuItem.style.display = "none";
    }

    // ✅ Analytics logic removed entirely as requested

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

    // ✅ Table changed to 'reviews' and IDs changed to 'reviewer_id' and 'seller_id'
    const { data, error } = await supabase
      .from("reviews")
      .select("created_at") 
      .or(`reviewer_id.eq.${user.id},seller_id.eq.${user.id}`);

    if (error) throw error;

    // Group deals by month
    const monthlyDeals = {};
    data.forEach((deal) => {
      const month = new Date(deal.created_at).toLocaleString("default", {
        month: "short",
      });
      // ✅ Every row counts as 1 deal
      monthlyDeals[month] = (monthlyDeals[month] || 0) + 1;
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
    
    // ✅ Keep all months so the chart doesn't look scattered
    const labels = allMonths;
    const values = labels.map((m) => monthlyDeals[m] || 0);

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
            tension: 0, // ✅ Straight lines to match your reference image
            borderWidth: 2,
            pointBackgroundColor: "#0b1e5b",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0b1e5b",
            titleColor: "#fff",
            bodyColor: "#fff",
          },
        },
        scales: {
          x: { grid: { display: false } }, // ✅ Matches the clean image style
          y: { 
            grid: { color: "#e5e7eb" }, 
            beginAtZero: true,
            suggestedMax: 1.0, 
            ticks: { stepSize: 0.2, precision: 1 } // ✅ Exact 0.2 increments
          },
        },
      },
    });
  } catch (err) {
    console.error("Error loading chart:", err.message);
  }
}

loadDealsChart();
