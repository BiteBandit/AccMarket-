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

// Now just write your logic
console.log("Supabase is ready to use!", supabase);


// ------------------------
// Global user variable
// ------------------------
let user = null;

// DOM Elements
const searchInput = document.getElementById("searchUser");
const searchBtn = document.getElementById("searchBtn");

const userFullName = document.getElementById("userFullName");
const userEmail = document.getElementById("userEmail");
const userRole = document.getElementById("userRole");
const verifyStatus = document.getElementById("verifyStatus");
const userJoined = document.getElementById("userJoined");
const userUsername = document.getElementById("userUsername");
const userPhone = document.getElementById("userPhone");
const accountStatus = document.getElementById("accountStatus");
const userCountry = document.getElementById("userCountry");
const userCountryFlag = document.getElementById("userCountryFlag");
const userAbout = document.getElementById("userAbout");
const walletBalance = document.getElementById("walletBalance");
const totalOrders = document.getElementById("totalOrders");
const totalSpent = document.getElementById("totalSpent");
const accountsSold = document.getElementById("accountsSold");
const lastLogin = document.getElementById("lastLogin");
const loginDevice = document.getElementById("loginDevice");
const telegramChatID = document.getElementById("telegramChatID");

// Action Buttons
let upgradeBtn, resetBtn, suspendBtn, magicLinkBtn;

// ------------------------
// Populate Overview
// ------------------------
function populateUserOverview(u) {
  userFullName.textContent = u.full_name || "N/A";
  userEmail.textContent = u.email || "N/A";
  userRole.textContent = u.role || "N/A";

  if (u.kyc_status === "verified") {
    verifyStatus.textContent = "Verified";
    verifyStatus.className = "verify-tag verified";
  } else if (u.kyc_status === "pending") {
    verifyStatus.textContent = "Pending";
    verifyStatus.className = "verify-tag pending";
  } else {
    verifyStatus.textContent = "Not Verified";
    verifyStatus.className = "verify-tag not-verified";
  }

  userJoined.textContent = new Date(u.created_at).toLocaleDateString();
  userUsername.textContent = u.username || "N/A";
  userPhone.textContent = u.phone || "N/A";
  accountStatus.textContent = u.is_active ? "Active" : "Suspended";
  userCountry.textContent = u.country || "N/A";
  userCountryFlag.textContent = u.country_flag || "N/A";
  userAbout.textContent = u.about || "N/A";
  walletBalance.textContent = `₦${Number(u.balance || 0).toLocaleString()}`;
  totalOrders.textContent = u.total_deals || 0;
  totalSpent.textContent = `₦${Number(u.total_earnings || 0).toLocaleString()}`;
  accountsSold.textContent = u.accounts_sold || 0;
  lastLogin.textContent = u.last_ip || "N/A";
  loginDevice.textContent = u.last_device || "N/A";
  telegramChatID.textContent = u.telegram_chat_id || "N/A";
}

// ------------------------
// Admin Access Protection
// ------------------------
(async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // If not logged in → redirect to login
  if (error || !user) {
    window.location.href = "auth.html";
    return;
  }

  // Fetch user profile to check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // If not admin → log out + redirect
  if (!profile || profile.role !== "admin") {
    await supabase.auth.signOut();
    window.location.href = "auth.html";
  }
})();

// ------------------------
// Search User
// ------------------------
async function searchUser() {
  const query = searchInput.value.trim();
  if (!query) {
    Swal.fire({
      icon: "warning",
      title: "Empty Search",
      text: "Please enter a User ID.",
    });
    return;
  }

  try {
    const { data: users, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", query)
      .limit(1);

    if (error) {
      console.error("Error fetching user:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error fetching user.",
      });
      return;
    }

    if (!users || users.length === 0) {
      Swal.fire({
        icon: "info",
        title: "Not Found",
        text: "No user matches your search.",
      });
      return;
    }

    user = users[0]; // assign to global variable
    populateUserOverview(user);

    Swal.fire({
      icon: "success",
      title: "User Found",
      text: "User data loaded successfully!",
      timer: 1500,
      showConfirmButton: false,
    });
  } catch (err) {
    console.error(err);
    Swal.fire({ icon: "error", title: "Error", text: "Something went wrong." });
  }
}

