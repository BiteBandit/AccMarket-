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

    // ✅ Populate Network Stats from JSONB columns
    const followingData = profile.following?.uids || [];
    const followersData = profile.followers?.uids || [];

    const followingCountEl = document.getElementById("followingCount");
    const followersCountEl = document.getElementById("followersCount");

    if (followingCountEl) followingCountEl.textContent = followingData.length;
    if (followersCountEl) followersCountEl.textContent = followersData.length;

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

  // ✅ Auto-save with Unique Username & Phone Number Scanner (No Cooldowns)
  [fullNameEl, usernameEl, phoneEl, aboutEl].forEach((el) => {
    el.addEventListener("blur", async () => {
      const isUsernameField = el === usernameEl;
      const isPhoneField = el === phoneEl;
      let newValue = el.textContent.trim();
      
      // Map original value from memory safely
      const originalValue = 
        el === fullNameEl ? profile.full_name :
        el === usernameEl ? profile.username :
        el === phoneEl ? profile.phone : 
        profile.about;

      // Skip if the user didn't actually change anything
      if (newValue === (originalValue || "")) return;


      // --- 🎯 UNIQUE USERNAME SCANNER (Facebook Style with Warnings) ---
      if (isUsernameField) {
        // Test if the username contains forbidden characters (Allows A-Z, a-z, 0-9, underscores, and hyphens)
        const hasInvalidCharacters = /[^a-zA-Z0-9___-]/g.test(newValue);
        
        if (hasInvalidCharacters) {
          Swal.fire({
            icon: "error",
            title: "Invalid Characters",
            text: "Usernames can only contain letters, numbers, underscores (_), and hyphens (-). No symbols like @ allowed!",
            confirmButtonColor: "#3b82f6"
          });
          usernameEl.textContent = originalValue || "@username";
          return; 
        }

        if (newValue.length === 0) {
          Swal.fire({ icon: "warning", title: "Invalid Username", text: "Username cannot be empty." });
          usernameEl.textContent = originalValue || "@username";
          return;
        }

        // Scan the database using a case-insensitive query (ilike) so "User" matches "user"
        const { data: existingUser, error: scanError } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", newValue)
          .neq("id", userId) // Ignore the user's current record
          .maybeSingle();

        if (scanError) {
          console.error("Database lookup error:", scanError);
          return;
        }

        if (existingUser) {
          Swal.fire({
            icon: "error",
            title: "Username Taken",
            text: `@${newValue} is already claimed by another user. Choose a different one!`,
            confirmButtonColor: "#3b82f6"
          });
          usernameEl.textContent = originalValue || "@username";
          return; // Stop execution, reject database updates
        }
        
        usernameEl.textContent = newValue;
      }


      // --- 📞 SMART UNIQUE PHONE VALIDATOR ---
      if (isPhoneField && newValue.length > 0) {
        // Strip out common formatting characters like spaces, hyphens, and parentheses to check raw digits
        const cleanNewPhone = newValue.replace(/[\s+\-()]/g, "");
        
        // 1. Syntax Check: Check if the clean version contains any letters or symbols
        const hasInvalidPhoneChars = /[^0-9]/g.test(cleanNewPhone);

        if (hasInvalidPhoneChars) {
          Swal.fire({
            icon: "error",
            title: "Invalid Phone Number",
            text: "Phone numbers can only contain digits and standard formatting characters like +, -, or (). Letters are not allowed.",
            confirmButtonColor: "#3b82f6"
          });
          phoneEl.textContent = originalValue || ""; 
          return; // Block save execution
        }

        // 2. Uniqueness Scanner: Scan the database to see if this number is already attached to another user
        const { data: existingPhone, error: phoneScanError } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", newValue) // Compares against the entered value string
          .neq("id", userId)     // Ignores your own account profile ID
          .maybeSingle();

        if (phoneScanError) {
          console.error("Phone lookup database error:", phoneScanError);
          return;
        }

        if (existingPhone) {
          Swal.fire({
            icon: "error",
            title: "Phone Number In Use",
            text: "This phone number is already registered to another account. Please use a different one.",
            confirmButtonColor: "#3b82f6"
          });
          phoneEl.textContent = originalValue || ""; // Revert UI text back
          return; // Stop execution
        }
      }

      // --- 🛠️ PREPARE UPDATES ---
      const updates = {
        full_name: fullNameEl.textContent.trim(),
        username: usernameEl.textContent.trim().toLowerCase(), // Normalize saved handles
        phone: phoneEl.textContent.trim(),
        about: aboutEl.textContent.trim(),
        updated_at: new Date().toISOString(),
      };

      // --- ⚡ EXECUTE UPDATE ---
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (updateError) {
        Swal.fire({ icon: "error", title: "Update Failed", text: updateError.message });
        el.textContent = originalValue || ""; // Revert to old text if save fails
      } else {
        // Sync local object records instantly in-memory without refreshing the page
        profile.full_name = updates.full_name;
        profile.username = updates.username;
        profile.phone = updates.phone;
        profile.about = updates.about;
        
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
  // Fixed casing error here (DeleteBtn -> deleteBtn based on your declaration above)
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      
      const result = await Swal.fire({
        title: "Are you sure?",
        text: "Your account and all data will be permanently deactivated!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, deactivate it!",
        showLoaderOnConfirm: true,
        preConfirm: async () => {
          // 1. Disable button to prevent duplicate clicks
          button.disabled = true;

          // 2. Perform the update
          const { error: delError } = await supabase
            .from("profiles")
            .update({ is_active: false })
            .eq("id", userId);

          if (delError) {
            button.disabled = false;
            Swal.showValidationMessage(`Request failed: ${delError.message}`);
            return false;
          }
          return true;
        },
        allowOutsideClick: () => !Swal.isLoading()
      });

      if (result.isConfirmed) {
        // 3. Sign out and redirect
        const { error: signoutError } = await supabase.auth.signOut();
        
        if (signoutError) {
          console.error("Signout error:", signoutError);
        }

        await Swal.fire({
          icon: "success",
          title: "Account Deactivated",
          text: "Your account has been deactivated successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
        
        window.location.href = "/login.html";
      } else {
        // Re-enable button if user cancels
        button.disabled = false;
      }
    });
  }
});


// ✅ Security PIN Update Block
document.addEventListener("DOMContentLoaded", async () => {
  const changePinBtn = document.getElementById("changePinBtn");

  // Get current user from Supabase
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return;

  // --- 🔐 UPDATE SECURITY PIN LOGIC ---
  if (changePinBtn) {
    changePinBtn.addEventListener("click", async () => {
      // 1️⃣ Verify Identity with Login Password
      const { value: password } = await Swal.fire({
        title: 'Verify Identity',
        text: 'Enter your account password to authorize PIN change',
        input: 'password',
        inputPlaceholder: 'Enter password',
        showCancelButton: true,
        confirmButtonColor: '#0b1e5b',
        cancelButtonColor: '#6b7280',
      });

      if (!password) return; // User cancelled

      // Show loading state while checking password
      Swal.fire({
        title: 'Verifying...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      try {
        // Re-authenticate user
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: password,
        });

        if (authError) throw new Error("Incorrect password. Access denied.");

        // 2️⃣ Ask for the New 4-Digit PIN
        const { value: newPin } = await Swal.fire({
          title: 'Set New PIN',
          text: 'Enter a 4-digit PIN for withdrawals',
          input: 'password',
          inputPlaceholder: 'e.g., 1234',
          inputAttributes: {
            maxlength: 4,
            autocapitalize: 'off',
            autocorrect: 'off',
            inputmode: 'numeric'
          },
          showCancelButton: true,
          confirmButtonColor: '#0b1e5b',
          preConfirm: (value) => {
            if (!/^\d{4}$/.test(value)) {
              Swal.showValidationMessage('PIN must be exactly 4 digits');
            }
            return value;
          }
        });

        if (!newPin) return;

        // 3️⃣ Update PIN in Database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ security_pin: newPin })
          .eq('id', user.id);

        if (updateError) throw updateError;

        Swal.fire({
          icon: 'success',
          title: 'PIN Secured!',
          text: 'Your security PIN has been updated.',
          timer: 2500,
          showConfirmButton: false
        });

      } catch (err) {
        Swal.fire('Error', err.message, 'error');
      }
    });
  }
});


// ✅ Telegram Toggles Block
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

// ✅ Privacy Toggles Block
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

// ✅ Switch Roles Block
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

const telegramSection = document.getElementById("telegramIntegrationSection");

const isTelegramConnected =
  profile.telegram_chat_id &&
  profile.telegram_chat_id.toString().trim() !== "";

if (!isTelegramConnected) {
  telegramSection.style.display = "flex";

  const container = document.getElementById("telegram-login-container");

  // Prevent duplicate widgets
  if (!container.querySelector("script")) {
    const script = document.createElement("script");

    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;

    script.setAttribute("data-telegram-login", "Accmarket247bot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-request-access", "write");

    script.setAttribute(
      "data-auth-url",
      `https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/telegram-auth?state=${user.id}`
    );

    container.appendChild(script);
  }
} else {
  telegramSection.style.display = "none";
}
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

  // Handle Switch Role button click
  if (switchRoleBtn) {
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
  }
});

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

    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = "inline-block";
        badge.classList.add("pop");
        setTimeout(() => badge.classList.remove("pop"), 200);
      } else {
        badge.style.display = "none";
      }
    }
  } catch (err) {
    console.error("Unexpected error loading notification count:", err);
  }
}

