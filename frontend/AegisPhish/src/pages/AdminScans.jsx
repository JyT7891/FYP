// Admin scans page for viewing, filtering, and managing all URL scan records
// src/pages/AdminScans.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Main Admin Scans component
export default function AdminScans() {
  const navigate = useNavigate();
  // List of all scan records
  const [scans, setScans] = useState([]);
  // Loading state for scans data
  const [loading, setLoading] = useState(true);
  // Prediction filter state (All, Phishing, Suspicious, Legitimate)
  const [filter, setFilter] = useState("All");
  // Search input state for URL filtering
  const [search, setSearch] = useState("");
  // Date range filter state
  const [dateRange, setDateRange] = useState("all");
  // Selected scans for bulk actions
  const [selectedScans, setSelectedScans] = useState(new Set());
  // Currently selected scan for detail view
  const [selectedScan, setSelectedScan] = useState(null);
  // Controls scan detail modal visibility
  const [showViewModal, setShowViewModal] = useState(false);
  // Aggregated scan statistics state
  const [stats, setStats] = useState({
    total: 0,
    phishing: 0,
    suspicious: 0,
    legitimate: 0,
    avgRisk: 0,
  });
  // Export CSV loading state
  const [exporting, setExporting] = useState(false);
  // Bulk delete loading state
  const [deleting, setDeleting] = useState(false);

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Fetch scans on component mount
  useEffect(() => {
    fetchScans();
  }, []);

  // Fetch scan records from backend and calculate stats
  const fetchScans = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/admin/scans", { headers });
      const data = await res.json();
      const scansData = data.scans || [];
      setScans(scansData);

      // Calculate stats
      const phishing = scansData.filter(
        (s) => s.prediction === "Phishing",
      ).length;
      const suspicious = scansData.filter(
        (s) => s.prediction === "Suspicious",
      ).length;
      const legitimate = scansData.filter(
        (s) => s.prediction === "Legitimate",
      ).length;
      const totalRisk = scansData.reduce(
        (sum, s) => sum + (s.risk_score || 0),
        0,
      );

      setStats({
        total: scansData.length,
        phishing,
        suspicious,
        legitimate,
        avgRisk:
          scansData.length > 0 ? (totalRisk / scansData.length).toFixed(1) : 0,
      });
    } catch (error) {
      console.error("Failed to fetch scans:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter scans based on selected date range
  const filterScansByDate = (scan) => {
    if (dateRange === "all") return true;
    if (!scan.scanned_at) return false;

    const scanDate = new Date(scan.scanned_at);
    const now = new Date();
    const daysDiff = (now - scanDate) / (1000 * 60 * 60 * 24);

    if (dateRange === "7days") return daysDiff <= 7;
    if (dateRange === "30days") return daysDiff <= 30;
    if (dateRange === "90days") return daysDiff <= 90;
    return true;
  };

  // Derived filtered scan list based on filter, search, and date
  const filteredScans = scans
    .filter((s) => filter === "All" || s.prediction === filter)
    .filter((s) => s.url?.toLowerCase().includes(search.toLowerCase()))
    .filter(filterScansByDate);

  // Check if all visible scans are selected
  const isAllSelected =
    filteredScans.length > 0 &&
    filteredScans.every((scan) => selectedScans.has(scan._id));

  // Toggle select all scans
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedScans(new Set());
    } else {
      const newSelected = new Set();
      filteredScans.forEach((scan) => {
        if (scan._id) newSelected.add(scan._id);
      });
      setSelectedScans(newSelected);
    }
  };

  // Toggle individual scan selection
  const handleSelectScan = (scanId) => {
    if (!scanId) return;
    setSelectedScans((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(scanId)) {
        newSelected.delete(scanId);
      } else {
        newSelected.add(scanId);
      }
      return newSelected;
    });
  };

  // Open scan details modal
  const handleViewScan = (scan) => {
    setSelectedScan(scan);
    setShowViewModal(true);
  };

  // Delete selected scans in bulk
  const handleBulkDelete = async () => {
    if (selectedScans.size === 0) return;

    const selectedIds = Array.from(selectedScans);
    if (
      !window.confirm(
        `Delete ${selectedIds.length} scan(s)? This action cannot be undone.`,
      )
    )
      return;

    setDeleting(true);
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/admin/scans/bulk-delete",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ scan_ids: selectedIds }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        setSelectedScans(new Set());
        fetchScans();
        alert(`Successfully deleted ${data.deleted_count} scan(s)`);
      } else {
        alert(data.detail || "Failed to delete scans");
      }
    } catch (error) {
      console.error("Failed to delete scans:", error);
      alert("Could not connect to server");
    } finally {
      setDeleting(false);
    }
  };

  // Export filtered scans to CSV file
  const exportToCSV = () => {
    setExporting(true);
    try {
      const csvHeaders = [
        "URL",
        "Prediction",
        "Risk Score (%)",
        "Reasons",
        "Scanned At",
        "User Email",
      ];
      const rows = filteredScans.map((scan) => [
        `"${(scan.url || "").replace(/"/g, '""')}"`,
        scan.prediction || "",
        scan.risk_score || "",
        `"${(scan.reasons || []).join("; ").replace(/"/g, '""')}"`,
        scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : "",
        scan.user_email || "Anonymous",
      ]);

      const csvContent = [csvHeaders, ...rows]
        .map((row) => row.join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aegisphish_scans_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  // Format timestamp into readable date string
  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
  };

  // Render admin scans UI
  return (
    <>
      <header className="border-b border-purple-500/20 px-6 py-4 bg-[#0f0f23]/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="text-base font-semibold">All Scans</h1>
          <p className="text-xs text-gray-500">
            View and manage all URL scans across the system
          </p>
        </div>
      </header>
      <div className="p-8">
        // Statistics overview cards section
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-[#0f0f23] to-[#0a0a1a] p-4">
            <p className="text-xs text-gray-500">Total Scans</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-[#0f0f23] to-[#0a0a1a] p-4">
            <p className="text-xs text-gray-500">Phishing</p>
            <p className="text-2xl font-bold text-red-400">{stats.phishing}</p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-[#0f0f23] to-[#0a0a1a] p-4">
            <p className="text-xs text-gray-500">Suspicious</p>
            <p className="text-2xl font-bold text-orange-400">
              {stats.suspicious}
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-[#0f0f23] to-[#0a0a1a] p-4">
            <p className="text-xs text-gray-500">Legitimate</p>
            <p className="text-2xl font-bold text-teal-400">
              {stats.legitimate}
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-[#0f0f23] to-[#0a0a1a] p-4">
            <p className="text-xs text-gray-500">Avg Risk Score</p>
            <p className="text-2xl font-bold text-yellow-400">
              {stats.avgRisk}%
            </p>
          </div>
        </div>
        // Filters and search controls section
        {/* Filters Bar */}
        // Filters container layout
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-1">
            {["All", "Phishing", "Suspicious", "Legitimate"].map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setSelectedScans(new Set());
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  filter === f
                    ? "border-purple-400 bg-purple-500/10 text-purple-400"
                    : "border-gray-600 text-gray-500 hover:border-purple-400 hover:text-gray-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search URL..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedScans(new Set());
            }}
            className="bg-gray-800/60 border border-gray-600 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-purple-400 transition w-64"
          />

          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setSelectedScans(new Set());
            }}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-purple-400"
          >
            <option value="all">All time</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="90days">Last 90 days</option>
          </select>

          <button
            onClick={exportToCSV}
            disabled={exporting || filteredScans.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-teal-500/40 text-teal-400 hover:bg-teal-500/10 transition disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "📥 Export CSV"}
          </button>

          <button
            onClick={fetchScans}
            className="text-xs px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition"
          >
            🔄 Refresh
          </button>
        </div>
        // Bulk actions section for selected scans
        {/* Bulk Actions Bar */}
        {selectedScans.size > 0 && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-2 mb-4 flex items-center justify-between">
            <span className="text-sm text-purple-400">
              {selectedScans.size} scan{selectedScans.size !== 1 ? "s" : ""}{" "}
              selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="text-xs px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Selected"}
              </button>
              <button
                onClick={() => setSelectedScans(new Set())}
                className="text-xs px-3 py-1 rounded-lg border border-gray-600 text-gray-400 hover:bg-gray-800 transition"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        // Scans data table section
        {/* Scans Table */}
        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading scans...</p>
        ) : filteredScans.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No scans found</p>
        ) : (
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-[#0f0f23] to-[#0a0a1a] overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-purple-500/20 bg-[#0f0f23]">
                <tr>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase w-8">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase">
                    URL
                  </th>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase">
                    Prediction
                  </th>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase">
                    Risk
                  </th>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase">
                    Scanned At
                  </th>
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/10">
                {filteredScans.map((scan) => (
                  <tr
                    key={scan._id}
                    className="hover:bg-white/[0.02] transition"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedScans.has(scan._id)}
                        onChange={() => handleSelectScan(scan._id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p
                        className="text-sm font-mono text-gray-300 truncate max-w-md"
                        title={scan.url}
                      >
                        {scan.url}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          scan.prediction === "Legitimate"
                            ? "bg-teal-500/10 text-teal-400"
                            : scan.prediction === "Suspicious"
                              ? "bg-orange-500/10 text-orange-400"
                              : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {scan.prediction}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-mono ${
                          scan.risk_score >= 70
                            ? "text-red-400"
                            : scan.risk_score >= 35
                              ? "text-orange-400"
                              : "text-teal-400"
                        }`}
                      >
                        {scan.risk_score}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs text-gray-400"
                        title={scan.user_email}
                      >
                        {scan.user_email || "Anonymous"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {formatDate(scan.scanned_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewScan(scan)}
                        className="text-xs text-purple-400 hover:text-purple-300 transition"
                      >
                        View Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-purple-500/10 flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing {filteredScans.length} of {scans.length} scans
              </span>
              <span className="text-purple-400">
                {stats.phishing + stats.suspicious} threats detected
              </span>
            </div>
          </div>
        )}
      </div>
      // Scan details modal
      {/* View Scan Details Modal */}
      {showViewModal && selectedScan && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0f0f23] border border-purple-500/30 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-purple-400">
                Scan Details
              </h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-200 transition text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* URL */}
              <div>
                <p className="text-xs text-gray-500 mb-1">URL</p>
                <p className="text-sm font-mono text-gray-300 break-all">
                  {selectedScan.url}
                </p>
              </div>

              {/* Prediction & Risk */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Prediction</p>
                  <span
                    className={`text-sm px-3 py-1 rounded-full inline-block ${
                      selectedScan.prediction === "Legitimate"
                        ? "bg-teal-500/10 text-teal-400"
                        : selectedScan.prediction === "Suspicious"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {selectedScan.prediction}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Risk Score</p>
                  <p
                    className={`text-lg font-bold ${
                      selectedScan.risk_score >= 70
                        ? "text-red-400"
                        : selectedScan.risk_score >= 35
                          ? "text-orange-400"
                          : "text-teal-400"
                    }`}
                  >
                    {selectedScan.risk_score}%
                  </p>
                </div>
              </div>

              {/* Detection Reasons */}
              {selectedScan.reasons && selectedScan.reasons.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    Detection Reasons
                  </p>
                  <ul className="space-y-1">
                    {selectedScan.reasons.map((reason, i) => (
                      <li
                        key={i}
                        className="text-sm text-gray-300 flex items-start gap-2"
                      >
                        <span className="text-red-400">⚠</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-purple-500/20">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Scan ID</p>
                  <p className="text-xs font-mono text-gray-500">
                    {selectedScan._id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">User</p>
                  <p className="text-xs font-mono text-gray-500">
                    {selectedScan.user_email || "Anonymous"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Scanned At</p>
                  <p className="text-xs text-gray-400">
                    {formatDate(selectedScan.scanned_at)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
