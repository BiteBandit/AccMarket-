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

// ✅ Initialize Supabase
// js/main.js
import { supabase } from './supabase-config.js';

// Now just write your logic
console.log("Supabase is ready to use!", supabase);


document.addEventListener("DOMContentLoaded", async () => {
  const startDiditBtn = document.getElementById("startDidit");

  // ✅ Get current logged-in user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    startDiditBtn.disabled = true;
    Swal.fire({
      icon: "warning",
      title: "Login Required",
      text: "You must be logged in to start verification.",
    });
    return;
  }

  const userId = userData.user.id;
  const email = userData.user.email;

  // ✅ Function to display SweetAlert based on status
  const showStatusAlert = (status) => {
    switch (status) {
      case "requested":
        Swal.fire({
          icon: "info",
          title: "Verification Requested",
          text: "Your verification request has been received. Please wait for the link.",
        });
        startDiditBtn.disabled = true;
        break;
      case "pending":
        Swal.fire({
          icon: "info",
          title: "Verification Pending",
          text: "Your verification is in progress. Please check your email or Telegram for the link.",
        });
        startDiditBtn.disabled = true;
        break;
      case "verified":
        Swal.fire({
          icon: "success",
          title: "Congratulations!",
          text: "Your account is verified. You are now a seller!",
        });
        startDiditBtn.style.display = "none";
        break;
      case "failed":
        Swal.fire({
          icon: "error",
          title: "Verification Failed",
          text: "Your previous verification attempt failed. Click start to retry.",
        });
        startDiditBtn.disabled = false;
        break;
    }
  };

  // ✅ Check current verification status on page load
  const { data: verificationData } = await supabase
    .from("user_verifications")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (verificationData) {
    showStatusAlert(verificationData.status);
  }

  // ✅ Start verification button logic
  startDiditBtn.addEventListener("click", async () => {
    try {
      startDiditBtn.disabled = true;
      startDiditBtn.textContent = "Starting...";

      // Fetch latest verification row
      const { data: existingData } = await supabase
        .from("user_verifications")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (existingData) {
        if (existingData.status === "failed") {
          // Retry failed → update to requested
          await supabase
            .from("user_verifications")
            .update({
              status: "requested",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          Swal.fire({
            icon: "info",
            title: "Verification Requested",
            text: "Your verification request has been sent. You will receive a link soon.",
          });
        } else {
          // If status is requested or pending
          Swal.fire({
            icon: "info",
            title: "Verification In Progress",
            text: "Your verification request is already in progress. Please check your email or Telegram.",
          });
        }
      } else {
        // Create new verification row
        await supabase.from("user_verifications").insert({
          user_id: userId,
          email: email,
          status: "requested",
        });

        Swal.fire({
          icon: "info",
          title: "Verification Requested",
          text: "Your verification request has been sent. You will receive a link soon.",
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Something Went Wrong",
        text: error.message,
      });
    } finally {
      startDiditBtn.disabled = false;
      startDiditBtn.textContent = "Start Verification with Didit";
    }
  });
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