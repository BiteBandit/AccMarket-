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

// Sidebar Sub-list Toggle
document.querySelectorAll(".category-list > li > a").forEach((link) => {
  link.addEventListener("click", (e) => {
    const parentLi = link.parentElement;
    const hasSubmenu = parentLi.querySelector(".sub-list");

    if (hasSubmenu) {
      e.preventDefault(); // Prevents page from jumping to top on '#' href
      parentLi.classList.toggle("active");
    }
  });
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

// --------------------------
// Supabase Logic
// --------------------------
import { supabase } from './supabase-config.js';

document.addEventListener("DOMContentLoaded", async () => {
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
      text: "Only sellers and admins can access this page."
    }).then(() => window.location.href = "/index.html");
    return;
  }

  // ---------------- FETCH LISTINGS ----------------
  try {
    const { data: listings, error: listingsError } = await supabase
      .from("verifications")
      .select("*")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false });

    if (listingsError) throw listingsError;

    const tableBody = document.querySelector("#seller-accounts-table tbody");

    if (!listings || listings.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--gray);">No accounts listed yet.</td></tr>`;
      return;
    }

    // Populate table with numbering
    listings.forEach((listing, index) => {
      const data = listing.data || {}; // JSONB column

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${data.platform || "-"}</td>
        <td>${data.username || "-"}</td>
        <td>${data.followers || "-"}</td>
        <td>${data.category || "-"}</td>
        <td>
          <span class="status ${listing.status || "pending"}">
            ${listing.status || "pending"}
          </span>
        </td>
        <td>
          <button class="view-btn" data-id="${listing.id}">View</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // ---------------- VIEW BUTTON ----------------
    document.querySelectorAll(".view-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const accountId = btn.dataset.id;
        window.location.href = `/view-listing.html?id=${accountId}`;
      });
    });

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Failed to load your account listings.", "error");
  }
});

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
    return;
  }
})();

async function loadNotificationCount() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return;

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

loadNotificationCount();
setInterval(loadNotificationCount, 30000);

const notificationSound = new Audio("notification.mp3");

async function setupNotificationRealtime() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
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
          chatNotificationSound.play().catch((e) => console.warn("Sound blocked:", e));
        }
      }
    )
    .subscribe();
}
loadTotalChatCount();
setupGlobalChatRealtime();

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

async function showSellerAndAdminLinks() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) return;

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
