// src/components/AdminLayout.jsx
import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";

const adminNavItems = [
  { icon: "📊", label: "Dashboard", path: "/admin" },
  { icon: "🔍", label: "All Scans", path: "/admin/scans" },
  { icon: "📋", label: "Reports", path: "/admin/reports" },
  { icon: "👥", label: "Users", path: "/admin/users" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [adminName, setAdminName] = useState(localStorage.getItem("name") || "Admin");
  const [adminAvatar, setAdminAvatar] = useState(localStorage.getItem("avatar") || "");

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // Redirect if not admin
  useEffect(() => {
    if (role !== "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [role, navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  const getActiveNav = () => {
    const exactMatch = adminNavItems.find((item) => item.path === location.pathname);
    if (exactMatch) return exactMatch.label;
    return "Dashboard";
  };

  const activeNav = getActiveNav();

  const getAvatarUrl = () => {
    if (!adminAvatar) return null;
    if (adminAvatar.startsWith("/static")) {
      return `http://127.0.0.1:8000${adminAvatar}`;
    }
    return adminAvatar;
  };

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white flex w-full">
      {/* Admin Sidebar */}
      <aside className="w-64 flex flex-col border-r border-purple-500/20 bg-[#0f0f23] shrink-0 h-screen sticky top-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-purple-500/20">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide">AegisPhish</span>
            <span className="text-xs text-purple-400">Admin Panel</span>
          </div>
        </div>

        {/* Admin Nav */}
        <nav className="flex flex-col gap-1 p-3 mt-2 flex-1">
          {adminNavItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeNav === item.label
                  ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Admin User Section */}
        <div className="p-3 border-t border-purple-500/20">
          <div className="flex items-center gap-3 px-2 py-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xs font-bold shrink-0 overflow-hidden">
              {getAvatarUrl() ? (
                <img src={getAvatarUrl()} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                adminName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-200 truncate font-medium">{adminName}</p>
              <p className="text-xs text-purple-400 truncate">Administrator</p>
            </div>
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-all duration-200"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0 w-full">
        <Outlet />
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0f0f23] border border-purple-500/30 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2 text-purple-400">Confirm Logout</h3>
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to logout from Admin Panel?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}