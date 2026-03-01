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

import { supabase } from './supabase-config.js';

document.addEventListener("DOMContentLoaded", async () => {

  const ticketForm = document.getElementById("ticketForm");
  const ticketSubjectEl = document.getElementById("ticketSubject");
  const ticketMessageEl = document.getElementById("ticketMessage");
  const ticketAttachmentEl = document.getElementById("ticketAttachment");
  const userTicketsEl = document.getElementById("userTickets");

  // ---------- Get current user ----------
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return Swal.fire("Error", "No user logged in", "error");
  }

  const userId = userData.user.id;
  const userEmail = userData.user.email;

  // ---------- Fetch tickets ----------
  async function fetchTickets() {
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    userTicketsEl.innerHTML = (tickets || []).map(t => {
  // Only two statuses: resolved or pending
  const statusClass = t.status.toLowerCase() === 'resolved' ? 'resolved' : 'pending';

  return `
    <tr>
      <td>${t.ticket_number}</td>
      <td>${t.subject}</td>
      <td><span class="status ${statusClass}">${t.status}</span></td>
      <td>${new Date(t.created_at).toLocaleString()}</td>
      <td>${t.attachment_url ? `<a href="${t.attachment_url}" target="_blank">View</a>` : "-"}</td>
    </tr>
  `;
}).join("");

    if (!tickets || tickets.length === 0) {
      userTicketsEl.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:gray">
            No tickets yet
          </td>
        </tr>
      `;
    }
  }

  fetchTickets();

  // ---------- Submit New Ticket ----------
  ticketForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const subject = ticketSubjectEl.value.trim();
    const message = ticketMessageEl.value.trim();

    if (!subject || !message) {
      return Swal.fire("Error", "Fill all fields", "error");
    }

    const ticketNumber = `TCK-${Date.now()}`;
    let attachmentUrl = null;

    // ---------- Upload attachment ----------
    if (ticketAttachmentEl.files.length > 0) {
      const file = ticketAttachmentEl.files[0];
      const ext = file.name.split(".").pop();
      const fileName = `tickets/${userId}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(fileName, file);

      if (uploadError) {
        return Swal.fire("Error", "Attachment upload failed", "error");
      }

      const publicUrl = supabase
  .storage
  .from("support-attachments")
  .getPublicUrl(fileName).data.publicUrl;

attachmentUrl = publicUrl;
}

    // ---------- Insert ticket ----------
    const { error: ticketError } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        ticket_number: ticketNumber,
        subject,
        message,
        status: "pending",
        attachment_url: attachmentUrl
      });

    if (ticketError) {
      return Swal.fire("Error", "Ticket creation failed", "error");
    }

    // ---------- Send FULL ticket details to Telegram ----------
    const botToken = "8436841265:AAHIh50C2bEamKqB649Dx_CRy7l8X6f2yqg";
    const chatId = "-5287413992";

    const telegramMessage = `
🆕 NEW SUPPORT TICKET

🎟 Ticket: ${ticketNumber}
👤 User: ${userEmail}
🆔 User ID: ${userId}

📝 Subject: ${subject}

💬 Message:
${message}

📎 Attachment:
${attachmentUrl ? attachmentUrl : "No attachment"}

⏰ ${new Date().toLocaleString()}
`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: telegramMessage
      })
    });

    ticketForm.reset();
    fetchTickets();

    Swal.fire("Success", "Ticket submitted successfully!", "success");

// ==============================
// ✅ SHOW LOADING → OPEN CHAPORT AFTER 3 SECONDS
// ==============================

if (window.chaport) {

  chaport.setVisitorData({
    name: userEmail,
    email: userEmail
  });

  Swal.fire({
    title: "Connecting to support...",
    text: "Opening live chat in a moment.",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  setTimeout(() => {

    Swal.close(); // close loading popup

    chaport.open();

    chaport.sendMessage(
      `Hello, I just created ticket ${ticketNumber} regarding "${subject}".`
    );

  }, 3000);
}
  });

});