// ------------------------
// Initialize Action Buttons
// ------------------------
function initActionButtons() {
  upgradeBtn = document.querySelector(".upgrade-user");
  resetBtn = document.querySelector(".reset-password");
  suspendBtn = document.querySelector(".toggle-status");
  magicLinkBtn = document.querySelector(".magic-link-user"); // <- Magic Link button

  // Upgrade User
  // --- Upgrade User (Buyer → Seller, deduct ₦1,000, verify KYC, send notification) ---
  upgradeBtn.addEventListener("click", async () => {
    if (!user) return Swal.fire("Error", "No user selected.", "error");

    // Check if user is already a verified seller
    if (user.role === "seller" && user.kyc_status === "verified") {
      return Swal.fire(
        "Notice",
        `${user.full_name} is already a verified Seller.`,
        "info"
      );
    }

    const result = await Swal.fire({
      title: "Upgrade User?",
      text: `This will upgrade ${user.full_name} from Buyer to Seller, deduct ₦1,000, and verify KYC.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Upgrade",
    });

    if (result.isConfirmed) {
      if (Number(user.balance) < 1000) {
        Swal.fire(
          "Error",
          `${user.full_name} does not have enough balance.`,
          "error"
        );
        return;
      }

      // Update user in profiles
      const { error } = await supabase
        .from("profiles")
        .update({
          role: "seller",
          balance: Number(user.balance) - 1000,
          kyc_status: "verified", // <-- KYC updated
        })
        .eq("id", user.id);

      if (error) {
        Swal.fire("Error", "Failed to upgrade user.", "error");
        return;
      }

      // Save revenue record
      await supabase.from("revenue").insert([
        {
          user_id: user.id,
          type: "upgrade_fee",
          amount: 1000,
          notes: `${user.full_name} upgraded to seller`,
          created_at: new Date().toISOString(),
        },
      ]);

      // Update local object and UI
      user.role = "seller";
      user.balance -= 1000;
      user.kyc_status = "verified";

      userRole.textContent = user.role;
      walletBalance.textContent = `₦${user.balance.toLocaleString()}`;
      verifyStatus.textContent = "Verified";
      verifyStatus.className = "verify-tag verified";

      // Send notification
      const { error: notifError } = await supabase
        .from("notifications")
        .insert([
          {
            user_id: user.id,
            title: "Account Upgraded",
            message: `Congratulations ${user.full_name}! You are now a Seller. ₦1,000 has been deducted from your balance and your KYC is now verified.`,
            is_read: false,
            type: "info",
            created_at: new Date().toISOString(),
          },
        ]);

      if (notifError) {
        console.error("Notification Error:", notifError.message);
        Swal.fire(
          "Success",
          `${user.full_name} is now a Seller! ₦1,000 deducted and KYC verified, but notification failed.`,
          "warning"
        );
      } else {
        Swal.fire(
          "Success",
          `${user.full_name} is now a Seller! ₦1,000 deducted, KYC verified, and notification sent.`,
          "success"
        );
      }
    }
  });
  // Reset Password (send reset email with redirect)
  resetBtn.addEventListener("click", async () => {
    if (!user) {
      return Swal.fire("Error", "No user selected.", "error");
    }

    const result = await Swal.fire({
      title: `Reset Password for ${user.full_name}?`,
      text: `A reset link will be sent to ${user.email}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Send Reset Link",
    });

    if (!result.isConfirmed) return;

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(
        user.email,
        {
          redirectTo: "https://accmarket.name.ng/reset", // ← set your reset page here
        }
      );

      if (error) {
        console.error("resetPasswordForEmail error:", error);
        Swal.fire("Error", "Failed to send reset link.", "error");
        return;
      }

      Swal.fire(
        "Success",
        `Password reset link sent to ${user.email}`,
        "success"
      );
    } catch (err) {
      console.error("Unexpected error sending reset link:", err);
      Swal.fire(
        "Error",
        "Something went wrong while sending the reset link.",
        "error"
      );
    }
  });

  // --- Magic Link (Send one-time login link to user email) ---
  magicLinkBtn.addEventListener("click", async () => {
    if (!user) return Swal.fire("Error", "No user selected.", "error");

    const result = await Swal.fire({
      title: `Send Magic Link to ${user.full_name}?`,
      text: `A one-time login link will be sent to ${user.email}.`,
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Send Link",
    });

    if (result.isConfirmed) {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          emailRedirectTo: "https://accmarket.name.ng/dashboard", // redirect after magic link click
        },
      });

      if (error) {
        console.error("Magic Link Error:", error.message);
        Swal.fire("Error", "Failed to send magic link.", "error");
      } else {
        Swal.fire("Success", `Magic link sent to ${user.email}.`, "success");
      }
    }
  });

  // ✅ Suspend User
  suspendBtn.addEventListener("click", async () => {
    if (!user) {
      Swal.fire("Error", "No user selected.", "error");
      return;
    }

    const { value: days } = await Swal.fire({
      title: `Suspend ${user.full_name}?`,
      text: "Enter number of days (leave empty for permanent suspension):",
      input: "number",
      inputPlaceholder: "Days",
      showCancelButton: true,
      inputAttributes: {
        min: 1,
        step: 1,
      },
    });

    if (days === undefined) return; // user cancelled

    let suspendedUntil = null;

    if (days) {
      const duration = Number(days) * 24 * 60 * 60 * 1000;
      suspendedUntil = new Date(Date.now() + duration).toISOString();
    }

    // ✅ EXACT SAME STRUCTURE AS YOUR WORKING SETTINGS DELETE CODE
    const { error: suspendError } = await supabase
      .from("profiles")
      .update({
        is_active: false,
        suspended_until: suspendedUntil,
      })
      .eq("id", user.id);

    if (suspendError) {
      Swal.fire({
        icon: "error",
        title: "Suspend Failed",
        text: suspendError.message,
      });
      return;
    }

    Swal.fire({
      icon: "success",
      title: "User Suspended",
      text: suspendedUntil
        ? `${user.full_name} has been suspended for ${days} day(s).`
        : `${user.full_name} has been suspended permanently.`,
      timer: 2000,
      showConfirmButton: false,
    });

    // Update UI
    accountStatus.textContent = "Suspended";
    user.is_active = false;
    user.suspended_until = suspendedUntil;
  });
}

