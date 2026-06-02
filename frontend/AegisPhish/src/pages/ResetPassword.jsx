// src/pages/ResetPassword.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

function StrengthBar({ password }) {
  const calc = (p) => {
    if (!p) return 0;
    let score = 0;
    
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (!/\s/.test(p) && p.length > 0) score++;
    
    return Math.min(score, 5);
  };

  const score = calc(password);
  const labels = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22d3ee", "#14b8a6"];
  const requirements = [
    { text: "At least 8 characters", met: password.length >= 8 },
    { text: "At least 12 characters (bonus)", met: password.length >= 12 },
    { text: "Uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { text: "Lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { text: "Number (0-9)", met: /[0-9]/.test(password) },
    { text: "Special character (!@#$%^&*)", met: /[^A-Za-z0-9]/.test(password) },
    { text: "No spaces", met: !/\s/.test(password) && password.length > 0 },
  ];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= score ? colors[score] : "#1f2937",
            }}
          />
        ))}
      </div>
      <p className="text-xs mb-2" style={{ color: colors[score] }}>
        {labels[score]}
      </p>
      
      {/* Password requirements list */}
      <div className="space-y-1 text-xs">
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={req.met ? "text-teal-400" : "text-gray-600"}>
              {req.met ? "✓" : "○"}
            </span>
            <span className={req.met ? "text-gray-300" : "text-gray-500"}>
              {req.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (!tokenParam) {
      setError("Invalid reset link. Please request a new one.");
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const validatePassword = () => {
    if (!password) {
      return "Please enter a new password.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (password.length > 64) {
      return "Password must be less than 64 characters.";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number.";
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return "Password must contain at least one special character (!@#$%^&* etc.).";
    }
    if (/\s/.test(password)) {
      return "Password cannot contain spaces.";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }
    return null;
  };

  const handleResetPassword = async () => {
    setError("");
    setMessage("");

    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Failed to reset password.");
        return;
      }

      setMessage("Password reset successfully! Redirecting to login...");
      setTimeout(() => navigate("/"), 3000);
    } catch (err) {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020c1b] text-white">
      <div className="w-full max-w-[420px] p-8 rounded-2xl border border-teal-500/30 bg-gradient-to-b from-[#0a192f] to-[#020c1b] shadow-lg">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold">Reset Password</h2>
          <p className="text-gray-400 text-sm mt-2">
            Enter your new password below.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm text-center">
            {message}
          </div>
        )}

        <div className="mb-4">
          <label className="text-sm text-gray-300">New Password</label>
          <div className="relative mt-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="•••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-teal-400 outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
            >
              {showPassword ? "HIDE" : "SHOW"}
            </button>
          </div>
          <StrengthBar password={password} />
        </div>

        <div className="mb-6">
          <label className="text-sm text-gray-300">Confirm New Password</label>
          <div className="relative mt-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="•••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-teal-400 outline-none transition"
            />
          </div>
        </div>

        <button
          onClick={handleResetPassword}
          disabled={loading}
          className="w-full py-3 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>

        <button
          onClick={() => navigate("/")}
          className="w-full mt-3 py-3 rounded-lg border border-gray-500 hover:bg-teal-500/10 transition"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}