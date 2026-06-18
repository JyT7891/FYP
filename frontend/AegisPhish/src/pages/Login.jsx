// React state management hook for form inputs and UI state
import { useState } from "react";
// Router navigation hook for redirecting between pages
import { useNavigate } from "react-router-dom";

// Main Login page component handling authentication and password reset
export default function Login() {
  // Email input state for login form
  const [email, setEmail] = useState("");
  // Password input state for login form
  const [password, setPassword] = useState("");
  // Toggle password visibility state
  const [showPassword, setShowPassword] = useState(false);
  // Login error message state
  const [error, setError] = useState("");
  // Email validation error state (login form)
  const [emailError, setEmailError] = useState("");
  // Loading state for login request
  const [loading, setLoading] = useState(false);
  // Toggle forgot password form visibility
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  // Email input state for password reset
  const [resetEmail, setResetEmail] = useState("");
  // Reset password success/error message
  const [resetMessage, setResetMessage] = useState("");
  // Reset message type (success/error)
  const [resetMessageType, setResetMessageType] = useState("");
  // Reset email validation error state
  const [resetEmailError, setResetEmailError] = useState("");
  // Loading state for password reset request
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();

  // Validate email format using regex
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle login email input changes with validation
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    if (value && !validateEmail(value.trim())) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  };

  // Handle reset email input changes with validation
  const handleResetEmailChange = (e) => {
    const value = e.target.value;
    setResetEmail(value);

    if (value && !validateEmail(value.trim())) {
      setResetEmailError("Please enter a valid email address.");
    } else {
      setResetEmailError("");
    }
  };

  // Handle user login authentication request
  const handleSignIn = async () => {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    if (!validateEmail(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Invalid email or password.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);

      if (data.avatar) {
        localStorage.setItem("avatar", data.avatar);
      } else {
        localStorage.removeItem("avatar");
      }

      if (data.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError("Could not connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // Handle forgot password request and email sending
  const handleForgotPassword = async () => {
    // Reset message
    setResetMessage("");
    setResetMessageType("");

    // Check if email is empty
    if (!resetEmail.trim()) {
      setResetEmailError("Please enter your email address.");
      return;
    }

    // Validate email format
    if (!validateEmail(resetEmail.trim())) {
      setResetEmailError("Please enter a valid email address.");
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/auth/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resetEmail.trim() }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setResetMessage(data.detail || "Failed to send reset email.");
        setResetMessageType("error");
        return;
      }

      // Check if the backend returned a success flag
      if (data.success === true) {
        setResetMessage("Password reset email sent! Please check your inbox.");
        setResetMessageType("success");
      } else {
        // Generic message for security (email not found or other issues)
        // But we don't tell the user if the email exists or not
        setResetMessage(
          "If your email is registered, you will receive a reset link.",
        );
        setResetMessageType("success");
      }

      // Clear the error state
      setResetEmailError("");

      // Do NOT jump back to login page automatically
      // User can manually click "Back to Login" when ready
    } catch (err) {
      setResetMessage("Could not connect to server. Please try again.");
      setResetMessageType("error");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020c1b] text-white">
      <div className="w-full max-w-[420px] p-8 rounded-2xl border border-teal-500/30 bg-gradient-to-b from-[#0a192f] to-[#020c1b] shadow-lg">
        {/* Application logo section */}
        {/* Logo */}
        <div className="flex justify-center gap-4 mb-6">
          <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 border-2 border-white rounded"></div>
          </div>
          <div className="flex flex-col items-start leading-tight text-left">
            <h1 className="text-xl font-semibold leading-tight m-0">
              AegisPhish
            </h1>
            <p className="text-teal-400 text-sm tracking-widest leading-tight m-0">
              PHISHING DETECTION
            </p>
          </div>
        </div>

        {/* Login form section */}
        {!showForgotPassword ? (
          // Login form section
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Welcome back</h2>
              <p className="text-gray-400 text-sm">
                Sign in to continue to AegisPhish
              </p>
            </div>

            {/* Email with validation */}
            <div className="mb-4">
              <label className="text-sm text-gray-300">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={handleEmailChange}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                className={`w-full mt-2 p-3 rounded-lg bg-gray-800 border outline-none transition ${
                  emailError
                    ? "border-red-500 focus:border-red-400"
                    : "border-gray-600 focus:border-teal-400"
                }`}
              />
              {emailError && (
                <p className="text-xs text-red-400 mt-1">{emailError}</p>
              )}
            </div>

            {/* Password */}
            <div className="mb-2">
              <label className="text-sm text-gray-300">Password</label>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="•••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                  className="w-full p-3 pr-12 rounded-lg bg-gray-800 border border-gray-600 focus:border-teal-400 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition text-xs"
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right mb-6">
              <button
                onClick={() => {
                  setShowForgotPassword(true);
                  setResetMessage("");
                  setResetMessageType("");
                  setResetEmailError("");
                }}
                className="text-xs text-teal-400 hover:text-teal-300 transition hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Login error message display */}
            {error && (
              // Login error message display
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Login submit button */}
            <button
              // Login submit button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full py-3 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 hover:border-teal-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            {/* Register Button */}
            <button
              onClick={() => navigate("/register")}
              className="w-full mt-3 py-3 rounded-lg border border-gray-500 hover:bg-teal-500/10 hover:border-teal-400 transition"
            >
              Register
            </button>
          </>
        ) : (
          // Forgot password form section
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Reset Password</h2>
              <p className="text-gray-400 text-sm mt-2">
                Enter your email address and we'll send you a link to reset your
                password.
              </p>
            </div>

            {/* Email with validation */}
            <div className="mb-4">
              <label className="text-sm text-gray-300">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={handleResetEmailChange}
                onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                className={`w-full mt-2 p-3 rounded-lg bg-gray-800 border outline-none transition ${
                  resetEmailError
                    ? "border-red-500 focus:border-red-400"
                    : "border-gray-600 focus:border-teal-400"
                }`}
              />
              {resetEmailError && (
                <p className="text-xs text-red-400 mt-1">{resetEmailError}</p>
              )}
            </div>

            {/* Password reset status message display */}
            {resetMessage && (
              // Password reset status message display
              <div
                className={`mb-4 px-4 py-3 rounded-lg text-sm text-center ${
                  resetMessageType === "success"
                    ? "bg-teal-500/10 border border-teal-500/30 text-teal-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}
              >
                {resetMessage}
              </div>
            )}

            {/* Send password reset email button */}
            <button
              // Send password reset email button
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="w-full py-3 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 hover:border-teal-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetLoading ? "Sending..." : "Send Reset Link"}
            </button>

            {/* Back to login form button */}
            <button
              // Back to login form button
              onClick={() => {
                setShowForgotPassword(false);
                setResetEmail("");
                setResetMessage("");
                setResetMessageType("");
                setResetEmailError("");
              }}
              className="w-full mt-3 py-3 rounded-lg border border-gray-500 hover:bg-teal-500/10 hover:border-teal-400 transition"
            >
              Back to Login
            </button>
          </>
        )}

        <div className="text-center mt-6 text-xs text-gray-500">
          <p className="mb-2">secured by AegisPhish</p>
          <p className="text-teal-400">
            ▢ Protected · Real-time phishing detection
          </p>
        </div>
      </div>
    </div>
  );
}
