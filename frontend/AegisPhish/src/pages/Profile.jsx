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

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Fetch user info
        const userRes = await fetch("http://127.0.0.1:8000/api/auth/me", { headers });
        const userData = await userRes.json();
        
        // Fetch user stats
        const statsRes = await fetch("http://127.0.0.1:8000/stats", { headers });
        const statsData = await statsRes.json();
        
        // Fetch recent scans for activity
        const scansRes = await fetch("http://127.0.0.1:8000/scans/recent", { headers });
        const scansData = await scansRes.json();
        
        setUser(userData);
        setStats(statsData);
        setRecentActivity(scansData.scans || []);
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, []);

  // Get avatar URL
  const getAvatarUrl = () => {
    if (!user?.avatar) return null;
    if (user.avatar.startsWith("/static")) {
      return `http://127.0.0.1:8000${user.avatar}`;
    }
    return user.avatar;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format time ago
  const timeAgo = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  if (loading) {
    return (
      <>
        <header className="border-b border-teal-500/20 px-6 py-4 bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
          <h1 className="text-base font-semibold">My Profile</h1>
          <p className="text-xs text-gray-500">View your account information</p>
        </header>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading profile...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="border-b border-teal-500/20 px-6 py-4 bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-base font-semibold">My Profile</h1>
            <p className="text-xs text-gray-500">View your account information</p>
          </div>
          <button
            onClick={() => navigate("/settings")}
            className="px-4 py-2 rounded-lg border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/10 transition flex items-center gap-2"
          >
            ⚙️ Edit Profile
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
                  <img 
                    src={getAvatarUrl()} 
                    alt={user?.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentElement.innerHTML = user?.name?.charAt(0).toUpperCase() || "U";
                    }}
                  />
                ) : (
                  <span className="text-3xl font-bold text-teal-400">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                )}
              </div>
            </div>
            
            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-semibold text-white">{user?.name}</h2>
              <p className="text-sm text-gray-400">{user?.email}</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                <span className="text-xs px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30 capitalize">
                  {user?.role || "User"}
                </span>
                <span className="text-xs px-3 py-1 rounded-full bg-gray-800/60 text-gray-400 border border-gray-600">
                  Member since {formatDate(user?.created_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            label="Total Scans" 
            value={stats?.total_scans || 0} 
            icon="🔍" 
            color="bg-teal-500/10"
          />
          <StatCard 
            label="Phishing Detected" 
            value={stats?.phishing_caught || 0} 
            icon="⚠️" 
            color="bg-red-500/10"
          />
          <StatCard 
            label="Detection Rate" 
            value={stats?.detection_rate || "0%"} 
            icon="📊" 
            color="bg-purple-500/10"
          />
          <StatCard 
            label="Avg. Scan Time" 
            value={stats?.avg_scan_time || "1.2s"} 
            icon="⚡" 
            color="bg-blue-500/10"
          />
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] overflow-hidden">
          <div className="px-5 py-4 border-b border-teal-500/20">
            <p className="text-xs text-gray-500 tracking-widest uppercase">Recent Activity</p>
            <p className="text-xs text-gray-600 mt-0.5">Your latest scans and actions</p>
          </div>
          
          {recentActivity.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-12">
              No recent activity. Start scanning URLs to see your activity here!
            </p>
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
                      <span className={`${
                        scan.prediction === "Legitimate" ? "text-teal-400" :
                        scan.prediction === "Suspicious" ? "text-orange-400" :
                        "text-red-400"
                      }`}>
                        {scan.prediction}
                      </span>
                      <span>•</span>
                      <span>Risk: {Math.round(scan.risk_score)}%</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-gray-500 group-hover:text-teal-400 transition">
                    →
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {recentActivity.length > 0 && (
            <div className="px-5 py-3 border-t border-teal-500/10">
              <button
                onClick={() => navigate("/reports")}
                className="text-xs text-teal-400 hover:underline"
              >
                View all scans →
              </button>
            </div>
          )}
        </div>

        {/* Account Summary Card */}
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
              <span className="text-sm text-teal-400">✓ Yes</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-sm text-gray-400">2FA Status</span>
              <span className="text-sm text-gray-400">Disabled</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-4 justify-center pt-4">
          <button
            onClick={() => navigate("/scan")}
            className="px-5 py-2.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 text-sm hover:bg-teal-500/20 transition"
          >
            🔍 New Scan
          </button>
          <button
            onClick={() => navigate("/reports")}
            className="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-400 text-sm hover:bg-white/5 transition"
          >
            📊 View Reports
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-400 text-sm hover:bg-white/5 transition"
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 pt-4">
          ▢ AegisPhish · Protecting users from phishing attacks
        </p>
      </div>
    </>
  );
}