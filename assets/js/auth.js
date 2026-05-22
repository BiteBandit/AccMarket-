// ==========================================
// 1. TURNSTILE TOKEN UTILITIES
// ==========================================
/**
 * Safely fetches the current Turnstile token from a widget container.
 * @param {string} selector - The CSS selector of the turnstile element (e.g., '#login-turnstile')
 * @returns {string|null} The token string if validated, otherwise null.
 */
function getTurnstileToken(selector) {
  if (typeof turnstile !== "undefined") {
    return turnstile.getResponse(selector);
  }
  return null;
}


// ==========================================
// 2. MODULE IMPORTS
// ==========================================
import { supabase } from './supabase-config.js'

// ==========================================
// 3. SIDEBARS & NAVIGATION UI LOGIC
// ==========================================
const sidebarToggle = document.getElementById("sidebarToggle");
const leftSidebar = document.getElementById("leftSidebar");
const closeLeft = document.getElementById("closeLeft");

if (sidebarToggle && leftSidebar && closeLeft) {
  sidebarToggle.addEventListener("click", () => {
    leftSidebar.classList.add("active");
  });
  closeLeft.addEventListener("click", () => {
    leftSidebar.classList.remove("active");
  });
}

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

// ==========================================
// 4. AUTH SECTION SWITCHING ANIMATIONS
// ==========================================
const registerSection = document.getElementById("register-section");
const loginSection = document.getElementById("login-section");
const goToLogin = document.getElementById("go-to-login");
const goToRegister = document.getElementById("go-to-register");
const illustration = document.querySelector(".auth-illustration");
const formSections = document.querySelectorAll(".auth-form");

function fadeIllustration() {
  if (illustration) {
    illustration.classList.remove("show");
    setTimeout(() => {
      illustration.classList.add("show");
    }, 100);
  }
}

function fadeForm() {
  formSections.forEach((form) => form.classList.remove("show"));
  setTimeout(() => {
    const activeForm = document.querySelector(".auth-section.active .auth-form");
    if (activeForm) activeForm.classList.add("show");
  }, 100);
}

const switchAuthMode = (e, showLogin) => {
  e.preventDefault();
  if (showLogin) {
    if (registerSection) registerSection.classList.remove("active");
    if (loginSection) loginSection.classList.add("active");
  } else {
    if (loginSection) loginSection.classList.remove("active");
    if (registerSection) registerSection.classList.add("active");
  }
  fadeIllustration();
  fadeForm();
};

if (goToLogin) goToLogin.addEventListener("click", (e) => switchAuthMode(e, true));
if (goToRegister) goToRegister.addEventListener("click", (e) => switchAuthMode(e, false));

window.addEventListener("load", () => {
  if (illustration) illustration.classList.add("show");
  fadeForm();
});

// ==========================================
// 5. FORGOT PASSWORD MODAL UTILITIES
// ==========================================
const forgotLink = document.querySelector(".forgot-link");
const forgotModal = document.getElementById("forgot-modal");

if (forgotLink && forgotModal) {
  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    forgotModal.classList.add("show");
  });
}

// Exposed globally to handle HTML inline onclick attributes safely
window.closeForgotModal = function() {
  if (forgotModal) forgotModal.classList.remove("show");
}

window.addEventListener("click", (e) => {
  if (e.target === forgotModal) window.closeForgotModal();
});

// ==========================================
// 6. BACK TO TOP BUTTON LOGIC
// ==========================================
const backToTop = document.getElementById("backToTop");
if (backToTop) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      backToTop.style.display = "flex";
    } else {
      backToTop.style.display = "none";
    }
  });

  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ==========================================
// 7. INTERACTIVE ENTRY FIELD HELPERS
// ==========================================

// Password Strength Meter
document.addEventListener("DOMContentLoaded", () => {
  const passwordInput = document.getElementById("password"); 
  const strengthContainer = document.querySelector(".password-strength");
  const strengthBar = document.querySelector(".strength-bar");
  const strengthText = document.querySelector(".strength-text");

  if (!passwordInput || !strengthContainer || !strengthBar || !strengthText) return;

  passwordInput.addEventListener("input", () => {
    const value = passwordInput.value.trim();
    if (value.length === 0) {
      strengthContainer.classList.add("hidden");
      return;
    }

    strengthContainer.classList.remove("hidden");
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;

    strengthBar.className = "strength-bar"; 
    if (score <= 1) {
      strengthBar.classList.add("weak");
      strengthText.textContent = "Weak";
    } else if (score <= 3) {
      strengthBar.classList.add("medium");
      strengthText.textContent = "Medium";
    } else {
      strengthBar.classList.add("strong");
      strengthText.textContent = "Strong";
    }
    
    if (score === 4 && window.navigator.vibrate) window.navigator.vibrate(15);
  });
});

