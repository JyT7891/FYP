import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { icon: "▣", label: "Dashboard", path: "/dashboard" },
  { icon: "⬡", label: "Scan URL", path: "/scan" },
  { icon: "☰", label: "Reports", path: "/reports" },
  { icon: "◎", label: "Settings", path: "/settings" },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [avatar, setAvatar] = useState(localStorage.getItem("avatar") || "");
  const [userName, setUserName] = useState(localStorage.getItem("name") || "User");
  const userRole = localStorage.getItem("role") || "user";

  // Load avatar and name from localStorage on mount
  useEffect(() => {
    const storedAvatar = localStorage.getItem("avatar");
    const storedName = localStorage.getItem("name");
    if (storedAvatar && storedAvatar !== "null" && storedAvatar !== "undefined") {
      setAvatar(storedAvatar);
    }
    if (storedName) {
      setUserName(storedName);
    }
  }, []);

  // Listen for avatar and profile updates
  useEffect(() => {
    const handleAvatarUpdate = () => {
      const updatedAvatar = localStorage.getItem("avatar");
      if (updatedAvatar && updatedAvatar !== "null" && updatedAvatar !== "undefined") {
        setAvatar(updatedAvatar);
      } else {
        setAvatar("");
      }
    };

    const handleProfileUpdate = () => {
      const updatedName = localStorage.getItem("name");
      if (updatedName) {
        setUserName(updatedName);
      }
    };

    window.addEventListener("avatar-updated", handleAvatarUpdate);
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      window.removeEventListener("avatar-updated", handleAvatarUpdate);
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    localStorage.removeItem("email");
    localStorage.removeItem("avatar");
    navigate("/", { replace: true });
  };

  const activeNav = navItems.find((item) => item.path === location.pathname)?.label || "Dashboard";

  // Construct full avatar URL if needed
  const getAvatarUrl = () => {
    if (!avatar) return null;
    if (avatar.startsWith("/static")) {
      return `http://127.0.0.1:8000${avatar}`;
    }
    return avatar;
  };

  return (
    <div className="min-h-screen bg-[#020c1b] text-white flex w-full">
      {/* Sidebar */}
      <aside className="w-16 md:w-56 flex flex-col border-r border-teal-500/20 bg-[#040d1a] shrink-0 h-screen sticky top-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-teal-500/20">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
          </div>
          <span className="hidden md:block text-sm font-semibold tracking-wide">
            AegisPhish
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-2 mt-2 flex-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeNav === item.label
                  ? "bg-teal-500/15 text-teal-400 border border-teal-500/30"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="hidden md:block">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Section with Logout */}
        <div className="p-3 border-t border-teal-500/20">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            {/* Avatar - Show uploaded image or default initial */}
            <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 text-xs font-bold shrink-0 overflow-hidden">
              {getAvatarUrl() ? (
                <img 
                  src={getAvatarUrl()} 
                  alt="avatar" 
                  className="w-full h-full object-cover"
                  onError={() => {
                    localStorage.removeItem("avatar");
                    setAvatar("");
                  }}
                />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="hidden md:block flex-1 min-w-0">
              <p className="text-xs text-gray-200 truncate font-medium">{userName}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{userRole}</p>
            </div>
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full hidden md:flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-all duration-200"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="md:hidden w-full flex items-center justify-center px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all duration-200"
            title="Logout"
          >
            <span>🚪</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0a192f] border border-teal-500/30 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-2">Confirm Logout</h3>
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to logout? You'll need to login again to access your dashboard.
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0 w-full">
        <Outlet />
      </main>
    </div>
  );
}