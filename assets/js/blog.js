// blog.js - Initialize Supabase
import { supabase } from './supabase-config.js';

// Select elements
const blogList = document.getElementById("blog-list");
const blogSection = document.querySelector(".blog-section");
const sectionTitle = document.querySelector(".section-title");
const sectionSubtitle = document.querySelector(".section-subtitle");

// ✅ Load blogs
async function loadBlogs() {
  const { data: blogs, error } = await supabase
    .from("blogs")
    .select("*")
    .order("created_at", { ascending: false });

  const loadingMsg = document.getElementById("loading-spinner");
  if (loadingMsg) loadingMsg.remove();

  if (error) {
    console.error("Error fetching blogs:", error);
    return;
  }

  // Only display the list if we aren't viewing a single post
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.get("id")) {
    displayBlogs(blogs);
  }
}

// ✅ Display blogs list
function displayBlogs(blogs) {
  blogList.innerHTML = "";
  blogs.forEach((blog) => {
    const article = document.createElement("article");
    article.classList.add("blog-card");
    const formattedDate = new Date(blog.created_at).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric"
    });

    article.innerHTML = `
      <div class="blog-media">
        ${blog.image_url ? `<img src="${blog.image_url}" alt="${blog.title}">` : 
          blog.video_url ? `<video src="${blog.video_url}" controls></video>` : ""}
      </div>
      <div class="blog-content">
        <h3 class="blog-title">${blog.title}</h3>
        <div class="blog-meta">
          <span><i class="fas fa-user"></i> ${blog.author || "AccMarket"}</span>
          <span><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
        </div>
        <p class="blog-description">${blog.content.substring(0, 120)}...</p>
        <div class="blog-actions">
          <button class="read-more" data-id="${blog.id}">
            <i class="fas fa-book-open"></i> Read More
          </button>
          <button class="share-blog-btn" data-id="${blog.id}" data-title="${blog.title}">
            <i class="fas fa-share-alt"></i> Share
          </button>
        </div>
      </div>
    `;
    blogList.appendChild(article);
  });
}

// ✅ Single Article View Logic
async function handleSingleView() {
  const urlParams = new URLSearchParams(window.location.search);
  const blogId = urlParams.get("id");

  if (blogId) {
    const { data: blog, error } = await supabase.from("blogs").select("*").eq("id", blogId).single();
    if (error || !blog) return;

    // Hide the list headers & grid
    if (sectionTitle) sectionTitle.style.display = "none";
    if (sectionSubtitle) sectionSubtitle.style.display = "none";
    blogList.style.display = "none";

    // Create the Single View Container
    const singleView = document.createElement("div");
    singleView.className = "single-article-view";
    singleView.innerHTML = `
      <button class="back-to-feed" onclick="window.location.href='blog.html'">
        <i class="fas fa-chevron-left"></i> Back to Updates
      </button>
      <div class="article-header">
        <h1>${blog.title}</h1>
        <div class="blog-meta">
          <span><i class="fas fa-user"></i> ${blog.author || "AccMarket"}</span>
          <span><i class="fas fa-calendar-alt"></i> ${new Date(blog.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div class="article-media">
        ${blog.image_url ? `<img src="${blog.image_url}">` : blog.video_url ? `<video src="${blog.video_url}" controls autoplay></video>` : ""}
      </div>
      <div class="article-body">${blog.content}</div>
      <div class="article-footer">
        <button class="share-blog-btn" data-id="${blog.id}" data-title="${blog.title}">
          <i class="fas fa-share-alt"></i> Share this insight
        </button>
      </div>
    `;
    blogSection.appendChild(singleView);
  }
}

// ✅ Event Delegation for Buttons
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  // Handle "Read More" button click
  if (btn.classList.contains("read-more")) {
    const id = btn.dataset.id;
    window.location.search = `?id=${id}`;
  }

  // Handle "Share" button click
  if (btn.classList.contains("share-blog-btn")) {
    const id = btn.dataset.id;
    const title = btn.dataset.title || document.querySelector(".article-header h1")?.textContent;
    const url = `https://accmarket.name.ng/blog.html?id=${id}`;
    showShareOptions(title, url);
  }
});

function showShareOptions(title, url) {
  navigator.clipboard.writeText(url);
  Swal.fire({
    title: 'Share Article',
    html: `
      <div class="share-grid">
        <a href="https://wa.me/?text=${encodeURIComponent(title + " " + url)}" target="_blank" class="share-item wa"><i class="fab fa-whatsapp"></i><span>WhatsApp</span></a>
        <a href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}" target="_blank" class="share-item tg"><i class="fab fa-telegram-plane"></i><span>Telegram</span></a>
        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}" target="_blank" class="share-item tw"><i class="fab fa-x-twitter"></i><span>Twitter</span></a>
      </div>
      <p style="font-size:0.8rem; margin-top:10px; color:#888;">Link copied!</p>
    `,
    showConfirmButton: false,
    showCloseButton: true
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadBlogs();
  handleSingleView();
});