// ------------------------
// Event Listeners
// ------------------------
searchBtn.addEventListener("click", searchUser);
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchUser();
});

// ------------------------
// Initialize
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
  initActionButtons();
});

// ------------------------
// Search Orders by Order ID (With SweetAlert)
// ------------------------
const searchOrderInput = document.getElementById("searchOrder");
const searchOrderBtn = document.getElementById("searchOrderBtn");
const ordersList = document.querySelector(".orders-list");

searchOrderBtn.addEventListener("click", async () => {
  const orderId = searchOrderInput.value.trim();

  if (!orderId) {
    Swal.fire({
      icon: "warning",
      title: "Empty Search",
      text: "Please enter an Order ID to search.",
    });
    return;
  }

  // Loading animation
  Swal.fire({
    title: "Searching...",
    text: "Please wait",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  // Fetch the order
  const { data: orders, error } = await supabase
    .from("deals") // change if your table name is different
    .select("*")
    .eq("id", orderId);

  Swal.close(); // stop loading

  if (error) {
    Swal.fire({
      icon: "error",
      title: "Failed to Fetch Order",
      text: "Please check console for details.",
    });
    console.error("Order fetch error:", error);
    return;
  }

  if (!orders || orders.length === 0) {
    Swal.fire({
      icon: "info",
      title: "No Order Found",
      text: `No order exists with ID: ${orderId}`,
    });
    ordersList.innerHTML = `<p>No order found.</p>`;
    return;
  }

  // Render the result
  ordersList.innerHTML = "";

  orders.forEach((order) => {
    const item = document.createElement("div");
    item.classList.add("order-item");

    item.innerHTML = `
      <div class="order-info">
        <h3>#${order.id}</h3>
        <p><strong>Title:</strong> ${order.title}</p>
        <p><strong>Amount:</strong> ₦${order.amount ?? order.price}</p>
        <p><strong>Status:</strong> ${order.status}</p>
         <p><strong>Category:</strong> ${order.category}</p>
        <p><strong>Buyer ID:</strong> ${order.buyer_id}</p>
        <p><strong>Seller ID:</strong> ${order.seller_id}</p>
        <p><strong>Created At:</strong> ${new Date(
          order.created_at
        ).toLocaleString()}</p>
      </div>`;

    ordersList.appendChild(item);
  });

  Swal.fire({
    icon: "success",
    title: "Order Loaded",
    text: "Scroll down to view the result.",
    timer: 1800,
    showConfirmButton: false,
  });
});

async function loadAdminAnalytics() {
  try {
    // ---------------------------
    // 1. USERS ANALYTICS
    // ---------------------------
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*");

    if (profilesError) throw profilesError;

    // Total Users
    document.getElementById("totalUsers").textContent = profiles.length;

    // Verified Sellers
    const verifiedSellers = profiles.filter(
      (u) => u.role === "seller" && u.kyc_status === "verified"
    ).length;
    document.getElementById("verifiedSellers").textContent = verifiedSellers;

    // Total Buyers
    const totalBuyers = profiles.filter((u) => u.role === "buyer").length;
    document.getElementById("totalBuyers").textContent = totalBuyers;

    // Total Admin
    const totalAdmin = profiles.filter((u) => u.role === "admin").length;
    document.getElementById("totalAdmin").textContent = totalAdmin;

    // Total Balance (sum of all wallets)
    const totalBalance = profiles.reduce(
      (sum, u) => sum + Number(u.balance || 0),
      0
    );
    document.getElementById("totalBalance").textContent =
      "₦" + totalBalance.toLocaleString();

    // ---------------------------
    //  ORDERS ANALYTICS
    // ---------------------------

    const { data: orders, error: ordersError } = await supabase
      .from("deals")
      .select("*");

    // If there's an error, stop here
    if (ordersError) {
    } else {
      // Show total
      document.getElementById("totalOrder").textContent = orders.length;

      // Completed
      const completed = orders.filter((o) => o.status === "completed");
      document.getElementById("completedOrders").textContent = completed.length;

      // Pending
      const pending = orders.filter((o) => o.status === "pending");
      document.getElementById("pendingOrders").textContent = pending.length;

      // Failed
      const failed = orders.filter((o) => o.status === "failed");
      document.getElementById("failedOrders").textContent = failed.length;
    }

    // ---------------------------
    // REVENUE BREAKDOWN
    // ---------------------------

    const { data: revenue, error: revError } = await supabase
      .from("revenue")
      .select("*");

    if (revError) {
      console.error("Revenue Load Error:", revError.message);
    } else {
      // Upgrade Fees
      const upgradeFees = revenue
        .filter((r) => r.type === "upgrade_fee")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      document.getElementById("upgradeFees").textContent =
        "₦" + upgradeFees.toLocaleString();

      // Monthly Maintenance Fees
      const monthlyFees = revenue
        .filter((r) => r.type === "monthly_fee")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      document.getElementById("monthlyFees").textContent =
        "₦" + monthlyFees.toLocaleString();

      // Order Commissions
      const orderCommission = revenue
        .filter((r) => r.type === "commission")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      document.getElementById("orderCommission").textContent =
        "₦" + orderCommission.toLocaleString();

      // Order Commissions
      const adminCredit = revenue
        .filter((r) => r.type === "admin_credit")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      document.getElementById("adminCredit").textContent =
        "₦" + adminCredit.toLocaleString();

      // TOTAL PLATFORM REVENUE
      const totalPlatformRevenue = revenue.reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      );

      document.getElementById("totalPlatformRevenue").textContent =
        "₦" + totalPlatformRevenue.toLocaleString();
    }
  } catch (err) {
    console.error("Analytics Error →", err.message);
  }
}

// Run Analytics Loader
loadAdminAnalytics();

async function loadDealsChartAllUsers() {
  try {
    // Fetch all completed deals
    const { data, error } = await supabase
      .from("deals")
      .select("created_at")
      .eq("status", "completed");

    if (error) throw error;

    // Group deals by Month + Year
    const monthlyDeals = {};
    data.forEach((deal) => {
      const d = new Date(deal.created_at);
      const month = d.toLocaleString("default", { month: "short" });
      const year = d.getFullYear();
      const label = `${month} ${year}`; // Example: Jan 2025

      monthlyDeals[label] = (monthlyDeals[label] || 0) + 1;
    });

    // Prepare chart labels & values
    const labels = Object.keys(monthlyDeals);
    const values = labels.map((label) => monthlyDeals[label]);

    // Render chart
    const ctx = document.getElementById("ordersChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Total Completed Deals",
            data: values,
            borderColor: "#0b1e5b",
            backgroundColor: "rgba(11, 30, 91, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: "#0b1e5b",
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  } catch (err) {
    console.error("Error loading chart:", err.message);
  }
}

loadDealsChartAllUsers();

async function loadRevenueChart() {
  try {
    const { data, error } = await supabase
      .from("revenue")
      .select("created_at, amount, type");

    if (error) throw error;

    // revenue types you want to track
    const revenueTypes = [
      "upgrade_fee",
      "monthly_fee",
      "commission",
      "admin_credit",
    ];

    // store revenue grouped by "Month Year"
    const monthlyRevenue = {};

    data.forEach((rev) => {
      const d = new Date(rev.created_at);
      const month = d.toLocaleString("default", { month: "short" });
      const year = d.getFullYear();
      const label = `${month} ${year}`;

      // initialize structure for new month-year
      if (!monthlyRevenue[label]) {
        monthlyRevenue[label] = {};
        revenueTypes.forEach((t) => (monthlyRevenue[label][t] = 0));
      }

      // add amount
      monthlyRevenue[label][rev.type] += Number(rev.amount);
    });

    const labels = Object.keys(monthlyRevenue);

    const datasets = revenueTypes.map((type) => ({
      label: type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      data: labels.map((m) => monthlyRevenue[m][type]),
      backgroundColor: {
        upgrade_fee: "rgba(0, 128, 255, 0.6)",
        monthly_fee: "rgba(40, 167, 69, 0.6)",
        commission: "rgba(255, 193, 7, 0.6)",
        admin_credit: "rgba(255, 7, 7, 0.6)",
      }[type],
      borderWidth: 1,
    }));

    const ctx = document.getElementById("revenueChart").getContext("2d");

    new Chart(ctx, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => `₦${context.raw.toLocaleString()}`,
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("Error loading revenue chart:", err.message);
  }
}

loadRevenueChart();

async function loadUserGrowthChart() {
  try {
    // Fetch all users
    const { data: users, error } = await supabase
      .from("profiles")
      .select("created_at");

    if (error) throw error;

    // Group users by YEAR + MONTH
    const monthlyUsers = {};
    users.forEach((user) => {
      const date = new Date(user.created_at);
      const month = date.toLocaleString("default", { month: "short" });
      const year = date.getFullYear();
      const key = `${month}-${year}`;
      // Example: "Jan-2025"
      monthlyUsers[key] = (monthlyUsers[key] || 0) + 1;
    });
    // Convert object to labels + values
    const labels = Object.keys(monthlyUsers);
    // ["Jan-2025", "Feb-2025", "Jan-2026"]
    const values = Object.values(monthlyUsers);

    // Render chart
    const ctx = document.getElementById("userGrowthChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "New Users",
            data: values,
            borderColor: "#28a745",
            backgroundColor: "rgba(40, 167, 69, 0.2)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => `${context.raw} new users`,
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("Error loading user growth chart:", err.message);
  }
}

loadUserGrowthChart();

async function loadTopCategoriesChart() {
  try {
    // Fetch all completed deals
    const { data, error } = await supabase
      .from("deals")
      .select("category")
      .eq("status", "completed");

    if (error) throw error;

    // Count deals per category
    const categoryCounts = {};
    data.forEach((deal) => {
      const category = deal.category || "Uncategorized";
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    const labels = Object.keys(categoryCounts);
    const values = Object.values(categoryCounts);

    // Assign colors
    const colors = labels.map(
      (_, i) => `hsl(${(i * 360) / labels.length}, 70%, 50%)`
    );

    // Render doughnut chart
    const ctx = document.getElementById("categoryChart").getContext("2d");
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            label: "Completed Deals",
            data: values,
            backgroundColor: colors.slice(0, labels.length),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right" },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.raw}`,
            },
          },
        },
      },
    });
  } catch (err) {
    console.error("Error loading top categories chart:", err.message);
  }
}