// Run when dashboard loads
loadNotificationCount();
setInterval(loadNotificationCount, 30000);

const notificationSound = new Audio("notification.mp3");

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

setupNotificationRealtime();

const chatNotificationSound = new Audio("notification.mp3");

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
        await loadTotalChatCount();
        
        if (payload.eventType === "INSERT" && payload.new.sender_id !== user.id) {
            chatNotificationSound.play().catch((e) => console.warn("Sound blocked by browser:", e));
        }
      }
    )
    .subscribe();
}

loadTotalChatCount();
setupGlobalChatRealtime();


// ---- LOGOUT FUNCTIONALITY ----
document.addEventListener("click", async (e) => {
  if (e.target.closest(".logout")) {
    e.preventDefault(); 

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      localStorage.clear();
      sessionStorage.clear();

      window.location.href = "auth.html";
    } catch (err) {
      console.error("Logout failed:", err.message);
      alert("Something went wrong while logging out.");
    }
  }
});

// Add this to your existing DOMContentLoaded listener in settings.js
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Create the script element
  const script = document.createElement('script');
  script.src = "https://telegram.org/js/telegram-widget.js?22";
  script.async = true;
  
  // Set data attributes
  script.setAttribute('data-telegram-login', 'Accmarket247bot');
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-request-access', 'write');
  
  // PASS THE USER ID AS THE 'state' PARAMETER
  script.setAttribute('data-auth-url', `https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/telegram-auth?state=${user.id}`);

  // Inject into the container
  document.getElementById('telegram-login-container').appendChild(script);
});


