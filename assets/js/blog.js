// blog.js - Initialize Supabase

import { supabase } from './supabase-config.js';

// Now just write your logic
console.log("Supabase is ready to use!", supabase);


// Select elements
const blogList = document.getElementById("blog-list");
const modal = document.getElementById("blog-modal");
const modalTitle = document.getElementById("modal-title");
const modalContent = document.getElementById("modal-content");
const modalMedia = document.getElementById("modal-media");
const closeModal = document.querySelector(".close-modal");

const addBlogBtn = document.getElementById("addBlogBtn");
const blogModal = document.getElementById("blogModal");
const closeBlogModal = document.querySelector(".close");
const blogForm = document.getElementById("blogForm");
const blogImageFile = document.getElementById("blogImageFile");
const blogVideoFile = document.getElementById("blogVideoFile");

let currentUserRole = null; // store role globally

// ✅ Check user role
async function checkUserRole() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (data) {
    currentUserRole = data.role;
    if (data.role === "admin") addBlogBtn.style.display = "block";
  }
}

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

  displayBlogs(blogs);
}
// ✅ Display blogs
function displayBlogs(blogs) {
  blogList.innerHTML = "";

  blogs.forEach((blog) => {
    const article = document.createElement("article");
    article.classList.add("blog-card");

    const formattedDate = new Date(blog.created_at).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );

    article.innerHTML = `
      <div class="blog-media">
        ${
          blog.image_url
            ? `<img src="${blog.image_url}" alt="${blog.title}">`
            : blog.video_url
            ? `<video src="${blog.video_url}" controls></video>`
            : ""
        }
      </div>
      <div class="blog-content">
        <h3 class="blog-title">${blog.title}</h3>
        <div class="blog-meta">
          <span class="author"><i class="fas fa-user"></i> ${
            blog.author || "Unknown"
          }</span>
          <span class="date"><i class="fas fa-calendar-alt"></i> ${formattedDate}</span>
        </div>
       <p class="blog-description" data-full-content="${blog.content.replace(
         /"/g,
         "&quot;"
       )}">
  ${truncateText(blog.content, 120)}
</p>
        <div class="blog-actions">
          <button class="read-more" data-id="${blog.id}">Read More</button>
          ${
            currentUserRole === "admin"
              ? `<button class="delete-blog" data-id="${blog.id}">🗑️ Delete</button>`
              : ""
          }
          <button class="share-blog" data-id="${blog.id}">🔗 Share</button>
        </div>
      </div>
    `;
    blogList.appendChild(article);
  });
}

