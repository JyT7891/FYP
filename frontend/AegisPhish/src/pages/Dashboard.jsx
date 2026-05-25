import { useState, useEffect } from "react";

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

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-500 tracking-widest uppercase">{label}</p>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

export default function Dashboard() {
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [stats, setStats] = useState({
    total_scans: "—",
    phishing_caught: "—",
    detection_rate: "—",
    avg_scan_time: "—",
  });

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Fetch stats and recent scans on load
  useEffect(() => {
    fetch("http://127.0.0.1:8000/stats", { headers })
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(console.error);

    fetch("http://127.0.0.1:8000/scans/recent", { headers })
      .then((r) => r.json())
      .then((data) => setRecentScans(data.scans || []))
      .catch(console.error);
  }, []);

  const handleScan = async () => {
    if (!scanInput.trim()) return;
    setScanning(true);
    setScanResult(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: scanInput }),
      });

      const data = await response.json();

      setScanResult({
        safe: data.prediction === "Legitimate",
        prediction: data.prediction,
        risk: data.risk_score,
        reason: data.reasons?.join(", ") || "No details available",
      });

      // Refresh recent scans and stats after a new scan
      fetch("http://127.0.0.1:8000/scans/recent", { headers })
        .then((r) => r.json())
        .then((data) => setRecentScans(data.scans || []))
        .catch(console.error);

      fetch("http://127.0.0.1:8000/stats", { headers })
        .then((r) => r.json())
        .then((data) => setStats(data))
        .catch(console.error);
    } catch (error) {
      setScanResult({
        safe: false,
        risk: 100,
        reason: "API connection failed",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <>
      {/* Topbar */}
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
        {/* Stats */}
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

        {/* Scan Box */}
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-5">
          <p className="text-xs text-gray-500 tracking-widest uppercase mb-3">
            Quick Scan
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter a URL to scan…"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className="flex-1 bg-gray-800/60 border border-gray-600 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-teal-400 transition placeholder-gray-600"
            />
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-5 py-2.5 rounded-lg bg-teal-500/10 border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? "Scanning…" : "Scan"}
            </button>
          </div>

          {scanResult && (
            <div
              className={`mt-4 p-4 rounded-lg border text-sm flex items-start gap-3 ${
                scanResult.safe
                  ? "bg-teal-500/5 border-teal-500/30"
                  : scanResult.prediction === "Suspicious"
                    ? "bg-orange-500/5 border-orange-500/30"
                    : "bg-red-500/5 border-red-500/30"
              }`}
            >
              <span className="text-xl">
                {scanResult.safe
                  ? "✓"
                  : scanResult.prediction === "Suspicious"
                    ? "⚡"
                    : "⚠"}
              </span>
              <div>
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
            </div>
          )}
        </div>

        {/* Recent Scans Table */}
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-teal-500/20">
            <p className="text-xs text-gray-500 tracking-widest uppercase">
              Recent Scans
            </p>
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
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-mono text-gray-300 truncate">
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
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 pb-2">
          ▢ AegisPhish · Real-time phishing detection · All scans are private
        </p>
      </div>
    </>
  );
}