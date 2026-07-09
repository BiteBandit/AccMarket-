// assets/js/verify-email.js

import { supabase } from "./supabase-config.js";

// ==========================================================================
// 1. SIDEBAR & LIVE SEARCH UTILITIES
// ==========================================================================
const sidebarToggle = document.getElementById("sidebarToggle");
const profileToggle = document.getElementById("profileToggle");
const leftSidebar = document.getElementById("leftSidebar");
const rightSidebar = document.getElementById("rightSidebar");
const closeLeft = document.getElementById("closeLeft");
const closeRight = document.getElementById("closeRight");

// Left sidebar menu toggles
sidebarToggle?.addEventListener("click", () => leftSidebar.classList.add("active"));
closeLeft?.addEventListener("click", () => leftSidebar.classList.remove("active"));

// Right sidebar quick links toggles
profileToggle?.addEventListener("click", () => rightSidebar.classList.add("active"));
closeRight?.addEventListener("click", () => rightSidebar.classList.remove("active"));

// Interactive Sidebar Dropdown Menu Sub-list Toggles
document.querySelectorAll(".category-list > li > a").forEach((link) => {
  link.addEventListener("click", (e) => {
    const parentLi = link.parentElement;
    const hasSubmenu = parentLi.querySelector(".sub-list");

    if (hasSubmenu) {
      e.preventDefault(); 
      parentLi.classList.toggle("active");
    }
  });
});

