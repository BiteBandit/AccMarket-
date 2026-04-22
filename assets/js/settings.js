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
  const fullNameEl = document.getElementById("fullName");
  const usernameEl = document.getElementById("username");
  const emailEl = document.getElementById("email");
  const phoneEl = document.getElementById("phoneNumber");
  const countryEl = document.getElementById("country");
  const countryCodeEl = document.getElementById("countryCode");
  const aboutEl = document.getElementById("about");
  const telegramChatIdEl = document.getElementById("telegram_chat_id");
  const telegramUserIdEl = document.getElementById("telegram_user_id");
  const roleText = document.getElementById("roleText");
  const switchRoleBtn = document.getElementById("switchRole");
  const deleteBtn = document.querySelector(".settings-item.danger");

  // ✅ Get current Supabase user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("❌ User not logged in:", userError);
    return;
  }

  const userId = user.id;

  // ✅ Fetch profile from Supabase
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("❌ Failed to load profile:", profileError.message);
    return;
  }

  // ✅ Fill all fields
  fullNameEl.textContent = profile.full_name || "Not set";
  usernameEl.textContent = profile.username || "@username";
  emailEl.textContent = user.email || "No email";
  phoneEl.textContent = profile.phone || "";
  aboutEl.textContent = profile.about || "Hey there! 👋";
  telegramChatIdEl.textContent = profile.telegram_chat_id || "Not linked";
  telegramUserIdEl.textContent = user.id;
  roleText.textContent =
    profile.role?.charAt(0).toUpperCase() + profile.role?.slice(1) || "Buyer";

  // ✅ Get user country info from IP
  try {
    const res = await fetch("https://ipapi.co/json/");
    const ipData = await res.json();

    const countryName = ipData.country_name || "Unknown";
    const countryCode = ipData.country_calling_code || "+000";
    const flag = `https://flagcdn.com/48x36/${ipData.country_code?.toLowerCase()}.png`;

    countryEl.innerHTML = `<img src="${flag}" style="width:20px; margin-right:5px;"> ${countryName}`;
    countryCodeEl.textContent = countryCode;

    // Save only if not already stored
    if (!profile.country || profile.country !== countryName) {
      await supabase
        .from("profiles")
        .update({
          country: countryName,
          country_code: countryCode,
          country_flag: flag,
        })
        .eq("id", userId);
    }
  } catch (err) {
    console.error("🌍 Failed to get country info:", err);
  }

  // ✅ Auto-save with 14-Day Cooldown for Name and Username
  [fullNameEl, usernameEl, phoneEl, aboutEl].forEach((el) => {
    el.addEventListener("blur", async () => {
      const isNameField = el === fullNameEl || el === usernameEl;
      const newValue = el.textContent.trim();
      
      // Get the values currently saved in the database (from the profile object)
      const originalValue = el === fullNameEl ? profile.full_name : profile.username;

      // Skip if the user didn't actually change the text
      if (newValue === (originalValue || "")) return;

      // --- 1. COOLDOWN CHECK FOR NAME/USERNAME ---
      if (isNameField && profile?.last_name_update) {
        const cooldownDays = 7; 
        const lastUpdate = new Date(profile.last_name_update).getTime();
        const now = Date.now();
        const msInCooldown = cooldownDays * 24 * 60 * 60 * 1000;

        if (now - lastUpdate < msInCooldown) {
          const diff = msInCooldown - (now - lastUpdate);
          const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

          Swal.fire({
            icon: "warning",
            title: "Wait a bit!",
            text: `Names can only be changed once every ${cooldownDays} days. ${daysLeft} days remaining.`,
          });
          
          // Revert the text back to the database value
          el.textContent = originalValue || "";
          return;
        }
      }

      // --- 2. PREPARE UPDATES ---
      const updates = {
        full_name: fullNameEl.textContent.trim(),
        username: usernameEl.textContent.trim(),
        phone: phoneEl.textContent.trim(),
        about: aboutEl.textContent.trim(),
        updated_at: new Date().toISOString(),
      };

      // Only lock the cooldown if a name field was changed
      if (isNameField) {
        updates.last_name_update = new Date().toISOString();
      }

      // --- 3. EXECUTE UPDATE ---
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (updateError) {
        Swal.fire({ icon: "error", title: "Update Failed", text: updateError.message });
      } else {
        // Update the local profile object so the cooldown works without refreshing
        if (isNameField) {
          profile.last_name_update = updates.last_name_update;
          profile.full_name = updates.full_name;
          profile.username = updates.username;
        }
        
        Swal.fire({
          icon: "success",
          title: "Profile Updated",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    });
  });


  // ✅ Delete Account (set inactive)
  deleteBtn.addEventListener("click", async () => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "Your account and all data will be permanently deleted!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      const { error: delError } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("id", userId);

      if (delError) {
        Swal.fire({
          icon: "error",
          title: "Delete Failed",
          text: delError.message,
        });
        return;
      }

      await supabase.auth.signOut();

      Swal.fire({
        icon: "success",
        title: "Account Deleted",
        text: "Your account has been deactivated successfully.",
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        window.location.href = "/login.html";
      });
    }
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const telegramToggle = document.getElementById("telegramAlertsToggle");
  if (!telegramToggle) return console.error("Toggle element not found!");

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return console.error("User not logged in:", userError);

  const userId = user.id;

  try {
    // Load current alert status from Supabase
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("telegram_alerts")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    // Set initial toggle state
    telegramToggle.checked = profile.telegram_alerts === true;
    console.log("Initial Telegram alerts status:", telegramToggle.checked);
  } catch (err) {
    console.error("Failed to load profile:", err.message);
  }

  // Listen for toggle changes
  telegramToggle.addEventListener("change", async () => {
    const newValue = telegramToggle.checked;
    console.log("Toggling Telegram alerts to:", newValue);

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ telegram_alerts: newValue })
        .eq("id", userId);

      if (updateError) throw updateError;

      console.log("Telegram alerts updated successfully!");
    } catch (err) {
      console.error("Failed to update Telegram alerts:", err.message);
      // revert toggle if update failed
      telegramToggle.checked = !newValue;
    }
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Load privacy settings
  const { data: profile } = await supabase
    .from("profiles")
    .select("show_online, show_last_seen, public_profile")
    .eq("id", user.id)
    .single();

  if (profile) {
    document.getElementById("showOnlineToggle").checked = profile.show_online;
    document.getElementById("showLastSeenToggle").checked =
      profile.show_last_seen;
    document.getElementById("publicProfileToggle").checked =
      profile.public_profile;
  }

  // Update Supabase when toggled
  const savePrivacySetting = async (field, value) => {
    await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("id", user.id);
    console.log(`${field} updated to ${value}`);
  };

  document
    .getElementById("showOnlineToggle")
    .addEventListener("change", (e) =>
      savePrivacySetting("show_online", e.target.checked)
    );

  document
    .getElementById("showLastSeenToggle")
    .addEventListener("change", (e) =>
      savePrivacySetting("show_last_seen", e.target.checked)
    );

  document
    .getElementById("publicProfileToggle")
    .addEventListener("change", (e) =>
      savePrivacySetting("public_profile", e.target.checked)
    );

  // Fetch and display account creation date
  if (user) {
    const createdDate = new Date(user.created_at);
    const formattedDate = createdDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    document.getElementById("accountCreated").textContent = formattedDate;
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const switchRoleBtn = document.getElementById("switchRole");
  const roleText = document.getElementById("roleText");

  // Get logged-in user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("No user found:", userError);
    return;
  }

  const userId = user.id;

  // Fetch current user role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, kyc_status")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Failed to load profile:", profileError.message);
    return;
  }

  // Update role text on load
  if (roleText) {
    // Capitalize the role name (default to Buyer)
    const role =
      profile.role && profile.role.trim() !== ""
        ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
        : "Buyer";
    roleText.textContent = role;

    // Apply colors by role
    switch (profile.role) {
      case "admin":
        roleText.style.color = "#007bff"; // blue for Admin
        break;
      case "seller":
        roleText.style.color = "#2aec58ff"; // green for Seller
        break;
      case "buyer":
      default:
        roleText.style.color = "#000"; // black for Buyer
        break;
    }

    // Make it bold
    roleText.style.fontWeight = "bold";
  }

  // ✅ Handle Switch Role button click
  switchRoleBtn.addEventListener("click", async () => {
    const { data: latestProfile, error } = await supabase
      .from("profiles")
      .select("role, kyc_status")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Failed to fetch role:", error.message);
      return;
    }

    if (latestProfile.role === "seller") {
      Swal.fire({
        icon: "info",
        title: "You’re already a Seller",
        text: "Your account is verified as a seller.",
      });
      return;
    }

    if (latestProfile.kyc_status === "pending") {
      Swal.fire({
        icon: "warning",
        title: "KYC Under Review",
        text: "Your verification is still being processed.",
      });
      return;
    }

    if (latestProfile.kyc_status === "rejected") {
      Swal.fire({
        icon: "error",
        title: "Verification Rejected",
        text: "Your KYC was rejected. Please resubmit.",
      }).then(() => {
        window.location.href = "/verification.html";
      });
      return;
    }

    // If KYC not yet started
    Swal.fire({
      icon: "info",
      title: "Switch to Seller",
      text: "To become a seller, you must complete KYC verification and pay a small monthly fee.",
      showCancelButton: true,
      confirmButtonText: "Start Verification",
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = "verification.html";
      }
    });
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


/* ---------- SECURE PROFILE PICTURE UPLOAD ---------- */

const handleProfilePicStats = async () => {
  const profileInput = document.getElementById("profileInput");
  const profilePreview = document.getElementById("profilePreview");

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Fetch Profile (including our new tracking column)
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, full_name, last_avatar_update")
    .eq("id", user.id)
    .single();

  // Initial load of the picture
  if (profile?.avatar_url) {
    profilePreview.src = profile.avatar_url;
  } else {
    const name = profile?.full_name || "User";
    profilePreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0b1e5b&color=fff&size=128`;
  }

  // 2. Handle Upload
  profileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // --- LIMIT 1: File Size (2MB) ---
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      Swal.fire({ icon: "error", title: "Too big!", text: "Keep it under 2MB." });
      profileInput.value = ""; 
      return;
    }

    // --- LIMIT 2: Database-Level Cooldown (7 Days) ---
    const cooldownDays = 7;
    if (profile?.last_avatar_update) {
      const lastUpdate = new Date(profile.last_avatar_update).getTime();
      const now = Date.now();
      const msInCooldown = cooldownDays * 24 * 60 * 60 * 1000;

      if (now - lastUpdate < msInCooldown) {
        const diff = msInCooldown - (now - lastUpdate);
        const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        Swal.fire({
          icon: "info",
          title: "Cooldown Active",
          text: `You can change your picture again in ${daysLeft} days and ${hoursLeft} hours.`,
        });
        profileInput.value = "";
        return;
      }
    }

    // --- PROCEED WITH UPLOAD ---
    Swal.fire({ 
        title: 'Uploading...', 
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); } 
    });

    try {
      const fileExt = file.name.split(".").pop();
      // Using a constant filename forces Supabase to OVERWRITE, saving space.
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update URL and the cooldown timestamp
      // We add ?t= to the URL to force the browser to refresh the image (cache busting)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          avatar_url: `${publicUrl}?t=${Date.now()}`, 
          last_avatar_update: new Date().toISOString() 
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      Swal.fire({
        icon: "success",
        title: "Dope Pic!",
        text: "Your profile picture has been updated.",
        timer: 3000,
        showConfirmButton: false
      }).then(() => {
          location.reload(); // Refresh to lock the cooldown and show new pic
      });

    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "Failed", text: err.message });
    }
  });
};

handleProfilePicStats();
