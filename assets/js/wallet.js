import { supabase } from './supabase-config.js';

// =========================
// SIDEBAR & SEARCH NAVIGATION
// =========================
const sidebarToggle = document.getElementById("sidebarToggle");
const profileToggle = document.getElementById("profileToggle");
const leftSidebar = document.getElementById("leftSidebar");
const rightSidebar = document.getElementById("rightSidebar");
const closeLeft = document.getElementById("closeLeft");
const closeRight = document.getElementById("closeRight");

// Left sidebar
if (sidebarToggle && leftSidebar) {
  sidebarToggle.addEventListener("click", () => leftSidebar.classList.add("active"));
}
if (closeLeft && leftSidebar) {
  closeLeft.addEventListener("click", () => leftSidebar.classList.remove("active"));
}

// Right sidebar
if (profileToggle && rightSidebar) {
  profileToggle.addEventListener("click", () => rightSidebar.classList.add("active"));
}
if (closeRight && rightSidebar) {
  closeRight.addEventListener("click", () => rightSidebar.classList.remove("active"));
}

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

  if (searchInput) {
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
  }
});

// =========================
// DOM ELEMENTS & GLOBAL STATE
// =========================
const walletBalanceEl = document.getElementById("walletBalance");
const walletTransactionsEl = document.getElementById("walletTransactions");

let currentUser = null;
let allTransactions = [];
let currentFilter = "all";

// =========================
// INITIALIZATION FLOW
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    console.error("Auth error:", error);
    window.location.href = "auth.html"; // Redirect if not logged in
    return;
  }

  currentUser = user; 
  console.log("Wallet session started for:", currentUser.id);

  if (typeof fetchWalletData === 'function') fetchWalletData();
  if (typeof showSellerAndAdminLinks === 'function') showSellerAndAdminLinks();
});

// =========================
// FILTER FUNCTIONS
// =========================
window.setFilter = function(type) {
  currentFilter = type;
  applyFilter();

  document.querySelectorAll(".wallet-filters button").forEach(btn => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(
    `.wallet-filters button[onclick*="'${type}'"]`
  );

  if (activeBtn) activeBtn.classList.add("active");
};

function applyFilter() {
  let filtered = allTransactions;

  if (currentFilter === "deposit") {
    filtered = allTransactions.filter(
      tx => (tx.type || "").toLowerCase() === "deposit"
    );
  }

  if (currentFilter === "withdrawal") {
    filtered = allTransactions.filter(
      tx => (tx.type || "").toLowerCase() === "withdrawal"
    );
  }

  renderTransactions(filtered);
}

// =========================
// RENDER TRANSACTIONS
// =========================
function renderTransactions(transactions) {
  if (!walletTransactionsEl) return;

  if (!transactions || transactions.length === 0) {
    walletTransactionsEl.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:1rem; color:var(--secondary)">
          No transactions yet
        </td>
      </tr>
    `;
    return;
  }

  walletTransactionsEl.innerHTML = transactions.map(tx => {
    const status = (tx.status || "").toLowerCase();
    const type = (tx.type || "").toLowerCase();

    let statusClass = "status-pending";
    if (status === "success") statusClass = "status-success";
    else if (status === "failed") statusClass = "status-failed";
    else if (status === "rejected") statusClass = "status-rejected";

    let amountColor = "var(--black)";
    if (type === "deposit") amountColor = "var(--green)";
    else if (type === "withdrawal") amountColor = "var(--red)";
    else if (type === "refund") amountColor = "var(--green)";
    else if (type === "verification_fee") amountColor = "var(--red)";
    else if (type === "credit") amountColor = "var(--green)";

    return `
      <tr>
        <td>${new Date(tx.created_at).toLocaleString()}</td>
        <td style="text-transform:capitalize; font-weight:600;">
          ${type}
        </td>
        <td style="color:${amountColor}; font-weight:600;">
          ₦${Number(tx.amount).toLocaleString()}
        </td>
        <td>${tx.note || "-"}</td>
        <td class="${statusClass}">${tx.status}</td>
        <td class="reference">${tx.reference || "-"}</td>
      </tr>
    `;
  }).join("");
}

// =========================
// MAIN WALLET DATA FETCHING
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) throw new Error("No user logged in");

    const userId = user.user.id;

    // Get balance
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    if (walletBalanceEl) {
      walletBalanceEl.textContent = profile.balance?.toLocaleString() || "0";
    }

    // Get transactions
    const { data: transactions, error: txError } = await supabase
      .from("wallet")
      .select("created_at, type, amount, note, status, reference")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (txError) throw txError;

    allTransactions = transactions || [];
    applyFilter();

  } catch (err) {
    console.error("Wallet error:", err);
    if (walletTransactionsEl) {
      walletTransactionsEl.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:1rem; color:red">
            Failed to load transactions
          </td>
        </tr>
      `;
    }
  }
});

