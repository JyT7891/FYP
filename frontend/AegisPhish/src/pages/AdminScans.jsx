// src/pages/AdminScans.jsx
import { useState, useEffect } from "react";

export default function AdminScans() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    fetchScans();
  }, []);

  const fetchScans = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/admin/scans", { headers });
      const data = await res.json();
      setScans(data.scans || []);
    } catch (error) {
      console.error("Failed to fetch scans:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredScans = scans
    .filter((s) => filter === "All" || s.prediction === filter)
    .filter((s) => s.url?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <header className="border-b border-purple-500/20 px-6 py-4 bg-[#0f0f23]/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-base font-semibold">All Scans</h1>
            <p className="text-xs text-gray-500">View all URL scans across the system</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800/60 border border-gray-600 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-purple-400 transition w-48"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-purple-400"
            >
              <option value="All">All</option>
              <option value="Phishing">Phishing</option>
              <option value="Suspicious">Suspicious</option>
              <option value="Legitimate">Legitimate</option>
            </select>
          </div>
        </div>
      </header>

      <div className="p-8">
        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading scans...</p>
        ) : filteredScans.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No scans found</p>
        ) : (
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-[#0f0f23] to-[#0a0a1a] overflow-hidden">
            <div className="divide-y divide-purple-500/10">
              {filteredScans.map((scan, i) => (
                <div key={i} className="px-5 py-4 hover:bg-white/[0.02] transition">
                  <p className="text-sm font-mono text-gray-300 break-all">{scan.url}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full ${
                      scan.prediction === "Legitimate" ? "bg-teal-500/10 text-teal-400" :
                      scan.prediction === "Suspicious" ? "bg-orange-500/10 text-orange-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {scan.prediction}
                    </span>
                    <span className="text-gray-500">Risk: {scan.risk_score}%</span>
                    <span className="text-gray-600">
                      {scan.scanned_at ? new Date(scan.scanned_at).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-purple-500/10 text-right text-xs text-gray-500">
              Total: {filteredScans.length} scans
            </div>
          </div>
        )}
      </div>
    </>
  );
}