// blog.js - Initialize Supabase
const supabaseUrl = "https://qihzvglznpkytolxkuxz.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpaHp2Z2x6bnBreXRvbHhrdXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTc4NDIsImV4cCI6MjA3NTUzMzg0Mn0.VHyy3_Amr-neYoudHudoW-TJwNPfhkRV2TTCfVgY_zM";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// === Register User ===
const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const username = document.getElementById("username").value.trim();

    // Show loading alert
    Swal.fire({
      title: "Creating Account...",
      text: "Please wait while we register your account.",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/verify.html`,
      },
    });

    Swal.close(); // Close loading spinner

    if (error) {
      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: error.message,
      });
    } else {
      Swal.fire({
        icon: "success",
        title: "Verification Email Sent!",
        text: "✅ Please check your email to verify your account.",
        confirmButtonText: "OK",
      });
      registerForm.reset();
    }
  });
}
// === Login User ===
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const remember = document.getElementById("remember-me").checked;

    // Show loading state
    Swal.fire({
      title: "Logging In...",
      text: "Please wait while we verify your credentials.",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    Swal.close(); // Close the loading alert

    if (error) {
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: error.message,
      });
    } else {
      // Remember me: persistent or temporary session
      if (remember) {
        localStorage.setItem("supabaseSession", JSON.stringify(data.session));
      } else {
        sessionStorage.setItem("supabaseSession", JSON.stringify(data.session));
      }

      Swal.fire({
        icon: "success",
        title: "Login Successful!",
        text: "Welcome back 👋",
        showConfirmButton: false,
        timer: 2000,
      });

      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = "dashboard.html"; // your dashboard page
      }, 1800);
    }
  });
}

// === Forgot Password (with SweetAlert2) ===
const resetBn = document.getElementById("reset-btn");
if (resetBtn) {
  resetBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = document.getElementById("reset-email").value.trim();

    if (!email) {
      Swal.fire({
        icon: "warning",
        title: "Missing Email",
        text: "Please enter your email address.",
      });
      return;
    }

    // Show loading alert
    Swal.fire({
      title: "Sending Reset Link...",
      text: "Please wait while we process your request.",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset.html`,
    });

    Swal.close(); // Close loading alert

    if (error) {
      Swal.fire({
        icon: "error",
        title: "Failed to Send Email",
        text: error.message,
      });
    } else {
      Swal.fire({
        icon: "success",
        title: "Email Sent!",
        text: "Check your inbox for the password reset link.",
        showConfirmButton: false,
        timer: 2500,
      });
      closeForgotModal();
    }
  });
}






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

// ------------------------
// Check Admin Access
// ------------------------
async function checkAdminAccess() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    alert("You must be logged in as admin to view this page");
    window.location.href = "/";
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile.role !== "admin") {
    alert("Access denied. Admins only.");
    window.location.href = "/";
    return false;
  }

  return true;
}