// ✅ Truncate text
function truncateText(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

// ✅ Read More & Delete
blogList.addEventListener("click", async (e) => {
  const id = e.target.getAttribute("data-id");

  // ✅ Read More toggle
  if (e.target.classList.contains("read-more")) {
    const card = e.target.closest(".blog-card");
    const description = card.querySelector(".blog-description");
    const fullText = description.dataset.fullContent || description.textContent;

    if (!card.classList.contains("expanded")) {
      description.textContent = fullText;
      e.target.textContent = "< Read Less <";
      e.target.classList.add("active");
    } else {
      description.textContent = truncateText(fullText, 120);
      e.target.textContent = "> Read More →";
      e.target.classList.remove("active");
    }
    card.classList.toggle("expanded");
  }

  // ✅ Delete Blog
  if (
    e.target.classList.contains("delete-blog") &&
    currentUserRole === "admin"
  ) {
    const confirmDel = await Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (!confirmDel.isConfirmed) return;

    const { error } = await supabase.from("blogs").delete().eq("id", id);

    if (error) {
      Swal.fire({
        icon: "error",
        title: "Error deleting blog",
        text: error.message,
      });
    } else {
      Swal.fire({
        icon: "success",
        title: "Blog deleted!",
        timer: 1500,
        showConfirmButton: false,
      });
      loadBlogs();
    }
  }

  // ✅ Copy Blog Link (Same Page)
  if (e.target.classList.contains("copy-link")) {
    const blogId = e.target.getAttribute("data-id");

    const blogUrl = `https://accmarket.name.ng/blog.html?id=${blogId}`;

    navigator.clipboard.writeText(blogUrl).then(() => {
      Swal.fire({
        icon: "success",
        title: "Link Copied!",
        text: "Anyone who opens this link will see that blog.",
        timer: 1500,
        showConfirmButton: false,
      });
    });
  }

  // ✅ Share Blog
  if (e.target.classList.contains("share-blog")) {
    const card = e.target.closest(".blog-card");
    const title = card.querySelector(".blog-title").textContent;
    const blogId = e.target.getAttribute("data-id");
    const blogUrl = `https://accmarket.name.ng/blog.html?id=${blogId}`;

    if (navigator.share) {
      navigator
        .share({
          title: title,
          text: `Check out this blog: ${title}`,
          url: blogUrl,
        })
        .catch(() => {
          // If share fails, show social share options
          showShareOptions(title, blogUrl);
        });
    } else {
      // Fallback for browsers that don't support navigator.share
      showShareOptions(title, blogUrl);
    }
  }
});

// ✅ Show Share Options Modal
function showShareOptions(title, blogUrl) {
  navigator.clipboard.writeText(blogUrl);
  Swal.fire({
    icon: "info",
    title: "Share this Blog",
    html: `
      <p style="margin-bottom: 12px;">Choose where to share:</p>
      <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(
          title
        )}&url=${encodeURIComponent(
      blogUrl
    )}" target="_blank" style="padding: 8px 12px; background: #1DA1F2; color: white; border-radius: 6px; text-decoration: none; font-size: 0.9rem; display: flex; align-items: center; gap: 4px;">𝕏 Twitter</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          blogUrl
        )}" target="_blank" style="padding: 8px 12px; background: #1877F2; color: white; border-radius: 6px; text-decoration: none; font-size: 0.9rem;">f Facebook</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
          blogUrl
        )}" target="_blank" style="padding: 8px 12px; background: #0A66C2; color: white; border-radius: 6px; text-decoration: none; font-size: 0.9rem;">in LinkedIn</a>
        <a href="https://wa.me/?text=${encodeURIComponent(
          `${title} ${blogUrl}`
        )}" target="_blank" style="padding: 8px 12px; background: #25D366; color: white; border-radius: 6px; text-decoration: none; font-size: 0.9rem;">💬 WhatsApp</a>
        <a href="https://t.me/share/url?url=${encodeURIComponent(
          blogUrl
        )}&text=${encodeURIComponent(
      title
    )}" target="_blank" style="padding: 8px 12px; background: #0088cc; color: white; border-radius: 6px; text-decoration: none; font-size: 0.9rem;">✈️ Telegram</a>
        <a href="mailto:?subject=${encodeURIComponent(
          title
        )}&body=${encodeURIComponent(
      `Check out this blog: ${blogUrl}`
    )}" style="padding: 8px 12px; background: #EA4335; color: white; border-radius: 6px; text-decoration: none; font-size: 0.9rem;">✉️ Email</a>
      </div>
      <p style="margin-top: 12px; font-size: 0.9rem; color: #666;">✅ Blog link copied to clipboard!</p>
    `,
    showConfirmButton: true,
    confirmButtonText: "Close",
  });
}

// ✅ Modal handling for upload
addBlogBtn.addEventListener("click", () => (blogModal.style.display = "flex"));
closeBlogModal.addEventListener(
  "click",
  () => (blogModal.style.display = "none")
);
window.addEventListener("click", (e) => {
  if (e.target === blogModal) blogModal.style.display = "none";
});
closeModal.addEventListener("click", () => (modal.style.display = "none"));
window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// ✅ Upload new blog (with optional direct upload)
blogForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  swal.fire({
    title: "Uploading blog...",
    html: "Please wait while we upload your blog post.",
    allowOutsideClick: false,
    didOpen: () => {
      swal.showLoading();
    },
  });

  const title = document.getElementById("blogTitle").value.trim();
  const content = document.getElementById("blogContent").value.trim();
  const author = document.getElementById("blogAuthor").value.trim();
  let image_url = document.getElementById("blogImage").value.trim();
  let video_url = document.getElementById("blogVideo").value.trim();

  // Upload image
  if (blogImageFile?.files.length > 0) {
    const file = blogImageFile.files[0];
    const fileName = `images/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage
      .from("blog-media")
      .upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage
        .from("blog-media")
        .getPublicUrl(fileName);
      image_url = data.publicUrl;
    } else
      return swal.fire({
        icon: "error",
        title: "Image upload failed",
        text: error.message,
      });
  }

  // Upload video
  if (blogVideoFile && blogVideoFile.files.length > 0) {
    const file = blogVideoFile.files[0];
    const fileName = `videos/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage
      .from("blog-media")
      .upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage
        .from("blog-media")
        .getPublicUrl(fileName);
      video_url = data.publicUrl;
    } else
      return swal.fire({
        icon: "error",
        title: "Video upload failed",
        text: error.message,
      });
  }

  const { error } = await supabase
    .from("blogs")
    .insert([{ title, content, author, image_url, video_url }]);

  if (!error) {
    // ✅ Send notification to all users
    await notifyAllUsersOnNewBlog(
      " New Blog Post!",
      `A new blog titled "${title}" has been published. Check it out!`,
      "blog" // 👈 This fills notifications.type = "blog"
    );
  }

  if (error) {
    Swal.fire({
      icon: "error",
      title: "Upload Failed",
      text: error.message,
    });
  } else {
    swal.fire({
      icon: "success",
      title: "Blog Uploaded",
      text: "Your blog post has been uploaded successfully.",
      timer: 2000,
      showConfirmButton: false,
    });
    blogModal.style.display = "none";
    blogForm.reset();
    loadBlogs();
  }
});

