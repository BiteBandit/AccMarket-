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


import { supabase } from "./supabase-config.js";


document.addEventListener("DOMContentLoaded", async () => {
  // ---------------- GET ACCOUNT ID FROM URL ----------------
  const params = new URLSearchParams(window.location.search);
  const accountId = params.get("id");

  if (!accountId) {
    Swal.fire("Error", "No account ID provided.", "error").then(() => {
      window.location.href = "/sell.html";
    });
    return;
  }

  // ---------------- USER AUTH ----------------
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user || userError) {
    window.location.href = "/auth.html";
    return;
  }

  // Fetch user role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    window.location.href = "/auth.html";
    return;
  }

  if (profile.role !== "seller") {
    Swal.fire({
      icon: "error",
      title: "Access Denied",
      text: "Only sellers can access this page."
    }).then(() => window.location.href = "/index.html");
    return;
  }

  // ---------------- FETCH ACCOUNT ----------------
  try {
    const { data: accountRow, error: fetchError } = await supabase
      .from("verifications")   // <-- corrected table name
      .select("*")
      .eq("id", accountId)
      .single();

    if (fetchError || !accountRow) throw fetchError || new Error("Account not found.");

    const account = accountRow.data; // JSON column
    const screenshotUrl = accountRow.screenshot_url;
    const status = accountRow.status;

// ---------------- POPULATE PAGE ----------------
const platformLogo = document.getElementById("platform-logo");
const platformTitle = document.getElementById("platform-title");
const detailsContainer = document.querySelector(".verification-details");

const logos = {
  instagram: "../images/instagram.png",
  twitter: "../images/twitter.png",
  tiktok: "../images/tiktok.png",
  facebook: "../images/facebook.png",
  snapchat: "../images/snapchat.png",
  reddit: "../images/reddit.png",
  twitch: "../images/twitch.png",
  discord: "../images/discord.png",
  linkedin: "../images/linkedin.png",
  pinterest: "../images/pinterest.png"
};

// Set platform logo safely
platformLogo.src = logos[account.platform?.toLowerCase()] || "../images/default.png";
platformTitle.textContent = `View ${account.platform} Account`;

// Build the details HTML
detailsContainer.innerHTML = `
  <p><strong>Username:</strong> ${account.username}</p>
  <p><strong>Profile Link:</strong> <a href="${account.profile_link}" target="_blank">${account.profile_link}</a></p>
  <p><strong>Account Age:</strong> ${account.account_age}</p>
  <p><strong>Followers:</strong> ${account.followers}</p>
  <p><strong>Region:</strong> ${account.region}</p>
  <p><strong>Category:</strong> ${account.category}</p>
  <p><strong>Login Formats:</strong> ${account.login_formats?.join(", ") || "-"}</p>
  <p><strong>Description:</strong> ${account.description || "-"}</p>
  <p><strong>Price:</strong> ₦${account.price?.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</p>
  <p><strong>Verification Code:</strong> ${account.verification_code || "-"}</p>
  <p><strong>Status:</strong> 
    <span class="status ${status?.toLowerCase()}">${status}</span>
  </p>
`;

// Append screenshot only if it exists
if (accountRow.screenshot_url) {
  const screenshotEl = document.createElement("p");
  screenshotEl.innerHTML = `<strong>Screenshot:</strong><br>
    <img src="${accountRow.screenshot_url}" alt="Screenshot" style="max-width:100%;border-radius:12px;">`;
  detailsContainer.appendChild(screenshotEl);
}
    // ---------------- DELETE ACCOUNT ----------------
    const deleteBtn = document.getElementById("delete-account-btn");
    deleteBtn.addEventListener("click", async () => {
      const confirm = await Swal.fire({
        title: "Delete Listing?",
        text: "Are you sure you want to delete this account listing?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel"
      });

      if (confirm.isConfirmed) {
        const { error: deleteError } = await supabase
          .from("verifications")   // <-- table name corrected
          .delete()
          .eq("id", accountId);

        if (deleteError) {
          Swal.fire("Error", "Failed to delete account listing.", "error");
          return;
        }

        Swal.fire("Deleted!", "Account listing has been deleted.", "success").then(() => {
          window.location.href = "/sell.html";
        });
      }
    });

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Failed to load account details.", "error").then(() => {
      window.location.href = "/sell.html";
    });
  }
});

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


// ✅ Get unread notification count for current user
async function loadNotificationCount() {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("No logged-in user, skipping notification count.");
      return;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
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
      badge.classList.add("pop");
      setTimeout(() => badge.classList.remove("pop"), 200);
    } else {
      badge.style.display = "none";
    }
  } catch (err) {
    console.error("Unexpected error loading notification count:", err);
  }
}

// ✅ Run when page loads
loadNotificationCount();

// ✅ Refresh every 30 seconds
setInterval(loadNotificationCount, 30000);

// ✅ Preload notification sound
const notificationSound = new Audio("notification.mp3");

// ✅ Real-time updates
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
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("🔔 Realtime notification event:", payload.eventType);
          await loadNotificationCount();
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

// ✅ Activate real-time listener
setupNotificationRealtime();

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
