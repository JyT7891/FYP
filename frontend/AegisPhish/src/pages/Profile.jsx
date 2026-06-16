// src/pages/Profile.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function StatCard({ label, value, icon, color }) {
  return (
    <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          <span className="text-lg">{icon}</span>
        </div>
        <p className="text-xs text-gray-500 tracking-widest uppercase">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function ActivityBadge({ type }) {
  const styles = {
    scan: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    report: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    login: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md border ${styles[type]}`}>
      {type.toUpperCase()}
    </span>
  );
}

function Field({ label, type = "text", placeholder, value, onChange, error, disabled }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="mb-4">
      <label className="text-sm text-gray-300">{label}</label>
      <div className="relative mt-2">
        <input
          type={isPassword ? (show ? "text" : "password") : type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full p-3 pr-10 rounded-lg bg-gray-800 border outline-none transition text-sm ${
            disabled
              ? "opacity-50 cursor-not-allowed border-gray-700"
              : error
                ? "border-red-500/60 focus:border-red-400"
                : "border-gray-600 focus:border-teal-400"
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition text-xs"
          >
            {show ? "HIDE" : "SHOW"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function Toast({ message, type }) {
  if (!message) return null;
  const styles =
    type === "success"
      ? "bg-teal-500/10 border-teal-500/30 text-teal-400"
      : type === "warning"
        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
        : "bg-red-500/10 border-red-500/30 text-red-400";
  return (
    <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg border text-sm z-50 shadow-lg ${styles}`}>
      {message}
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });
  const [emailChangedWarning, setEmailChangedWarning] = useState(false);

  // Verification code states
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [tempUserId, setTempUserId] = useState("");
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Form states
  const [avatar, setAvatar] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordLoading, setPasswordLoading] = useState(false);

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [userRes, statsRes, scansRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/auth/me", { headers }),
          fetch("http://127.0.0.1:8000/stats", { headers }),
          fetch("http://127.0.0.1:8000/scans/recent", { headers }),
        ]);

        const userData = await userRes.json();
        const statsData = await statsRes.json();
        const scansData = await scansRes.json();

        setUser(userData);
        setProfile({ name: userData.name || "", email: userData.email || "" });
        setStats(statsData);
        setRecentActivity(scansData.scans || []);

        // Load avatar
        if (userData.avatar) {
          let avatarUrl = userData.avatar;
          if (avatarUrl.startsWith("/static")) {
            avatarUrl = `http://127.0.0.1:8000${avatarUrl}`;
          }
          setAvatar(avatarUrl);
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Check if email exists
  const checkEmailExists = async (email) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/auth/check-email?email=${encodeURIComponent(email)}`,
        { headers },
      );
      const data = await res.json();
      return data.exists;
    } catch (error) {
      console.error("Failed to check email:", error);
      return false;
    }
  };

  // Handle profile save
  const handleProfileSave = async () => {
    const e = {};
    if (!profile.name.trim()) e.name = "Name is required.";

    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      e.email = "Enter a valid email address.";
    }

    const emailChanged = profile.email && profile.email !== user?.email;

    if (emailChanged && profile.email) {
      const emailExists = await checkEmailExists(profile.email);
      if (emailExists) {
        e.email = "This email is already registered. Please use a different email address.";
      }
    }

    setProfileErrors(e);
    if (Object.keys(e).length > 0) return;

    setProfileLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/user/profile", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: profile.name,
          email: profile.email || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Update failed.", "error");
        return;
      }

      localStorage.setItem("name", profile.name);

      // If email was changed, show verification modal
      if (emailChanged) {
        setTempUserId(user?.user_id || "");
        setShowVerificationModal(true);
        showToast("A verification code has been sent to your new email address.", "warning");

        // Start resend timer
        setResendDisabled(true);
        setResendTimer(30);
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

        // Refresh user data
        setTimeout(async () => {
          const userRes = await fetch("http://127.0.0.1:8000/api/auth/me", {
            headers,
          });
          const userData = await userRes.json();
          setUser(userData);
        }, 1500);
      } else {
        setUser((prev) => ({ ...prev, name: profile.name }));
        showToast("Profile updated successfully.");
      }

      setIsEditing(false);
    } catch {
      showToast("Could not connect to server.", "error");
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle verification code submission
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showToast("Please enter the 6-digit verification code.", "error");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/user/verify-email-change",  // ← Changed to profile endpoint
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            code: verificationCode,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        showToast(data.detail || "Invalid verification code.", "error");
        return;
      }

      setShowVerificationModal(false);
      setVerificationCode("");
      setEmailChangedWarning(false);
      showToast("Email verified successfully!", "success");

      // Refresh user data
      const userRes = await fetch("http://127.0.0.1:8000/api/auth/me", {
        headers,
      });
      const userData = await userRes.json();
      setUser(userData);
    } catch (err) {
      console.error("Verification error:", err);
      showToast("Could not connect to server.", "error");
    } finally {
      setVerifying(false);
    }
  };

  // Handle resend verification code
  const handleResendCode = async () => {
    if (resendDisabled) return;

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/user/resend-profile-verification",  // ← Changed to profile endpoint
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      if (res.ok) {
        showToast("New verification code sent! Please check your inbox.", "success");
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
        showToast(data.detail || "Failed to resend code.", "error");
      }
    } catch (err) {
      console.error("Resend error:", err);
      showToast("Could not connect to server.", "error");
    }
  };

  // Handle password save
  const handlePasswordSave = async () => {
    const e = {};
    if (!passwords.current) e.current = "Current password is required.";
    if (!passwords.newPass) e.newPass = "New password is required.";
    else if (passwords.newPass.length < 8) e.newPass = "Must be at least 8 characters.";
    if (!passwords.confirm) e.confirm = "Please confirm your new password.";
    else if (passwords.confirm !== passwords.newPass) e.confirm = "Passwords do not match.";
    setPasswordErrors(e);
    if (Object.keys(e).length > 0) return;

    setPasswordLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/user/password", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          current_password: passwords.current,
          new_password: passwords.newPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Password update failed.", "error");
        return;
      }
      setPasswords({ current: "", newPass: "", confirm: "" });
      showToast("Password updated successfully.");
    } catch {
      showToast("Could not connect to server.", "error");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/user/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Upload failed.", "error");
        return;
      }
      const fullUrl = `http://127.0.0.1:8000${data.avatar}`;
      localStorage.setItem("avatar", fullUrl);
      setAvatar(fullUrl);
      showToast("Profile picture updated.");
    } catch {
      showToast("Could not upload image.", "error");
    } finally {
      setAvatarLoading(false);
    }
  };

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/user/avatar", {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error();
      localStorage.removeItem("avatar");
      setAvatar("");
      showToast("Profile picture removed.");
    } catch {
      showToast("Failed to remove picture.", "error");
    } finally {
      setRemovingAvatar(false);
    }
  };

  const getAvatarUrl = () => {
    if (!avatar) return null;
    if (avatar.startsWith("/static")) return `http://127.0.0.1:8000${avatar}`;
    return avatar;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const timeAgo = (dateString) => {
    if (!dateString) return "—";
    const diffMs = new Date() - new Date(dateString);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffMs / 86400000);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020c1b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-teal-500/20 px-6 py-4 bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-base font-semibold">My Profile</h1>
            <p className="text-xs text-gray-500">
              {isEditing ? "Edit your account information" : "View your account information"}
            </p>
          </div>
          <button
            onClick={() => {
              setIsEditing(!isEditing);
              setEmailChangedWarning(false);
              setShowVerificationModal(false);
              if (isEditing) {
                setProfile({ name: user?.name || "", email: user?.email || "" });
                setProfileErrors({});
              }
            }}
            className="px-4 py-2 rounded-lg border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/10 transition flex items-center gap-2"
          >
            {isEditing ? "✕ Cancel" : "✎ Edit Profile"}
          </button>
        </div>
      </header>

      <div className="p-8 space-y-6 w-full max-w-4xl mx-auto">
        {/* Profile Header Card */}
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full bg-teal-500/20 border-2 border-teal-500/30 flex items-center justify-center overflow-hidden">
                {getAvatarUrl() ? (
                  <img src={getAvatarUrl()} alt={user?.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-teal-400">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                )}
              </div>
              {isEditing && (
                <>
                  <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition cursor-pointer text-xs text-white">
                    {avatarLoading ? "…" : "Edit"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                  {avatar && (
                    <button
                      onClick={handleRemoveAvatar}
                      disabled={removingAvatar}
                      className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-red-400 hover:text-red-300 bg-black/70 px-2 py-0.5 rounded-full whitespace-nowrap"
                    >
                      Remove
                    </button>
                  )}
                </>
              )}
            </div>

            {/* User Info - Inline form when editing */}
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                      className="w-full md:w-80 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-teal-400 outline-none transition"
                      placeholder="Your name"
                    />
                    {profileErrors.name && <p className="text-xs text-red-400 mt-1">{profileErrors.name}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Email Address</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                      className="w-full md:w-80 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-teal-400 outline-none transition"
                      placeholder="your@email.com"
                    />
                    {profileErrors.email && <p className="text-xs text-red-400 mt-1">{profileErrors.email}</p>}
                    {profile.email !== user?.email && profile.email && (
                      <p className="text-xs text-orange-400 mt-1">
                        ⚠️ Changing your email will require verification with a 6-digit code
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-white">{user?.name}</h2>
                  <p className="text-sm text-gray-400">{user?.email}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-xs px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 capitalize">
                      {user?.role || "User"}
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-gray-800/60 text-gray-400 border border-gray-600">
                      Member since {formatDate(user?.created_at)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons when editing */}
        {isEditing && (
          <div className="flex gap-4 justify-end">
            <button
              onClick={handleProfileSave}
              disabled={profileLoading}
              className="px-5 py-2.5 rounded-lg bg-teal-500/20 border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/30 transition disabled:opacity-50"
            >
              {profileLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}

        {/* Email Verification Status (only show if not verified) */}
        {!user?.email_verified && !isEditing && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-orange-400">Email Not Verified</p>
                <p className="text-xs text-gray-300">Please verify your email address to secure your account.</p>
              </div>
              <button
                onClick={() => {
                  setTempUserId(user?.user_id || "");
                  setShowVerificationModal(true);
                }}
                className="px-3 py-1.5 rounded-lg border border-orange-500/40 text-orange-400 text-xs hover:bg-orange-500/10 transition"
              >
                Enter Verification Code
              </button>
            </div>
          </div>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Scans" value={stats?.total_scans || 0} icon="🔍" color="bg-teal-500/10" />
          <StatCard label="Phishing Detected" value={stats?.phishing_caught || 0} icon="⚠️" color="bg-red-500/10" />
          <StatCard label="Detection Rate" value={stats?.detection_rate || "0%"} icon="📊" color="bg-purple-500/10" />
          <StatCard label="Avg. Scan Time" value={stats?.avg_scan_time || "1.2s"} icon="⚡" color="bg-blue-500/10" />
        </div>

        {/* Change Password Section (only when editing) */}
        {isEditing && (
          <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
            <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">Change Password</p>
            <div className="max-w-md">
              <Field
                label="Current password"
                type="password"
                placeholder="Enter current password"
                value={passwords.current}
                onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                error={passwordErrors.current}
              />
              <Field
                label="New password"
                type="password"
                placeholder="Enter new password"
                value={passwords.newPass}
                onChange={(e) => setPasswords((p) => ({ ...p, newPass: e.target.value }))}
                error={passwordErrors.newPass}
              />
              <Field
                label="Confirm new password"
                type="password"
                placeholder="Confirm new password"
                value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                error={passwordErrors.confirm}
              />
              <button
                onClick={handlePasswordSave}
                disabled={passwordLoading}
                className="px-5 py-2.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 text-sm hover:bg-teal-500/20 transition disabled:opacity-50"
              >
                {passwordLoading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        )}

        {/* Account Summary Card (view only) */}
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
          <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">Account Summary</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Account ID</span>
              <span className="text-sm font-mono text-gray-300">{user?.user_id?.slice(-8) || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Account Type</span>
              <span className="text-sm capitalize text-gray-300">{user?.role || "User"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Email Verified</span>
              <span className={`text-sm ${user?.email_verified ? "text-teal-400" : "text-orange-400"}`}>
                {user?.email_verified ? "✓ Yes" : "⚠ Pending"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">Member Since</span>
              <span className="text-sm text-gray-300">{formatDate(user?.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] overflow-hidden">
          <div className="px-5 py-4 border-b border-teal-500/20">
            <p className="text-xs text-gray-500 tracking-widest uppercase">Recent Activity</p>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No recent activity.</p>
          ) : (
            <div className="divide-y divide-teal-500/10">
              {recentActivity.map((scan, i) => (
                <div
                  key={i}
                  onClick={() => navigate(`/scan/${scan._id}`)}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ActivityBadge type="scan" />
                      <p className="text-sm font-mono text-gray-300 truncate group-hover:text-teal-400 transition">
                        {scan.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span>{timeAgo(scan.scanned_at)}</span>
                      <span>•</span>
                      <span className={
                        scan.prediction === "Legitimate"
                          ? "text-teal-400"
                          : scan.prediction === "Suspicious"
                            ? "text-orange-400"
                            : "text-red-400"
                      }>
                        {scan.prediction}
                      </span>
                      <span>•</span>
                      <span>Risk: {Math.round(scan.risk_score)}%</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-gray-500 group-hover:text-teal-400 transition">→</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-700 pb-2">
          ▢ AegisPhish · Protecting users from phishing attacks
        </p>
      </div>

      {/* Verification Code Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0a192f] border border-teal-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold mb-2 text-teal-400">Verify Email</h3>
            <p className="text-xs text-gray-400 mb-4">
              Enter the 6-digit verification code sent to your email address.
            </p>

            <div className="mb-4">
              <label className="text-sm text-gray-300">Verification Code</label>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                className="w-full mt-2 p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-teal-400 outline-none transition text-center text-2xl font-mono tracking-widest"
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
              />
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={handleVerifyCode}
                disabled={verifying || verificationCode.length !== 6}
                className="flex-1 px-4 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying ? "Verifying..." : "Verify Code"}
              </button>
            </div>

            <div className="text-center">
              <button
                onClick={handleResendCode}
                disabled={resendDisabled}
                className="text-xs text-gray-500 hover:text-teal-400 transition"
              >
                {resendDisabled ? `Resend code in ${resendTimer}s` : "Didn't receive code? Resend"}
              </button>
            </div>

            <button
              onClick={() => {
                setShowVerificationModal(false);
                setVerificationCode("");
              }}
              className="w-full mt-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <Toast message={toast.message} type={toast.type} />
    </>
  );
}