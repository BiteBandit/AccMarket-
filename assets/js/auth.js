// Select elements
const sidebarToggle = document.getElementById("sidebarToggle");
const leftSidebar = document.getElementById("leftSidebar");
const closeLeft = document.getElementById("closeLeft");

// Left sidebar
sidebarToggle.addEventListener("click", () => {
  leftSidebar.classList.add("active");
});
closeLeft.addEventListener("click", () => {
  leftSidebar.classList.remove("active");
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

const registerSection = document.getElementById("register-section");
const loginSection = document.getElementById("login-section");
const goToLogin = document.getElementById("go-to-login");
const goToRegister = document.getElementById("go-to-register");
const illustration = document.querySelector(".auth-illustration");

function fadeIllustration() {
  illustration.classList.remove("show");
  setTimeout(() => {
    illustration.classList.add("show");
  }, 100);
}

goToLogin.addEventListener("click", (e) => {
  e.preventDefault();
  registerSection.classList.remove("active");
  loginSection.classList.add("active");
  fadeIllustration();
});

goToRegister.addEventListener("click", (e) => {
  e.preventDefault();
  loginSection.classList.remove("active");
  registerSection.classList.add("active");
  fadeIllustration();
});

// Initial animation when the page loads
window.addEventListener("load", () => {
  fadeIllustration();
});

const formSections = document.querySelectorAll(".auth-form");

function fadeForm() {
  formSections.forEach((form) => {
    form.classList.remove("show");
  });
  setTimeout(() => {
    const activeForm = document.querySelector(
      ".auth-section.active .auth-form"
    );
    if (activeForm) activeForm.classList.add("show");
  }, 100);
}

// Trigger form animation during switch
goToLogin.addEventListener("click", (e) => {
  e.preventDefault();
  registerSection.classList.remove("active");
  loginSection.classList.add("active");
  fadeIllustration();
  fadeForm();
});

goToRegister.addEventListener("click", (e) => {
  e.preventDefault();
  loginSection.classList.remove("active");
  registerSection.classList.add("active");
  fadeIllustration();
  fadeForm();
});

// On first load
window.addEventListener("load", () => {
  illustration.classList.add("show");
  fadeForm();
});



const forgotLink = document.querySelector(".forgot-link");
const forgotModal = document.getElementById("forgot-modal");

forgotLink.addEventListener("click", (e) => {
  e.preventDefault();
  forgotModal.classList.add("show");
});

function closeForgotModal() {
  forgotModal.classList.remove("show");
}

// Optional: close when clicking outside the modal
window.addEventListener("click", (e) => {
  if (e.target === forgotModal) {
    forgotModal.classList.remove("show");
  }
});

const backToTop = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
  if (window.scrollY > 300) {
    backToTop.style.display = "flex";
  } else {
    backToTop.style.display = "none";
  }
});

backToTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});

// === Auto Detect Country (using ipwho.is) ===
document.addEventListener("DOMContentLoaded", async () => {
  const countryNameEl = document.getElementById("country-name");
  const countryFlagEl = document.getElementById("country-flag");
  const countryCodeEl = document.getElementById("country-code");
  const countryInput = document.getElementById("country");

  try {
    const response = await fetch("https://ipwho.is/");
    const data = await response.json();

    const country = data.country || "Unknown";
    const countryCode = data.calling_code ? `+${data.calling_code}` : "+00";
    const countryFlag = data.country_code
      ? `https://flagsapi.com/${data.country_code}/flat/24.png`
      : "";

    // Display details
    countryNameEl.textContent = country;
    countryCodeEl.textContent = countryCode;
    countryInput.value = country;

    if (countryFlag) {
      countryFlagEl.innerHTML = `<img src="${countryFlag}" alt="${country}" style="width:24px;height:18px;">`;
    }
  } catch (error) {
    console.error("Country detection failed:", error);
    countryNameEl.textContent = "Unable to detect country";
    countryCodeEl.textContent = "+00";
    countryInput.value = "";
    countryFlagEl.innerHTML = "";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const passwordInput = document.getElementById("password"); // only for registration form
  const strengthContainer = document.querySelector(".password-strength");
  const strengthBar = document.querySelector(".strength-bar");
  const strengthText = document.querySelector(".strength-text");

  if (!passwordInput || !strengthContainer || !strengthBar || !strengthText)
    return;

  passwordInput.addEventListener("input", () => {
    const value = passwordInput.value.trim();

    if (value.length === 0) {
      strengthContainer.classList.add("hidden");
      return;
    }

    strengthContainer.classList.remove("hidden");

    let strength = 0;
    if (value.length >= 6) strength++;
    if (/[A-Z]/.test(value)) strength++;
    if (/[0-9]/.test(value)) strength++;
    if (/[^A-Za-z0-9]/.test(value)) strength++;

    switch (strength) {
      case 1:
        strengthBar.style.width = "25%";
        strengthBar.style.background = "red";
        strengthText.textContent = "Weak";
        break;
      case 2:
        strengthBar.style.width = "50%";
        strengthBar.style.background = "orange";
        strengthText.textContent = "Fair";
        break;
      case 3:
        strengthBar.style.width = "75%";
        strengthBar.style.background = "gold";
        strengthText.textContent = "Good";
        break;
      case 4:
        strengthBar.style.width = "100%";
        strengthBar.style.background = "green";
        strengthText.textContent = "Strong";
        break;
      default:
        strengthBar.style.width = "0";
        strengthText.textContent = "";
    }
  });
});

// === Password Match Checker (with Fade + Vibrate Animation) ===
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
      matchMsg.textContent = "";
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

      // Add vibration effect
      confirmPasswordField.classList.add("vibrate");

      // Remove class after animation ends so it can repeat next time
      setTimeout(() => {
        confirmPasswordField.classList.remove("vibrate");
      }, 300);
    }
  }

  passwordField.addEventListener("input", checkPasswordMatch);
  confirmPasswordField.addEventListener("input", checkPasswordMatch);
}

