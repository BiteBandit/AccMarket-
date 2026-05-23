// Path: AccMarket/admin/assets/js/login.js
import { supabase } from '../../../assets/js/supabase-config.js';

const loginForm = document.getElementById("adminLoginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get input values
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    // ✅ 1. Read and validate the Turnstile token
    let token = null;
    if (typeof turnstile !== "undefined") {
      token = turnstile.getResponse("#admin-turnstile");
    }

    if (!token) {
      Swal.fire({
        icon: 'warning',
        title: 'Security Check',
        text: 'Please fulfill the security verification challenge before logging in.',
        confirmButtonColor: "#0b1e5b"
      });
      return;
    }

    try {
      // Show loading state while validating
      Swal.fire({
        title: 'Verifying...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      // ✅ 2. Authenticate user with Supabase, passing the captchaToken inside options
      const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: token
        }
      });

      if (authError) throw authError;

      // 3. Fetch user profile to verify "admin" role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Could not verify administrative privileges.");
      }

      // 4. Strict Security Check: Only "admin" allowed
      if (profile.role !== "admin") {
        // Log them out immediately if they aren't an admin
        await supabase.auth.signOut();
        throw new Error("Access Denied: Administrative role required.");
      }

      // ✅ 5. Reset Turnstile token on successful login processing
      if (typeof turnstile !== "undefined") turnstile.reset("#admin-turnstile");

      Swal.close();

      // 6. Success popup using your brand color
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
      Swal.close();

      // ✅ 7. Force clear and reset Turnstile so they can solve a new challenge on error
      if (typeof turnstile !== "undefined") turnstile.reset("#admin-turnstile");

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