// =========================
// DEPOSIT MODAL & KORA PAY LOGIC
// =========================
const depositModal = document.getElementById("depositModal");
const openModalBtn = document.getElementById("depositBtn"); 
const closeModalBtn = document.getElementById("closeModal");
const amountInput = document.getElementById("depositAmount");

// Gateway Button (Kora Only)
const koraBtn = document.getElementById("payWithKora");

// Open Modal
if (openModalBtn && depositModal) {
  openModalBtn.addEventListener("click", (e) => {
    e.preventDefault();
    depositModal.classList.add("active");
  });
}

// Close Modal Logic
const handleClose = () => {
  if (depositModal) {
    depositModal.classList.remove("active");
    if (amountInput) amountInput.value = ""; 
    
    // Reset button state
    if (koraBtn) { 
      koraBtn.disabled = false; 
      koraBtn.innerHTML = '<span class="btn-content"><i class="fas fa-credit-card"></i><span>Pay with Kora Pay</span></span>'; 
    }
  }
};

if (closeModalBtn) closeModalBtn.addEventListener("click", handleClose);

window.addEventListener("click", (e) => {
  if (e.target === depositModal) handleClose();
});

// --- 🟢 KORA PAY HANDLER ---
if (koraBtn) {
  koraBtn.addEventListener("click", async () => {
    const amount = amountInput ? parseFloat(amountInput.value) : 0;

    if (!amount || amount < 100) {
      Swal.fire({
        title: 'Invalid Amount',
        text: 'Please enter at least ₦100.',
        icon: 'warning',
        confirmButtonColor: '#0b1e5b',
        target: 'body'
      });
      return;
    }

    Swal.fire({
      title: 'Connecting to Kora...',
      text: 'Please wait...',
      allowOutsideClick: false,
      showConfirmButton: false,
      target: 'body', 
      didOpen: async () => {
        Swal.showLoading();
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await fundWallet(amount, user);
        } catch (err) {
          Swal.fire({ title: 'Error', text: err.message, icon: 'error', target: 'body' });
        }
      }
    });
  });
}

// --- 💳 KORAPAY PAYMENT FUNCTION --- 
async function fundWallet(amount, user) {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error("You must be logged in to deposit.");
    }

    const res = await fetch(
      "https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/create-payment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          amount,
          email: user.email,
          user_id: user.id,
          metadata: {
            user_id: user.id
          }
        })
      }
    );

    const data = await res.json();

    if (res.ok && data.checkout_url) {
      window.location.href = data.checkout_url;
    } else {
      throw new Error(data.error || data.message || "Payment initialization failed");
    }
  } catch (err) {
    console.error("Payment Error:", err);
    alert(err.message);
    
    const confirmBtn = document.getElementById("confirmDepositBtn");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Deposit Now";
    }
  }
}

// =========================
// WITHDRAWAL SYSTEM LOGIC
// =========================
const withdrawModal = document.getElementById('withdrawModal');
const withdrawBtn = document.getElementById('withdrawBtn'); 
const closeWithdrawModal = document.getElementById('closeWithdrawModal');
const confirmWithdrawBtn = document.getElementById('confirmWithdrawBtn');

if (withdrawBtn) {
  withdrawBtn.onclick = (e) => {
    e.preventDefault();
    if (!currentUser) {
      Swal.fire('Please wait', 'Your account details are still loading...', 'info');
      return;
    }
    withdrawModal.classList.add('active');
  };
}

if (closeWithdrawModal) {
  closeWithdrawModal.onclick = () => {
    withdrawModal.classList.remove('active');
  };
}

