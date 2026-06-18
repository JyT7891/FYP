import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function RiskBadge({ prediction, risk }) {
  const styles =
    prediction === "Legitimate"
      ? "bg-teal-500/10 text-teal-400 border-teal-500/30"
      : prediction === "Suspicious"
        ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
        : "bg-red-500/10 text-red-400 border-red-500/30";
  const label =
    prediction === "Legitimate"
      ? "SAFE"
      : prediction === "Suspicious"
        ? "SUSPICIOUS"
        : "PHISHING";
  return (
    <span className={`text-xs px-2 py-1 rounded-md border font-mono ${styles}`}>
      {label} · {Math.round(risk)}%
    </span>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-gray-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-gray-400 w-6 text-right">{value}</span>
    </div>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [reporting, setReporting] = useState({});
  const [reportedUrls, setReportedUrls] = useState({});

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Fetch scans with report status embedded
  const fetchScans = async () => {
    setLoading(true);
    setError("");
    
    try {
      const response = await fetch("http://127.0.0.1:8000/scans/all", { headers });
      
      // Handle 401 Unauthorized - Session Expired
      if (response.status === 401) {
        setError("Your session has expired. Please log in again.");
        setTimeout(() => {
          localStorage.clear();
          window.location.href = "/";
        }, 2500);
        return;
      }
      
      // Handle other non-200 responses
      if (!response.ok) {
        setError("Failed to load scan history. Please try again.");
        setScans([]);
        return;
      }
      
      const data = await response.json();
      const scansData = data.scans || [];
      setScans(scansData);
      
      // Build reportedUrls map from the scan data
      const reportMap = {};
      scansData.forEach(scan => {
        if (scan.report_status) {
          const normalizedUrl = scan.url?.trim().toLowerCase();
          if (normalizedUrl) {
            reportMap[normalizedUrl] = scan.report_status;
          }
        }
      });
      setReportedUrls(reportMap);
      
    } catch (err) {
      console.error("Error fetching scans:", err);
      // Network error - backend is down
      setError("Could not connect to server. Please check your connection and try again.");
      setScans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchScans();
  }, []);

  // Stats
  const total = scans.length;
  const phishing = scans.filter((s) => s.prediction === "Phishing").length;
  const suspicious = scans.filter((s) => s.prediction === "Suspicious").length;
  const legitimate = scans.filter((s) => s.prediction === "Legitimate").length;
  const avgRisk =
    total > 0
      ? (scans.reduce((a, s) => a + s.risk_score, 0) / total).toFixed(1)
      : 0;
  const threatRate =
    total > 0 ? (((phishing + suspicious) / total) * 100).toFixed(1) : 0;

  // Filter + search + sort
  const filtered = scans
    .filter((s) => filter === "All" || s.prediction === filter)
    .filter((s) => s.url?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortOrder === "newest"
        ? new Date(b.scanned_at) - new Date(a.scanned_at)
        : new Date(a.scanned_at) - new Date(b.scanned_at),
    );

  // CSV export
  const handleExport = () => {
    if (error || filtered.length === 0) return;
    
    try {
      const rows = [
        ["URL", "Prediction", "Risk Score (%)", "Detection Reason", "Scanned At", "Report Status"],
        ...filtered.map((s) => [
          s.url,
          s.prediction,
          s.risk_score,
          s.reasons?.[0] || "—",
          s.scanned_at ? new Date(s.scanned_at).toLocaleString() : "—",
          s.report_status || "Not Reported",
        ]),
      ];
      const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aegisphish_report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      setError("Failed to export data.");
    }
  };

  // Check if a URL has a resolved report
  const isReportResolved = (scan) => {
    return scan?.report_status === 'resolved';
  };

  // Check if a URL has any report (pending or resolved)
  const isReported = (scan) => {
    return scan?.report_status !== undefined && scan?.report_status !== null;
  };

  // Simplified report submission - just saves to database
  const handleReportSubmit = async (scan) => {
    if (!scan?.url) return;
    const normalizedUrl = scan.url.trim().toLowerCase();
    
    // Prevent duplicate reports or if already resolved
    if (isReported(scan) || isReportResolved(scan)) return;
    
    setReporting(prev => ({ ...prev, [normalizedUrl]: true }));
    
    try {
      const response = await fetch("http://127.0.0.1:8000/report", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          url: scan.url, 
          note: `[Auto-report] ${scan.prediction} URL detected with ${Math.round(scan.risk_score)}% risk score. Reasons: ${scan.reasons?.join(', ') || 'N/A'}` 
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to submit report");
      }
      
      // Update the scan in the local state with pending status
      setScans(prevScans => 
        prevScans.map(s => 
          s.url === scan.url 
            ? { ...s, report_status: 'pending' }
            : s
        )
      );
      
      // Also update the reportedUrls map
      setReportedUrls(prev => ({
        ...prev,
        [normalizedUrl]: 'pending'
      }));
    } catch (error) {
      console.error("Report failed:", error);
      setError("Failed to submit report. Please try again.");
    } finally {
      setReporting(prev => ({ ...prev, [normalizedUrl]: false }));
    }
  };

  // Chart: scans per day (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
  const scansByDay = last7.map((day) => ({
    day: day.slice(5),
    phishing: scans.filter(
      (s) =>
        s.prediction === "Phishing" &&
        new Date(s.scanned_at).toISOString().startsWith(day),
    ).length,
    legitimate: scans.filter(
      (s) =>
        s.prediction === "Legitimate" &&
        new Date(s.scanned_at).toISOString().startsWith(day),
    ).length,
    suspicious: scans.filter(
      (s) =>
        s.prediction === "Suspicious" &&
        new Date(s.scanned_at).toISOString().startsWith(day),
    ).length,
  }));
  const maxDay = Math.max(
    ...scansByDay.map((d) => d.phishing + d.legitimate + d.suspicious),
    1,
  );

  // Get counts of resolved reports
  const resolvedCount = scans.filter(s => s.report_status === 'resolved').length;

  return (
    <>
      <header className="border-b border-teal-500/20 px-6 py-4 flex items-center justify-between bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="text-base font-semibold">Detection Reports</h1>
          <p className="text-xs text-gray-500">
            Scan history · Visual analytics · Threat reporting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={loading || error || filtered.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-teal-500/40 text-teal-400 hover:bg-teal-500/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ↓ Export CSV
          </button>
          <span className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-500/10 border border-teal-500/30 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse"></span>
            Protected
          </span>
        </div>
      </header>

      <div className="p-8 space-y-6 w-full">
        {/* Error Banner - Show when backend is down or any error occurs */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-red-400">Connection Error</p>
                <p className="text-xs text-gray-400">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchScans}
              className="px-4 py-2 rounded-lg border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/10 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Detection outcome summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            {
              label: "Total Scanned",
              value: error ? "—" : total,
              accent: "text-white",
              sub: "All time",
            },
            {
              label: "Phishing",
              value: error ? "—" : phishing,
              accent: "text-red-400",
              sub: "Detected",
            },
            {
              label: "Suspicious",
              value: error ? "—" : suspicious,
              accent: "text-orange-400",
              sub: "Flagged",
            },
            {
              label: "Legitimate",
              value: error ? "—" : legitimate,
              accent: "text-teal-400",
              sub: "Safe",
            },
            {
              label: "Avg Risk Score",
              value: error ? "—" : `${avgRisk}%`,
              accent: "text-gray-300",
              sub: "Per scan",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-4 flex flex-col gap-1"
            >
              <p className="text-xs text-gray-500 tracking-widest uppercase">
                {c.label}
              </p>
              <p className={`text-2xl font-bold ${c.accent}`}>{c.value}</p>
              <p className="text-xs text-gray-600">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stacked bar chart per day */}
          <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-5">
            <p className="text-xs text-gray-500 tracking-widest uppercase mb-1">
              Detection Activity — Last 7 Days
            </p>
            <p className="text-xs text-gray-600 mb-4">
              Colour-coded by prediction outcome
            </p>
            {error ? (
              <div className="flex items-center justify-center h-28 text-gray-500 text-sm">
                Data unavailable
              </div>
            ) : (
              <div className="flex items-end gap-2 h-28">
                {scansByDay.map((d) => {
                  const total = d.phishing + d.suspicious + d.legitimate;
                  return (
                    <div
                      key={d.day}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <span className="text-xs text-gray-600">{total || ""}</span>
                      <div
                        className="w-full flex flex-col-reverse rounded-t-sm overflow-hidden"
                        style={{
                          height: `${(total / maxDay) * 80}px`,
                          minHeight: total > 0 ? "4px" : "0",
                        }}
                      >
                        <div
                          className="bg-teal-500/50"
                          style={{
                            height: `${total > 0 ? (d.legitimate / total) * 100 : 0}%`,
                          }}
                        />
                        <div
                          className="bg-orange-400/60"
                          style={{
                            height: `${total > 0 ? (d.suspicious / total) * 100 : 0}%`,
                          }}
                        />
                        <div
                          className="bg-red-400/60"
                          style={{
                            height: `${total > 0 ? (d.phishing / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2 h-2 rounded-sm bg-red-400/60 inline-block"></span>
                Phishing
              </span>
              <span className="flex items-center gap-1.5 text-orange-400">
                <span className="w-2 h-2 rounded-sm bg-orange-400/60 inline-block"></span>
                Suspicious
              </span>
              <span className="flex items-center gap-1.5 text-teal-400">
                <span className="w-2 h-2 rounded-sm bg-teal-500/50 inline-block"></span>
                Legitimate
              </span>
            </div>
          </div>

          {/* Detection breakdown + threat rate */}
          <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-5">
            <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">
              Prediction Breakdown
            </p>
            {error ? (
              <div className="flex items-center justify-center h-28 text-gray-500 text-sm">
                Data unavailable
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  <MiniBar
                    label="Phishing"
                    value={phishing}
                    max={total}
                    color="bg-red-400"
                  />
                  <MiniBar
                    label="Suspicious"
                    value={suspicious}
                    max={total}
                    color="bg-orange-400"
                  />
                  <MiniBar
                    label="Legitimate"
                    value={legitimate}
                    max={total}
                    color="bg-teal-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-800/40 border border-gray-700 p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Threat Rate</p>
                    <p className="text-xl font-bold text-red-400">{threatRate}%</p>
                  </div>
                  <div className="rounded-lg bg-gray-800/40 border border-gray-700 p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">Detection Rate</p>
                    <p className="text-xl font-bold text-teal-400">
                      {total > 0
                        ? (((phishing + suspicious) / total) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scan History */}
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] overflow-hidden">
          <div className="px-5 py-4 border-b border-teal-500/20 flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <p className="text-xs text-gray-500 tracking-widest uppercase">
                Scan History
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Click any scan to view details | Click ⚑ to report a phishing URL
              </p>
            </div>
            <input
              type="text"
              placeholder="Search URL…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800/60 border border-gray-600 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-teal-400 transition placeholder-gray-600 w-48"
              disabled={loading || error}
            />
            <div className="flex gap-1">
              {["All", "Phishing", "Suspicious", "Legitimate"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  disabled={loading || error}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    filter === f
                      ? "border-teal-400 bg-teal-500/10 text-teal-400"
                      : "border-gray-600 text-gray-500 hover:border-teal-400 hover:text-gray-300"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {f}
                </button>
              ))}
            </div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              disabled={loading || error}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {loading ? (
            <p className="text-gray-600 text-sm text-center py-12">
              Loading scan history…
            </p>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📡</p>
              <p className="text-gray-400 text-sm">{error}</p>
              <button
                onClick={fetchScans}
                className="mt-4 px-4 py-2 rounded-lg border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/10 transition"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-12">
              No scans match your filters.
            </p>
          ) : (
            <div className="divide-y divide-teal-500/10">
              {filtered.map((scan, i) => {
                const isResolved = scan?.report_status === 'resolved';
                const isReportedStatus = scan?.report_status !== undefined && scan?.report_status !== null;
                const normalizedUrl = scan.url?.trim().toLowerCase();
                const isReportingNow = reporting[normalizedUrl];
                
                // Determine if we should show the report button
                // Only show for non-legitimate URLs that are NOT resolved
                const showButton = scan.prediction !== "Legitimate" && !isResolved;
                
                let buttonText = "⚑ Report";
                let buttonDisabled = false;
                let buttonStyles = "border-orange-500/40 text-orange-400 hover:bg-orange-500/10";
                
                if (isReportingNow) {
                  buttonText = "⏳ Reporting...";
                  buttonDisabled = true;
                  buttonStyles = "border-gray-700 text-gray-600 cursor-not-allowed";
                } else if (isReportedStatus) {
                  buttonText = "✓ Reported";
                  buttonDisabled = true;
                  buttonStyles = "border-gray-700 text-gray-600 cursor-not-allowed";
                }
                
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition group"
                  >
                    {/* Clickable area for navigation to scan details */}
                    <div
                      onClick={() => navigate(`/scan/${scan._id}`)}
                      className="flex-1 min-w-0 mr-4 cursor-pointer"
                    >
                      <p className="text-sm font-mono text-gray-300 truncate group-hover:text-teal-400 transition">
                        {scan.url}
                      </p>
                      {scan.reasons?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {scan.reasons.slice(0, 2).map((r, j) => (
                            <span
                              key={j}
                              className="text-xs text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded-md border border-gray-700"
                            >
                              {r.length > 50 ? r.substring(0, 50) + "..." : r}
                            </span>
                          ))}
                          {scan.reasons.length > 2 && (
                            <span className="text-xs text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded-md border border-gray-700">
                              +{scan.reasons.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-600 mt-1">
                        {scan.scanned_at
                          ? new Date(scan.scanned_at).toLocaleString()
                          : "—"}
                      </p>
                    </div>

                    {/* Action buttons - separate from clickable area */}
                    <div className="flex items-center gap-3 shrink-0">
                      <RiskBadge
                        prediction={scan.prediction}
                        risk={scan.risk_score}
                      />
                      {showButton && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!buttonDisabled) {
                              handleReportSubmit(scan);
                            }
                          }}
                          disabled={buttonDisabled}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition min-w-[90px] flex items-center justify-center ${buttonStyles}`}
                        >
                          {buttonText}
                        </button>
                      )}
                      {isResolved && (
                        <span className="text-xs px-3 py-1.5 rounded-lg border border-teal-500/30 text-teal-400 bg-teal-500/5 min-w-[90px] flex items-center justify-center">
                          ✓ Resolved
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-teal-500/10 flex items-center justify-between text-xs text-gray-600">
              <span>
                Showing {filtered.length} of {scans.length} scans
              </span>
              <div className="flex items-center gap-4">
                <span className="text-orange-400">
                  {scans.filter((s) => s.prediction !== "Legitimate").length}{" "}
                  threats detected
                </span>
                <span className="text-teal-400">
                  {resolvedCount} resolved
                </span>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-700 pb-2">
          ▢ AegisPhish · ML-based phishing detection · Reports logged for
          cybersecurity monitoring
        </p>
      </div>
    </>
  );
}