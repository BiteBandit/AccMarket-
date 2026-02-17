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

// Animated counters for stats
const counters = document.querySelectorAll(".counter");
const speed = 100; // lower = faster

const startCounting = (entry) => {
  const counter = entry.target;
  const target = +counter.getAttribute("data-target");
  const updateCount = () => {
    const count = +counter.innerText;
    const inc = target / speed;
    if (count < target) {
      counter.innerText = Math.ceil(count + inc);
      requestAnimationFrame(updateCount);
    } else {
      counter.innerText = target;
    }
  };
  updateCount();
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        startCounting(entry);
        observer.unobserve(entry.target); // stop re-triggering
      }
    });
  },
  { threshold: 0.3 }
);

counters.forEach((counter) => observer.observe(counter));

// FAQ Toggle
document.querySelectorAll(".faq-question").forEach((btn) => {
  btn.addEventListener("click", () => {
    const item = btn.parentElement;
    item.classList.toggle("active");
  });
});

// Theme Toggle
const themeToggle = document.getElementById("themeToggle");
const body = document.body;

// Detect system preference
const systemPrefersDark = window.matchMedia(
  "(prefers-color-scheme: dark)"
).matches;

// Load saved theme or system default
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
  body.classList.add("dark-mode");
} else {
  body.classList.remove("dark-mode");
}

// Toggle theme on click
themeToggle.addEventListener("click", (e) => {
  e.preventDefault();
  body.classList.toggle("dark-mode");

  // Save user preference
  if (body.classList.contains("dark-mode")) {
    localStorage.setItem("theme", "dark");
  } else {
    localStorage.setItem("theme", "light");
  }
});
// Watch for system theme changes
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (event) => {
    const newSystemTheme = event.matches ? "dark" : "light";
    const userSetTheme = localStorage.getItem("theme");

    // Only auto-change if user hasn’t manually set a theme
    if (!userSetTheme) {
      if (newSystemTheme === "dark") {
        body.classList.add("dark-mode");
      } else {
        body.classList.remove("dark-mode");
      }
    }
  });

document.getElementById("footerYear").textContent = new Date().getFullYear();

const categoryItems = document.querySelectorAll(".category-list > li > a");

categoryItems.forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const parent = item.parentElement;
    parent.classList.toggle("active");
  });
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
