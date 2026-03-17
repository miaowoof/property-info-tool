import { useState } from "react";

export default function BulkImport({ onSelectProperty, onGoToDashboard }) {
  const [input, setValue] = useState("");
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [current, setCurrent] = useState("");
  const [done, setDone] = useState(false);

  const handleImport = async () => {
    const addresses = input
      .split("\n")
      .map(a => a.trim())
      .filter(a => a.length > 3);

    if (addresses.length === 0) return;
    setProcessing(true);
    setDone(false);
    setResults([]);

    for (const address of addresses) {
      setCurrent(address);
      try {
        const res = await lookupProperty(address);
        setResults(prev => [...prev, { ...res, status: "done" }]);
      } catch {
        setResults(prev => [...prev, { address, status: "error", vacancyStatus: "Unknown", lookedUpAt: new Date().toISOString() }]);
      }
      // Small delay to avoid hammering APIs
      await new Promise(r => setTimeout(r, 800));
    }

    setProcessing(false);
    setCurrent("");
    setDone(true);
  };

  return (
    <div className="dashboard">
      <div className="history-header">
        <div>
          <h2 className="history-title">Bulk Import</h2>
          <p className="history-sub">Paste a list of SF addresses — one per line</p>
        </div>
      </div>

      {!processing && !done && (
        <>
          <textarea
            className="bulk-textarea"
            placeholder={"90 New Montgomery St\n857 Columbus Ave\n1 Market St\n..."}
            value={input}
            onChange={e => setValue(e.target.value)}
            rows={10}
          />
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="search-btn"
              style={{ padding: "12px 28px", borderRadius: 8, fontSize: 14 }}
              onClick={handleImport}
              disabled={!input.trim()}
            >
              Look Up {input.split("\n").filter(a => a.trim().length > 3).length} Addresses →
            </button>
            <span className="history-sub">~{Math.ceil(input.split("\n").filter(a => a.trim().length > 3).length * 0.8 / 60)} min estimated</span>
          </div>
        </>
      )}

      {processing && (
        <div className="bulk-progress">
          <div className="bulk-spinner" />
          <p className="bulk-status">Looking up: <strong>{current}</strong></p>
          <p className="history-sub">{results.length} of {input.split("\n").filter(a => a.trim().length > 3).length} complete</p>
          <div className="bulk-progress-bar">
            <div className="bulk-progress-fill" style={{
              width: `${(results.length / input.split("\n").filter(a => a.trim().length > 3).length) * 100}%`
            }} />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="bulk-results">
          <p className="recent-label" style={{ marginBottom: 12 }}>
            Results {done ? `— ${results.filter(r => r.status === "done").length} succeeded, ${results.filter(r => r.status === "error").length} failed` : ""}
          </p>
          <div className="bulk-result-list">
            {results.map((r, i) => (
              <div
                key={i}
                className={`bulk-result-row ${r.status === "error" ? "error" : ""}`}
                onClick={() => r.status === "done" && onSelectProperty(r)}
              >
                <span className={`status-badge ${r.vacancyStatus === "Vacant" ? "status-vacant" : r.vacancyStatus === "Occupied" ? "status-occupied" : "status-unknown"}`}>
                  {r.vacancyStatus}
                </span>
                <span className="bulk-result-address">{r.confirmedAddress || r.address}</span>
                {r.status === "error" && <span className="bulk-result-error">Failed</span>}
                {r.status === "done" && <span className="bulk-result-cta">View →</span>}
              </div>
            ))}
            {processing && (
              <div className="bulk-result-row loading">
                <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5, borderColor: "var(--text-dim)", borderTopColor: "transparent" }} />
                <span className="bulk-result-address" style={{ color: "var(--text-dim)" }}>{current}</span>
              </div>
            )}
          </div>
          {done && (
            <button
              className="search-btn"
              style={{ marginTop: 16, padding: "12px 28px", borderRadius: 8, fontSize: 14 }}
              onClick={onGoToDashboard}
            >
              Go to Dashboard →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Lookup logic — mirrors Dashboard.jsx
async function lookupProperty(address) {
  const geo = await geocodeAddress(address);
  const [attomData, bizData, vacancyData, loopnetData] = await Promise.all([
    fetchAttomData(address),
    fetchSFBusinesses(address),
    fetchSFVacancy(address),
    fetchLoopNet(geo.lat, geo.lon, address, geo.zip),
  ]);
  return buildRecord(address, geo, attomData, bizData, vacancyData, loopnetData);
}

async function geocodeAddress(address) {
  const normalized = address.replace(/,?\s*(san francisco|sf)\s*,?\s*(ca)?\s*,?\s*\d{5}?\s*/gi, "").trim();
  try {
    const censusUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(normalized + ", San Francisco, CA")}&benchmark=2020&format=json`;
    const res = await fetch(censusUrl);
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (match) return { lat: parseFloat(match.coordinates.y), lon: parseFloat(match.coordinates.x), zip: match.addressComponents?.zip || null };
  } catch {}
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(normalized + ", San Francisco, CA")}&format=json&limit=1&addressdetails=1`,
    { headers: { "User-Agent": "VacantToVibrant/1.0" } }
  );
  const data = await res.json();
  if (!data.length) throw new Error("Not found");
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), zip: data[0].address?.postcode || null };
}

async function fetchAttomData(address) {
  try {
    const clean = address.replace(/,?\s*(san francisco|sf)\s*,?\s*(ca)?\s*/gi, "").trim();
    const res = await fetch(`/api/property?address1=${encodeURIComponent(clean)}&address2=San+Francisco+CA`, { cache: "no-store" });
    return await res.json();
  } catch { return {}; }
}

async function fetchSFBusinesses(address) {
  try {
    const clean = address.replace(/,?\s*(san francisco|sf)\s*,?\s*(ca)?\s*/gi, "").trim();
    const res = await fetch(`/api/businesses?address=${encodeURIComponent(clean)}`, { cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function fetchSFVacancy(address) {
  try {
    const clean = address.replace(/,?\s*(san francisco|sf)\s*,?\s*(ca)?\s*/gi, "").trim();
    const res = await fetch(`/api/vacancy?address=${encodeURIComponent(clean)}`, { cache: "no-store" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function fetchLoopNet(lat, lon, address, zip) {
  if (!lat || !lon) return null;
  try {
    const params = new URLSearchParams({ lat, lon });
    if (address) params.set("address", address);
    if (zip) params.set("zip", zip);
    const res = await fetch(`/api/loopnet?${params}`, { cache: "no-store" });
    return await res.json();
  } catch { return null; }
}

function buildRecord(address, geo, attomData, bizData, vacancyData, loopnetData) {
  const prop = attomData?.property?.[0];
  const ln = loopnetData?.listings?.[0] || null;
  const vacStatus = vacancyData?.[0]?.vacant === "YES" ? "Vacant" : vacancyData?.[0]?.vacant === "NO" ? "Occupied" : "Unknown";
  return {
    address,
    confirmedAddress: prop?.address?.oneLine || address,
    lat: geo.lat,
    lon: geo.lon,
    vacancyStatus: vacStatus,
    vacancyData: vacancyData || [],
    bizHistory: bizData || [],
    loopnetData,
    ownerName: ln?.ownerName || prop?.owner?.owner1?.fullname || null,
    ownerWebsite: ln?.ownerWebsite || null,
    ownerDescription: ln?.ownerDescription || null,
    yearBuilt: ln?.yearBuilt || prop?.summary?.yearbuilt || null,
    yearRenovated: ln?.yearRenovated || null,
    buildingSize: ln?.totalBuildingSize || (prop?.building?.size?.universalsize ? `${Number(prop.building.size.universalsize).toLocaleString()} sq ft` : null),
    buildingClass: ln?.buildingClass || null,
    stories: ln?.stories || null,
    zoning: ln?.zoning || null,
    lotSize: ln?.lotSize || null,
    parkingRatio: ln?.parkingRatio || null,
    totalSpaceAvailable: ln?.totalSpaceAvailable || null,
    amenities: ln?.amenities || [],
    sustainability: ln?.sustainability || null,
    landUse: ln?.category || prop?.summary?.propclass || null,
    apn: ln?.apn || prop?.identifier?.apn || null,
    levels: prop?.building?.summary?.levels || null,
    lastSaleDate: prop?.sale?.amount?.salerecdate || null,
    lastSaleAmount: prop?.sale?.amount?.saleamt ? `$${Number(prop.sale.amount.saleamt).toLocaleString()}` : null,
    lookedUpAt: new Date().toISOString(),
  };
}