// Live Content Search Bar Component Filter
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.querySelector(".search-box input");
  const items = document.querySelectorAll("#categoryList li a");

  searchInput?.addEventListener("keyup", () => {
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

// ==========================================================================
// 2. MAIN CORE VALIDATION & LOGIC ROUTINES
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {

  // ---------------- AUTH & ROLE PROTECTION ----------------
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

  // ---------------- DYNAMIC PLATFORM INITIALIZATION ----------------
  const params = new URLSearchParams(window.location.search);
  const platform = params.get("platform") || "Email";

  const platformTitle = document.getElementById("platform-title");
  if (platformTitle) {
    platformTitle.textContent = `Verify Your ${platform.charAt(0).toUpperCase() + platform.slice(1)} Account`;
  }

  const platformLogo = document.getElementById("platform-logo");
  const platformLogos = {
    gmail: "../images/gmail.png",
    outlook: "../images/outlook.png",
    yahoo: "../images/yahoo.png",
    rambler: "../images/rambler.png",
    hotmail: "../images/hotmail.png",
    protonmail: "../images/protonmail.png",
    gmx: "../images/gmx.png",
    yandex: "../images/yandex.png",
    o2: "../images/o2.png",
    "mail.ru": "../images/mail.ru.png",
    "mail.com": "../images/mail.com.png",
    atomicmail: "../images/atomicmail.png",
    onet: "../images/onet.png",
    aol: "../images/aol.png"
  };
  
  if (platformLogo) {
    platformLogo.src = platformLogos[platform.toLowerCase()] || "../images/default.png";
  }

  // ---------------- AI DESCRIPTION CO-PILOT SUB-ROUTINE ----------------
  const aiGenerateBtn = document.getElementById("ai-generate-btn");
  const descriptionTextarea = document.getElementById("description");

  if (aiGenerateBtn) {
    aiGenerateBtn.addEventListener("click", async (e) => {
      e.preventDefault(); 

      const unreadCount = document.getElementById("unread-count")?.value.trim() || "";
      const region = document.getElementById("region")?.value.trim() || "";
      const category = document.getElementById("category")?.value || "";
      const emailAddress = document.getElementById("email-address")?.value.trim() || "";
      const price = document.getElementById("price")?.value.trim() || ""; 
      const creationYear = document.getElementById("creation-year")?.value.trim() || "";

      let userDraft = descriptionTextarea?.value.trim() || "";
      if (userDraft.includes("Accmarket Escrow") || userDraft.includes("•")) {
        userDraft = ""; 
      }

      let missingFields = [];
      if (!unreadCount) missingFields.push("Unread Inbox Count");
      if (!region) missingFields.push("Account Country Region");
      if (!category || category === "") missingFields.push("Account Purpose Category");
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
        aiGenerateBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
        descriptionTextarea.placeholder = "Accmarket AI is building out your specifications sheet listing details...";

        const { data, error } = await supabase.functions.invoke('generate-description', {
          body: { 
            platform, 
            username: emailAddress, 
            followers: unreadCount, // Map safely into follower parameter logic for compatibility
            region, 
            category,
            price, 
            userDraft,
            additionalMeta: { creationYear }
          }
        });

        if (error) throw error;

        if (data && data.description) {
          descriptionTextarea.value = data.description;
        } else {
          throw new Error("No payload text string strings returned from execution.");
        }

      } catch (err) {
        console.error("AI Generation Error:", err);
        Swal.fire({
          icon: "error",
          title: "Generation Failed",
          text: "We couldn't upgrade your email description automatically. Please fill it manually."
        });
      } finally {
        aiGenerateBtn.disabled = false;
        aiGenerateBtn.style.opacity = "1";
        aiGenerateBtn.innerHTML = `<i class="fas fa-magic"></i> Generate with AI`;
        descriptionTextarea.placeholder = "Describe the profile, registered attachments, clean history status...";
      }
    });
  }

  // ---------------- FORM STEPPING & PROCESSING LOGIC ----------------
  const verifyForm = document.getElementById("verify-form");
  const verificationSection = document.getElementById("verification-section");
  const instruction = document.getElementById("verification-instruction");
  const submitBtn = document.getElementById("submit-verification-btn");

  let verificationCode = "";
  let initialData = {};

  verifyForm?.addEventListener("submit", (e) => {
    e.preventDefault();

    const selectedFormats = Array.from(
      document.querySelectorAll(".login-options input:checked")
    ).map(cb => cb.value);

    if (selectedFormats.length === 0) {
      Swal.fire("Select Login Format", "Please select at least one credential access format.", "warning");
      return;
    }

    if (selectedFormats.length > 2) {
      Swal.fire("Too Many Selected", "You can select a maximum of 2 credential parameters.", "warning");
      return;
    }
    
    const priceInput = document.getElementById("price").value.trim();
    const price = parseFloat(priceInput);

    if (!priceInput || isNaN(price) || price < 0) {
      Swal.fire("Invalid Price", "Please enter a valid listing asset price.", "warning");
      return;
    }

    // Generate unique confirmation key reference identity string code
    verificationCode = "ACCMARKET-MAIL-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Gather metric values to map cleanly into verification schema schema structures
    const rawYear = document.getElementById("creation-year").value.trim();
    const unreadInboxVal = parseInt(document.getElementById("unread-count").value) || 0;

    // UNIFIED JSON MAPPING: Maps email data values perfectly to your existing table structure
    initialData = {
      price: price,
      region: document.getElementById("region").value.toUpperCase().trim(),
      status: "pending",
      category: document.getElementById("category").value,
      platform: platform.toLowerCase(),
      username: document.getElementById("email-address").value.trim(), // email address mapped to username
      followers: unreadInboxVal,                                      // unread count mapped to followers
      account_age: `CREATED ${rawYear}`,                              // age string matching standard format
      description: document.getElementById("description").value.trim(),
      login_formats: selectedFormats,
      verification_code: verificationCode,
      submitted_at: new Date().toISOString()
    };

    // Replace social bio challenge text block configurations
        
    instruction.innerHTML = `
      <div style="text-align: left; font-size: 0.95rem; line-height: 1.5; color: #374151;">
        <strong style="color: #0b1e5b; font-size: 1.05rem; display: block; margin-bottom: 0.5rem;">🎒 Quick Verification Steps:</strong>
        1. Open your email app or webmail and click <strong>Compose</strong> or <strong>New Mail</strong>.<br>
        2. In the <strong>To:</strong> field, type your email address.<br>
        3. In the <strong>Subject:</strong> field, type your unique code:<br>
        <div style="background: #ffffff; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center; margin: 0.5rem 0;">
          <strong style="font-size: 18px; color: #0b1e5b; letter-spacing: 0.5px;">${verificationCode}</strong>
        </div>
        4. Take a clear screenshot of that composition screen showing both the email address and code, then upload it below.
      </div>
    `;

    verificationSection.style.display = "flex";
    Array.from(verifyForm.elements).forEach(el => el.disabled = true);
  });

  // STEP 2: METADATA & SCREENSHOT FILE UPLOAD COMPONENT DIRECTORY
  submitBtn?.addEventListener("click", async () => {
    const file = document.getElementById("screenshot").files[0];

    if (!file) {
      Swal.fire("Screenshot Required", "Please upload the storage or dashboard proof screenshot.", "warning");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User session drop detected.");

      // Upload payload binary data to dedicated email verification repository
      const filePath = `email_verifications/${user.id}-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("verification-screenshots")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData, error: urlError } = supabase.storage
        .from("verification-screenshots")
        .getPublicUrl(filePath);

      if (urlError) throw urlError;
      const screenshotUrl = publicUrlData.publicUrl;

      // Insert complete record matrix directly into verification schema tables
      const { error: insertError } = await supabase
        .from("verifications") 
        .insert([
          {
            user_id: user.id,
            data: initialData, // Pass the structured object directly to match the schema format
            screenshot_url: screenshotUrl
          }
        ]);

      if (insertError) throw insertError;

      Swal.fire(
        "Submitted!",
        "Your email dashboard profile listing configuration data is now pending administrator evaluation review.",
        "success"
      );

      verifyForm.reset();
      verificationSection.style.display = "none";
      Array.from(verifyForm.elements).forEach(el => el.disabled = false);

    } catch (err) {
      console.error("Verification Error:", err);
      Swal.fire("Error", "Something went wrong processing database rows. Check console logging maps.", "error");
    }
  });

  // Keep selection bounds capped cleanly to 2 parameters
  const loginCheckboxes = document.querySelectorAll(".login-options input");
  loginCheckboxes.forEach(box => {
    box.addEventListener("change", () => {
      const checked = document.querySelectorAll(".login-options input:checked");
      if (checked.length > 2) {
        box.checked = false;
        Swal.fire("Limit Reached", "You can select a maximum of 2 credentials configuration setups.", "warning");
      }
    });
  });
});

// ==========================================================================
// 3. ACCOUNT STATUS MONITOR & NOTIFICATION BADGE COUNTERS
// ==========================================================================

// Global user profile suspension tracker
(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .single();

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
  }
})();

// System unread notification utility badge counter maps
async function loadNotificationCount() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return;

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) return;

    const badge = document.getElementById("notification-count");
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  } catch (err) { console.warn(err); }
}
loadNotificationCount();
setInterval(loadNotificationCount, 30000);

// Global chat unread indicator update components
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
    } else {
      badge.style.display = "none";
    }
  } catch (err) { console.error("Error loading chat count mappings:", err); }
}
loadTotalChatCount();

// ---------------- LOGOUT MODULE IMPLEMENTATION ----------------
document.addEventListener("click", async (e) => {
  if (e.target.closest(".logout")) {
    e.preventDefault();
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "auth.html";
    } catch (err) { console.error("Logout runtime breakdown:", err.message); }
  }
});

// Manage core side links presentation visibility
async function showSellerAndAdminLinks() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const sellAccountLink = document.querySelector(".seller-only");
    if (sellAccountLink && profile?.role === "seller") {
      sellAccountLink.style.display = "block";
    }
  } catch (err) { console.warn(err); }
}
showSellerAndAdminLinks();
 