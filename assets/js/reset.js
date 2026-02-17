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

//  - Initialize Supabase

import { supabase } from './supabase-config.js';

// Now just write your logic
console.log("Supabase is ready to use!", supabase);


document.addEventListener("DOMContentLoaded", async () => {
  // Check if the user has an active session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    Swal.fire(
      "Error",
      "Session expired or invalid. Please request a new reset link.",
      "error"
    );
    return;
  }

  const form = document.getElementById("resetForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = document.getElementById("password").value.trim();
    const confirmPassword = document
      .getElementById("confirmPassword")
      .value.trim();

    if (password !== confirmPassword) {
      Swal.fire("Mismatch", "Passwords do not match!", "warning");
      return;
    }

    Swal.fire({
      title: "Resetting Password...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const { error } = await supabase.auth.updateUser({ password });
    Swal.close();

    if (error) {
      Swal.fire("Error", error.message, "error");
      return;
    }

    Swal.fire({
      icon: "success",
      title: "Password Updated!",
      text: "You can now log in with your new password.",
      showConfirmButton: false,
      timer: 1800,
    });

    setTimeout(() => {
      window.location.href = "auth.html";
    }, 1800);
  });
});
