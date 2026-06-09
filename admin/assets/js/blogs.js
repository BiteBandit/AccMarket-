import { supabase } from '../../../assets/js/supabase-config.js';

/**
 * ============================================================================
 * ENTERPRISE PLATFORM NEWS MANAGEMENT CORE ENGINE
 * ============================================================================
 */

// Global Z-Index alignment fix to prevent SweetAlert2 modals from getting stuck behind DOM overlays
const style = document.createElement('style');
style.innerHTML = `.swal2-container { z-index: 999999 !important; }`;
document.head.appendChild(style);

// --- 1. READ VECTOR: LEDGER SYNCHRONIZATION ---
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
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;"><i class="fa-solid fa-folder-open"></i> No published platform news found.</td></tr>`;
            return;
        }

        tbody.innerHTML = blogs.map(post => {
            // Detect file taxonomy rules directly via the existing video_url path parameter
            const hasVideo = post.video_url && post.video_url.trim() !== "";
            
            return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background-color 0.2s;">
                <td style="padding: 15px; vertical-align: middle;">
                    ${hasVideo ? 
                        `<div style="width:45px; height:30px; background:#0b1e5b; border-radius:4px; display:flex; align-items:center; justify-content:center; color:white; font-size:12px;" title="Video Broadcast Post">
                            <i class="fa-solid fa-video"></i>
                         </div>` : 
                        `<img src="${post.image_url}" style="width:45px; height:30px; object-fit:cover; border-radius:4px; border:1px solid #e2e8f0;" onerror="this.src='https://via.placeholder.com/45x30?text=No+Img'">`
                    }
                </td>
                <td style="padding:15px; font-weight:600; color:#1e293b; vertical-align: middle;">${post.title}</td>
                <td style="padding:15px; color:#64748b; vertical-align: middle;">${post.author || 'Admin'}</td>
                <td style="padding:15px; font-size:12px; color:#94a3b8; vertical-align: middle;">${new Date(post.created_at).toLocaleDateString()}</td>
                <td style="padding:15px; text-align:center; vertical-align: middle;">
                    <button onclick="window.editBlog('${post.id}')" class="btn-action-edit" title="Modify Layout Profile"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                    <button onclick="window.deleteBlogPost('${post.id}')" class="btn-action-delete" title="Purge Record"><i class="fa-solid fa-trash"></i> Delete</button>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error("❌ Failed to pull blog ledger updates:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Sync failure: ${err.message}</td></tr>`;
    }
};

// --- 2. MODAL VIEW MANAGER INTERACTION HANDLERS ---
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
            document.getElementById('blogTitle').value = post.title;
            document.getElementById('blogAuthor').value = post.author || "Admin";
            document.getElementById('blogContent').value = post.content;
            document.getElementById('blogFile').value = ""; 
            document.getElementById('modalTitle').innerText = "Edit News Post";
            document.getElementById('blogModal').style.display = "flex";
        }
    } catch (err) {
        console.error("❌ Error locating article parameters:", err);
        Swal.fire('Data Fetch Error', err.message, 'error');
    }
};

// --- 3. WRITE VECTOR: UPSERT TRANSACTIONS WITH STORAGE ATTACHMENTS ---
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

    // Display localized workflow execution overlay 
    Swal.fire({ title: 'Processing Transaction...', text: 'Uploading media blobs and caching database entries...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        let uploadedUrl = null;
        let isVideoFile = false;
        
        if (file) {
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

        // Visual layout clean up operations 
        window.closeBlogModal();
        Swal.fire({ icon: "success", title: "Record Saved Successfully", text: "Platform news matrix synchronization execution absolute.", confirmButtonColor: '#0b1e5b' });
        window.loadBlogs();

    } catch (err) {
        console.error("📢 News persist failure exception:", err);
        Swal.fire({ icon: "error", title: "Write Interrupted", text: err.message || "The cluster drops writing transaction actions updates." });
    }
};

// --- 4. PURGE VECTOR: DESTRUCTION ARRAYS ENGINE ---
window.deleteBlogPost = async function(id) {
    try {
        const { isConfirmed } = await Swal.fire({
            title: 'Delete this item?',
  text: 'This will permanently remove the record.',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonColor: '#ef4444',
  cancelButtonColor: '#64748b',
  confirmButtonText: 'Yes, delete'
        });

        if (!isConfirmed) return;

        const { error } = await supabase.from('blogs').delete().eq('id', id);
        if (error) throw error;

        Swal.fire({
  title: "Deleted",
  text: "The post has been removed.",
  icon: "success",
  confirmButtonColor: '#0b1e5b'
});

window.loadBlogs();

    } catch (err) {
        console.error("❌ Core Delete procedure interruption:", err);
        Swal.fire("Action Blocked", err.message || "Could not completely disconnect specified object references.", "error");
    }
};

// --- 5. INITIALIZATION RUNTIME ANCHOR ---
document.addEventListener('DOMContentLoaded', () => {
    window.loadBlogs();
});
