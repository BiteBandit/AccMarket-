import { supabase } from './supabase-config.js';

// --- SIDEBAR & UI LOGIC ---
const sidebarToggle = document.getElementById("sidebarToggle");
const profileToggle = document.getElementById("profileToggle");
const leftSidebar = document.getElementById("leftSidebar");
const rightSidebar = document.getElementById("rightSidebar");
const closeLeft = document.getElementById("closeLeft");
const closeRight = document.getElementById("closeRight");

sidebarToggle?.addEventListener("click", () => leftSidebar.classList.add("active"));
closeLeft?.addEventListener("click", () => leftSidebar.classList.remove("active"));
profileToggle?.addEventListener("click", () => rightSidebar.classList.add("active"));
closeRight?.addEventListener("click", () => rightSidebar.classList.remove("active"));

// Live Search
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.querySelector(".search-box input");
  const items = document.querySelectorAll("#categoryList li a");
  searchInput?.addEventListener("keyup", () => {
    let input = searchInput.value.toLowerCase().trim();
    items.forEach((item) => {
      item.parentElement.style.display = item.textContent.toLowerCase().includes(input) ? "block" : "none";
    });
  });
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


// Sound Preload
const chatNotificationSound = new Audio("notification.mp3");

// --- MAIN INITIALIZATION FLOW ---
document.addEventListener("DOMContentLoaded", async () => {
  // ✅ FIX: Fetch user ONCE and pass it down
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "/auth.html";
    return;
  }

  // Initial Data Fetch
  const [profileRes, verificationRes] = await Promise.all([
    supabase.from("profiles").select("role, balance, is_active, telegram_chat_id").eq("id", user.id).single(),
    supabase.from("user_verifications").select("status, dispatch_status").eq("user_id", user.id).maybeSingle()
  ]);

  const profile = profileRes.data;
  let verification = verificationRes.data; // Changed to let so we can update local state

  // 1. Account Deactivation Check
  if (profile && profile.is_active === false) {
    Swal.fire({
      title: "Account Deactivated",
      text: "Please contact support.",
      icon: "error",
      confirmButtonColor: "#0b1e5b",
      allowOutsideClick: false
    }).then(async () => {
      await supabase.auth.signOut();
      window.location.href = "auth.html";
    });
    return;
  }

  // Hide/Show Seller Link based on loaded profile
  const sellLink = document.querySelector(".seller-only");
  if (sellLink) sellLink.style.display = profile?.role === "seller" ? "block" : "none";

  // 2. UI Button State
  const startBtn = document.getElementById("startDidit");
  
  function updateButtonUI(status) {
    if (!startBtn) return;
    if (status === 'pending') {
      startBtn.disabled = true;
      startBtn.textContent = "Pending Review";
    } else if (status === 'sent') {
      startBtn.disabled = true;
      startBtn.textContent = "Verification link sent";
    } else if (status === 'verified') {
      startBtn.disabled = true;
      startBtn.textContent = "Verified ✅";
    } else if (status === 'rejected') {
      startBtn.disabled = false;
      startBtn.textContent = "Re-request Verification";
    } else {
      startBtn.disabled = false;
      startBtn.textContent = "Request Verification";
    }
  }

  // Initialize button state
  updateButtonUI(verification?.dispatch_status);

  // 3. SECURE VERIFICATION CLICK HANDLER
  startBtn?.addEventListener("click", async () => {
    try {
      startBtn.disabled = true;
      startBtn.textContent = "Processing Transaction...";

      // Call Database Function
      const { error: rpcError } = await supabase.rpc('handle_verification_fee', {
        user_id_input: user.id,
        user_email_input: user.email
      });

      if (rpcError) {
        Swal.fire("Transaction Failed", rpcError.message, "error");
        updateButtonUI(verification?.dispatch_status);
        return;
      }

      // ✅ FIX: Use UPSERT instead of UPDATE to handle new rows safely
      const { error: updateError } = await supabase
        .from("user_verifications")
        .upsert({ 
          user_id: user.id,
          dispatch_status: "pending",
          status: "pending", 
          updated_at: new Date().toISOString() 
        });

      if (updateError) {
        console.error("Error updating verification status:", updateError);
        Swal.fire("Partial Success", "Fee deducted, but failed to update status. Please contact support.", "warning");
        return;
      }

      // Sync local state variable
      if (!verification) verification = {};
      verification.dispatch_status = "pending";

      Swal.fire({
        icon: "success",
        title: "Success!",
        text: "3,000 deducted. Your request is now pending review.",
        confirmButtonColor: "#0b1e5b"
      });
      
      updateButtonUI("pending");

    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Critical system error. Please refresh.", "error");
      updateButtonUI(verification?.dispatch_status);
    }
  });

  // Run Notification & Chat Logic passing the existing user instance
  loadNotificationCount(user);
  setInterval(() => loadNotificationCount(user), 30000);

  loadTotalChatCount(user);
  setupGlobalChatRealtime(user);
});

// --- NOTIFICATIONS & CHAT FUNCTIONS ---
async function loadNotificationCount(user) {
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  const badge = document.getElementById("notification-count");
  if (badge) {
    badge.textContent = count || 0;
    badge.style.display = count > 0 ? "inline-block" : "none";
  }
}

async function loadTotalChatCount(user) {
  try {
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false)
      .neq("sender_id", user.id); // Add an explicit receiver check here if your DB schema supports it

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

async function setupGlobalChatRealtime(user) {
  supabase
    .channel("global-chat-updates")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" }, // Only listen to INSERTS to save processing power
      async (payload) => {
        // ✅ OPTIMIZATION: Only run calculations if the message is from someone else
        if (payload.new.sender_id !== user.id) {
            await loadTotalChatCount(user);
            chatNotificationSound.play().catch((e) => console.warn("Sound blocked by browser:", e));
        }
      }
    )
    .subscribe();
}

// Global Logout event listener
document.addEventListener("click", async (e) => {
  if (e.target.closest(".logout")) {
    e.preventDefault();
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = "auth.html";
  }
});
