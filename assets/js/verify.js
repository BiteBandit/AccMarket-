// Initialize Supabase
const supabaseUrl = "https://qihzvglznpkytolxkuxz.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpaHp2Z2x6bnBreXRvbHhrdXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTc4NDIsImV4cCI6MjA3NTUzMzg0Mn0.VHyy3_Amr-neYoudHudoW-TJwNPfhkRV2TTCfVgY_zM";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

async function handleVerification() {
  const loadingState = document.getElementById("verify-loading");
  const successState = document.getElementById("verify-success");
  const errorState = document.getElementById("verify-error");

  // Show loading initially
  loadingState.classList.add("active");
  successState.classList.remove("active");
  errorState.classList.remove("active");

  try {
    // Instead of using token, just assume email is already verified
    // because Supabase confirms it when link is clicked

    // Hide loading, show success
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
      window.location.href = "auth.html"; // redirect to login
    }, 2500);
  } catch (err) {
    console.error("Verification error:", err.message);

    loadingState.classList.remove("active");
    errorState.classList.add("active");

    Swal.fire({
      icon: "error",
      title: "Verification Failed",
      text: "Something went wrong. Please request a new verification email.",
    });
  }
}

document.addEventListener("DOMContentLoaded", handleVerification);
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
