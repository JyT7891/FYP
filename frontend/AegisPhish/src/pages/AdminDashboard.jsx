// src/pages/AdminDashboard.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 tracking-widest uppercase">
          {label}
        </p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function ReportModal({ report, onClose, onResolve, onDismiss, resolving }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#0a192f] border border-teal-500/30 rounded-xl p-6 max-w-lg w-full shadow-2xl">
        <h3 className="text-base font-semibold mb-2">Report Details</h3>
        <div className="space-y-3 mb-4">
          <div>
            <p className="text-xs text-gray-500">URL</p>
            <p className="text-sm font-mono text-red-400 break-all">
              {report?.url}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Reported By</p>
            <p className="text-sm text-gray-300">
              {report?.reported_by || "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Reported At</p>
            <p className="text-sm text-gray-300">
              {report?.reported_at
                ? new Date(report.reported_at).toLocaleString()
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Note</p>
            <p className="text-sm text-gray-400">
              {report?.note || "No additional notes"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onResolve}
            disabled={resolving}
            className="flex-1 px-4 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resolving ? "Processing..." : "✓ Resolve"}
          </button>
          <button
            onClick={onDismiss}
            disabled={resolving}
            className="flex-1 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resolving ? "Processing..." : "✗ Dismiss"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalScans: 0,
    totalReports: 0,
    pendingReports: 0,
    phishingDetected: 0,
  });
  const [recentScans, setRecentScans] = useState([]);
  const [pendingReports, setPendingReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");

  // Redirect if not admin
  useEffect(() => {
    if (userRole !== "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [userRole, navigate]);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const fetchData = async () => {
    try {
      console.log("📊 Fetching admin data...");
      
      // Use Promise.all for parallel requests (faster)
      const [statsRes, scansRes, reportsRes] = await Promise.all([
        fetch("http://127.0.0.1:8000/admin/stats", { headers }),
        fetch("http://127.0.0.1:8000/admin/scans", { headers }),
        fetch("http://127.0.0.1:8000/admin/reports", { headers }),
      ]);

      const statsData = await statsRes.json();
      const scansData = await scansRes.json();
      const reportsData = await reportsRes.json();

      console.log("📊 Stats:", statsData);
      console.log("📋 Pending reports:", reportsData.reports?.length || 0);

      setStats({
        totalUsers: statsData.total_users || 0,
        totalScans: statsData.total_scans || 0,
        totalReports: statsData.total_reports || 0,
        pendingReports: statsData.pending_reports || 0,
        phishingDetected: statsData.phishing_detected || 0,
      });

      setRecentScans(scansData.scans?.slice(0, 10) || []);
      setPendingReports(reportsData.reports || []);
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleResolveReport = async (reportId) => {
    setResolving(true);
    try {
      console.log("🔧 Resolving report:", reportId);
      const res = await fetch(
        `http://127.0.0.1:8000/admin/reports/${reportId}/resolve`,
        {
          method: "POST",
          headers,
        }
      );
      
      const data = await res.json();
      console.log("📊 Resolve response:", data);
      
      if (res.ok) {
        // Remove from local state
        setPendingReports((prev) => prev.filter((r) => r._id !== reportId));
        setSelectedReport(null);
        // Refresh stats
        await fetchData();
      } else {
        console.error("Failed to resolve:", data.detail);
        alert(data.detail || "Failed to resolve report");
      }
    } catch (error) {
      console.error("Failed to resolve report:", error);
      alert("Could not connect to server");
    } finally {
      setResolving(false);
    }
  };

  const handleDismissReport = async (reportId) => {
    setResolving(true);
    try {
      console.log("🔧 Dismissing report:", reportId);
      const res = await fetch(
        `http://127.0.0.1:8000/admin/reports/${reportId}/dismiss`,
        {
          method: "POST",
          headers,
        }
      );
      
      const data = await res.json();
      console.log("📊 Dismiss response:", data);
      
      if (res.ok) {
        // Remove from local state
        setPendingReports((prev) => prev.filter((r) => r._id !== reportId));
        setSelectedReport(null);
        // Refresh stats
        await fetchData();
      } else {
        console.error("Failed to dismiss:", data.detail);
        alert(data.detail || "Failed to dismiss report");
      }
    } catch (error) {
      console.error("Failed to dismiss report:", error);
      alert("Could not connect to server");
    } finally {
      setResolving(false);
    }
  };

  const handleClearCache = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/admin/cache/clear", {
        method: "POST",
        headers,
      });
      if (res.ok) {
        alert("Cache cleared successfully!");
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to clear cache:", error);
      alert("Failed to clear cache");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020c1b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020c1b] text-white">
      {/* Header */}
      <header className="border-b border-teal-500/20 px-6 py-4 flex items-center justify-between bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="text-base font-semibold">Admin Dashboard</h1>
          <p className="text-xs text-gray-500">System overview & management</p>
        </div>
        {/* Removed Refresh, Clear Cache, and Logout buttons */}
        <span className="flex items-center gap-1.5 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></span>
          Admin
        </span>
      </header>

      {/* Main Content */}
      <div className="p-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Total Users"
            value={stats.totalUsers}
            sub="Registered accounts"
            accent="text-white"
            icon="👥"
          />
          <StatCard
            label="Total Scans"
            value={stats.totalScans}
            sub="All time"
            accent="text-teal-400"
            icon="🔍"
          />
          <StatCard
            label="Phishing Detected"
            value={stats.phishingDetected}
            sub="Across all users"
            accent="text-red-400"
            icon="⚠️"
          />
          <StatCard
            label="Total Reports"
            value={stats.totalReports}
            sub="All time"
            accent="text-orange-400"
            icon="📋"
          />
          <StatCard
            label="Pending Reports"
            value={stats.pendingReports}
            sub="Awaiting action"
            accent="text-yellow-400"
            icon="⏳"
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Scans Table */}
          <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] overflow-hidden">
            <div className="px-5 py-4 border-b border-teal-500/20">
              <p className="text-xs text-gray-500 tracking-widest uppercase">
                Recent Scans
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Latest 10 scans across all users
              </p>
            </div>
            <div className="divide-y divide-teal-500/10 max-h-[400px] overflow-y-auto">
              {recentScans.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">
                  No scans yet
                </p>
              ) : (
                recentScans.map((scan, i) => (
                  <div
                    key={i}
                    className="px-5 py-3 hover:bg-white/[0.02] transition"
                  >
                    <p className="text-sm font-mono text-gray-300 truncate">
                      {scan.url}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          scan.prediction === "Legitimate"
                            ? "bg-teal-500/10 text-teal-400"
                            : scan.prediction === "Suspicious"
                              ? "bg-orange-500/10 text-orange-400"
                              : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {scan.prediction}
                      </span>
                      <span className="text-gray-500">{scan.risk_score}%</span>
                      <span className="text-gray-600">
                        {scan.scanned_at
                          ? new Date(scan.scanned_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-teal-500/10 text-center">
              <button
                onClick={() => navigate("/admin/scans")}
                className="text-xs text-teal-400 hover:underline"
              >
                View all scans →
              </button>
            </div>
          </div>

          {/* Pending Reports */}
          <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] overflow-hidden">
            <div className="px-5 py-4 border-b border-teal-500/20">
              <p className="text-xs text-gray-500 tracking-widest uppercase">
                Pending Reports
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                URLs reported by users needing review
              </p>
            </div>
            <div className="divide-y divide-teal-500/10 max-h-[400px] overflow-y-auto">
              {pendingReports.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-8">
                  No pending reports
                </p>
              ) : (
                pendingReports.map((report) => (
                  <div
                    key={report._id}
                    onClick={() => setSelectedReport(report)}
                    className="px-5 py-3 hover:bg-white/[0.02] transition cursor-pointer"
                  >
                    <p className="text-sm font-mono text-red-400 truncate">
                      {report.url}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-gray-500">
                        Reported:{" "}
                        {report.reported_at
                          ? new Date(report.reported_at).toLocaleDateString()
                          : "—"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReport(report);
                        }}
                        className="text-teal-400 hover:underline"
                      >
                        Details →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-700 pb-2">
          ▢ AegisPhish Admin · System monitoring & threat management
        </p>
      </div>

      {/* Report Modal */}
      {selectedReport && (
        <ReportModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onResolve={() => handleResolveReport(selectedReport._id)}
          onDismiss={() => handleDismissReport(selectedReport._id)}
          resolving={resolving}
        />
      )}
    </div>
  );
}