// Password Match Checker
const passwordField = document.getElementById("password");
const confirmPasswordField = document.getElementById("confirm-password");

if (passwordField && confirmPasswordField) {
  const matchMsg = document.createElement("p");
  matchMsg.className = "password-match-msg hidden";
  confirmPasswordField.closest(".form-group").appendChild(matchMsg);

  function checkPasswordMatch() {
    const pass = passwordField.value;
    const confirmPass = confirmPasswordField.value;

    if (confirmPass.length === 0) {
      matchMsg.classList.add("hidden");
      confirmPasswordField.classList.remove("vibrate");
      return;
    }

    matchMsg.classList.remove("hidden");
    if (pass === confirmPass) {
      matchMsg.textContent = "✅ Passwords match";
      matchMsg.style.color = "green";
      confirmPasswordField.classList.remove("vibrate");
    } else {
      matchMsg.textContent = "❌ Passwords do not match";
      matchMsg.style.color = "red";
      confirmPasswordField.classList.add("vibrate");
      setTimeout(() => confirmPasswordField.classList.remove("vibrate"), 300);
    }
  }

  passwordField.addEventListener("input", checkPasswordMatch);
  confirmPasswordField.addEventListener("input", checkPasswordMatch);
}

// Password Visibility Toggle
document.addEventListener("click", (e) => {
  const toggleBtn = e.target.closest(".eye-icon");
  if (toggleBtn) {
    const input = toggleBtn.parentElement.querySelector("input");
    if (input) {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggleBtn.classList.toggle("visible", !isPassword);
      toggleBtn.style.opacity = isPassword ? "1" : "0.6";
      if (window.navigator.vibrate) window.navigator.vibrate(25);
    }
  }
});

// ==========================================
// 8. SUPABASE & SECURE AUTENTICATION TRANSACTION HANDLERS
// ==========================================

// Register User Request
const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const termsCheckbox = document.getElementById("terms");
    const isTermsAccepted = termsCheckbox ? termsCheckbox.checked : false;

    const token = getTurnstileToken("#register-turnstile");
    if (!token) {
      Swal.fire({ 
        title: 'Security Check', 
        text: 'Please fulfill the security verification challenge.', 
        icon: 'warning', 
        confirmButtonColor: '#0b1e5b' 
      });
      return;
    }

    if (!email || !password) {
      Swal.fire({ title: 'Account Creation', text: 'Please fill in all mandatory fields.', icon: 'warning', confirmButtonColor: '#0b1e5b' });
      if (typeof turnstile !== "undefined") turnstile.reset("#register-turnstile");
      return;
    }

    if (password !== confirmPassword) {
      Swal.fire({ title: 'Security Verification', text: 'The passwords entered do not match.', icon: 'error', confirmButtonColor: '#0b1e5b' });
      if (typeof turnstile !== "undefined") turnstile.reset("#register-turnstile");
      return;
    }

    if (!isTermsAccepted) {
      Swal.fire({ title: 'Policy Agreement', text: 'You must review and agree to the Terms & Policies to proceed.', icon: 'info', confirmButtonColor: '#0b1e5b' });
      termsCheckbox.parentElement.classList.add('vibrate');
      setTimeout(() => termsCheckbox.parentElement.classList.remove('vibrate'), 300);
      if (typeof turnstile !== "undefined") turnstile.reset("#register-turnstile");
      return;
    }

    Swal.fire({ 
      title: 'Processing Request', 
      html: 'Validating credentials and setting up your profile...', 
      allowOutsideClick: false, 
      showConfirmButton: false, 
      didOpen: () => Swal.showLoading() 
    });

    try {
      const { data: existingProfile } = await supabase.from("profiles").select("email").eq("email", email).maybeSingle();

      if (existingProfile) {
        Swal.fire({
          title: 'Account Exists',
          html: `An account associated with <b>${email}</b> is already registered. Would you like to log in instead?`,
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: 'Proceed to Login',
          confirmButtonColor: '#0b1e5b'
        }).then((res) => { if (res.isConfirmed) document.getElementById('go-to-login').click(); });
        if (typeof turnstile !== "undefined") turnstile.reset("#register-turnstile");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          emailRedirectTo: "https://accmarket.name.ng/verify.html",
          captchaToken: token 
        }
      });

      if (error) {
        Swal.fire({ title: 'Registration Failed', text: error.message, icon: 'error', confirmButtonColor: '#0b1e5b' });
        // Fixed: Removed old window.turnstileTokens line that would cause execution to crash here
        if (typeof turnstile !== "undefined") turnstile.reset("#register-turnstile");
        return;
      }

      if (data?.user) {
        registerForm.reset();
        if (typeof turnstile !== "undefined") turnstile.reset("#register-turnstile");
        Swal.fire({ 
          icon: 'success', 
          title: 'Verification Link Sent', 
          html: `A verification link has been successfully dispatched to <b>${email}</b>.<br><br><small style="color: #666;">If you do not see it in a few minutes, please check your <b>Spam</b> or <b>Junk</b> folders.</small>`, 
          confirmButtonColor: '#0b1e5b' 
        });
      } else {
        // Fixed: Removed old window.turnstileTokens line that would cause execution to crash here
        if (typeof turnstile !== "undefined") turnstile.reset("#register-turnstile");
        Swal.fire({ 
          icon: 'info', 
          title: 'Check Your Inbox', 
          html: `If this email address is new to our network, a verification link has been dispatched to <b>${email}</b>.<br><br><small style="color: #666;">Please check your <b>Spam</b> or <b>Junk</b> folders if the message does not arrive shortly.</small>`, 
          confirmButtonColor: '#0b1e5b' 
        });
      }

    } catch (err) {
      Swal.close();
      if (typeof turnstile !== "undefined") turnstile.reset("#register-turnstile");
      Swal.fire({ title: 'System Error', text: 'An unexpected internal error occurred. Please try again later or contact support.', icon: 'error', confirmButtonColor: '#0b1e5b' });
    }
  });
}