// === SVG Eye Toggle for Modules ===
document.addEventListener("click", (e) => {
  // Check if we clicked the SVG or a path inside the SVG
  const toggleBtn = e.target.closest(".password-toggle");
  
  if (toggleBtn) {
    // 1. Find the input sitting right next to the SVG
    const input = toggleBtn.parentElement.querySelector("input");
    
    if (input) {
      const isPassword = input.type === "password";
      
      // 2. Switch type
      input.type = isPassword ? "text" : "password";
      
      // 3. Visual Feedback: Change opacity or color of the eye
      toggleBtn.style.opacity = isPassword ? "1" : "0.5";
      
      // 4. Mobile haptic (vibration)
      if (window.navigator.vibrate) window.navigator.vibrate(10);
    }
  }
});



// blog.js - Initialize Supabase

import { supabase } from './supabase-config.js'
console.log("If this logs, the error is gone!", supabase)


// ---------- Helpers ----------
async function fetchGeoInfo() {
  try {
    const res = await fetch("https://ipwho.is/");
    if (!res.ok) return null;
    const raw = await res.json();
    return {
      country: raw.country || null,
      calling_code: raw.calling_code ? `+${raw.calling_code}` : null,
      country_code: raw.country_code || null,
      ip: raw.ip || null,
      raw,
    };
  } catch (err) {
    console.warn("Geo fetch failed", err);
    return null;
  }
}

async function upsertProfile(userId, payload = {}) {
  if (!userId) return { error: new Error("Missing userId") };
  payload.id = userId;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { returning: "minimal" });

  return { data, error };
}

// ---------- Register User with Supabase Email ----------
const registerForm = document.getElementById("register-form");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      Swal.fire(
        "Missing fields",
        "Email and password are required.",
        "warning"
      );
      return;
    }

    Swal.fire({
      title: "Creating account...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // 🔍 Check if email already exists in profiles table
      const { data: existing, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .limit(1);

      if (checkError) {
        Swal.close();
        Swal.fire("Error", checkError.message, "error");
        return;
      }

      if (existing && existing.length > 0) {
        Swal.close();
        await Swal.fire(
          "Email already registered",
          "Use another email.",
          "warning"
        );
        return;
      }

      // 🧑‍💻 Register new Supabase user (Supabase will handle sending confirmation email)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "https:accmarket.name.ng/verify.html", // page users go to after confirming
        },
      });

      Swal.close();

      if (error) {
        Swal.fire("Registration failed", error.message, "error");
        return;
      }

      if (!data?.user) {
        Swal.fire("Registration failed", "User not created.", "error");
        return;
      }

      // ✅ Success message
      Swal.fire(
        "Check your email",
        "A verification link has been sent. Please verify to activate your account.",
        "success"
      );

      registerForm.reset();
    } catch (err) {
      Swal.close();
      console.error("Registration exception:", err);
      Swal.fire("Error", "Something went wrong. Check console.", "error");
    }
  });
}

