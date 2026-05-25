// src/pages/ScanDetails.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

function RiskGauge({ score, prediction }) {
  const color =
    prediction === "Legitimate" ? "#2dd4bf"
    : prediction === "Suspicious" ? "#fb923c"
    : "#f87171";

  const label =
    prediction === "Legitimate" ? "Safe"
    : prediction === "Suspicious" ? "Suspicious"
    : "Phishing";

  const bgClass =
    prediction === "Legitimate"
      ? "bg-teal-500/10 border-teal-500/30"
      : prediction === "Suspicious"
      ? "bg-orange-500/10 border-orange-500/30"
      : "bg-red-500/10 border-red-500/30";

  const textClass =
    prediction === "Legitimate" ? "text-teal-400"
    : prediction === "Suspicious" ? "text-orange-400"
    : "text-red-400";

  return (
    <div className={`rounded-xl border p-6 flex flex-col items-center gap-3 ${bgClass}`}>
      <p className="text-xs text-gray-500 tracking-widest uppercase">Risk Score</p>
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#1f2937" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${(score / 100) * 314} 314`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${textClass}`}>{Math.round(score)}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold px-4 py-1.5 rounded-full border ${bgClass} ${textClass}`}>
        {label}
      </span>
    </div>
  );
}

function ShapBar({ feature, value, maxVal }) {
  const isPositive = value >= 0;
  const width = Math.min((Math.abs(value) / maxVal) * 100, 100);
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-gray-400 w-48 truncate shrink-0 font-mono">{feature}</span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isPositive ? "bg-red-400" : "bg-teal-400"
            }`}
            style={{ width: `${width}%` }}
          />
        </div>
        <span className={`w-14 text-right shrink-0 ${isPositive ? "text-red-400" : "text-teal-400"}`}>
          {value > 0 ? "+" : ""}{value.toFixed(4)}
        </span>
      </div>
    </div>
  );
}

export default function ScanDetails() {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportSent, setReportSent] = useState(false);

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    const fetchScanDetails = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/scans/${scanId}`, {
          headers,
        });
        
        if (!res.ok) {
          if (res.status === 404) {
            setError("Scan not found");
          } else if (res.status === 401) {
            setError("Unauthorized. Please login again.");
          } else {
            setError("Failed to load scan details");
          }
          return;
        }
        
        const data = await res.json();
        setScan(data);
      } catch (err) {
        console.error("Error fetching scan details:", err);
        setError("Could not connect to server");
      } finally {
        setLoading(false);
      }
    };

    fetchScanDetails();
  }, [scanId]);

  const handleReport = async () => {
    if (!scan) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/report", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          url: scan.url, 
          note: `Reported from scan details. Prediction: ${scan.prediction}, Risk score: ${scan.risk_score}%` 
        }),
      });
      
      if (res.ok) {
        setReportSent(true);
        setTimeout(() => setReportSent(false), 3000);
      }
    } catch (err) {
      console.error("Failed to submit report:", err);
    }
  };

  const handleRescan = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: scan.url }),
      });
      const data = await res.json();
      setScan(data);
    } catch (err) {
      console.error("Failed to rescan:", err);
    } finally {
      setLoading(false);
    }
  };

  // Prepare SHAP data sorted by absolute value
  const shapEntries = scan?.shap_values
    ? Object.entries(scan.shap_values)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 10)
    : [];
  const maxShap = shapEntries.length > 0 ? Math.abs(shapEntries[0][1]) : 1;

  if (loading) {
    return (
      <>
        <header className="border-b border-teal-500/20 px-6 py-4 bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="text-teal-400 hover:text-teal-300 transition">
            ← Back
          </button>
          <h1 className="text-base font-semibold mt-2">Scan Details</h1>
        </header>
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading scan details...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <header className="border-b border-teal-500/20 px-6 py-4 bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
          <button onClick={() => navigate(-1)} className="text-teal-400 hover:text-teal-300 transition">
            ← Back
          </button>
          <h1 className="text-base font-semibold mt-2">Scan Details</h1>
        </header>
        <div className="p-8">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => navigate("/reports")}
              className="mt-4 px-4 py-2 rounded-lg border border-teal-500/40 text-teal-400 hover:bg-teal-500/10 transition"
            >
              Return to Reports
            </button>
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
            <button onClick={() => navigate(-1)} className="text-teal-400 hover:text-teal-300 transition inline-flex items-center gap-1">
              ← Back to Reports
            </button>
            <h1 className="text-base font-semibold mt-2">Scan Details</h1>
            <p className="text-xs text-gray-500">Deep analysis of URL scan</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRescan}
              className="px-4 py-2 rounded-lg border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/10 transition"
            >
              ⟳ Rescan URL
            </button>
            {scan?.prediction !== "Legitimate" && (
              <button
                onClick={handleReport}
                className="px-4 py-2 rounded-lg border border-orange-500/40 text-orange-400 text-sm hover:bg-orange-500/10 transition"
              >
                {reportSent ? "✓ Reported" : "⚑ Report"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="p-8 space-y-6 w-full max-w-4xl mx-auto">
        {/* URL Section */}
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
          <p className="text-xs text-gray-500 tracking-widest uppercase mb-2">Scanned URL</p>
          <p className="font-mono text-sm text-gray-200 break-all">{scan?.url}</p>
          <p className="text-xs text-gray-600 mt-3">
            Scanned on: {scan?.scanned_at ? new Date(scan.scanned_at).toLocaleString() : "—"}
          </p>
        </div>

        {/* Result Row: Gauge + Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RiskGauge score={scan?.risk_score || 0} prediction={scan?.prediction || "Legitimate"} />

          <div className="md:col-span-2 rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Prediction</p>
                <p className={`text-xl font-semibold ${
                  scan?.prediction === "Legitimate" ? "text-teal-400" :
                  scan?.prediction === "Suspicious" ? "text-orange-400" :
                  "text-red-400"
                }`}>{scan?.prediction || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Risk Score</p>
                <p className="text-xl font-semibold text-white">{scan?.risk_score?.toFixed(2) || "—"}%</p>
              </div>
            </div>
            
            {scan?.reasons && scan.reasons.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Key Indicators</p>
                <div className="space-y-1">
                  {scan.reasons.slice(0, 3).map((reason, i) => (
                    <p key={i} className="text-xs text-gray-400 flex items-start gap-2">
                      <span className="text-red-400">⚠</span>
                      {reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* All Detection Reasons */}
        {scan?.reasons && scan.reasons.length > 0 && (
          <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
            <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">Detection Reasons</p>
            <div className="space-y-2">
              {scan.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 shrink-0 text-red-400">⚠</span>
                  <span className="text-gray-300">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SHAP Feature Importance */}
        {shapEntries.length > 0 && (
          <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-xs text-gray-500 tracking-widest uppercase">SHAP Feature Importance</p>
                <p className="text-xs text-gray-600 mt-1">Top features influencing this prediction</p>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-3 h-1.5 bg-red-400 rounded-full inline-block"></span>
                  Increases risk
                </span>
                <span className="flex items-center gap-1.5 text-teal-400">
                  <span className="w-3 h-1.5 bg-teal-400 rounded-full inline-block"></span>
                  Decreases risk
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {shapEntries.map(([feature, value]) => (
                <ShapBar key={feature} feature={feature} value={value} maxVal={maxShap} />
              ))}
            </div>
          </div>
        )}

        {/* URL Structure Analysis */}
        {scan?.url && (
          <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
            <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">URL Structure Analysis</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Length", value: scan.url.length },
                { label: "HTTPS", value: scan.url.startsWith("https") ? "✓ Yes" : "✗ No", color: scan.url.startsWith("https") ? "text-teal-400" : "text-red-400" },
                { label: "Dots", value: (scan.url.match(/\./g) || []).length },
                { label: "Hyphens", value: (scan.url.match(/-/g) || []).length },
                { label: "Digits", value: (scan.url.match(/[0-9]/g) || []).length },
                { label: "Slashes", value: (scan.url.match(/\//g) || []).length },
                { label: "Has @", value: scan.url.includes("@") ? "✗ Yes" : "✓ No", color: scan.url.includes("@") ? "text-red-400" : "text-teal-400" },
                { label: "TLD", value: scan.url.split(".").pop()?.split("/")[0] ?? "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-gray-800/40 border border-gray-700 p-3">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <p className={`text-sm font-semibold ${item.color || "text-white"}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end pt-4">
          <button
            onClick={handleRescan}
            className="px-5 py-2.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 text-sm hover:bg-teal-500/20 transition"
          >
            ⟳ Rescan URL
          </button>
          {scan?.prediction !== "Legitimate" && (
            <button
              onClick={handleReport}
              className="px-5 py-2.5 rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-400 text-sm hover:bg-orange-500/20 transition"
            >
              {reportSent ? "✓ Reported" : "⚑ Report to Authorities"}
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 pt-4">
          ▢ AegisPhish · ML-powered phishing detection · SHAP explainability
        </p>
      </div>
    </>
  );
}