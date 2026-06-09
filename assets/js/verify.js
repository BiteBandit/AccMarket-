import { supabase } from './supabase-config.js';

// --- Verification Logic ---
async function handleVerification() {
  const loadingState = document.getElementById("verify-loading");
  const successState = document.getElementById("verify-success");
  const errorState = document.getElementById("verify-error");

  // Guard clause: If these elements aren't on the current page, don't run verification
  if (!loadingState || !successState || !errorState) return;

  loadingState.classList.add("active");
  successState.classList.remove("active");
  errorState.classList.remove("active");

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code'); 

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      throw new Error("No verification token found in the URL.");
    }

    loadingState.classList.remove("active");
    successState.classList.add("active");

    Swal.fire({
      icon: "success",
      title: "✅ Email Verified!",
      text: "You’ll be redirected to login shortly.",
      showConfirmButton: false,
      timer: 2500,
    });

    setTimeout(() => {
      window.location.href = "auth.html"; 
    }, 2500);

  } catch (err) {
    console.error("Verification error:", err.message);

    loadingState.classList.remove("active");
    errorState.classList.add("active");

    Swal.fire({
      icon: "error",
      title: "Verification Failed",
      text: err.message || "Something went wrong. Please request a new verification email.",
    });
  }
}

// --- Initialize Functions ---
// (Note: Since this is now loaded as a type="module", it safely fires after DOM is ready)
handleVerification();

// Sidebar Toggle Logic
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

// Sidebar Search Logic
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
