// Main React hooks for state and lifecycle management
import { useState, useEffect } from "react";
// Router hook for navigation between pages
import { useNavigate } from "react-router-dom";

// Displays risk level badge based on prediction result
function RiskBadge({ risk, prediction }) {
  if (prediction === "Legitimate") {
    return (
      <span className="text-xs px-2 py-1 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/30 font-mono">
        SAFE · {Math.round(risk)}%
      </span>
    );
  }
  const color =
    prediction === "Phishing"
      ? "bg-red-500/10 text-red-400 border-red-500/30"
      : "bg-orange-500/10 text-orange-400 border-orange-500/30";
  return (
    <span className={`text-xs px-2 py-1 rounded-md border font-mono ${color}`}>
      RISK · {Math.round(risk)}%
    </span>
  );
}

// Reusable dashboard statistic card component
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-500 tracking-widest uppercase">{label}</p>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

// Temporary notification toast component
function Toast({ message, type }) {
  if (!message) return null;
  const styles =
    type === "success"
      ? "bg-teal-500/10 border-teal-500/30 text-teal-400"
      : type === "warning"
        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
        : "bg-red-500/10 border-red-500/30 text-red-400";
  return (
    <div
      className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg border text-sm z-50 shadow-lg ${styles}`}
    >
      {message}
    </div>
  );
}

// Main dashboard page component
export default function Dashboard() {
  const navigate = useNavigate();
  // Input state for URL to be scanned
  const [scanInput, setScanInput] = useState("");
  // Loading state for scan request
  const [scanning, setScanning] = useState(false);
  // Result of URL scan
  const [scanResult, setScanResult] = useState(null);
  // Recent scan history list
  const [recentScans, setRecentScans] = useState([]);
  // URL validation error message
  const [urlError, setUrlError] = useState("");
  // General error message state
  const [error, setError] = useState("");
  // Toast notification state
  const [toast, setToast] = useState({ message: "", type: "" });
  // Session expiration modal visibility state
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  // Dashboard statistics state
  const [stats, setStats] = useState({
    total_scans: "—",
    phishing_caught: "—",
    detection_rate: "—",
    avg_scan_time: "—",
  });

  // Show temporary toast notification
  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  // Build authenticated request headers
  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // Validate and normalize URL input
  const validateURL = (url) => {
    if (!url || !url.trim()) {
      return { valid: false, message: "Please enter a URL." };
    }

    const trimmedUrl = url.trim();

    let urlToCheck = trimmedUrl;
    if (
      !urlToCheck.startsWith("http://") &&
      !urlToCheck.startsWith("https://")
    ) {
      urlToCheck = "https://" + urlToCheck;
    }

    try {
      const urlObj = new URL(urlToCheck);

      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        return {
          valid: false,
          message: "Please enter a valid URL (http or https).",
        };
      }

      if (!urlObj.hostname.includes(".")) {
        return { valid: false, message: "Please enter a valid URL." };
      }

      return { valid: true, url: trimmedUrl };
    } catch {
      return { valid: false, message: "Please enter a valid URL." };
    }
  };

  // Handle input field changes
  const handleInputChange = (e) => {
    const value = e.target.value;
    setScanInput(value);
    if (urlError) setUrlError("");
    if (error) setError("");
  };

  // Submit URL for phishing scan
  const handleScan = async () => {
    setScanResult(null);
    setError("");
    setUrlError("");

    const validation = validateURL(scanInput);
    if (!validation.valid) {
      setUrlError(validation.message);
      return;
    }

    setScanning(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ url: validation.url }),
        credentials: "include",
      });

      if (response.status === 401) {
        showToast("Your session has expired. Please log in again.", "error");
        setShowSessionExpired(true);
        setTimeout(() => {
          localStorage.clear();
          window.location.href = "/";
        }, 2500);
        return;
      }

      if (!response.ok) {
        let errorMessage = "Failed to scan URL. Please try again.";
        try {
          const data = await response.json();
          errorMessage = data.detail || data.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        setError(errorMessage);
        return;
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setScanResult({
        _id: data._id,
        safe: data.prediction === "Legitimate",
        prediction: data.prediction,
        risk: data.risk_score,
        reason: data.reasons?.join(", ") || "No details available",
      });

      const scansRes = await fetch("http://127.0.0.1:8000/scans/recent", {
        headers: getHeaders(),
      });
      if (scansRes.ok) {
        const scansData = await scansRes.json();
        setRecentScans(scansData.scans || []);
      }
    } catch (err) {
      console.error("Scan failed:", err);
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        setError(
          "Could not connect to server. Please check your connection and try again.",
        );
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      setScanResult(null);
    } finally {
      setScanning(false);
    }
  };

  // Fetch dashboard stats and recent scans on load
  useEffect(() => {
    const fetchData = async () => {
      const headers = getHeaders();
      const token = localStorage.getItem("token");

      if (!token) return;

      try {
        const [statsRes, scansRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/stats", { headers }),
          fetch("http://127.0.0.1:8000/scans/recent", { headers }),
        ]);

        if (statsRes.status === 401 || scansRes.status === 401) {
          showToast("Your session has expired. Please log in again.", "error");
          setTimeout(() => {
            localStorage.clear();
            window.location.href = "/";
          }, 2500);
          return;
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (scansRes.ok) {
          const scansData = await scansRes.json();
          setRecentScans(scansData.scans || []);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    };

    fetchData();
  }, []);

  // Render dashboard UI
  return (
    <>
      // Toast notification display
      <Toast message={toast.message} type={toast.type} />
      // Session expired modal
      {showSessionExpired && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0a192f] border border-red-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="text-center">
              <div className="text-5xl mb-4">⏰</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Session Expired
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                Your session has expired. Please log in again to continue
                scanning URLs and accessing your scan history.
              </p>
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = "/";
                }}
                className="w-full py-2.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20 transition"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      )}
      // Dashboard header section
      <header className="border-b border-teal-500/20 px-6 py-4 flex items-center justify-between bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="text-base font-semibold">Dashboard</h1>
          <p className="text-xs text-gray-500">Real-time phishing detection</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-500/10 border border-teal-500/30 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse"></span>
          Protected
        </span>
      </header>
      <div className="p-8 space-y-6 w-full">
        // Statistics overview cards
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="URLs Scanned"
            value={stats.total_scans}
            sub="All time"
            accent="text-white"
          />
          <StatCard
            label="Phishing Caught"
            value={stats.phishing_caught}
            sub="Detected"
            accent="text-red-400"
          />
          <StatCard
            label="Threats Blocked"
            value={stats.detection_rate}
            sub="Detection rate"
            accent="text-teal-400"
          />
          <StatCard
            label="Avg. Scan Time"
            value={stats.avg_scan_time}
            sub="Per URL"
            accent="text-gray-300"
          />
        </div>
        // Quick URL scan section
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-5">
          <p className="text-xs text-gray-500 tracking-widest uppercase mb-3">
            Quick Scan
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter a URL to scan…"
              value={scanInput}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className={`flex-1 bg-gray-800/60 border rounded-lg px-4 py-2.5 text-sm outline-none transition placeholder-gray-600 ${
                urlError
                  ? "border-red-500 focus:border-red-400"
                  : "border-gray-600 focus:border-teal-400"
              }`}
            />
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-5 py-2.5 rounded-lg bg-teal-500/10 border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? "Scanning…" : "Scan"}
            </button>
          </div>

          {urlError && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <span>⚠</span> {urlError}
            </div>
          )}

          {error && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          {scanResult && !error && (
            <div
              onClick={() =>
                scanResult._id && navigate(`/scan/${scanResult._id}`)
              }
              className={`mt-4 p-4 rounded-lg border text-sm flex items-start gap-3 transition-all duration-200 ${
                scanResult.safe
                  ? "bg-teal-500/5 border-teal-500/30 hover:bg-teal-500/10 hover:border-teal-400"
                  : scanResult.prediction === "Suspicious"
                    ? "bg-orange-500/5 border-orange-500/30 hover:bg-orange-500/10 hover:border-orange-400"
                    : "bg-red-500/5 border-red-500/30 hover:bg-red-500/10 hover:border-red-400"
              } ${scanResult._id ? "cursor-pointer group" : "cursor-default"}`}
            >
              <span className="text-xl shrink-0">
                {scanResult.safe
                  ? "✓"
                  : scanResult.prediction === "Suspicious"
                    ? "⚡"
                    : "⚠"}
              </span>
              <div className="flex-1">
                <p
                  className={`font-semibold ${
                    scanResult.safe
                      ? "text-teal-400"
                      : scanResult.prediction === "Suspicious"
                        ? "text-orange-400"
                        : "text-red-400"
                  }`}
                >
                  {scanResult.safe
                    ? "URL appears safe"
                    : scanResult.prediction === "Suspicious"
                      ? "URL looks suspicious"
                      : "Phishing URL detected"}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Risk score: {scanResult.risk}% — {scanResult.reason}
                </p>
              </div>
              {scanResult._id && (
                <div className="shrink-0 text-gray-500 group-hover:text-teal-400 transition">
                  →
                </div>
              )}
            </div>
          )}
        </div>
        // Recent scans list section
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] overflow-hidden">
          <div className="px-5 py-4 border-b border-teal-500/20">
            <div>
              <p className="text-xs text-gray-500 tracking-widest uppercase">
                Recent Scans
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Click on any scan to view details
              </p>
            </div>
          </div>
          <div className="divide-y divide-teal-500/10">
            {recentScans.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-8">
                No scans yet — enter a URL above to get started.
              </p>
            ) : (
              recentScans.map((scan, i) => (
                <div
                  key={i}
                  onClick={() => navigate(`/scan/${scan._id}`)}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition cursor-pointer group"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-mono text-gray-300 truncate group-hover:text-teal-400 transition">
                      {scan.url}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {scan.reasons?.[0] || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <RiskBadge
                      risk={scan.risk_score}
                      prediction={scan.prediction}
                    />
                    <span className="text-xs text-gray-600 hidden md:block w-32 text-right">
                      {scan.scanned_at
                        ? new Date(scan.scanned_at).toLocaleString()
                        : "—"}
                    </span>
                    <div className="shrink-0 text-gray-500 group-hover:text-teal-400 transition">
                      →
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        // Footer branding text
        <p className="text-center text-xs text-gray-700 pb-2">
          ▢ AegisPhish · Real-time phishing detection · All scans are private
        </p>
      </div>
    </>
  );
}
