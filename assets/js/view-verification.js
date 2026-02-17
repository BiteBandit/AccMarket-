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

// ✅ Supabase initialization

import { supabase } from './supabase-config.js';

document.addEventListener("DOMContentLoaded", async () => {
  // ---------------- GET ACCOUNT ID FROM URL ----------------
  const params = new URLSearchParams(window.location.search);
  const accountId = params.get("id");

  if (!accountId) {
    Swal.fire("Error", "No account ID provided.", "error").then(() => {
      window.location.href = "/analytics.html";
    });
    return;
  }

  // ---------------- USER AUTH ----------------
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user || userError) {
    window.location.href = "/auth.html";
    return;
  }

  // ---------------- CHECK ADMIN ROLE ----------------
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    Swal.fire({
      icon: "error",
      title: "Access Denied",
      text: "Only admins can access this page."
    }).then(() => window.location.href = "/index.html");
    return;
  }

  // ---------------- FETCH ACCOUNT ----------------
  try {
    const { data: accountRow, error: fetchError } = await supabase
      .from("verifications")
      .select("*")
      .eq("id", accountId)
      .single();

    if (fetchError || !accountRow) throw fetchError || new Error("Account not found.");

    const account = accountRow.data || {}; // JSON column
    const status = account.status || accountRow.status;

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

    platformLogo.src = logos[account.platform?.toLowerCase()] || "../images/default.png";
    platformTitle.textContent = `View ${account.platform} Account`;

    detailsContainer.innerHTML = `
      <p><strong>User ID:</strong> <span id="userid">${accountRow.id}</span></p>
      <p><strong>Platform:</strong> <span id="platform">${account.platform}</span></p>
      <p><strong>Username:</strong> <span id="username" contenteditable="true">${account.username || ""}</span></p>
      <p><strong>Profile Link:</strong> <a id="profile-link" href="${account.profile_link || "#"}" target="_blank">${account.profile_link || "Visit"}</a></p>
      <p><strong>Account Age:</strong> <span id="account-age" contenteditable="true">${account.account_age || ""}</span></p>
      <p><strong>Followers:</strong> <span id="followers" contenteditable="true">${account.followers || ""}</span></p>
      <p><strong>Region:</strong> <span id="region" contenteditable="true">${account.region || ""}</span></p>
      <p><strong>Category:</strong> <span id="category">${account.category || ""}</span></p>
      <p><strong>Login Formats:</strong> <span id="login-formats">${(account.login_formats || []).join(", ")}</span></p>
      <p><strong>Description:</strong> <span id="description" contenteditable="true">${account.description || ""}</span></p>
      <p><strong>Verification Code:</strong> <span id="verification-code">${account.verification_code || ""}</span></p>
      <p><strong>Status:</strong> <span id="status" class="status ${status?.toLowerCase()}">${status || ""}</span></p>
      <p><strong>Submitted At:</strong> <span id="submitted-at">${account.submitted_at || ""}</span></p>
      ${accountRow.screenshot_url ? `<p><strong>Screenshot:</strong><br><img id="screenshot" src="${accountRow.screenshot_url}" style="max-width:100%; border-radius:12px;"></p>` : ""}
    `;

    const statusEl = document.getElementById("status");

    // ---------------- INLINE EDIT AUTO-SAVE ----------------
    const editableFields = ["username", "account-age", "followers", "region", "description"];
    editableFields.forEach(fieldId => {
      const el = document.getElementById(fieldId);
      el.addEventListener("blur", async () => {
        const value = el.textContent.trim();
        const updatedData = { ...account, [fieldId.replace("-", "_")]: value };

        const { error } = await supabase
          .from("verifications")
          .update({ data: updatedData })
          .eq("id", accountRow.id);

        if (error) Swal.fire("Error", `Failed to update ${fieldId}`, "error");
        else {
          account[fieldId.replace("-", "_")] = value;
          Swal.fire("Saved", `${fieldId} updated successfully!`, "success");
        }
      });
    });

    // ---------------- ACTION BUTTONS (LIVE + JSON) ----------------
    const updateStatus = async (newStatus) => {
      try {
        const updatedData = { ...account, status: newStatus };
        const { error } = await supabase
          .from("verifications")
          .update({ status: newStatus, data: updatedData })
          .eq("id", accountRow.id);

        if (error) throw error;

        statusEl.textContent = newStatus;
        statusEl.className = "status " + newStatus.toLowerCase();
        account.status = newStatus;

        Swal.fire({
          icon: "success",
          title: newStatus.charAt(0).toUpperCase() + newStatus.slice(1) + "!",
          text: "Account status updated successfully.",
          timer: 1500,
          toast: true,
          position: "top-end",
          showConfirmButton: false
        });
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "Failed to update status.", "error");
      }
    };

    document.getElementById("approve-btn")?.addEventListener("click", () => updateStatus("approved"));
    document.getElementById("reject-btn")?.addEventListener("click", () => updateStatus("rejected"));

    document.getElementById("delete-btn")?.addEventListener("click", async () => {
      const confirm = await Swal.fire({
        title: "Delete Listing?",
        text: "Are you sure you want to delete this account listing?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel"
      });

      if (confirm.isConfirmed) {
        const { error } = await supabase
          .from("verifications")
          .delete()
          .eq("id", accountRow.id);

        if (error) Swal.fire("Error", "Failed to delete account.", "error");
        else Swal.fire("Deleted!", "Account has been deleted.", "success").then(() => window.location.href = "/analytics.html");
      }
    });

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Failed to load account details.", "error").then(() => window.location.href = "/analytics.html");
  }
});