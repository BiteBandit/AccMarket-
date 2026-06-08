import { supabase } from '../../../assets/js/supabase-config.js';

/**
 * ============================================================================
 * ENTERPRISE PLATFORM NEWS MANAGEMENT CORE ENGINE
 * ============================================================================
 */

// --- 1. GLOBAL WINDOW INTERFACE HOOKS ---
// Explicitly exposes functions on the global window scope immediately during compilation 
// to prevent "is not a function" race-condition errors with inline HTML onclick attributes.
window.loadBlogs = window.loadBlogs || (() => {});
window.openBlogModal = window.openBlogModal || (() => {});
window.closeBlogModal = window.closeBlogModal || (() => {});
window.editBlog = window.editBlog || (() => {});
window.saveBlogPost = window.saveBlogPost || (() => {});
window.deleteBlogPost = window.deleteBlogPost || (() => {});

// Global Z-Index alignment fix to prevent SweetAlert2 modals from getting stuck behind DOM overlays
const style = document.createElement('style');
style.innerHTML = `.swal2-container { z-index: 999999 !important; }`;
document.head.appendChild(style);

// --- CACHE & DOM REFS ---
const saveBtn = document.getElementById('saveBtn');

// Helper function to extract path out of public URL for object cleanups
function getPathFromUrl(url) {
    if (!url) return null;
    const splitParts = url.split('/storage/v1/object/public/blog-media/');
    return splitParts.length > 1 ? splitParts[1] : null;
}