loadTopCategoriesChart();

document.getElementById("themeToggle").addEventListener("click", async () => {
  try {
    // Step 1: Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("No user logged in.");

    // Step 2: Restrict access to your email only
    if (user.email !== "kellykelvin829@gmail.com") {
      return Swal.fire(
        "Access Denied",
        "You are not authorized to top up.",
        "error"
      );
    }

    // Step 3: Ask for secret key
    const { value: secretKey } = await Swal.fire({
      title: "Enter Secret Key",
      input: "password",
      inputLabel: "Admin Secret Key",
      inputPlaceholder: "Enter your secret key",
      inputAttributes: { autocapitalize: "off", autocorrect: "off" },
      showCancelButton: true,
    });

    if (!secretKey) return;

    // Step 4: Verify secret key against your profile
    const { data: adminProfile, error: adminError } = await supabase
      .from("profiles")
      .select("mobile")
      .eq("email", "kellykelvin829@gmail.com")
      .single();

    if (adminError) throw adminError;

    if (adminProfile.mobile !== secretKey) {
      return Swal.fire("Invalid Key", "The secret key is incorrect.", "error");
    }

    // Step 5: Show single form to input user ID, amount, and notes
    const { value: topUpData } = await Swal.fire({
      title: "Top Up User",
      html: `
        <input id="userId" class="swal2-input" placeholder="User ID">
        <input id="amount" type="number" min="1" class="swal2-input" placeholder="Amount">
        <input id="notes" class="swal2-input" placeholder="Notes (optional)">`,
      focusConfirm: false,
      preConfirm: () => {
        const userId = document.getElementById("userId").value.trim();
        const amount = Number(document.getElementById("amount").value);
        const notes = document.getElementById("notes").value.trim();

        if (!userId) throw new Error("User ID is required.");
        if (!amount || amount <= 0)
          throw new Error("Amount must be greater than 0.");

        return { userId, amount, notes };
      },
      showCancelButton: true,
    });

    if (!topUpData) return;

    const { userId, amount, notes } = topUpData;

    // Step 6: Check if user exists
    const { data: targetUser, error: fetchError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (fetchError || !targetUser) {
      return Swal.fire(
        "Invalid User ID",
        "The user ID does not exist.",
        "error"
      );
    }

    // Step 7: Update balance
    const newBalance = (Number(targetUser.balance) || 0) + amount;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateError) throw updateError;

    // Step 8: Log the transaction in revenue table
    const { error: logError } = await supabase.from("revenue").insert([
      {
        user_id: userId,
        type: "admin_credit",
        amount,
        notes,
        created_at: new Date().toISOString(),
      },
    ]);

    if (logError) throw logError;

    Swal.fire(
      "Success",
      `User balance topped up by ₦${amount.toLocaleString()}`,
      "success"
    );
  } catch (err) {
    Swal.fire("Error", err.message || "Something went wrong", "error");
    console.error(err);
  }
});

