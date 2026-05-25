import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";  // ← ADD THIS IMPORT

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

function ReportModal({ scan, onClose, onSubmit, submitted }) {
  const [note, setNote] = useState("");
  const [agency, setAgency] = useState("MCMC");

  const agencies = [
    {
      id: "MCMC",
      name: "MCMC (Malaysia)",
      desc: "Malaysian Communications and Multimedia Commission",
    },
    {
      id: "NAPSC",
      name: "NAPSC / CyberSecurity MY",
      desc: "National Cyber Security Agency Malaysia",
    },
    {
      id: "Google",
      name: "Google Safe Browsing",
      desc: "Report to Google's phishing database",
    },
    {
      id: "PhishTank",
      name: "PhishTank",
      desc: "Community phishing verification database",
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#0a192f] border border-teal-500/30 rounded-xl p-6 max-w-lg w-full shadow-2xl">
        <h3 className="text-base font-semibold mb-1">Report Phishing URL</h3>
        <p className="text-xs text-gray-500 mb-4">
          Submit this URL to a cybersecurity body for investigation and threat
          mitigation.
        </p>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-gray-500 mb-1">URL being reported</p>
          <p className="text-sm font-mono text-red-400 break-all">
            {scan?.url}
          </p>
        </div>

        <p className="text-xs text-gray-400 mb-2">Report to:</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {agencies.map((a) => (
            <button
              key={a.id}
              onClick={() => setAgency(a.id)}
              className={`text-left px-3 py-2.5 rounded-lg border text-xs transition ${
                agency === a.id
                  ? "border-teal-400 bg-teal-500/10 text-teal-400"
                  : "border-gray-600 text-gray-400 hover:border-teal-500/40"
              }`}
            >
              <p className="font-medium">{a.name}</p>
              <p className="text-gray-600 mt-0.5 text-xs">{a.desc}</p>
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 mb-2">
          Additional notes (optional):
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe why this URL is suspicious…"
          rows={3}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-teal-400 transition resize-none mb-4 placeholder-gray-600"
        />

        {submitted ? (
          <div className="px-4 py-3 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm text-center mb-4">
            ✓ Report submitted successfully. The URL has been logged for
            investigation.
          </div>
        ) : null}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition text-sm"
          >
            {submitted ? "Close" : "Cancel"}
          </button>
          {!submitted && (
            <button
              onClick={() => onSubmit({ url: scan.url, agency, note })}
              className="flex-1 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition text-sm"
            >
              Submit Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const navigate = useNavigate();  // ← ADD THIS LINE
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [reportScan, setReportScan] = useState(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportedIds, setReportedIds] = useState([]);

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    if (!token) return;
    fetch("http://127.0.0.1:8000/scans/all", { headers })
      .then((r) => r.json())
      .then((data) => setScans(data.scans || []))
      .catch(console.error)
      .finally(() => setLoading(false));
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
    const rows = [
      ["URL", "Prediction", "Risk Score (%)", "Detection Reason", "Scanned At"],
      ...filtered.map((s) => [
        s.url,
        s.prediction,
        s.risk_score,
        s.reasons?.[0] || "—",
        s.scanned_at ? new Date(s.scanned_at).toLocaleString() : "—",
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
  };

  const handleReportSubmit = async ({ url, agency, note }) => {
    try {
      await fetch("http://127.0.0.1:8000/report", {
        method: "POST",
        headers,
        body: JSON.stringify({ url, note: `[${agency}] ${note}` }),
      });
      setReportSubmitted(true);
      setReportedIds((prev) => [...prev, url]);
    } catch {
      console.error("Report failed");
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
            className="text-xs px-3 py-1.5 rounded-lg border border-teal-500/40 text-teal-400 hover:bg-teal-500/10 transition"
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
        {/* Detection outcome summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            {
              label: "Total Scanned",
              value: total,
              accent: "text-white",
              sub: "All time",
            },
            {
              label: "Phishing",
              value: phishing,
              accent: "text-red-400",
              sub: "Detected",
            },
            {
              label: "Suspicious",
              value: suspicious,
              accent: "text-orange-400",
              sub: "Flagged",
            },
            {
              label: "Legitimate",
              value: legitimate,
              accent: "text-teal-400",
              sub: "Safe",
            },
            {
              label: "Avg Risk Score",
              value: `${avgRisk}%`,
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
            />
            <div className="flex gap-1">
              {["All", "Phishing", "Suspicious", "Legitimate"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    filter === f
                      ? "border-teal-400 bg-teal-500/10 text-teal-400"
                      : "border-gray-600 text-gray-500 hover:border-teal-400 hover:text-gray-300"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-teal-400"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {loading ? (
            <p className="text-gray-600 text-sm text-center py-12">
              Loading scan history…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-12">
              No scans match your filters.
            </p>
          ) : (
            <div className="divide-y divide-teal-500/10">
              {filtered.map((scan, i) => (
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
                    {scan.prediction !== "Legitimate" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevents navigation to details page
                          setReportScan(scan);
                          setReportSubmitted(false);
                        }}
                        disabled={reportedIds.includes(scan.url)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                          reportedIds.includes(scan.url)
                            ? "border-gray-700 text-gray-600 cursor-not-allowed"
                            : "border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                        }`}
                      >
                        {reportedIds.includes(scan.url)
                          ? "✓ Reported"
                          : "⚑ Report"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-teal-500/10 flex items-center justify-between text-xs text-gray-600">
              <span>
                Showing {filtered.length} of {scans.length} scans
              </span>
              <span className="text-orange-400">
                {scans.filter((s) => s.prediction !== "Legitimate").length}{" "}
                threats detected
              </span>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-700 pb-2">
          ▢ AegisPhish · ML-based phishing detection · Reports logged for
          cybersecurity monitoring
        </p>
      </div>

      {/* Report Modal */}
      {reportScan && (
        <ReportModal
          scan={reportScan}
          onClose={() => {
            setReportScan(null);
            setReportSubmitted(false);
          }}
          onSubmit={handleReportSubmit}
          submitted={reportSubmitted}
        />
      )}
    </>
  );
}