// ------------------------
// Search User
// ------------------------
async function searchUser() {
  const query = searchInput.value.trim();
  if (!query) {
    Swal.fire({ icon: 'warning', title: 'Empty Search', text: 'Please enter a username, email or User ID.' });
    return;
  }

  try {
    const { data: users, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${query}%,email.ilike.%${query}%,id.eq.${query}`)
      .limit(1);

    if (error) {
      console.error("Error fetching user:", error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Error fetching user.' });
      return;
    }

    if (!users || users.length === 0) {
      Swal.fire({ icon: 'info', title: 'Not Found', text: 'No user matches your search.' });
      return;
    }

    populateUserOverview(users[0]);
    Swal.fire({ icon: 'success', title: 'User Found', text: 'User data loaded successfully!', timer: 1500, showConfirmButton: false });

  } catch (err) {
    console.error(err);
    Swal.fire({ icon: 'error', title: 'Error', text: 'Something went wrong.' });
  }
}
// ------------------------
// Populate Overview
// ------------------------
function populateUserOverview(user) {
  userFullName.textContent = user.full_name || "N/A";
  userEmail.textContent = user.email || "N/A";
  userRole.textContent = user.role || "N/A";
 if (user.kyc_status === "verified") {
  verifyStatus.textContent = "Verified";
  verifyStatus.className = "verify-tag verified";
} 
else if (user.kyc_status === "pending") {
  verifyStatus.textContent = "Pending";
  verifyStatus.className = "verify-tag pending";
} 
else {
  verifyStatus.textContent = "Not Verified";
  verifyStatus.className = "verify-tag not-verified";
}
  userJoined.textContent = new Date(user.created_at).toLocaleDateString();
  userUsername.textContent = user.username || "N/A";
  userPhone.textContent = user.phone || "N/A";
  accountStatus.textContent = user.is_active ? "Active" : "Suspended";
  userCountry.textContent = user.country || "N/A";
  userCountryFlag.textContent = user.country_flag || "N/A";
  userAbout.textContent = user.about || "N/A";
  walletBalance.textContent = `₦${Number(user.balance || 0).toLocaleString()}`;
  totalOrders.textContent = user.total_deals || 0;
  totalSpent.textContent = `₦${Number(user.total_earnings || 0).toLocaleString()}`;
  accountsSold.textContent = user.accounts_sold || 0;
  lastLogin.textContent = user.last_ip || "N/A";
  loginDevice.textContent = user.last_device || "N/A";
  telegramChatID.textContent = user.telegram_chat_id || "N/A";
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
(async function init() {
  const isAdmin = await checkAdminAccess();
  if (!isAdmin) return;
})();

// --- Action Buttons ---
const upgradeBtn = document.querySelector(".upgrade-user");
const resetBtn = document.querySelector(".reset-password");
const suspendBtn = document.querySelector(".toggle-status");

// --- Upgrade User (Buyer → Seller & deduct ₦1,000) ---
upgradeBtn.addEventListener("click", async () => {
  const result = await Swal.fire({
    title: "Upgrade User?",
    text: `This will upgrade ${user.full_name} from Buyer to Seller and deduct ₦1,000 from their balance.`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Upgrade",
  });

  if (result.isConfirmed) {
    if (Number(user.balance) < 1000) {
      Swal.fire("Error", `${user.full_name} does not have enough balance.`, "error");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        role: "seller",
        balance: Number(user.balance) - 1000
      })
      .eq("id", user.id);

    if (error) {
      Swal.fire("Error", "Failed to upgrade user.", "error");
    } else {
      Swal.fire("Success", `${user.full_name} is now a Seller! ₦1,000 deducted.`, "success");
      user.role = "seller";
      user.balance = Number(user.balance) - 1000;
      userRole.textContent = user.role;
      walletBalance.textContent = `₦${user.balance.toLocaleString()}`;
    }
  }
});

// --- Reset Password (Send Reset Link) ---
resetBtn.addEventListener("click", async () => {
  const result = await Swal.fire({
    title: `Reset Password for ${user.full_name}?`,
    text: `A reset link will be sent to ${user.email}`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Send Reset Link",
  });

  if (result.isConfirmed) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) {
      Swal.fire("Error", "Failed to send reset link.", "error");
    } else {
      Swal.fire("Success", `Password reset link sent to ${user.email}`, "success");
    }
  }
});

// --- Suspend User (is_active & suspended_until) ---
suspendBtn.addEventListener("click", async () => {
  const { value: days } = await Swal.fire({
    title: `Suspend ${user.full_name}`,
    text: "Enter suspension duration in days (leave blank for permanent):",
    input: "number",
    inputPlaceholder: "Number of days",
    showCancelButton: true,
    inputAttributes: { min: 1, step: 1 }
  });

  if (days !== undefined) {
    let suspendedUntil = null;
    if (days) {
      const durationMs = Number(days) * 24 * 60 * 60 * 1000;
      suspendedUntil = new Date(Date.now() + durationMs).toISOString();
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        is_active: false,
        suspended_until: suspendedUntil
      })
      .eq("id", user.id);

    if (error) {
      Swal.fire("Error", "Failed to suspend user.", "error");
    } else {
      Swal.fire(
        "Success",
        suspendedUntil
          ? `${user.full_name} has been suspended for ${days} day(s).`
          : `${user.full_name} has been suspended permanently.`,
        "success"
      );
      accountStatus.textContent = "Suspended";
      user.is_active = false;
      user.suspended_until = suspendedUntil;
    }
  }
});