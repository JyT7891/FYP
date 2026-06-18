// React hook for managing component state
import { useState } from "react";
// Router hook for navigation between pages
import { useNavigate } from "react-router-dom";

// Password strength indicator component
function StrengthBar({ password }) {
  // Calculate password strength score based on rules
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
  // Labels for password strength levels
  const labels = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"];
  // Colors representing password strength levels
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22d3ee", "#14b8a6"];
  // Password requirement checklist
  const requirements = [
    { text: "At least 8 characters", met: password.length >= 8 },
    { text: "At least 12 characters (bonus)", met: password.length >= 12 },
    { text: "Uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { text: "Lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { text: "Number (0-9)", met: /[0-9]/.test(password) },
    {
      text: "Special character (!@#$%^&*)",
      met: /[^A-Za-z0-9]/.test(password),
    },
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

// Reusable form input component with validation display
function InputField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  onKeyDown,
  error,
  children,
}) {
  return (
    <div className="mb-4">
      <label className="text-sm text-gray-300">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={`w-full mt-2 p-3 rounded-lg bg-gray-800 border outline-none transition text-sm ${
          error
            ? "border-red-500/60 focus:border-red-400"
            : "border-gray-600 focus:border-teal-400"
        }`}
      />
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

// Main registration page component with email verification flow
export default function Register() {
  const navigate = useNavigate();

  // User role selection state (user/admin)
  const [role, setRole] = useState("user");
  // Registration flow step (register or verify)
  const [step, setStep] = useState("register"); // 'register' or 'verify'
  // Newly created user ID for verification step
  const [userId, setUserId] = useState(null);
  // Email verification code input state
  const [verificationCode, setVerificationCode] = useState("");
  // Registration form state (name, email, password, confirm)
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  // Selected avatar file for upload
  const [avatarFile, setAvatarFile] = useState(null);
  // Avatar preview image state
  const [avatarPreview, setAvatarPreview] = useState(null);
  // Avatar upload loading state
  const [uploading, setUploading] = useState(false);
  // Form validation error state
  const [errors, setErrors] = useState({});
  // General loading state for registration/verification
  const [loading, setLoading] = useState(false);
  // Global error message state
  const [globalError, setGlobalError] = useState("");
  // Resend verification code cooldown state
  const [resendDisabled, setResendDisabled] = useState(false);
  // Countdown timer for resend verification code
  const [resendTimer, setResendTimer] = useState(0);

  // Generic form field update handler
  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  // Handle avatar image selection and validation
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({
        ...prev,
        avatar: "Please select an image file (JPEG, PNG, WebP).",
      }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        avatar: "Image must be less than 2MB.",
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, avatar: "" }));
    setAvatarFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Upload avatar image to backend server
  const uploadAvatar = async () => {
    if (!avatarFile) return null;

    const formData = new FormData();
    formData.append("file", avatarFile);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/user/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        return `http://127.0.0.1:8000${data.avatar}`;
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    }
    return null;
  };

  // Validate registration form inputs
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 8)
      e.password = "Password must be at least 8 characters.";
    else if (form.password.length > 64)
      e.password = "Password must be less than 64 characters.";
    else if (!/[A-Z]/.test(form.password))
      e.password = "Password must contain at least one uppercase letter.";
    else if (!/[a-z]/.test(form.password))
      e.password = "Password must contain at least one lowercase letter.";
    else if (!/[0-9]/.test(form.password))
      e.password = "Password must contain at least one number.";
    else if (!/[^A-Za-z0-9]/.test(form.password))
      e.password =
        "Password must contain at least one special character (!@#$%^&* etc.).";
    else if (/\s/.test(form.password))
      e.password = "Password cannot contain spaces.";
    if (!form.confirm) e.confirm = "Please confirm your password.";
    else if (form.confirm !== form.password)
      e.confirm = "Passwords do not match.";
    return e;
  };

  // Submit registration request to backend
  const handleRegister = async () => {
    setGlobalError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGlobalError(data.detail || "Registration failed. Please try again.");
        return;
      }

      // Store user ID for verification
      setUserId(data.user_id);

      // Move to verification step
      setStep("verify");

      showToast("Verification email sent! Please check your inbox.");
    } catch (err) {
      console.error("Registration error:", err);
      setGlobalError("Could not connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // Verify email using 6-digit code
  const handleVerifyEmail = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setGlobalError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setGlobalError("");

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/auth/verify-registration",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            code: verificationCode,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setGlobalError(data.detail || "Invalid verification code.");
        return;
      }

      // Store user data after verification
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);

      if (avatarFile) {
        setUploading(true);
        const avatarUrl = await uploadAvatar();
        if (avatarUrl) {
          localStorage.setItem("avatar", avatarUrl);
        }
        setUploading(false);
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Verification error:", err);
      setGlobalError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  // Resend verification email code
  const handleResendCode = async () => {
    if (resendDisabled) return;

    setLoading(true);
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/auth/resend-verification-code",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email }),
        },
      );

      if (res.ok) {
        showToast("New verification code sent!");
        setResendDisabled(true);
        setResendTimer(60);
        const timer = setInterval(() => {
          setResendTimer((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              setResendDisabled(false);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        const data = await res.json();
        setGlobalError(data.detail || "Failed to resend code.");
      }
    } catch (err) {
      setGlobalError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  // Show temporary error/success message
  const showToast = (message) => {
    setGlobalError(message);
    setTimeout(() => setGlobalError(""), 5000);
  };

  // Handle Enter key for form submission
  const handleKey = (e) => {
    if (e.key === "Enter") handleRegister();
  };

  // Handle Enter key for verification step
  const handleVerifyKey = (e) => {
    if (e.key === "Enter") handleVerifyEmail();
  };

  // Registration Form
  if (step === "register") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020c1b] text-white px-4 py-10">
        <div className="w-full max-w-[480px] p-8 rounded-2xl border border-teal-500/30 bg-gradient-to-b from-[#0a192f] to-[#020c1b] shadow-lg">
          {/* Application logo section */}
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
          {/* Page heading section*/}
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold">Create an account</h2>
            <p className="text-gray-400 text-sm">
              Join AegisPhish and stay protected
            </p>
          </div>
           {/* Avatar upload section */}
          <div className="mb-6 flex flex-col items-center">
            <label className="text-sm text-gray-300 mb-2">
              Profile Picture
            </label>
            <div
              className="relative group cursor-pointer"
              onClick={() => document.getElementById("avatar-input").click()}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Profile preview"
                  className="w-24 h-24 rounded-full object-cover border-2 border-teal-500/40 hover:border-teal-400 transition"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-teal-500/20 border-2 border-teal-500/30 flex items-center justify-center hover:border-teal-400 transition group-hover:bg-teal-500/30">
                  <svg
                    className="w-12 h-12 text-teal-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>
            <input
              id="avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-2">
              Click to upload (JPEG, PNG, WebP, max 2MB)
            </p>
            {errors.avatar && (
              <p className="text-xs text-red-400 mt-1 text-center">
                {errors.avatar}
              </p>
            )}
          </div>
          {/* Full name input field*/}
          <InputField
            label="Full name"
            placeholder="Jane Doe"
            value={form.name}
            onChange={set("name")}
            onKeyDown={handleKey}
            error={errors.name}
          />
          {/* Email input field */}
          <InputField
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set("email")}
            onKeyDown={handleKey}
            error={errors.email}
          />
          {/* Password input field with strength indicator */}
          <InputField
            label="Password"
            type="password"
            placeholder="•••••••"
            value={form.password}
            onChange={set("password")}
            onKeyDown={handleKey}
            error={errors.password}
          >
            <StrengthBar password={form.password} />
          </InputField>
          {/* Confirm password input field */}
          <InputField
            label="Confirm password"
            type="password"
            placeholder="•••••••"
            value={form.confirm}
            onChange={set("confirm")}
            onKeyDown={handleKey}
            error={errors.confirm}
          />
          {/* Global error message display */}
          {globalError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
              {globalError}
            </div>
          )}
          {/* Registration submit button */}
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full py-3 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 hover:border-teal-400 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
          {/* Navigation back to login page */}
          <button
            onClick={() => navigate("/")}
            className="w-full mt-3 py-3 rounded-lg border border-gray-500 hover:bg-teal-500/10 hover:border-teal-400 transition text-sm text-gray-400"
          >
            Already have an account? Sign in
          </button>
          {/* Page footer section */}
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

  // Email verification step UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020c1b] text-white px-4 py-10">
      <div className="w-full max-w-[420px] p-8 rounded-2xl border border-teal-500/30 bg-gradient-to-b from-[#0a192f] to-[#020c1b] shadow-lg">
        {/* Application logo section */}
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
        {/* Page heading section */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold">Verify Your Email</h2>
          <p className="text-gray-400 text-sm mt-2">
            We've sent a 6-digit verification code to
          </p>
          <p className="text-teal-400 text-sm font-medium mt-1">{form.email}</p>
        </div>
        {/* Verification code input field */}
        <div className="mb-4">
          <label className="text-sm text-gray-300">Verification Code</label>
          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={verificationCode}
            onChange={(e) =>
              setVerificationCode(
                e.target.value.replace(/[^0-9]/g, "").slice(0, 6),
              )
            }
            onKeyDown={handleVerifyKey}
            className="w-full mt-2 p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-teal-400 outline-none transition text-center text-2xl font-mono tracking-widest"
            maxLength={6}
          />
        </div>
        {/* Verification error message display */}
        {globalError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {globalError}
          </div>
        )}
        {/* Email verification submit button */}
        <button
          onClick={handleVerifyEmail}
          disabled={loading || verificationCode.length !== 6}
          className="w-full py-3 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 hover:border-teal-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Verifying..." : "Verify Email"}
        </button>
        {/* Resend verification code button */}
        <div className="text-center mt-4">
          <button
            onClick={handleResendCode}
            disabled={resendDisabled || loading}
            className="text-xs text-gray-500 hover:text-teal-400 transition"
          >
            {resendDisabled
              ? `Resend code in ${resendTimer}s`
              : "Didn't receive code? Resend"}
          </button>
        </div>
        {/* Back to registration step button */}
        <button
          onClick={() => {
            setStep("register");
            setGlobalError("");
          }}
          className="w-full mt-3 py-3 rounded-lg border border-gray-500 hover:bg-teal-500/10 hover:border-teal-400 transition text-sm text-gray-400"
        >
          Back to Registration
        </button>
        {/* Verification page footer section */}
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