// ✅ Send notifications to all users when a new blog is posted
async function notifyAllUsersOnNewBlog(title, message, type = "blog") {
  try {
    // Fetch all users from profiles
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id");

    if (usersError) throw usersError;
    if (!users || users.length === 0) return;

    // Create notification entries
    const notifications = users.map((user) => ({
      user_id: user.id,
      title,
      message,
      is_read: false,
      type,
      created_at: new Date().toISOString(),
    }));

    // Insert notifications
    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) throw insertError;

    console.log(`✅ Notifications sent to ${users.length} users.`);
  } catch (err) {
    console.error("❌ Notification error:", err.message);
  }
}

// ✅ Real-time updates
supabase
  .channel("blogs-changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "blogs" },
    () => loadBlogs()
  )
  .subscribe();

// ✅ Sidebar + UI Controls
const sidebarToggle = document.getElementById("sidebarToggle");
const leftSidebar = document.getElementById("leftSidebar");
const closeLeft = document.getElementById("closeLeft");
const backToTop = document.getElementById("backToTop");

sidebarToggle.addEventListener("click", () =>
  leftSidebar.classList.add("active")
);
closeLeft.addEventListener("click", () =>
  leftSidebar.classList.remove("active")
);

window.addEventListener("scroll", () => {
  if (window.scrollY > 300) backToTop.style.display = "flex";
  else backToTop.style.display = "none";
});

backToTop.addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" })
);

// ✅ Check if URL has a blog ID parameter and open it
function openBlogFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const blogId = urlParams.get("id");

  if (blogId) {
    // Fetch and display the specific blog
    supabase
      .from("blogs")
      .select("*")
      .eq("id", blogId)
      .single()
      .then(({ data: blog, error }) => {
        if (error || !blog) {
          console.error("Blog not found:", error);
          Swal.fire({
            icon: "error",
            title: "Blog Not Found",
            text: "Sorry, this blog doesn't exist or has been deleted.",
          });
          return;
        }

        // Populate modal with blog data
        modalTitle.textContent = blog.title;
        modalContent.textContent = blog.content;

        if (blog.image_url) {
          modalMedia.innerHTML = `<img src="${blog.image_url}" alt="${blog.title}" style="max-width: 100%; border-radius: 8px;">`;
        } else if (blog.video_url) {
          modalMedia.innerHTML = `<video src="${blog.video_url}" controls autoplay style="max-width: 100%; border-radius: 8px;"></video>`;
        } else {
          modalMedia.innerHTML = "";
        }

        // Show modal
        modal.style.display = "flex";
      });
  }
}

// ✅ Initialize
document.addEventListener("DOMContentLoaded", () => {
  checkUserRole();
  loadBlogs();

  // Check if there's a blog ID in the URL and open it
  setTimeout(() => {
    openBlogFromURL();
  }, 500);
});
