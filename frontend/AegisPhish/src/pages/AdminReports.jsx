// src/pages/AdminReports.jsx
import { useState, useEffect } from "react";

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      console.log("🔍 Fetching pending reports...");
      const res = await fetch("http://127.0.0.1:8000/admin/reports", { headers });
      const data = await res.json();
      console.log("📋 Reports received:", data.reports?.length || 0);
      setReports(data.reports || []);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId) => {
    console.log("🔧 Resolving report:", reportId);
    try {
      const res = await fetch(`http://127.0.0.1:8000/admin/reports/${reportId}/resolve`, {
        method: "POST",
        headers,
      });
      
      const data = await res.json();
      console.log("📊 Response:", res.status, data);
      
      if (res.ok) {
        // Remove from local state immediately for UI feedback
        setReports(prev => prev.filter(r => r._id !== reportId));
        setSelectedReport(null);
        // Also refresh from server to be safe
        await fetchReports();
      } else {
        console.error("Failed to resolve:", data.detail);
        alert(data.detail || "Failed to resolve report");
      }
    } catch (error) {
      console.error("Failed to resolve report:", error);
      alert("Could not connect to server");
    }
  };

  const handleDismiss = async (reportId) => {
    console.log("🔧 Dismissing report:", reportId);
    try {
      const res = await fetch(`http://127.0.0.1:8000/admin/reports/${reportId}/dismiss`, {
        method: "POST",
        headers,
      });
      
      const data = await res.json();
      console.log("📊 Response:", res.status, data);
      
      if (res.ok) {
        // Remove from local state immediately for UI feedback
        setReports(prev => prev.filter(r => r._id !== reportId));
        setSelectedReport(null);
        // Also refresh from server to be safe
        await fetchReports();
      } else {
        console.error("Failed to dismiss:", data.detail);
        alert(data.detail || "Failed to dismiss report");
      }
    } catch (error) {
      console.error("Failed to dismiss report:", error);
      alert("Could not connect to server");
    }
  };

  return (
    <>
      <header className="border-b border-purple-500/20 px-6 py-4 bg-[#0f0f23]/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="text-base font-semibold">User Reports</h1>
          <p className="text-xs text-gray-500">Manage reported phishing URLs</p>
        </div>
        <div className="mt-2">
          <button
            onClick={fetchReports}
            className="text-xs px-3 py-1 rounded-lg border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition"
          >
            🔄 Refresh
          </button>
        </div>
      </header>

      <div className="p-8">
        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No pending reports</p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report._id} className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-[#0f0f23] to-[#0a0a1a] p-4">
                <p className="text-sm font-mono text-red-400 break-all">{report.url}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-gray-500">
                    Reported: {report.reported_at ? new Date(report.reported_at).toLocaleString() : "—"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="px-3 py-1 rounded-lg border border-teal-500/40 text-teal-400 text-xs hover:bg-teal-500/10 transition"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0f0f23] border border-purple-500/30 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-semibold mb-2 text-purple-400">Report Details</h3>
            <div className="space-y-3 mb-4">
              <div>
                <p className="text-xs text-gray-500">URL</p>
                <p className="text-sm font-mono text-red-400 break-all">{selectedReport.url}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Reported At</p>
                <p className="text-sm text-gray-300">
                  {selectedReport.reported_at ? new Date(selectedReport.reported_at).toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Note</p>
                <p className="text-sm text-gray-400">{selectedReport.note || "No additional notes"}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleResolve(selectedReport._id)}
                className="flex-1 px-4 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition"
              >
                ✓ Resolve
              </button>
              <button
                onClick={() => handleDismiss(selectedReport._id)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition"
              >
                ✗ Dismiss
              </button>
              <button
                onClick={() => setSelectedReport(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition"
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