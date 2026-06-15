// src/pages/AdminReports.jsx
import { useState, useEffect } from "react";

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showAuthorityModal, setShowAuthorityModal] = useState(false);
  const [authorityEmail, setAuthorityEmail] = useState("");
  const [authorityMessage, setAuthorityMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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
        setReports(prev => prev.filter(r => r._id !== reportId));
        setSelectedReport(null);
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
        setReports(prev => prev.filter(r => r._id !== reportId));
        setSelectedReport(null);
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

  const handleSendToAuthorities = async () => {
    if (!authorityEmail.trim()) {
      alert("Please enter an authority email address");
      return;
    }

    setSendingEmail(true);
    
    try {
      // Simulate sending email to authorities (dummy implementation)
      console.log("📧 Sending report to authority:", authorityEmail);
      console.log("Report URL:", selectedReport?.url);
      console.log("Message:", authorityMessage);
      
      // Dummy API call - replace with actual backend endpoint if needed
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate successful email send
      setEmailSent(true);
      setTimeout(() => {
        setShowAuthorityModal(false);
        setAuthorityEmail("");
        setAuthorityMessage("");
        setEmailSent(false);
        alert("Report has been forwarded to the cybersecurity authorities!");
      }, 2000);
      
    } catch (error) {
      console.error("Failed to send email:", error);
      alert("Failed to send report to authorities. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  // Predefined authority email options
  const authorityOptions = [
    { name: "MCMC (Malaysian Communications and Multimedia Commission)", email: "aduan@mcmc.gov.my" },
    { name: "CyberSecurity Malaysia", email: "threats@cybersecurity.my" },
    { name: "PhishTank", email: "phish@phishtank.com" },
    { name: "Google Safe Browsing", email: "safe-browsing@google.com" },
    { name: "Custom Email", email: "" },
  ];

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
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowAuthorityModal(true)}
                className="flex-1 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition"
              >
                📧 Send to Authorities
              </button>
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

      {/* Send to Authorities Modal */}
      {showAuthorityModal && selectedReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0f0f23] border border-yellow-500/30 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-base font-semibold mb-2 text-yellow-400">Report to Cybersecurity Authorities</h3>
            <p className="text-xs text-gray-400 mb-4">
              Forward this phishing URL to cybersecurity authorities for investigation and takedown.
            </p>

            {/* URL being reported */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 mb-4">
              <p className="text-xs text-gray-500 mb-1">URL being reported</p>
              <p className="text-sm font-mono text-red-400 break-all">{selectedReport.url}</p>
            </div>

            {/* Authority Selection */}
            <div className="mb-4">
              <label className="text-sm text-gray-300 mb-2 block">Select Authority</label>
              <select
                value={authorityEmail}
                onChange={(e) => setAuthorityEmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-yellow-400 transition"
              >
                <option value="">Select an authority...</option>
                {authorityOptions.map((option, index) => (
                  <option key={index} value={option.email}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Email Input (shown when Custom Email is selected) */}
            {authorityEmail === "" && (
              <div className="mb-4">
                <label className="text-sm text-gray-300 mb-2 block">Custom Email Address</label>
                <input
                  type="email"
                  placeholder="authority@example.com"
                  value={authorityEmail}
                  onChange={(e) => setAuthorityEmail(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-yellow-400 transition"
                />
              </div>
            )}

            {/* Additional Message */}
            <div className="mb-4">
              <label className="text-sm text-gray-300 mb-2 block">Additional Notes (Optional)</label>
              <textarea
                value={authorityMessage}
                onChange={(e) => setAuthorityMessage(e.target.value)}
                placeholder="Add any additional information about this phishing URL..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-yellow-400 transition resize-none"
              />
            </div>

            {/* Email Preview */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 mb-2">Email Preview:</p>
              <div className="text-xs text-gray-400 space-y-1">
                <p><span className="text-gray-500">To:</span> {authorityEmail || "[Selected Authority]"}</p>
                <p><span className="text-gray-500">Subject:</span> Phishing URL Report - AegisPhish</p>
                <p><span className="text-gray-500">Message:</span></p>
                <p className="pl-4">A phishing URL has been detected and reported through AegisPhish:</p>
                <p className="pl-4 font-mono text-red-400 break-all">{selectedReport.url}</p>
                {authorityMessage && <p className="pl-4 mt-2">Additional notes: {authorityMessage}</p>}
                <p className="pl-4 mt-2 text-gray-500">---</p>
                <p className="pl-4 text-gray-500">Please investigate and take appropriate action.</p>
                <p className="pl-4 text-gray-500">Sent via AegisPhish Phishing Detection System</p>
              </div>
            </div>

            {emailSent ? (
              <div className="px-4 py-3 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm text-center mb-4">
                ✓ Email sent successfully! The authority has been notified.
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAuthorityModal(false);
                  setAuthorityEmail("");
                  setAuthorityMessage("");
                  setEmailSent(false);
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSendToAuthorities}
                disabled={sendingEmail || !authorityEmail}
                className="flex-1 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail ? "Sending..." : "Send Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}