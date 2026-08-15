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

  // ---------------- AUTH & ROLE CHECK ----------------
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "/auth.html";
    return;
  }

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
    }).then(() => {
      window.location.href = "/index.html";
    });
    return;
  }

  // ---------------- PLATFORM SETUP ----------------
  const params = new URLSearchParams(window.location.search);
  const platform = params.get("platform") || "Platform";

  const platformTitle = document.getElementById("platform-title");
  platformTitle.textContent = `Verify Your ${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`;

  const platformLogo = document.getElementById("platform-logo");
  const platformLogos = {
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
  platformLogo.src = platformLogos[platform.toLowerCase()] || "../images/default.png";

  // ---------------- DYNAMIC CREDENTIAL FIELDS GENERATOR ----------------
  const loginCheckboxes = document.querySelectorAll(".login-options input");
  const fieldsWrapper = document.getElementById("dynamic-fields-wrapper");

  function renderCredentialFields() {
    if (!fieldsWrapper) return;

    const selectedValues = Array.from(loginCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    if (selectedValues.length === 0) {
      fieldsWrapper.innerHTML = `
        <p style="font-size: 0.85rem; color: #666; font-style: italic;">
          Please select at least one login format above to display input fields.
        </p>`;
      return;
    }

    let html = "";

    // Email + Password
    if (selectedValues.includes("email_password")) {
      html += `
        <div class="cred-group" style="margin-bottom: 0.75rem;">
          <label for="cred_email">Email Address</label>
          <input type="email" id="cred_email" placeholder="e.g., account@gmail.com" required>
          <label for="cred_email_pass" style="margin-top:0.4rem;">Email Password</label>
          <input type="password" id="cred_email_pass" placeholder="Enter email password" required>
        </div>`;
    }

    // Username + Password
    if (selectedValues.includes("username_password")) {
      html += `
        <div class="cred-group" style="margin-bottom: 0.75rem;">
          <label for="cred_username">Account Username / Handle</label>
          <input type="text" id="cred_username" placeholder="e.g., @john_doe" required>
          <label for="cred_account_pass" style="margin-top:0.4rem;">Account Password</label>
          <input type="password" id="cred_account_pass" placeholder="Enter account password" required>
        </div>`;
    }

    // Phone + Password
    if (selectedValues.includes("phone_password")) {
      html += `
        <div class="cred-group" style="margin-bottom: 0.75rem;">
          <label for="cred_phone">Phone Number</label>
          <input type="tel" id="cred_phone" placeholder="e.g., +1234567890" required>
          <label for="cred_phone_pass" style="margin-top:0.4rem;">Password</label>
          <input type="password" id="cred_phone_pass" placeholder="Enter password" required>
        </div>`;
    }

    // 2FA Enabled
    if (selectedValues.includes("2fa_enabled")) {
      html += `
        <div class="cred-group" style="margin-bottom: 0.75rem;">
          <label for="cred_2fa">2FA Secret Key / Backup Codes</label>
          <input type="text" id="cred_2fa" placeholder="e.g., JBSWY3DPEHPK3PXP or 8-digit codes" required>
        </div>`;
    }

    // Optional Extra / Recovery Details
    html += `
      <div class="cred-group" style="margin-bottom: 0.75rem;">
        <label for="cred_extra">Recovery Email / Additional Notes (Optional)</label>
        <input type="text" id="cred_extra" placeholder="e.g., Recovery email, original creation year, etc.">
      </div>`;

    fieldsWrapper.innerHTML = html;
  }

  // Checkbox Selection Listener (Limit to 3 & trigger dynamic render)
  loginCheckboxes.forEach(box => {
    box.addEventListener("change", () => {
      const checked = document.querySelectorAll(".login-options input:checked");
      if (checked.length > 3) {
        box.checked = false;
        Swal.fire("Limit Reached", "You can select a maximum of 3 login formats.", "warning");
        return;
      }
      renderCredentialFields();
    });
  });

  // ---------------- AI DESCRIPTION GENERATION ----------------
  const aiGenerateBtn = document.getElementById("ai-generate-btn");
  const descriptionTextarea = document.getElementById("description");

  if (aiGenerateBtn) {
    aiGenerateBtn.addEventListener("click", async (e) => {
      e.preventDefault(); 

      const followers = document.getElementById("followers")?.value.trim() || "";
      const region = document.getElementById("region")?.value.trim() || "";
      const category = document.getElementById("category")?.value || "";
      const username = document.getElementById("username")?.value.trim() || "";
      const price = document.getElementById("price")?.value.trim() || ""; 

      let userDraft = descriptionTextarea?.value.trim() || "";
      if (userDraft.includes("Accmarket Escrow") || userDraft.includes("•")) {
        userDraft = ""; 
      }

      let missingFields = [];
      if (!followers) missingFields.push("Follower Count");
      if (!region) missingFields.push("Account Region");
      if (!category || category === "") missingFields.push("Account Category");
      if (!price) missingFields.push("Listing Price"); 

      if (missingFields.length > 0) {
        Swal.fire({
          icon: "warning",
          title: "Information Needed",
          text: `Please fill out these remaining fields first: ${missingFields.join(", ")}`
        });
        return;
      }

      try {
        aiGenerateBtn.disabled = true;
        aiGenerateBtn.style.opacity = "0.7";
        aiGenerateBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Upgrading...`;
        descriptionTextarea.placeholder = "Accmarket AI is upgrading your description using all form details...";

        const { data, error } = await supabase.functions.invoke('generate-description', {
          body: { 
            platform, 
            username, 
            followers, 
            region, 
            category,
            price, 
            userDraft 
          }
        });

        if (error) throw error;

        if (data && data.description) {
          descriptionTextarea.value = data.description;
        } else {
          throw new Error("No description content returned from backend.");
        }

      } catch (err) {
        console.error("AI Generation Error:", err);
        Swal.fire({
          icon: "error",
          title: "Generation Failed",
          text: "We couldn't upgrade the description automatically. Please try again."
        });
      } finally {
        aiGenerateBtn.disabled = false;
        aiGenerateBtn.style.opacity = "1";
        aiGenerateBtn.innerHTML = `<i class="fas fa-magic"></i> Generate with AI`;
        descriptionTextarea.placeholder = "Describe the account, niche, engagement, audience type...";
      }
    });
  }

  // ---------------- FORM LOGIC ----------------
  const verifyForm = document.getElementById("verify-form");
  const bioLockSection = document.getElementById("bio-lock-section");
  const instruction = document.getElementById("verification-instruction");
  const submitBtn = document.getElementById("submit-verification-btn");

  let verificationCode = "";
  let initialData = {};

  // STEP 1: Generate Bio-Lock Code
  verifyForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const selectedFormats = Array.from(
      document.querySelectorAll(".login-options input:checked")
    ).map(cb => cb.value);

    if (selectedFormats.length === 0) {
      Swal.fire("Select Login Format", "Please select at least one login format.", "warning");
      return;
    }

    if (selectedFormats.length > 3) {
      Swal.fire("Too Many Selected", "You can select a maximum of 3 login formats.", "warning");
      return;
    }
    
    // PRICE VALIDATION
    const priceInput = document.getElementById("price").value.trim();
    const price = parseFloat(priceInput);

    if (!priceInput || isNaN(price) || price < 0) {
      Swal.fire(
        "Invalid Price",
        "Please enter a valid price (0 or greater).",
        "warning"
      );
      return;
    }

    verificationCode = "ACCMARKET-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    initialData = {
      platform,
      username: document.getElementById("username").value.trim(),
      profile_link: document.getElementById("profile-link").value.trim(),
      account_age: document.getElementById("account-age").value.trim(),
      followers: parseInt(document.getElementById("followers").value),
      region: document.getElementById("region").value.trim(),
      login_formats: selectedFormats,
      description: document.getElementById("description").value.trim(),
      price: parseFloat(document.getElementById("price").value),
      category: document.getElementById("category").value,
      status: "pending",
      verification_code: verificationCode,
      submitted_at: new Date().toISOString()
    };

    instruction.innerHTML = `
      Copy this code into your bio temporarily:<br><br>
      <strong style="font-size:18px;">${verificationCode}</strong>
    `;

    bioLockSection.style.display = "flex";
    Array.from(verifyForm.elements).forEach(el => el.disabled = true);
  });
  
  // STEP 2: Upload Screenshot & Save to DB
  submitBtn.addEventListener("click", async () => {
    const file = document.getElementById("screenshot").files[0];

    if (!file) {
      Swal.fire("Screenshot Required", "Please upload your screenshot.", "warning");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not logged in.");

      // 1. Upload screenshot
      const filePath = `verification_screenshots/${user.id}-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("verification-screenshots")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: publicUrlData, error: urlError } = supabase.storage
        .from("verification-screenshots")
        .getPublicUrl(filePath);

      if (urlError) throw urlError;
      const screenshotUrl = publicUrlData.publicUrl;

      // 3. Insert into `verifications` table
      const { data: verificationData, error: insertError } = await supabase
        .from("verifications")
        .insert([
          {
            user_id: user.id,
            data: initialData,
            screenshot_url: screenshotUrl
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // 4. Gather credential values from dynamic input fields
      const primaryUser = document.getElementById("cred_email")?.value.trim() 
        || document.getElementById("cred_username")?.value.trim() 
        || document.getElementById("cred_phone")?.value.trim() 
        || "";

      const primaryPass = document.getElementById("cred_account_pass")?.value.trim() 
        || document.getElementById("cred_email_pass")?.value.trim() 
        || document.getElementById("cred_phone_pass")?.value.trim() 
        || "";

      const extra2FA = document.getElementById("cred_2fa")?.value.trim() || "";
      const extraNotes = document.getElementById("cred_extra")?.value.trim() || "";

      const parsedPayload = {
        username: primaryUser,
        password: primaryPass,
        extra: [
          extra2FA ? `2FA: ${extra2FA}` : "",
          extraNotes ? `Notes: ${extraNotes}` : ""
        ].filter(Boolean).join(" | ")
      };

      const primaryLoginType = initialData.login_formats && initialData.login_formats.length > 0 
        ? initialData.login_formats[0] 
        : "email_password";

      // 5. Insert into `Listing_credentials` table
      const { error: credentialsError } = await supabase
        .from("listing_credentials")
        .insert([
          {
            listing_id: verificationData.id,
            seller_id: user.id,
            login_type: primaryLoginType,
            credentials_payload: JSON.stringify(parsedPayload),
            status: "pending",
            claimed_by_buyer_id: null,
            claimed_at: null
          }
        ]);

      if (credentialsError) throw credentialsError;

      Swal.fire(
        "Submitted!",
        "Your verification request and credentials have been submitted.",
        "success"
      );

      verifyForm.reset();
      renderCredentialFields(); // Resets dynamic credential inputs
      bioLockSection.style.display = "none";
      Array.from(verifyForm.elements).forEach(el => el.disabled = false);

    } catch (err) {
      console.error("Verification Error:", err);
      Swal.fire("Error", "Something went wrong. Check console.", "error");
    }
  });

});

(async () => {
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; 

  // Fetch the is_active status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .single();

  // Account Status Check
  if (profile && profile.is_active === false) {
    Swal.fire({
      title: "Account Deactivated",
      text: "Your account has been deactivated. Please contact support for assistance.",
      icon: "error",
      confirmButtonColor: "#0b1e5b",
      confirmButtonText: "Close",
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(async () => {
      await supabase.auth.signOut();
      window.location.href = "auth.html";
    });
    return;
  }
})();

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

// Run when page loads
loadNotificationCount();

// Refresh every 30 seconds
setInterval(loadNotificationCount, 30000);

// Preload notification sound
const notificationSound = new Audio("notification.mp3");

// Real-time updates
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

// Activate real-time listener
setupNotificationRealtime();

// Preload the notification sound
const chatNotificationSound = new Audio("notification.mp3");

// Get total unread messages
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

// Real-time listener WITH SOUND
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

// Initialize chat counts
loadTotalChatCount();
setupGlobalChatRealtime();

// LOGOUT FUNCTIONALITY
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

// Show Sell Account link ONLY for Sellers
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