// Login User Request
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const remember = document.getElementById("rememberMe")?.checked ?? false;

    const token = getTurnstileToken("#login-turnstile");
    if (!token) {
      Swal.fire("Security Check", "Please fulfill the security verification challenge.", "warning");
      return;
    }

    if (!email || !password) {
      Swal.fire("Missing fields", "Please enter email and password.", "warning");
      if (typeof turnstile !== "undefined") turnstile.reset("#login-turnstile");
      return;
    }

    Swal.fire({ title: "Logging in...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { data, error } = await supabase.auth.signInWithPassword({ 
      email, 
      password,
      options: {
        captchaToken: token
      }
    });
    Swal.close();

    if (error) {
      Swal.fire("Login failed", error.message, "error");
      if (typeof turnstile !== "undefined") turnstile.reset("#login-turnstile");
      return;
    }

    const user = data.user;
    if (!user.confirmed_at) {
      Swal.fire({ icon: "warning", title: "Email not verified", text: "Please verify your email." });
      if (typeof turnstile !== "undefined") turnstile.reset("#login-turnstile");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("is_active, last_ip, last_device, telegram_chat_id, telegram_alerts").eq("id", user.id).single();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      Swal.fire({ icon: "warning", title: "Account Deactivated", text: "Contact support to reactivate." });
      // Fixed: Removed old window.turnstileTokens line that would cause execution to crash here
      if (typeof turnstile !== "undefined") turnstile.reset("#login-turnstile");
      return;
    }

    // Device Tracking & Alerts
    try {
      const currentDevice = navigator.userAgent;
      const ipRes = await fetch("https://ipapi.co/json/");
      const ipData = await ipRes.json();
      const currentIP = ipData.ip || "0.0.0.0";

      if (profile?.telegram_alerts && profile.telegram_chat_id && (profile.last_ip !== currentIP || profile.last_device !== currentDevice)) {
        await fetch(`https://api.telegram.org/bot8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: profile.telegram_chat_id, text: `🔔 New login detected:\nDevice: ${currentDevice}\nIP: ${currentIP}` })
        });
      }
      await supabase.from("profiles").update({ last_ip: currentIP, last_device: currentDevice }).eq("id", user.id);
    } catch (err) { console.error("Tracking failed", err); }

    if (remember) {
      localStorage.setItem("supabaseSession", JSON.stringify(data.session));
    } else {
      sessionStorage.setItem("supabaseSession", JSON.stringify(data.session));
    }

    // Fixed: Removed old window.turnstileTokens line that would cause execution to crash here
    if (typeof turnstile !== "undefined") turnstile.reset("#login-turnstile");
    Swal.fire({ icon: "success", title: "Login successful", showConfirmButton: false, timer: 1400 });
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1200);
  });
}

// Forgot Password Transaction Handler
const forgotForm = document.getElementById("forgot-password-form");
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("forgot-email").value.trim();
    if (!email) {
      Swal.fire("Missing email", "Please enter your email.", "warning");
      return;
    }

    Swal.fire({ title: "Sending reset link...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: "https://accmarket.name.ng/reset.html" });
    Swal.close();

    if (error) {
      Swal.fire("Error", error.message, "error");
    } else {
      Swal.fire("Check your inbox", "Reset link sent.", "success");
      forgotForm.reset();
      if (typeof window.closeForgotModal === "function") window.closeForgotModal();
    }
  });
}
