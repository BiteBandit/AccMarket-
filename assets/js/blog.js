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

  // Logic: Check if we are viewing a single post via URL ?id=...
  const urlParams = new URLSearchParams(window.location.search);
  const blogId = urlParams.get("id");

  if (blogId) {
    handleSingleView(blogId);
  } else {
    displayBlogs(blogs);
  }
}

// ✅ Display blogs (With Toggle Logic)
function displayBlogs(blogs) {
  if (!blogList) return;
  blogList.innerHTML = "";

  blogs.forEach((blog) => {
    const article = document.createElement("article");
    article.classList.add("blog-card");

    const formattedDate = new Date(blog.created_at).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric"
    });

    // 🛠️ VIDEO FIX: Prioritize video_url
    let mediaHTML = "";
    if (blog.video_url && blog.video_url.trim() !== "") {
      let videoSrc = blog.video_url;
if (videoSrc && !videoSrc.includes('#t=')) {
  videoSrc += '#t=0.001'; 
}

mediaHTML = `<video src="${videoSrc}" controls preload="metadata" class="blog-video"></video>`;

    } else if (blog.image_url && blog.image_url.trim() !== "") {
      mediaHTML = `<img src="${blog.image_url}" alt="${blog.title}">`;
    }

    article.innerHTML = `
      <div class="blog-media">
        ${mediaHTML}
      </div>
      <div class="blog-content">
        <h3 class="blog-title">${blog.title}</h3>
        <div class="blog-meta">
          <span class="author"><i class="fas fa-user"></i> ${blog.author || "AccMarket"}</span>
          <span class="date"><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
        </div>
        <p class="blog-description" data-full-content="${blog.content.replace(/"/g, "&quot;")}">
          ${truncateText(blog.content, 120)}
        </p>
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

// ✅ Single Article View Logic (For URL Params)
async function handleSingleView(blogId) {
  const { data: blog, error } = await supabase.from("blogs").select("*").eq("id", blogId).single();
  if (error || !blog) return;

  // Hide list UI
  if (sectionTitle) sectionTitle.style.display = "none";
  if (sectionSubtitle) sectionSubtitle.style.display = "none";
  if (blogList) blogList.style.display = "none";

  const mediaHtml = blog.video_url 
    ? `<video src="${blog.video_url}" controls autoplay class="article-video"></video>` 
    : blog.image_url ? `<img src="${blog.image_url}" alt="${blog.title}">` : "";

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
    <div class="article-media">${mediaHtml}</div>
    <div class="article-body" style="white-space: pre-wrap;">${blog.content}</div>
    <div class="article-footer">
      <button class="share-blog-btn" data-id="${blog.id}" data-title="${blog.title}">
        <i class="fas fa-share-alt"></i> Share this insight
      </button>
    </div>
  `;
  blogSection.appendChild(singleView);
}

// ✅ Truncate helper
function truncateText(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

// ✅ Click Events
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.getAttribute("data-id");

  // Handle Toggle (Read More)
  if (btn.classList.contains("read-more")) {
    const card = btn.closest(".blog-card");
    const description = card.querySelector(".blog-description");
    const fullText = description.dataset.fullContent;

    if (!card.classList.contains("expanded")) {
      description.textContent = fullText;
      btn.innerHTML = `<i class="fas fa-chevron-up"></i> Read Less`;
      btn.classList.add("active");
      card.classList.add("expanded");
    } else {
      description.textContent = truncateText(fullText, 120);
      btn.innerHTML = `<i class="fas fa-book-open"></i> Read More`;
      btn.classList.remove("active");
      card.classList.remove("expanded");
    }
  }

  // Handle Share
  if (btn.classList.contains("share-blog-btn")) {
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

document.addEventListener("DOMContentLoaded", loadBlogs);
