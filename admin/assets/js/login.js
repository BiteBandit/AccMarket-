// Path: AccMarket/admin/assets/js/login.js
import { supabase } from '../../../assets/js/supabase-config.js';

const loginForm = document.getElementById("adminLoginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get input values
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      // 1. Authenticate user with Supabase
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // 2. Fetch user profile to verify "admin" role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Could not verify administrative privileges.");
      }

      // 3. Strict Security Check: Only "admin" allowed
      if (profile.role !== "admin") {
        // Log them out immediately if they aren't an admin
        await supabase.auth.signOut();
        throw new Error("Access Denied: Administrative role required.");
      }

      // 4. Success popup using your brand color
      Swal.fire({
        icon: 'success',
        title: 'Welcome, Admin',
        text: 'Access granted. Redirecting to dashboard...',
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true
      }).then(() => {
        // Redirect to admin dashboard
        window.location.href = "dashboard.html";
      });

    } catch (err) {
      // Error popup using the dark blue theme color
      Swal.fire({
        icon: 'error',
        title: 'Authentication Failed',
        text: err.message,
        confirmButtonColor: "#0b1e5b" 
      });
    }
  });
}