async function showSellerAndAdminLinks() {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("⚠️ No logged-in user found.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("❌ Error fetching user role:", profileError.message);
      return;
    }

    const sellAccountLink = document.querySelector(".seller-only");

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

showSellerAndAdminLinks();


/* ---------- SECURE PROFILE PICTURE UPLOAD ---------- */
const handleProfilePicStats = async () => {
  const profileInput = document.getElementById("profileInput");
  const profilePreview = document.getElementById("profilePreview");

  if (!profileInput || !profilePreview) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, full_name, last_avatar_update")
    .eq("id", user.id)
    .single();

  if (profile?.avatar_url) {
    profilePreview.src = profile.avatar_url;
  } else {
    const name = profile?.full_name || "User";
    profilePreview.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0b1e5b&color=fff&size=128`;
  }

  profileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      Swal.fire({ icon: "error", title: "Too big!", text: "Keep it under 2MB." });
      profileInput.value = ""; 
      return;
    }

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

    Swal.fire({ 
        title: 'Uploading...', 
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); } 
    });

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

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
          location.reload(); 
      });

    } catch (err) {
      console.error(err);
      Swal.fire({ icon: "error", title: "Failed", text: err.message });
    }
  });
};

handleProfilePicStats();

// ✅ Push Notifications Settings Toggle
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 OneSignal Toggle Script: DOMContentLoaded triggered.");
  
  const pushToggle = document.getElementById("oneSignalSetupBtn");
  if (!pushToggle) {
    console.error("❌ OneSignal Toggle Script: Element with ID 'oneSignalSetupBtn' not found in HTML layout!");
    return;
  }
  console.log("🎯 OneSignal Toggle Script: Bound successfully to #oneSignalSetupBtn element.");

  console.log("🔍 OneSignal Toggle Script: Requesting user authentication context from Supabase...");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error("❌ OneSignal Toggle Script: Supabase auth check error:", userError.message);
    return;
  }
  if (!user) {
    console.warn("⚠️ OneSignal Toggle Script: No authenticated user detected. Halting registration setup.");
    return;
  }

  const userId = user.id;
  console.log("👤 OneSignal Toggle Script: Authenticated User ID matched:", userId);

  try {
    console.log("📂 OneSignal Toggle Script: Fetching existing notification flags from profiles table...");
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("push_notifications_enabled, onesignal_id")
      .eq("id", userId)
      .single();

    if (fetchError) throw fetchError;

    console.log("📋 OneSignal Toggle Script: Profile raw notification data retrieved:", {
      push_notifications_enabled: profile?.push_notifications_enabled,
      onesignal_id: profile?.onesignal_id
    });

    if (profile && (profile.push_notifications_enabled || profile.onesignal_id)) {
      console.log("💡 OneSignal Toggle Script: Existing active record found! Forcing visual toggle state to CHECKED.");
      pushToggle.checked = true;
    } else {
      console.log("⚪ OneSignal Toggle Script: No existing push registration parameters found. Leaving toggle UNCHECKED.");
      pushToggle.checked = false;
    }
  } catch (err) {
    console.error("❌ OneSignal Toggle Script: Failed to download initial push notification parameters from Supabase:", err.message);
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  pushToggle.addEventListener("change", async () => {
    const isTurningOn = pushToggle.checked;
    console.log(`🔄 OneSignal Toggle Event: User flipped the switch slider graphic. New visual state: [${isTurningOn ? "ON" : "OFF"}]`);

    if (isTurningOn) {
      console.log("⏳ OneSignal Toggle Event: Queueing OneSignal background operations via window.OneSignalDeferred...");
      
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        console.log("📦 OneSignal Queue: Deferred environment container running. Checking initialized core object context:", OneSignal);
        
        try {
          console.log("🔔 OneSignal Queue: Triggering explicit device prompt via OneSignal.Notifications.requestPermission()...");
          await OneSignal.Notifications.requestPermission();
          console.log("⏳ OneSignal Queue: Permission sequence requested. Pausing execution for 1500ms to allow async registration tokens to bake...");
          
          await sleep(1500);

          console.log("🔍 OneSignal Queue: Scanning active browser instance properties for generated token data...");
          const subscriptionId = OneSignal.User.PushSubscription?.id;
          console.log("🔑 OneSignal Queue: Retrieved Subscription ID result token string:", subscriptionId);

          if (subscriptionId) {
            console.log("💾 OneSignal Queue: Valid registration token found! Transporting update payloads to Supabase profiles row...");
            
            const { error: patchError } = await supabase
              .from("profiles")
              .update({ 
                onesignal_id: subscriptionId,
                push_notifications_enabled: true,
                updated_at: new Date().toISOString()
              })
              .eq("id", userId);

            if (!patchError) {
              console.log("✅ OneSignal Queue: Database parameters synchronised successfully. Rendering sweetalert success confirmation.");
              Swal.fire({
                icon: "success",
                title: "Alerts Activated!",
                text: "Your device has been linked to your account. You will now receive real-time updates.",
                timer: 2500,
                showConfirmButton: false
              });
            } else {
              console.error("❌ OneSignal Queue: Supabase patch query rejected:", patchError.message);
              throw new Error(patchError.message);
            }
          } else {
            console.warn("⚠️ OneSignal Queue: Subscription ID came back empty/null. The user likely denied or closed the authorization prompt panel.");
            Swal.fire({
              icon: "info",
              title: "Permission Needed",
              text: "Notifications were not enabled. Please check your browser's site settings permission and allow alerts manually."
            });
            pushToggle.checked = false; 
          }
        } catch (err) {
          console.error("❌ OneSignal Queue: Operational exception thrown during permission configuration cycles:", err);
          Swal.fire({
            icon: "error",
            title: "Sync Error",
            text: "We couldn't save your device key to your profile. Please try again later."
          });
          pushToggle.checked = false; 
        }
      });

    } else {
      console.log("⚠️ OneSignal Toggle Event: Opt-out request caught. Spawning cancel confirmation alert modal...");
      
      const confirmOptOut = await Swal.fire({
        title: "Disable Alerts?",
        text: "You will stop receiving updates regarding active disputes and transaction statuses on this device.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3b82f6",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, turn off"
      });

      console.log("❓ OneSignal Toggle Event: Prompt closed. Did user confirm subscription deletion?:", confirmOptOut.isConfirmed);

      if (confirmOptOut.isConfirmed) {
        console.log("🗑️ OneSignal Toggle Event: User confirmed opt-out. Connecting to Supabase to purge registration tokens...");
        try {
          const { error: clearError } = await supabase
            .from("profiles")
            .update({ 
              onesignal_id: null,
              push_notifications_enabled: false,
              updated_at: new Date().toISOString()
            })
            .eq("id", userId);

          if (clearError) throw clearError;

          console.log("✅ OneSignal Toggle Event: DB target columns cleared successfully.");
          Swal.fire({
            icon: "success",
            title: "Deactivated",
            text: "Push alerts have been disabled.",
            timer: 1500,
            showConfirmButton: false
          });
        } catch (err) {
          console.error("❌ OneSignal Toggle Event: Failed to clear registration indexes from target profile row:", err.message);
          pushToggle.checked = true; 
        }
      } else {
        console.log("❌ OneSignal Toggle Event: User clicked cancel. Rolling visual switch graphic back to CHECKED active position.");
        pushToggle.checked = true; 
      }
    }
  });
});