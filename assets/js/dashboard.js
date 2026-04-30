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

async function loadDashboard() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      window.location.href = "auth.html";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username, role, balance, accounts_sold, total_deals, trust_score, is_active")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    // ✅ DEACTIVATION CHECK
    if (profile.is_active === false) {
      Swal.fire({
        title: "Account Deactivated",
        text: "Your account has been deactivated. Please contact support.",
        icon: "error",
        confirmButtonColor: "#0b1e5b",
        confirmButtonText: "Close"
      }).then(async () => {
        await supabase.auth.signOut();
        window.location.href = "auth.html";
      });
      return;
    }

    // --- 👤 STEP 1: UPDATE PUBLIC CARDS (Shows instantly) ---
    document.getElementById("userName").textContent = `${profile.username} 👋`;

    const balanceEl = document.querySelector(".card i.fa-wallet")?.parentElement.querySelector("h3");
    if (balanceEl) balanceEl.textContent = `₦${Number(profile.balance || 0).toLocaleString()}`;

    const dealsEl = document.querySelector(".card i.fa-tags")?.parentElement.querySelector("h3");
    if (dealsEl) dealsEl.textContent = profile.total_deals || 0;

    // --- 🎯 STEP 2: SELLER-ONLY LOGIC ---
    const sellerOnlyElements = document.querySelectorAll(".seller-only");
    const trustScoreEl = document.getElementById("trustScore");

    if (profile.role === "seller") {
      // 🔓 Reveal everything with the .seller-only class
      sellerOnlyElements.forEach(el => {
        el.classList.remove("hidden-element"); // Remove the CSS hide class
        
        // Handle the display style based on element type
        // This overrides 'style="display: none"' in your HTML
        if (el.tagName === "LI") {
          el.style.display = "block"; 
        } else {
          el.style.display = "flex"; // Cards need flex for layout
        }
      });

      // Update Accounts Sold Card
      const accountsSoldCard = Array.from(sellerOnlyElements).find(card => 
        card.innerText.includes("Accounts Sold")
      );
      if (accountsSoldCard) {
        accountsSoldCard.querySelector("h3").textContent = profile.accounts_sold || 0;
      }

      // Update Trust Score & Colors
      if (trustScoreEl) {
        const score = profile.trust_score || 0;
        trustScoreEl.textContent = `${Math.round(score)}%`;

        if (score >= 80) trustScoreEl.style.color = "#2aec58";
        else if (score >= 50) trustScoreEl.style.color = "#f59e0b";
        else trustScoreEl.style.color = "#ff4d4d";
      }

    } else {
      // 🔒 Force hide for Buyers and Admins
      sellerOnlyElements.forEach(el => {
        el.classList.add("hidden-element");
        el.style.display = "none";
      });
    }

  } catch (err) {
    console.error("Dashboard Error:", err.message);
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
