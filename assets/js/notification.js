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

// ✅ Supabase Setup
import { supabase } from './supabase-config.js';


console.log("Supabase is ready to use!", supabase);


// ✅ Elements
const notificationsList = document.getElementById("notificationsList");
const markAllBtn = document.getElementById("markAllRead");

let userId = null;

async function getCurrentUser() {
  console.log("🔍 Checking Supabase auth session...");

  // Check if user session exists
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) {
    console.error("❌ Error getting session:", sessionError.message);
    return;
  }

  if (!sessionData.session) {
    console.warn("⚠️ No active session found. User not logged in.");
    notificationsList.innerHTML = `<p class="error">⚠️ Please log in first.</p>`;
    return;
  }

  const user = sessionData.session.user;
  userId = user.id;
  console.log("✅ Logged-in User ID:", userId);

  loadNotifications();
  setupRealtimeNotifications();
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


// ✅ Icon mapping
// ✅ Icon mapping with more types
const iconMap = {
  payment: { icon: "fa-check-circle", color: "#22c55e" }, // green
  security: { icon: "fa-user-shield", color: "#f43f5e" }, // red
  listing: { icon: "fas fa-store", color: "#158c0dff" }, // green
  system: { icon: "fa-cog", color: "#a855f7" }, // purple
  message: { icon: "fa-envelope", color: "#facc15" }, // yellow
  alert: { icon: "fa-exclamation-triangle", color: "#f87171" }, // light red
  info: { icon: "fa-award", color: "#FFD700" }, //  gold
  success: { icon: "fa-thumbs-up", color: "#22c55e" }, // green
  warning: { icon: "fa-exclamation-circle", color: "#fbbf24" }, // orange
  default: { icon: "fa-bell", color: "#6b7280" }, // gray fallback
  blog: { icon: "fa-newspaper", color: "#0b1e5b" }, // dark blue
};

// ✅ Render a notification
function renderNotification(note, prepend = false) {
  // Use only type to get icon & color
  const iconInfo = iconMap[note.type] || iconMap.default;

  const html = `
    <div class="notification ${note.is_read ? "" : "unread"}" data-id="${
    note.id
  }">
      <div class="icon">
        <i class="fas ${iconInfo.icon}" style="color: ${iconInfo.color}"></i>
      </div>
      <div class="details">
        <h4>${note.title}</h4>
        <p>${note.message}</p>
        <span class="time">${new Date(note.created_at).toLocaleString()}</span>
      </div>
      <button class="delete-btn" title="Delete Notification">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;

  if (prepend) {
    notificationsList.insertAdjacentHTML("afterbegin", html);
  } else {
    notificationsList.insertAdjacentHTML("beforeend", html);
  }

  // Attach delete event
  const deleteBtn = document.querySelector(
    `[data-id="${note.id}"] .delete-btn`
  );
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => deleteNotification(note.id));
  }
}

// ✅ Load notifications
async function loadNotifications() {
  console.log("📡 Fetching notifications from Supabase...");
  
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

    const loadingMsg = document.getElementById("loading-spinner");
    if (loadingMsg) loadingMsg.remove();

  if (error) {
    console.error("❌ Supabase Error:", error.message);
    notificationsList.innerHTML = `<p class="error">Error loading notifications: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    notificationsList.innerHTML = `<p class="empty">No notifications yet.</p>`;
    return;
  }

  console.log(`✅ Loaded ${data.length} notifications.`);
  notificationsList.innerHTML = "";
  data.forEach(renderNotification);
}
// scroll visually to top
notificationsList.scrollTop = notificationsList.scrollHeight;

// ✅ Delete a notification
async function deleteNotification(id) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (!error) {
    document.querySelector(`[data-id="${id}"]`)?.remove();
    Swal.fire({
      icon: "success",
      title: "Deleted!",
      text: "Notification removed successfully.",
      timer: 1500,
      showConfirmButton: false,
    });
  } else {
    console.error("❌ Delete error:", error.message);
  }
}

// ✅ Mark all as read
if (markAllBtn) {
  markAllBtn.addEventListener("click", async () => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId);

    if (!error) {
      document
        .querySelectorAll(".notification")
        .forEach((note) => note.classList.remove("unread"));
      Swal.fire({
        icon: "success",
        title: "All caught up!",
        text: "All notifications marked as read.",
        timer: 2000,
        showConfirmButton: false,
      });
    } else {
      console.error("❌ Mark all read error:", error.message);
    }
  });
}

// ✅ Realtime notifications (auto update)
function setupRealtimeNotifications() {
  console.log("🔔 Setting up realtime notifications...");

  supabase
    .channel("notifications-channel")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const newNote = payload.new;
        renderNotification(newNote, true);
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "info",
          title: "New Notification",
          text: newNote.title,
          timer: 2500,
          showConfirmButton: false,
        });
      }
    )
    .subscribe();
}

// ✅ Start
getCurrentUser();

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
    // This will hide the  link for both "buyer" and "admin"
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