confirmWithdrawBtn?.addEventListener('click', async () => {
  if (!currentUser) return Swal.fire('Error', 'Session not found. Please refresh.', 'error');

  const amountInput = document.getElementById('withdrawAmount');
  const bankInput = document.getElementById('bankName');
  const accNumInput = document.getElementById('accountNumber');
  const accNameInput = document.getElementById('accountName');

  const amount = parseFloat(amountInput.value);
  const bank = bankInput.value.trim();
  const accNum = accNumInput.value.trim();
  const accName = accNameInput.value.trim();

  if (!amount || amount < 1000) {
    return Swal.fire({ target: withdrawModal, title: 'Invalid Amount', text: 'Minimum withdrawal is ₦1,000', icon: 'warning' });
  }
  if (!bank || !accNum || !accName) {
    return Swal.fire({ target: withdrawModal, title: 'Missing Info', text: 'Please provide all bank details.', icon: 'warning' });
  }

  try {
    const [{ data: profile, error: profileErr }, { data: factors, error: factorErr }] = await Promise.all([
      supabase.from('profiles').select('balance').eq('id', currentUser.id).single(),
      supabase.auth.mfa.listFactors()
    ]);

    if (profileErr) throw profileErr;
    
    const totpFactor = factors?.totp?.find(f => f.status === 'verified');
    if (!totpFactor) {
      return Swal.fire({
        target: withdrawModal,
        title: '2FA Not Enabled',
        text: 'You must have 2FA enabled to make withdrawals.',
        icon: 'warning'
      }).then(() => window.location.href = 'settings.html');
    }

    if (profile.balance < amount) {
      return Swal.fire({ target: withdrawModal, title: 'Insufficient Funds', text: `Your balance is ₦${profile.balance.toLocaleString()}`, icon: 'error' });
    }

    const mfaModal = document.getElementById('mfaModal');
    const mfaCodeInput = document.getElementById('mfaCodeInput');
    const verifyMfaBtn = document.getElementById('verifyMfaBtn');
    const cancelMfaBtn = document.getElementById('cancelMfaBtn');

    mfaModal.style.display = 'flex';

    verifyMfaBtn.onclick = async () => {
      const mfaCode = mfaCodeInput.value.trim();
      if (mfaCode.length !== 6) {
        return Swal.fire({
          icon: 'error',
          title: 'Invalid Code',
          text: 'Please enter a valid 6-digit code.',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false
        });
      }

      verifyMfaBtn.disabled = true;
      verifyMfaBtn.innerText = "Verifying...";

      try {
        const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: totpFactor.id,
          challengeId: challenge.id,
          code: mfaCode
        });

        if (verifyError) throw new Error("Invalid 2FA code.");

        mfaModal.style.display = 'none';
        confirmWithdrawBtn.disabled = true;
        confirmWithdrawBtn.innerText = "Processing...";

        const { data: walletLog, error: walletTableError } = await supabase
          .from('wallet')
          .insert([{
            user_id: currentUser.id,
            type: 'withdrawal',
            amount: -amount,
            note: `Withdrawal to ${bank} (${accNum})`,
            status: 'pending',
            reference: `WDR-${Date.now()}-${currentUser.id.slice(0, 5)}`
          }])
          .select().single();

        if (walletTableError) throw walletTableError;

        const { error: withdrawError } = await supabase
          .from('withdrawals')
          .insert([{
            user_id: currentUser.id,
            amount: amount,
            method: 'Transfer',
            details: `${bank} | Acc: ${accNum} | Name: ${accName}`,
            status: 'pending',
            transaction_id: walletLog.id
          }]);

        if (withdrawError) throw withdrawError;

        await supabase.rpc('deduct_balance', { user_id: currentUser.id, amount_to_deduct: amount });

        Swal.fire({
          target: withdrawModal,
          title: 'Authorized!',
          text: `₦${amount.toLocaleString()} deducted. Processing within 24 hours.`,
          icon: 'success'
        }).then(() => window.location.reload());

      } catch (err) {
        alert(err.message);
        verifyMfaBtn.disabled = false;
        verifyMfaBtn.innerText = "Verify & Withdraw";
      }
    };

    cancelMfaBtn.onclick = () => {
      mfaModal.style.display = 'none';
      verifyMfaBtn.disabled = false;
      verifyMfaBtn.innerText = "Verify & Withdraw";
    };

  } catch (err) {
    console.error("Withdrawal Error:", err);
    Swal.fire({ target: withdrawModal, title: 'System Error', text: err.message, icon: 'error' });
  } finally {
    if (confirmWithdrawBtn) {
      confirmWithdrawBtn.disabled = false;
      confirmWithdrawBtn.innerText = "Confirm Withdrawal";
    }
  }
});

// =========================
// SUCCESS CHECKER (KORA PAY)
// =========================
function checkTransactionStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const reference = urlParams.get('reference') || urlParams.get('order_id');
  const successModal = document.getElementById("successModal");
  const closeSuccessBtn = document.getElementById("closeSuccessBtn");

  if (reference) {
    if (successModal) {
      successModal.classList.add("active");
    } else {
      Swal.fire({
        title: 'Payment Successful!',
        text: 'Your wallet funding is being processed.',
        icon: 'success',
        confirmButtonColor: '#0b1e5b'
      });
    }

    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    setTimeout(() => {
      window.location.reload(); 
    }, 3000);
  }

  closeSuccessBtn?.addEventListener("click", () => {
    successModal.classList.remove("active");
  });
}

document.addEventListener("DOMContentLoaded", checkTransactionStatus);

// =========================
// ACCOUNT STATUS CHECKER
// =========================
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

// =========================
// NOTIFICATIONS REALTIME
// =========================
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

// =========================
// CHAT MESSAGES REALTIME
// =========================
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

// =========================
// LOGOUT FUNCTIONALITY
// =========================
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

// =========================
// ROLE-BASED UI CONTROLS
// =========================
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

    const withdrawBtn = document.getElementById("withdrawBtn");
    if (withdrawBtn) {
      withdrawBtn.style.display = (profile.role === "seller") ? "block" : "none";
    }

    const sellAccountLink = document.querySelector(".seller-only");
    if (sellAccountLink) {
      sellAccountLink.style.display = (profile.role === "seller") ? "block" : "none";
    }

  } catch (err) {
    console.error("⚠️ Error checking role:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
    showSellerAndAdminLinks();
});