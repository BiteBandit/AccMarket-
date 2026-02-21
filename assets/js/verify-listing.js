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

  if (profile.role !== "admin" && profile.role !== "seller") {
    Swal.fire({
      icon: "error",
      title: "Access Denied",
      text: "Only sellers and admins can access this page."
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

    if (selectedFormats.length > 2) {
      Swal.fire("Too Many Selected", "You can select a maximum of 2 login formats.", "warning");
      return;
    }
    
    // ---------------- PRICE VALIDATION ----------------
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

      // Upload screenshot
      const filePath = `verification_screenshots/${user.id}-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("verification-screenshots")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData, error: urlError } = supabase.storage
        .from("verification-screenshots")
        .getPublicUrl(filePath);

      if (urlError) throw urlError;
      const screenshotUrl = publicUrlData.publicUrl;

      // Insert into table
      const { error: insertError } = await supabase
        .from("verifications") // table must exist
        .insert([
          {
            user_id: user.id,
            data: initialData,
            screenshot_url: screenshotUrl
          }
        ]);

      if (insertError) throw insertError;

      Swal.fire(
        "Submitted!",
        "Your verification request is now pending review.",
        "success"
      );

      verifyForm.reset();
      bioLockSection.style.display = "none";
      Array.from(verifyForm.elements).forEach(el => el.disabled = false);

    } catch (err) {
      console.error("Verification Error:", err);
      Swal.fire("Error", "Something went wrong. Check console.", "error");
    }
  });

  // Limit login format selection to 2
  const loginCheckboxes = document.querySelectorAll(".login-options input");
  loginCheckboxes.forEach(box => {
    box.addEventListener("change", () => {
      const checked = document.querySelectorAll(".login-options input:checked");
      if (checked.length > 2) {
        box.checked = false;
        Swal.fire(
          "Limit Reached",
          "You can select a maximum of 2 login formats.",
          "warning"
        );
      }
    });
  });

});

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


// ✅ Show Sell Account & Analytics only for Seller or Admin
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

    // Show links if role is seller or admin
    if (profile.role === "seller" || profile.role === "admin") {
      if (sellAccountLink) sellAccountLink.style.display = "block";
      if (analyticsLink) analyticsLink.style.display = "block";
    } else {
      if (sellAccountLink) sellAccountLink.style.display = "none";
      if (analyticsLink) analyticsLink.style.display = "none";
    }
  } catch (err) {
    console.error("⚠️ Error checking role:", err);
  }
}

// ✅ Run it once page loads
showSellerAndAdminLinks();