// ✅ Listen for verified users and send welcome email
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session?.user) {
    const user = session.user;

    // Only send welcome email if email is confirmed
    if (user.confirmed_at) {
      await fetch("https://qihzvglznpkytolxkuxz.supabase.co/functions/v1/Welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
    }
  }
});
// ----- login -----
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const remember = document.getElementById("rememberMe")?.checked ?? false;
      if (!email || !password) {
        Swal.fire(
          "Missing fields",
          "Please enter both email and password.",
          "warning"
        );
        return;
      }

      Swal.fire({
        title: "Logging in...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      Swal.close();

      if (error) {
        Swal.fire("Login failed", error.message, "error");
        return;
      }

      const user = data.user;
      if (!user) {
        Swal.fire("Login failed", "User data not available.", "warning");
        return;
      }

      // check if email is verified
      if (!user.confirmed_at) {
        Swal.fire({
          icon: "warning",
          title: "Email not verified",
          text: "Please verify your email before logging in.",
        });
        return;
      }

      // 🔍 Check if user is active in "profiles" table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .single();

      if (profileError) {
        Swal.fire({
          icon: "error",
          title: "Error Loading Profile",
          text: profileError.message,
        });
        return;
      }

      // 🚫 If account is deactivated
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();

        Swal.fire({
          icon: "warning",
          title: "Account Deactivated",
          text: "Your account has been deactivated. Contact support to reactivate it.",
        });
        return;
      }

      // ✅ After user login and email verification
      const userId = user.id; // Supabase user ID

      try {
        // Get current device info
        const currentDevice = navigator.userAgent;

        // Get IP info
        const res = await fetch("https://ipapi.co/json/");
        const ipData = await res.json();
        const currentIP = ipData.ip || "0.0.0.0";

        // Fetch last known device info and alert settings from Supabase
        const { data: profile } = await supabase
          .from("profiles")
          .select("last_ip, last_device, telegram_chat_id, telegram_alerts")
          .eq("id", userId)
          .single();

        // Check if Telegram alerts are enabled and if device/IP is new
        const isNewDevice =
          profile.last_ip !== currentIP ||
          profile.last_device !== currentDevice;
        if (
          profile &&
          profile.telegram_alerts === true &&
          profile.telegram_chat_id &&
          isNewDevice
        ) {
          // Send Telegram notification
          await fetch(
            `https://api.telegram.org/bot8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: profile.telegram_chat_id,
                text: `🔔 New login detected:\nDevice: ${currentDevice}\nIP: ${currentIP}`,
              }),
            }
          );

          console.log("Telegram alert sent for new device/IP.");
        } else {
          console.log(
            "No Telegram alert needed. Either alerts disabled or same device/IP."
          );
        }

        // Update last device info in Supabase for future comparisons
        await supabase
          .from("profiles")
          .update({ last_ip: currentIP, last_device: currentDevice })
          .eq("id", userId);
      } catch (err) {
        console.error("Failed to track device login:", err);
      }

      // Persist session
      if (remember) {
        localStorage.setItem("supabaseSession", JSON.stringify(data.session));
      } else {
        sessionStorage.setItem("supabaseSession", JSON.stringify(data.session));
      }

      Swal.fire({
        icon: "success",
        title: "Login successful",
        showConfirmButton: false,
        timer: 1400,
      });

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1200);
    } catch (err) {
      Swal.close();
      console.error("Login error:", err);
      Swal.fire("Error", "Something went wrong. Check console.", "error");
    }
  });
}

const forgotForm = document.getElementById("forgot-password-form");
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Forgot password submit triggered"); // for testing
    const email = document.getElementById("forgot-email").value.trim();
    if (!email) {
      Swal.fire("Missing email", "Please enter your email.", "warning");
      return;
    }

    try {
      Swal.fire({
        title: "Sending reset link...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://accmarket.name.ng/reset.html",
      });

      Swal.close();

      if (error) {
        console.error("Forgot password error:", error);
        Swal.fire("Error", error.message, "error");
      } else {
        Swal.fire("Check your inbox", "Reset link sent.", "success");
        forgotForm.reset();
        closeForgotModal();
      }
    } catch (err) {
      Swal.close();
      console.error("Forgot password exception:", err);
      Swal.fire("Error", "Something went wrong. Check console.", "error");
    }
  });
}