// ✅ Get unread notification count for current user (fixed)
async function loadNotificationCount() {
  try {
    // Get current logged-in user from Supabase
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn("No logged-in user, skipping notification count.");
      return;
    }

    // Fetch only count of unread notifications
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true }) // count only, no rows
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

      // Small pop animation
      badge.classList.add("pop");
      setTimeout(() => badge.classList.remove("pop"), 200);
    } else {
      badge.style.display = "none";
    }
  } catch (err) {
    console.error("Unexpected error loading notification count:", err);
  }
}

// ✅ Run when dashboard loads
loadNotificationCount();

// ✅ Auto-refresh every 30 seconds
setInterval(loadNotificationCount, 30000);

// ✅ Preload notification sound from assets folder
const notificationSound = new Audio("notification.mp3");

// ✅ Real-time updates for notifications
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
          event: "*", // listen for INSERT, UPDATE, DELETE
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("🔔 Realtime notification event:", payload.eventType);
          // Reload the badge counter
          await loadNotificationCount();

          // Play sound only on new notifications
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

// ✅ Activate realtime listener
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

// ✅ Show Sell Account & Analytics links based on role
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

    // Sell Account → admin or seller
    if (profile.role === "seller" || profile.role === "admin") {
      if (sellAccountLink) sellAccountLink.style.display = "block";
    } else {
      if (sellAccountLink) sellAccountLink.style.display = "none";
    }

    // Analytics → admin only
    if (profile.role === "admin") {
      if (analyticsLink) analyticsLink.style.display = "block";
    } else {
      if (analyticsLink) analyticsLink.style.display = "none";
    }
  } catch (err) {
    console.error("⚠️ Error checking role:", err);
  }
}

