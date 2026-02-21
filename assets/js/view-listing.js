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

  if (profile.role !== "admin" && profile.role !== "seller") {
    Swal.fire({
      icon: "error",
      title: "Access Denied",
      text: "Only sellers and admins can access this page."
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

