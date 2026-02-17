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

// ------------------------
// Initialize Supabase
// ------------------------
// js/main.js
import { supabase } from './supabase-config.js';

// Now just write your logic
console.log("Supabase is ready to use!", supabase);


async function fetchOrders() {
  const ordersList = document.getElementById("orders-list");

  // Get currently logged-in user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    ordersList.innerHTML = `<p>Please log in to see your orders.</p>`;
    return;
  }

  // Fetch orders where current user is buyer OR seller
  const { data: orders, error } = await supabase
    .from("deals")
    .select("*")
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const loadingMsg = document.getElementById("loading-spinner");
  if (loadingMsg) loadingMsg.remove();

  if (error) {
    ordersList.innerHTML = `<p>Failed to load orders.</p>`;
    console.error("Error fetching orders:", error);
    return;
  }

  renderOrders(orders);
}

// ------------------------
// Render Orders
// ------------------------
function renderOrders(orders) {
  const ordersList = document.getElementById("orders-list");
  ordersList.innerHTML = "";

  if (!orders || orders.length === 0) {
    ordersList.innerHTML = `<p>You have no orders yet.</p>`;
    return;
  }

  orders.forEach((order) => {
    const orderItem = document.createElement("div");
    orderItem.classList.add("order-item");

    orderItem.innerHTML = `
  <div class="order-menu">
    <button class="menu-btn">⋮</button>
    <div class="menu-dropdown">
        <button class="copy-id-btn" data-id="${order.id}">Copy Order ID</button>
    </div>
  </div>

  <div class="order-info">
    <h4>${order.title}</h4>
    <p class="order-date">Ordered: ${new Date(
      order.created_at
    ).toLocaleDateString()}</p>
  </div>
  <div class="order-meta">
    <span class="order-amount">₦${order.price}</span>
    <span class="order-status ${order.status.toLowerCase()}">${
      order.status
    }</span>
  </div>`;
    ordersList.appendChild(orderItem);
  });
}

// ------------------------
// Initialize
// ------------------------
fetchOrders();

// ------------------------
// Copy Order ID (3 Dots Menu)
// ------------------------
document.addEventListener("click", async (e) => {
  // Toggle the dropdown menu
  if (e.target.classList.contains("menu-btn")) {
    const menu = e.target.nextElementSibling;
    menu.classList.toggle("show");
  }

  // Copy ID
  if (e.target.classList.contains("copy-id-btn")) {
    const orderId = e.target.dataset.id;

    try {
      await navigator.clipboard.writeText(orderId); // copy to clipboard

      Swal.fire({
        icon: "success",
        title: "Copied!",
        text: `Order ID copied: ${orderId}`, // use backticks
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Failed to copy:", err);
      Swal.fire({
        icon: "error",
        title: "Failed to copy",
        text: "Your browser may not support clipboard copy.",
      });
    }
  }
});

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