// --- 2. READ VECTOR: LEDGER SYNCHRONIZATION ---
window.loadBlogs = async function() {
    const tbody = document.getElementById('blogTableBody');
    if (!tbody) return;

    try {
        const { data: blogs, error } = await supabase
            .from('blogs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!blogs || blogs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;">
                        <i class="fa-solid fa-folder-open"></i> No published platform news found.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = blogs.map(post => {
            // Detect file taxonomy rules directly via the existing video_url path parameter
            const hasVideo = post.video_url && post.video_url.trim() !== "";
            
            // Format Timestamp nicely according to Admin aesthetic preferences
            const displayDate = post.created_at 
                ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : "Just Now";

            // Enforce layout container architecture patterns matching HTML workspace styling
            let mediaPreview = "";
            if (hasVideo) {
                mediaPreview = `
                    <div class="media-preview-container" title="Video Broadcast Post">
                        <i class="fa-solid fa-video" style="color: #2563eb; font-size: 16px;"></i>
                    </div>`;
            } else {
                mediaPreview = `
                    <div class="media-preview-container">
                        <img src="${post.image_url}" class="media-preview-img" onerror="this.src='https://via.placeholder.com/70x45?text=No+Img'">
                    </div>`;
            }

            return `
            <tr style="border-bottom: 1px solid #e2e8f0; transition: background-color 0.2s;">
                <td style="padding: 12px 15px; vertical-align: middle;">${mediaPreview}</td>
                <td style="padding: 12px 15px; font-weight: 500; color: #1e293b; vertical-align: middle;">${post.title || 'Untitled'}</td>
                <td style="padding: 12px 15px; color: #475569; vertical-align: middle;">${post.author || 'Admin'}</td>
                <td style="padding: 12px 15px; font-size: 13px; color: #64748b; vertical-align: middle;">${displayDate}</td>
                <td style="padding: 12px 15px; text-align: center; vertical-align: middle;">
                    <button onclick="window.editBlog('${post.id}')" class="btn-action-edit" title="Modify Layout Profile">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button onclick="window.deleteBlogPost('${post.id}')" class="btn-action-delete" title="Purge Record">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error("❌ Failed to pull blog ledger updates:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Sync failure: ${err.message}
                </td>
            </tr>`;
    }
};

// --- 3. MODAL VIEW MANAGER INTERACTION HANDLERS ---
window.openBlogModal = function() {
    document.getElementById('editBlogId').value = "";
    document.getElementById('blogTitle').value = "";
    document.getElementById('blogAuthor').value = "Admin";
    document.getElementById('blogContent').value = "";
    document.getElementById('blogFile').value = "";
    document.getElementById('modalTitle').innerText = "Create News Post";
    document.getElementById('blogModal').style.display = "flex";
};

window.closeBlogModal = function() {
    document.getElementById('blogModal').style.display = "none";
};

window.editBlog = async function(id) {
    try {
        const { data: post, error } = await supabase.from('blogs').select('*').eq('id', id).single();
        if (error) throw error;
        
        if (post) {
            document.getElementById('editBlogId').value = post.id;
            document.getElementById('blogTitle').value = post.title || "";
            document.getElementById('blogAuthor').value = post.author || "Admin";
            document.getElementById('blogContent').value = post.content || "";
            document.getElementById('blogFile').value = ""; 
            document.getElementById('modalTitle').innerText = "Edit News Post";
            document.getElementById('blogModal').style.display = "flex";
        }
    } catch (err) {
        console.error("❌ Error locating article parameters:", err);
        Swal.fire('Data Fetch Error', err.message, 'error');
    }
};

// --- 4. WRITE VECTOR: UPSERT TRANSACTIONS WITH STORAGE ATTACHMENTS ---
window.saveBlogPost = async function() {
    const id = document.getElementById('editBlogId').value;
    const title = document.getElementById('blogTitle').value.trim();
    const author = document.getElementById('blogAuthor').value.trim();
    const content = document.getElementById('blogContent').value.trim();
    const file = document.getElementById('blogFile').files[0];

    // Form inputs field integrity confirmation
    if (!title || !content) {
        return Swal.fire({ icon: "error", title: "Required Inputs", text: "Title and content bodies are required before archiving." });
    }
    
    // Require file only if creating a brand new post
    if (!id && !file) {
        return Swal.fire({ icon: "warning", title: "Media Asset Required", text: "Please attach an onboarding display image or an MP4 file vector." });
    }

    // Display localized workflow execution overlay and stall DOM mutations
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...`;
    }
    Swal.fire({ title: 'Processing Transaction...', text: 'Uploading media blobs and caching database entries...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        let uploadedUrl = null;
        let isVideoFile = false;
        let oldMediaUrlToClean = null;

        // If editing, pull historical media signatures to avoid orphaned assets inside the storage bucket
        if (id && file) {
            const { data: currentPost } = await supabase.from('blogs').select('image_url, video_url').eq('id', id).single();
            if (currentPost) {
                oldMediaUrlToClean = currentPost.video_url || currentPost.image_url;
            }
        }
        
        if (file) {
            // Enforcement rule check: 10MB maximum limit guardrail
            if (file.size > 10 * 1024 * 1024) {
                throw new Error("Target file asset passes recommended 10MB configuration bounds.");
            }

            // Enhanced taxonomy sorting algorithm checking explicit MIME signatures or trailing file extensions
            isVideoFile = file.type.startsWith('video/') || file.name.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
            
            const folder = isVideoFile ? 'videos' : 'images';
            const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const path = `${folder}/${fileName}`;

            // Transfer structural chunk arrays to targeted raw object storage bucket layout channels
            const { error: uploadError } = await supabase.storage.from('blog-media').upload(path, file);
            if (uploadError) throw uploadError;

            // Extract programmatic full reference path
            const { data: urlData } = supabase.storage.from('blog-media').getPublicUrl(path);
            uploadedUrl = urlData.publicUrl;
        }

        const payload = { title, author: author || "Admin", content };
        
        // Ensure binary exclusive switches handle structural target rows properly across columns
        if (uploadedUrl) {
            if (isVideoFile) {
                payload.video_url = uploadedUrl;
                payload.image_url = ""; 
            } else {
                payload.image_url = uploadedUrl;
                payload.video_url = ""; 
            }
        }

        // Branch operation type dynamically based on historical primary keys identifier state logic
        const { error: dbError } = id 
            ? await supabase.from('blogs').update(payload).eq('id', id)
            : await supabase.from('blogs').insert([payload]);

        if (dbError) throw dbError;

        // Purge historical storage resources post-update success
        if (oldMediaUrlToClean) {
            const cleanPath = getPathFromUrl(oldMediaUrlToClean);
            if (cleanPath) {
                await supabase.storage.from('blog-media').remove([cleanPath]);
            }
        }

        // Visual layout clean up operations 
        window.closeBlogModal();
        Swal.fire({ icon: "success", title: "Record Saved Successfully", text: "Platform news matrix synchronization execution absolute.", confirmButtonColor: '#0b1e5b' });
        window.loadBlogs();

    } catch (err) {
        console.error("📢 News persist failure exception:", err);
        Swal.fire({ icon: "error", title: "Write Interrupted", text: err.message || "The cluster drops writing transaction actions updates." });
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fa-solid fa-paper-plane" style="margin-right: 5px;"></i> Save Post`;
        }
    }
};

// --- 5. PURGE VECTOR: DESTRUCTION ARRAYS ENGINE ---
window.deleteBlogPost = async function(id) {
    try {
        const { isConfirmed } = await Swal.fire({
            title: 'Confirm Deletion?',
            text: "This process wipes out historical platform records permanently from subscriber streams.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, purge row structure'
        });

        if (!isConfirmed) return;

        // Fetch media targets to fully scrub the object binary out of Supabase Bucket
        const { data: targetPost } = await supabase.from('blogs').select('image_url, video_url').eq('id', id).single();
        
        const { error } = await supabase.from('blogs').delete().eq('id', id);
        if (error) throw error;

        // Perform cascading asset drop from Bucket Storage if paths check out
        if (targetPost) {
            const targetUrl = targetPost.video_url || targetPost.image_url;
            const cleanPath = getPathFromUrl(targetUrl);
            if (cleanPath) {
                await supabase.storage.from('blog-media').remove([cleanPath]);
            }
        }

        Swal.fire({ title: "Purged", text: "The target news asset post has been cleared.", icon: "success", confirmButtonColor: '#0b1e5b' });
        window.loadBlogs();

    } catch (err) {
        console.error("❌ Core Delete procedure interruption:", err);
        Swal.fire("Action Blocked", err.message || "Could not completely disconnect specified object references.", "error");
    }
};

// --- 6. INITIALIZATION RUNTIME ANCHOR ---
document.addEventListener('DOMContentLoaded', () => {
    window.loadBlogs();
});
