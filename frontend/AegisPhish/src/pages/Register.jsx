import { useState } from "react";
import { useNavigate } from "react-router-dom";

function StrengthBar({ password }) {
  const calc = (p) => {
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const score = calc(password);
  const labels = ["", "Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22d3ee", "#14b8a6"];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
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
      <p className="text-xs" style={{ color: colors[score] }}>
        {labels[score]}
      </p>
    </div>
  );
}

function InputField({ label, type = "text", placeholder, value, onChange, onKeyDown, error, children }) {
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

export default function Register() {
  const navigate = useNavigate();

  const [role, setRole] = useState("user");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState("");

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, avatar: "Please select an image file (JPEG, PNG, WebP)." }));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, avatar: "Image must be less than 2MB." }));
      return;
    }

    setErrors((prev) => ({ ...prev, avatar: "" }));
    setAvatarFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

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
        // Return the full URL for the avatar
        return `http://127.0.0.1:8000${data.avatar}`;
      } else {
        console.error("Avatar upload failed:", data.detail);
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    }
    return null;
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Enter a valid email address.";
    if (!form.password) e.password = "Password is required.";
    else if (form.password.length < 8)
      e.password = "Password must be at least 8 characters.";
    if (!form.confirm) e.confirm = "Please confirm your password.";
    else if (form.confirm !== form.password)
      e.confirm = "Passwords do not match.";
    return e;
  };

  const handleRegister = async () => {
    setGlobalError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      // First, register the user
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

      // Store token from registration
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);

      // Upload avatar if selected
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
      console.error("Registration error:", err);
      setGlobalError("Could not connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleRegister();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020c1b] text-white px-4 py-10">
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

        {/* Heading */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold">Create an account</h2>
          <p className="text-gray-400 text-sm">
            Join AegisPhish and stay protected
          </p>
        </div>

        {/* Profile Picture Upload */}
        <div className="mb-6 flex flex-col items-center">
          <label className="text-sm text-gray-300 mb-2">Profile Picture</label>
          <div className="relative group cursor-pointer" onClick={() => document.getElementById("avatar-input").click()}>
            {/* Avatar Preview or Default */}
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Profile preview"
                className="w-24 h-24 rounded-full object-cover border-2 border-teal-500/40 hover:border-teal-400 transition"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-teal-500/20 border-2 border-teal-500/30 flex items-center justify-center hover:border-teal-400 transition group-hover:bg-teal-500/30">
                <svg className="w-12 h-12 text-teal-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            )}
            
            {/* Upload Overlay */}
            <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
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
            <p className="text-xs text-red-400 mt-1 text-center">{errors.avatar}</p>
          )}
        </div>

        {/* Role Selection */}
        <div className="flex gap-4 mb-6">
          {["user", "admin"].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex-1 py-3 rounded-lg border transition hover:bg-teal-500/10 capitalize ${
                role === r
                  ? "border-teal-400 bg-teal-500/10"
                  : "border-gray-600 hover:border-teal-400"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Full Name */}
        <InputField
          label="Full name"
          placeholder="Jane Doe"
          value={form.name}
          onChange={set("name")}
          onKeyDown={handleKey}
          error={errors.name}
        />

        {/* Email */}
        <InputField
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={set("email")}
          onKeyDown={handleKey}
          error={errors.email}
        />

        {/* Password */}
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

        {/* Confirm Password */}
        <InputField
          label="Confirm password"
          type="password"
          placeholder="•••••••"
          value={form.confirm}
          onChange={set("confirm")}
          onKeyDown={handleKey}
          error={errors.confirm}
        />

        {/* Global error */}
        {globalError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {globalError}
          </div>
        )}

        {/* Register Button */}
        <button
          onClick={handleRegister}
          disabled={loading || uploading}
          className="w-full py-3 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 hover:border-teal-400 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {uploading ? "Uploading photo…" : loading ? "Creating account…" : "Create account"}
        </button>

        {/* Back to login */}
        <button
          onClick={() => navigate("/")}
          className="w-full mt-3 py-3 rounded-lg border border-gray-500 hover:bg-teal-500/10 hover:border-teal-400 transition text-sm text-gray-400"
        >
          Already have an account? Sign in
        </button>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-gray-500">
          <p className="mb-2">secured by AegisPhish</p>
          <p className="text-teal-400">▢ Protected · Real-time phishing detection</p>
        </div>
      </div>
    </div>
  );
}