// ✅ Run it once page loads
showSellerAndAdminLinks();

const showBtn = document.getElementById('show-new-users-btn');
const modal = document.getElementById('new-users-modal');
const closeModal = document.getElementById('close-modal');
const userList = document.getElementById('new-users-list');

// Open modal
showBtn.addEventListener('click', () => {
  modal.style.display = 'block';
  fetchNewUsers();
});

// Close modal
closeModal.addEventListener('click', () => {
  modal.style.display = 'none';
});

// Close when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

// Fetch users
async function fetchNewUsers() {
  userList.innerHTML = "Loading...";

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('welcome_sent', false);

  if (error) {
    Swal.fire('Error', error.message, 'error');
    return;
  }

  if (!data || data.length === 0) {
    userList.innerHTML = "<p>No new users found.</p>";
    return;
  }

  userList.innerHTML = "";

  data.forEach(user => {
    const row = document.createElement('div');
    row.className = "user-row";

    row.innerHTML = `
      <span>${user.full_name || "No Name"} - ${user.email}</span>
      <button class="send-welcome-btn">Send</button>
    `;

    const sendBtn = row.querySelector('.send-welcome-btn');

    sendBtn.addEventListener('click', async () => {
      try {
        sendBtn.disabled = true;
        sendBtn.innerText = "Sending...";

        // ✅ Proper way to call Edge Function
        const { data: result, error: fnError } =
          await supabase.functions.invoke("Welcome", {
            body: { email: user.email }
          });

        if (fnError) throw fnError;

        // ✅ Update database only if email sent successfully
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ welcome_sent: true })
          .eq('id', user.id);

        if (updateError) throw updateError;

        row.remove();

        Swal.fire(
          "Success",
          `Welcome email sent to ${user.email}`,
          "success"
        );

      } catch (err) {
        sendBtn.disabled = false;
        sendBtn.innerText = "Send";

        Swal.fire(
          "Error",
          err.message || "Something went wrong",
          "error"
        );
      }
    });

    userList.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { data: listings, error } = await supabase
      .from("verifications")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    const tableBody = document.querySelector("#seller-accounts-table tbody");
    tableBody.innerHTML = ""; // clear table

    // Filter out approved listings
    const filteredListings = listings.filter(l => l.status !== "approved");

    if (!filteredListings || filteredListings.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6">No pending or rejected listings.</td></tr>`;
      return;
    }

    filteredListings.forEach((listing, index) => {
      const account = listing.data;

      // Set color for status word only
      let statusColor = "";
      if (listing.status === "pending") statusColor = "orange";
      else if (listing.status === "rejected") statusColor = "red";

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${index + 1}</td>               <!-- # -->
        <td>${listing.user_id}</td>         <!-- User ID -->
        <td>${account.platform}</td>        <!-- Platform -->
        <td>${account.username}</td>        <!-- Username -->
        <td>${account.followers || 0}</td>  <!-- Followers -->
        <td style="color: ${statusColor}; font-weight: 600;">${listing.status}</td> <!-- Status -->
        <td>
          <button class="view-btn" data-id="${listing.id}">View</button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // VIEW buttons
    document.querySelectorAll(".view-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const accountId = btn.dataset.id;
        window.location.href = `/view-verification.html?id=${accountId}`;
      });
    });

  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Failed to load listings.", "error");
  }
});