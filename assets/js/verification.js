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

// --- MAIN AUTH & VERIFICATION FLOW ---
document.addEventListener("DOMContentLoaded", async () => {
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
  const verification = verificationRes.data;

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

  // 2. UI Button State
  const startBtn = document.getElementById("startDidit");
  if (startBtn && verification) {
    if (verification.dispatch_status === 'pending') {
      startBtn.disabled = true;
      startBtn.textContent = "Pending Review";
    } else if (verification.dispatch_status === 'sent') {
      startBtn.disabled = true;
      startBtn.textContent = "Verification link sent";
    } else if (verification.dispatch_status === 'verified') {
      startBtn.disabled = true;
      startBtn.textContent = "Verified ✅";
    } else if (verification.dispatch_status === 'rejected') {
      startBtn.disabled = false;
      startBtn.textContent = "Re-request Verification";
    }
  }

  // 3. SECURE VERIFICATION CLICK HANDLER (RPC)
  startBtn?.addEventListener("click", async () => {
    try {
      startBtn.disabled = true;
      startBtn.textContent = "Processing Transaction...";

      // Call the Database Function
      const { error } = await supabase.rpc('handle_verification_fee', {
        user_id_input: user.id,
        user_email_input: user.email
      });

      if (error) {
        // If the balance was low, the SQL 'RAISE EXCEPTION' will appear here
        Swal.fire("Transaction Failed", error.message, "error");
        startBtn.disabled = false;
        startBtn.textContent = "Request Verification";
        return;
      }

      // Success
      Swal.fire({
        icon: "success",
        title: "Success!",
        text: "1,000 deducted. Your request is now pending.",
        confirmButtonColor: "#0b1e5b"
      });
      
      startBtn.textContent = "Pending Review";
      startBtn.disabled = true;

    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Critical system error. Please refresh.", "error");
      startBtn.disabled = false;
    }
  });
});

// --- NOTIFICATIONS, LOGOUT, & ROLE UI (Remained same) ---
async function loadNotificationCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false);
  const badge = document.getElementById("notification-count");
  if (badge) {
    badge.textContent = count || 0;
    badge.style.display = count > 0 ? "inline-block" : "none";
  }
}
loadNotificationCount();
setInterval(loadNotificationCount, 30000);

document.addEventListener("click", async (e) => {
  if (e.target.closest(".logout")) {
    e.preventDefault();
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = "auth.html";
  }
});

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

(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const sellLink = document.querySelector(".seller-only");
    if (sellLink) sellLink.style.display = profile?.role === "seller" ? "block" : "none";
})();
