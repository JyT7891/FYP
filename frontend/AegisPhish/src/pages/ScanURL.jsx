import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

export default function ScanURL() {
  const navigate = useNavigate();
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // Validate URL format
  const validateURL = (url) => {
    if (!url || !url.trim()) {
      return { valid: false, message: "Please enter a URL." };
    }

    const trimmedUrl = url.trim();
    
    let urlToCheck = trimmedUrl;
    if (!urlToCheck.startsWith('http://') && !urlToCheck.startsWith('https://')) {
      urlToCheck = 'https://' + urlToCheck;
    }

    try {
      const urlObj = new URL(urlToCheck);
      
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return { valid: false, message: "Please enter a valid URL (http or https)." };
      }
      
      if (!urlObj.hostname.includes('.')) {
        return { valid: false, message: "Please enter a valid URL." };
      }
      
      return { valid: true, url: trimmedUrl };
    } catch {
      return { valid: false, message: "Please enter a valid URL." };
    }
  };

  // Handle input change with validation
  const handleInputChange = (e) => {
    const value = e.target.value;
    setScanInput(value);
    if (validationError) {
      setValidationError("");
    }
  };

  const handleScan = async () => {
    setResult(null);
    setError("");
    setValidationError("");
    setReportSent(false);

    // Validate URL before scanning
    const validation = validateURL(scanInput);
    if (!validation.valid) {
      setValidationError(validation.message);
      return;
    }

    setScanning(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ url: validation.url }),
      });

      if (res.status === 401) {
        localStorage.clear();
        window.location.href = "/";
        return;
      }

      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError("Could not connect to server. Is the backend running?");
    } finally {
      setScanning(false);
    }
  };

  const handleRescan = async () => {
    if (!result) return;
    setValidationError("");
    setError("");
    setReportSent(false);
    
    // Validate URL before rescanning
    const validation = validateURL(result.url);
    if (!validation.valid) {
      setValidationError(validation.message);
      return;
    }

    setScanning(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ url: validation.url }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError("Could not connect to server.");
    } finally {
      setScanning(false);
    }
  };

  const handleReport = async () => {
    if (!result) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/report", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          url: result.url,
          note: `Reported from scan details. Prediction: ${result.prediction}, Risk score: ${result.risk_score}%`,
        }),
      });
      if (res.ok) {
        setReportSent(true);
        setTimeout(() => setReportSent(false), 3000);
      }
    } catch {
      setError("Failed to submit report.");
    }
  };

  const shapEntries = result?.shap_values
    ? Object.entries(result.shap_values)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 10)
    : [];
  const maxShap = shapEntries.length > 0 ? Math.abs(shapEntries[0][1]) : 1;

  return (
    <>
      {/* Header — mirrors ScanDetails */}
      <header className="border-b border-teal-500/20 px-6 py-4 bg-[#030e1c]/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-base font-semibold">Scan URL</h1>
            <p className="text-xs text-gray-500">Deep phishing analysis</p>
          </div>
          <div className="flex gap-2">
            {result && (
              <button
                onClick={handleRescan}
                disabled={scanning}
                className="px-4 py-2 rounded-lg border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⟳ Rescan URL
              </button>
            )}
            {result && result.prediction !== "Legitimate" && (
              <button
                onClick={handleReport}
                disabled={reportSent}
                className="px-4 py-2 rounded-lg border border-orange-500/40 text-orange-400 text-sm hover:bg-orange-500/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reportSent ? "✓ Reported" : "⚑ Report"}
              </button>
            )}
            <span className="flex items-center gap-1.5 text-xs text-teal-400 bg-teal-500/10 border border-teal-500/30 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse"></span>
              Protected
            </span>
          </div>
        </div>
      </header>

      <div className="p-8 space-y-6 w-full max-w-4xl mx-auto">

        {/* URL Input */}
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
          <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">Enter URL to Analyse</p>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="https://example.com"
              value={scanInput}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className={`flex-1 bg-gray-800/60 border rounded-lg px-4 py-3 text-sm outline-none transition placeholder-gray-600 font-mono ${
                validationError ? "border-red-500 focus:border-red-400" : "border-gray-600 focus:border-teal-400"
              }`}
            />
            <button
              onClick={handleScan}
              disabled={scanning}
              className="px-6 py-3 rounded-lg bg-teal-500/10 border border-teal-500/40 text-teal-400 text-sm font-medium hover:bg-teal-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></span>
                  Analysing…
                </span>
              ) : "Analyse"}
            </button>
          </div>
          
          {/* Validation Error Message */}
          {validationError && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              ⚠ {validationError}
            </div>
          )}
          
          <p className="text-xs text-gray-600 mt-3">
            Powered by Random Forest ML · VirusTotal · SHAP Explainability
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Results — identical structure to ScanDetails */}
        {result && (
          <>
            {/* Scanned URL — same as ScanDetails */}
            <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
              <p className="text-xs text-gray-500 tracking-widest uppercase mb-2">Scanned URL</p>
              <p className="font-mono text-sm text-gray-200 break-all">{result.url}</p>
              <p className="text-xs text-gray-600 mt-3">Analysed just now</p>
            </div>

            {/* Gauge + Summary — identical to ScanDetails */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <RiskGauge score={result.risk_score || 0} prediction={result.prediction || "Legitimate"} />

              <div className="md:col-span-2 rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Prediction</p>
                    <p className={`text-xl font-semibold ${
                      result.prediction === "Legitimate" ? "text-teal-400" :
                      result.prediction === "Suspicious" ? "text-orange-400" :
                      "text-red-400"
                    }`}>{result.prediction || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Risk Score</p>
                    <p className="text-xl font-semibold text-white">{result.risk_score?.toFixed(2) || "—"}%</p>
                  </div>
                </div>

                {result.reasons && result.reasons.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Key Indicators</p>
                    <div className="space-y-1">
                      {result.reasons.slice(0, 3).map((reason, i) => (
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

            {/* Detection Reasons — identical to ScanDetails */}
            {result.reasons && result.reasons.length > 0 && (
              <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
                <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">Detection Reasons</p>
                <div className="space-y-2">
                  {result.reasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 shrink-0 text-red-400">⚠</span>
                      <span className="text-gray-300">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SHAP Feature Importance — identical to ScanDetails */}
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

            {/* URL Structure Analysis — identical to ScanDetails */}
            {result.url && (
              <div className="rounded-xl border border-teal-500/20 bg-gradient-to-b from-[#0a192f] to-[#06111f] p-6">
                <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">URL Structure Analysis</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Length", value: result.url.length },
                    { label: "HTTPS", value: result.url.startsWith("https") ? "✓ Yes" : "✗ No", color: result.url.startsWith("https") ? "text-teal-400" : "text-red-400" },
                    { label: "Dots", value: (result.url.match(/\./g) || []).length },
                    { label: "Hyphens", value: (result.url.match(/-/g) || []).length },
                    { label: "Digits", value: (result.url.match(/[0-9]/g) || []).length },
                    { label: "Slashes", value: (result.url.match(/\//g) || []).length },
                    { label: "Has @", value: result.url.includes("@") ? "✗ Yes" : "✓ No", color: result.url.includes("@") ? "text-red-400" : "text-teal-400" },
                    { label: "TLD", value: result.url.split(".").pop()?.split("/")[0] ?? "—" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-gray-800/40 border border-gray-700 p-3">
                      <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                      <p className={`text-sm font-semibold ${item.color || "text-white"}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons — identical to ScanDetails */}
            <div className="flex gap-4 justify-end pt-4">
              <button
                onClick={handleRescan}
                disabled={scanning}
                className="px-5 py-2.5 rounded-lg border border-teal-500/40 bg-teal-500/10 text-teal-400 text-sm hover:bg-teal-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⟳ Rescan URL
              </button>
              {result.prediction !== "Legitimate" && (
                <button
                  onClick={handleReport}
                  disabled={reportSent}
                  className="px-5 py-2.5 rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-400 text-sm hover:bg-orange-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reportSent ? "✓ Reported" : "⚑ Report to Authorities"}
                </button>
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {!result && !scanning && !error && !validationError && (
          <div className="rounded-xl border border-teal-500/10 border-dashed p-12 text-center">
            <p className="text-4xl mb-4">⬡</p>
            <p className="text-gray-400 text-sm font-medium">Enter a URL above to run a full analysis</p>
            <p className="text-gray-600 text-xs mt-2">
              Results include ML prediction, risk score, SHAP breakdown, and VirusTotal reputation
            </p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 pt-4">
          ▢ AegisPhish · ML-powered phishing detection · SHAP explainability
        </p>
      </div>
    </>
  );
}