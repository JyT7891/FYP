import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [role, setRole] = useState("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();

  const handleSignIn = async () => {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
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

      // Store user data in localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);
      
      // Store avatar if present
      if (data.avatar) {
        localStorage.setItem("avatar", data.avatar);
      } else {
        localStorage.removeItem("avatar");
      }
      
      // Redirect based on role
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

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      setResetMessage("Please enter your email address.");
      return;
    }

    setResetLoading(true);
    setResetMessage("");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResetMessage(data.detail || "Failed to send reset email.");
        return;
      }

      setResetMessage("Password reset email sent! Please check your inbox.");
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmail("");
        setResetMessage("");
      }, 3000);
    } catch (err) {
      setResetMessage("Could not connect to server. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020c1b] text-white">
      <div className="w-full max-w-[420px] p-8 rounded-2xl border border-teal-500/30 bg-gradient-to-b from-[#0a192f] to-[#020c1b] shadow-lg">
        {/* Logo */}
        <div className="flex justify-center gap-4 mb-6">
          <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <div className="w-6 h-6 border-2 border-white rounded"></div>
          </div>
          <div className="flex flex-col items-start leading-tight text-left">
            <h1 className="text-xl font-semibold leading-tight m-0">AegisPhish</h1>
            <p className="text-teal-400 text-sm tracking-widest leading-tight m-0">
              PHISHING DETECTION
            </p>
          </div>
        </div>

        {!showForgotPassword ? (
          // Login Form
          <>
            {/* Welcome */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Welcome back</h2>
              <p className="text-gray-400 text-sm">Sign in to continue to AegisPhish</p>
            </div>

            {/* Role Selection */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setRole("user")}
                className={`flex-1 py-3 rounded-lg border transition hover:bg-teal-500/10 ${
                  role === "user"
                    ? "border-teal-400 bg-teal-500/10"
                    : "border-gray-600 hover:border-teal-400"
                }`}
              >
                User
              </button>
              <button
                onClick={() => setRole("admin")}
                className={`flex-1 py-3 rounded-lg border transition hover:bg-teal-500/10 ${
                  role === "admin"
                    ? "border-teal-400 bg-teal-500/10"
                    : "border-gray-600 hover:border-teal-400"
                }`}
              >
                Admin
              </button>
            </div>

            {/* Email */}
            <div className="mb-4">
              <label className="text-sm text-gray-300">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                className="w-full mt-2 p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-teal-400 outline-none transition"
              />
            </div>

            {/* Password with Show/Hide Toggle */}
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
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-teal-400 hover:text-teal-300 transition hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Sign In Button */}
            <button
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
          // Forgot Password Form
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Reset Password</h2>
              <p className="text-gray-400 text-sm mt-2">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            {/* Email */}
            <div className="mb-4">
              <label className="text-sm text-gray-300">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleForgotPassword()}
                className="w-full mt-2 p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-teal-400 outline-none transition"
              />
            </div>

            {/* Reset Message */}
            {resetMessage && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm text-center ${
                resetMessage.includes("sent") 
                  ? "bg-teal-500/10 border border-teal-500/30 text-teal-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}>
                {resetMessage}
              </div>
            )}

            {/* Send Reset Button */}
            <button
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="w-full py-3 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 hover:border-teal-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetLoading ? "Sending..." : "Send Reset Link"}
            </button>

            {/* Back to Login Button */}
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetEmail("");
                setResetMessage("");
              }}
              className="w-full mt-3 py-3 rounded-lg border border-gray-500 hover:bg-teal-500/10 hover:border-teal-400 transition"
            >
              Back to Login
            </button>
          </>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500">
          <p className="mb-2">secured by AegisPhish</p>
          <p className="text-teal-400">▢ Protected · Real-time phishing detection</p>
        </div>
      </div>
    </div>
  );
}