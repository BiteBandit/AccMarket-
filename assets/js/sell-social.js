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

// 2️⃣ Supabase config
// js/main.js
import { supabase } from './supabase-config.js';

// Now just write your logic
console.log("Supabase is ready to use!", supabase);


// 3️⃣ Get current logged-in user
let currentUser = null;
(async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    console.log("Error fetching user:", error.message);
  } else if (user) {
    currentUser = user;
    console.log("Logged-in user:", currentUser);
  }
})();

// 4️⃣ DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("sellAccountForm");
  const steps = form.querySelectorAll(".form-step");
  const progressSteps = document.querySelectorAll(".progress-bar .step");
  let currentStep = 0;

  // Show current step and highlight progress
  const showStep = (step) => {
    steps.forEach((s, i) => s.classList.toggle("active", i === step));
    progressSteps.forEach((p, i) => p.classList.toggle("active", i <= step));
    if (step === steps.length - 1) fillReview();
  };

  // Fill review step
  const fillReview = () => {
    const map = {
      reviewCategory: "category",
      reviewCountry: "country",
      reviewProfile: "profileLink",
      reviewUsername: "username",
      reviewPassword: "password",
      reviewAccountFormat: "accountFormat",
      reviewDescription: "description",
      reviewEmail: "email",
      reviewEmailPass: "emailPassword",
      reviewRecovery: "recoveryContact",
      review2fa: "twoFA",
      reviewBackup: "backupCodes",
      reviewPrice: "price",
      reviewDiscount: "discount",
    };
    for (const [reviewId, inputId] of Object.entries(map)) {
      const el = document.getElementById(inputId);
      document.getElementById(reviewId).textContent = el
        ? el.value || "-"
        : "-";
    }
  };

  // Next buttons
  form.querySelectorAll(".next-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inputs = steps[currentStep].querySelectorAll(
        "input, select, textarea"
      );
      for (const input of inputs) {
        if (input.required && !input.value) {
          Swal.fire(
            "Error",
            `Please fill the ${input.label || input.id}`,
            "error"
          );
          return;
        }
      }
      if (currentStep < steps.length - 1) {
        currentStep++;
        showStep(currentStep);
      }
    });
  });

  // Back buttons
  form.querySelectorAll(".prev-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
      }
    });
  });

  // 2FA toggle
  document.getElementById("twoFA").addEventListener("change", (e) => {
    const show = e.target.value === "Yes";
    document.getElementById("backupCodesBox").classList.toggle("hidden", !show);
    document.getElementById("securityNotice").classList.toggle("hidden", show);
  });

  // Form submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    fillReview();

    const category = document.getElementById("category").value;
    const tableName = category; // Table = selected category

    if (!currentUser) {
      Swal.fire(
        "Error",
        "You must be logged in to submit an account.",
        "error"
      );
      return;
    }

    const data = {
      user_id: currentUser.id,
      country: document.getElementById("country").value,
      profile_link: document.getElementById("profileLink").value,
      username: document.getElementById("username").value,
      password: document.getElementById("password").value,
      account_format: document.getElementById("accountFormat").value,
      description: document.getElementById("description").value,
      email: document.getElementById("email").value,
      email_password: document.getElementById("emailPassword").value,
      recovery_contact: document.getElementById("recoveryContact").value,
      twofa: document.getElementById("twoFA").value,
      backup_codes: document.getElementById("backupCodes").value,
      price: document.getElementById("price").value || 0,
      discount: document.getElementById("discount").value || 0,
      status: "pending", // Admin approval
      created_at: new Date(),
    };

    Swal.fire({
      title: "Submitting...",
      text: "Please wait while we submit your account.",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading(); // Shows the spinner
      },
    });

    const { error } = await supabase.from(tableName).insert([data]);

    Swal.close(); // Closes the "Submitting..." alert

    if (error) {
      Swal.fire("Error", error.message, "error");
    } else {
      Swal.fire("Success", "Account submitted for admin review!", "success");
      form.reset();
      currentStep = 0;
      showStep(currentStep);
    }
  });

  // Initialize first step
  showStep(currentStep);
});
