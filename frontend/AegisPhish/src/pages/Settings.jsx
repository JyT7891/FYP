import { useState, useEffect } from "react";

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
      <p className="text-xs text-gray-500 tracking-widest uppercase mb-5">
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  disabled,
}) {
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
            onClick={() => setShow((s) => !s)}
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
      : "bg-red-500/10 border-red-500/30 text-red-400";
  return (
    <div
      className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg border text-sm z-50 shadow-lg ${styles}`}
    >
      {message}
    </div>
  );
}

export default function Settings() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });

  const userName = localStorage.getItem("name") || "";
  const userRole = localStorage.getItem("role") || "user";
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Profile form
  const [avatar, setAvatar] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [profile, setProfile] = useState({ name: userName, email: "" });
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

  // Delete confirm input
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Load avatar from localStorage on mount
  useEffect(() => {
    const storedAvatar = localStorage.getItem("avatar");
    if (
      storedAvatar &&
      storedAvatar !== "null" &&
      storedAvatar !== "undefined"
    ) {
      // Convert relative path to full URL if needed
      let avatarUrl = storedAvatar;
      if (avatarUrl.startsWith("/static")) {
        avatarUrl = `http://127.0.0.1:8000${avatarUrl}`;
      }
      setAvatar(avatarUrl);
    }
  }, []);

  // Load user email from backend on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/auth/me", {
          headers,
        });
        const data = await res.json();
        if (res.ok && data.email) {
          setProfile((prev) => ({ ...prev, email: data.email }));
        }
        // Also update avatar if it came from backend
        if (res.ok && data.avatar && data.avatar !== "") {
          let avatarUrl = data.avatar;
          if (avatarUrl.startsWith("/static")) {
            avatarUrl = `http://127.0.0.1:8000${avatarUrl}`;
          }
          if (avatarUrl !== avatar) {
            setAvatar(avatarUrl);
            localStorage.setItem("avatar", avatarUrl);
          }
        }
      } catch (err) {
        console.error("Failed to fetch user info:", err);
      }
    };
    fetchUserInfo();
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 3000);
  };

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

      // Dispatch a custom event so Layout can update
      window.dispatchEvent(new Event("avatar-updated"));

      showToast("Profile picture updated.");
    } catch {
      showToast("Could not upload image.", "error");
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/user/avatar", {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        showToast("Failed to remove profile picture.", "error");
        return;
      }

      // Clear avatar from localStorage and state
      localStorage.removeItem("avatar");
      setAvatar("");

      // Dispatch event to update Layout
      window.dispatchEvent(new Event("avatar-updated"));

      showToast("Profile picture removed. Default avatar restored.");
    } catch {
      showToast("Could not connect to server.", "error");
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleProfileSave = async () => {
    const e = {};
    if (!profile.name.trim()) e.name = "Name is required.";
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))
      e.email = "Enter a valid email.";
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

      // Dispatch a custom event so Layout can update
      window.dispatchEvent(new Event("profile-updated"));

      showToast("Profile updated successfully.");
    } catch {
      showToast("Could not connect to server.", "error");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSave = async () => {
    const e = {};
    if (!passwords.current) e.current = "Current password is required.";
    if (!passwords.newPass) e.newPass = "New password is required.";
    else if (passwords.newPass.length < 8)
      e.newPass = "Must be at least 8 characters.";
    if (!passwords.confirm) e.confirm = "Please confirm your new password.";
    else if (passwords.confirm !== passwords.newPass)
      e.confirm = "Passwords do not match.";
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    try {
      const res = await fetch("http://127.0.0.1:8000/api/user/delete", {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        showToast("Failed to delete account.", "error");
        return;
      }
      localStorage.clear();
      window.location.href = "/";
    } catch {
      showToast("Could not connect to server.", "error");
    }
  };

  return (
    <>
      <header className="border-b border-teal-500/20 px-6 py-4 flex items-center justify-between bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="text-base font-semibold">Settings</h1>
          <p className="text-xs text-gray-500">Manage your account</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-500/10 border border-teal-500/30 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse"></span>
          Protected
        </span>
      </header>

      <div className="p-8 space-y-6 w-full max-w-2xl">
        {/* Account Info */}
        <Section title="Account Info">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt="avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-teal-500/40"
                  onError={() => {
                    localStorage.removeItem("avatar");
                    setAvatar("");
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-teal-500/20 border-2 border-teal-500/30 flex items-center justify-center text-teal-400 text-2xl font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition cursor-pointer text-xs text-white">
                {avatarLoading ? "…" : "Edit"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </label>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-200">{userName}</p>
              <p className="text-xs text-teal-400 capitalize mt-0.5">
                {userRole}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Hover over photo to change
              </p>
            </div>
          </div>

          {/* Remove Avatar Button - Only show if user has an avatar */}
          {avatar && (
            <button
              onClick={handleRemoveAvatar}
              disabled={removingAvatar}
              className="mt-2 px-4 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {removingAvatar ? "Removing…" : "Remove Profile Picture"}
            </button>
          )}
        </Section>

        {/* Profile */}
        <Section title="Update Profile">
          <Field
            label="Full name"
            placeholder="Your name"
            value={profile.name}
            onChange={(e) =>
              setProfile((p) => ({ ...p, name: e.target.value }))
            }
            error={profileErrors.name}
          />
          <Field
            label="New email address (optional)"
            type="email"
            placeholder="new@example.com"
            value={profile.email}
            onChange={(e) =>
              setProfile((p) => ({ ...p, email: e.target.value }))
            }
            error={profileErrors.email}
          />
          <button
            onClick={handleProfileSave}
            disabled={profileLoading}
            className="px-5 py-2.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 text-sm hover:bg-teal-500/20 transition disabled:opacity-50"
          >
            {profileLoading ? "Saving…" : "Save changes"}
          </button>
        </Section>

        {/* Password */}
        <Section title="Change Password">
          <Field
            label="Current password"
            type="password"
            placeholder="•••••••"
            value={passwords.current}
            onChange={(e) =>
              setPasswords((p) => ({ ...p, current: e.target.value }))
            }
            error={passwordErrors.current}
          />
          <Field
            label="New password"
            type="password"
            placeholder="•••••••"
            value={passwords.newPass}
            onChange={(e) =>
              setPasswords((p) => ({ ...p, newPass: e.target.value }))
            }
            error={passwordErrors.newPass}
          />
          <Field
            label="Confirm new password"
            type="password"
            placeholder="•••••••"
            value={passwords.confirm}
            onChange={(e) =>
              setPasswords((p) => ({ ...p, confirm: e.target.value }))
            }
            error={passwordErrors.confirm}
          />
          <button
            onClick={handlePasswordSave}
            disabled={passwordLoading}
            className="px-5 py-2.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 text-sm hover:bg-teal-500/20 transition disabled:opacity-50"
          >
            {passwordLoading ? "Updating…" : "Update password"}
          </button>
        </Section>

        {/* Danger Zone */}
        <Section title="Danger Zone">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm font-medium text-red-400 mb-1">
              Delete Account
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Permanently deletes your account and all associated scan history.
              This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-5 py-2.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition"
            >
              Delete my account
            </button>
          </div>
        </Section>

        <p className="text-center text-xs text-gray-700 pb-2">
          ▢ AegisPhish · Real-time phishing detection · All scans are private
        </p>
      </div>

      {/* Delete Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0a192f] border border-red-500/30 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2 text-red-400">
              Delete Account
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              This will permanently delete your account and all scan history.
              This cannot be undone.
            </p>
            <p className="text-xs text-gray-500 mb-2">
              Type <span className="text-red-400 font-mono">DELETE</span> to
              confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 focus:border-red-400 outline-none text-sm mb-4"
              placeholder="DELETE"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE"}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast.message} type={toast.type} />
    </>
  );
}
