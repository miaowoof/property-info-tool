import { useState, useEffect } from "react";
import AddressSearch from "../components/AddressSearch";
import ExportButton from "../components/ExportButton";
import { TAGS } from "../constants";

const STATUS_FILTERS = ["All", "Vacant", "Occupied", "Unknown"];

const STORAGE_KEY = "vtv_search_history";

export default function Dashboard({ onSelectProperty, pendingSearch, onClearPending }) {
  const [properties, setProperties] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vtv_session_props") || "[]"); }
    catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");
  const [recentSearches, setRecentSearches] = useState([]);

  const LOADING_STEPS = [
    "Geocoding address…",
    "Checking SF vacancy records…",
    "Looking up business history…",
    "Fetching LoopNet listings…",
    "Building property report…",
  ];

  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setRecentSearches(history.slice(0, 3));
    } catch {}
  }, [properties]);

  // Persist current session properties
  useEffect(() => {
    try { localStorage.setItem("vtv_session_props", JSON.stringify(properties.slice(0, 50))); }
    catch {}
  }, [properties]);

  // Auto-trigger search when navigated here with a pending address
  useEffect(() => {
    if (pendingSearch) {
      onClearPending();
      handleSearch(pendingSearch);
    }
  }, [pendingSearch]); // eslint-disable-line

  const handleSearch = async (address) => {
    setLoading(true);
    setLoadingAddress(address);
    setLoadingStep(0);
    setError(null);

    // Animate through steps while lookup runs
    const stepInterval = setInterval(() => {
      setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 900);

    try {
      const data = await lookupProperty(address);
      clearInterval(stepInterval);
      setLoadingStep(LOADING_STEPS.length - 1);
      setProperties((prev) => {
        const exists = prev.find((p) => p.address === data.address);
        if (exists) return prev;
        return [data, ...prev];
      });
      // Small delay so user sees "Building report…" before navigating
      await new Promise(r => setTimeout(r, 400));
      onSelectProperty(data);
    } catch (err) {
      clearInterval(stepInterval);
      setError(err.message || "Failed to look up property.");
    } finally {
      setLoading(false);
      setLoadingAddress(null);
      setLoadingStep(0);
    }
  };

  const filtered =
    filter === "All"
      ? properties
      : properties.filter((p) => p.vacancyStatus === filter);

  if (loading && loadingAddress) {
    return (
      <div className="lookup-loading-page">
        <div className="lookup-loading-inner">
          <div className="lookup-spinner" />
          <p className="lookup-address">{loadingAddress}</p>
          <div className="lookup-steps">
            {LOADING_STEPS.map((step, i) => (
              <div key={i} className={`lookup-step ${i < loadingStep ? "done" : i === loadingStep ? "active" : "pending"}`}>
                <span className="lookup-step-dot">{i < loadingStep ? "✓" : i === loadingStep ? "◉" : "○"}</span>
                <span className="lookup-step-label">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        {properties.length > 0 && <ExportButton properties={properties} />}
      </header>

      <div className="search-section">
        <AddressSearch onSearch={handleSearch} loading={loading} />
        {error && <p className="error-msg">{error}</p>}
      </div>

      {properties.length > 0 && (
        <>
          <div className="filter-bar">
            <span className="filter-label">Filter:</span>
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                className={`filter-btn ${filter === s ? "active" : ""}`}
                onClick={() => setFilter(s)}
              >
                {s}
                <span className="filter-count">
                  {s === "All"
                    ? properties.length
                    : properties.filter((p) => p.vacancyStatus === s).length}
                </span>
              </button>
            ))}
          </div>

          <div className="history-list">
            {filtered.map((p, i) => {
            const tag = p.tag ? TAGS.find(t => t.id === p.tag) : null;
            const statusClass = { Vacant: "status-vacant", Occupied: "status-occupied", Unknown: "status-unknown" }[p.vacancyStatus] || "status-unknown";
            const spaces = p.loopnetData?.listings?.reduce((sum, l) => sum + (l.spaces?.length || 0), 0) || 0;
            return (
              <div key={p.address + i} className="history-row" onClick={() => onSelectProperty(p)}>
                <span className={`status-badge ${statusClass}`}>{p.vacancyStatus}</span>
                <span className="history-row-address">{p.confirmedAddress || p.address}</span>
                <span className="history-row-owner">{p.ownerName || p.vacancyData?.find(v => v.entity)?.entity || "—"}</span>
                <span className="history-row-spaces">{spaces > 0 ? `${spaces} spaces` : "—"}</span>
                {tag && <span className="history-row-tag" style={{ background: tag.color + "22", color: tag.color, border: `1px solid ${tag.color}55` }}>{tag.label}</span>}
                {p.notes && <span className="history-row-notes">{p.notes.slice(0, 60)}{p.notes.length > 60 ? "…" : ""}</span>}
                <span className="history-row-date">{new Date(p.lookedUpAt).toLocaleDateString()}</span>
                <span className="history-row-cta">→</span>
              </div>
            );
          })}
          </div>
        </>
      )}

      {properties.length === 0 && !loading && (
        <>
          {recentSearches.length > 0 ? (
            <div className="recent-section">
              <p className="recent-label">Recent Searches</p>
              <div className="history-list">
                {recentSearches.map((p, i) => {
            const tag = p.tag ? TAGS.find(t => t.id === p.tag) : null;
            const statusClass = { Vacant: "status-vacant", Occupied: "status-occupied", Unknown: "status-unknown" }[p.vacancyStatus] || "status-unknown";
            const spaces = p.loopnetData?.listings?.reduce((sum, l) => sum + (l.spaces?.length || 0), 0) || 0;
            return (
              <div key={p.address + i} className="history-row" onClick={() => onSelectProperty(p)}>
                <span className={`status-badge ${statusClass}`}>{p.vacancyStatus}</span>
                <span className="history-row-address">{p.confirmedAddress || p.address}</span>
                <span className="history-row-owner">{p.ownerName || p.vacancyData?.find(v => v.entity)?.entity || "—"}</span>
                <span className="history-row-spaces">{spaces > 0 ? `${spaces} spaces` : "—"}</span>
                {tag && <span className="history-row-tag" style={{ background: tag.color + "22", color: tag.color, border: `1px solid ${tag.color}55` }}>{tag.label}</span>}
                {p.notes && <span className="history-row-notes">{p.notes.slice(0, 60)}{p.notes.length > 60 ? "…" : ""}</span>}
                <span className="history-row-date">{new Date(p.lookedUpAt).toLocaleDateString()}</span>
                <span className="history-row-cta">→</span>
              </div>
            );
          })}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">⬡</div>
              <p>Enter an address to begin investigating</p>
              <p className="empty-sub">
                Pull vacancy status, ownership, last business, and broker info for
                any SF property
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Property Lookup Logic ────────────────────────────────────────────────────
async function lookupProperty(address) {
  // 1. Geocode the address
  const geo = await geocodeAddress(address);

  // 2. Fetch all data sources in parallel
  const [attomData, bizData, vacancyData, loopnetData] = await Promise.all([
    fetchAttomData(geo.lat, geo.lon, address),
    fetchSFBusinesses(address),
    fetchSFVacancy(address),
    fetchLoopNet(geo.lat, geo.lon, address, geo.zip),
  ]);

  // 3. Build full record
  return buildPropertyRecord(address, geo, attomData, bizData, vacancyData, loopnetData);
}

async function fetchSFBusinesses(address) {
  // Strip city/state for the SF Open Data query
  const clean = address
    .replace(/,?\s*(san francisco|sf)\s*,?\s*(ca)?\s*,?\s*\d{5}?\s*/gi, "")
    .trim();
  try {
    const res = await fetch(
      `/api/businesses?address=${encodeURIComponent(clean)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchSFVacancy(address) {
  const clean = address
    .replace(/,?\s*(san francisco|sf)\s*,?\s*(ca)?\s*,?\s*\d{5}?\s*/gi, "")
    .trim();
  try {
    const res = await fetch(
      `/api/vacancy?address=${encodeURIComponent(clean)}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchLoopNet(lat, lon, address, zip) {
  if (!lat || !lon) return null;
  try {
    const params = new URLSearchParams({ lat, lon });
    if (address) params.set("address", address);
    if (zip) params.set("zip", zip);
    const res = await fetch(`/api/loopnet?${params}`, { cache: "no-store" });
    const data = await res.json();
    return data || null;
  } catch {
    return null;
  }
}

async function geocodeAddress(rawAddress) {
  const normalized = rawAddress
    .replace(/,?\s*(san francisco|sf)\s*,?\s*(ca)?\s*,?\s*\d{5}?\s*/gi, "")
    .trim();

  // US Census Geocoder — free, no key, highly accurate for US addresses
  try {
    const censusUrl =
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress` +
      `?address=${encodeURIComponent(normalized + ", San Francisco, CA")}` +
      `&benchmark=2020&format=json`;
    const res = await fetch(censusUrl);
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (match) {
      const zip = match.addressComponents?.zip || null;
      return {
        lat: parseFloat(match.coordinates.y),
        lon: parseFloat(match.coordinates.x),
        zip,
      };
    }
  } catch (e) {
    console.warn("Census geocoder failed, falling back to Nominatim:", e.message);
  }

  // Fallback: Nominatim
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(normalized + ", San Francisco, CA")}` +
    `&format=json&limit=3&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "VacantToVibrant/1.0" },
  });
  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Address not found. Try adding 'San Francisco, CA'.");
  }
  const best = results[0];
  return {
    lat: parseFloat(best.lat),
    lon: parseFloat(best.lon),
    zip: best.address?.postcode || null,
  };
}

async function fetchAttomData(lat, lon, address) {
  // ATTOM API — replace YOUR_ATTOM_API_KEY with your actual key
  // Docs: https://api.developer.attomdata.com/
  const ATTOM_KEY = import.meta.env.VITE_ATTOM_API_KEY;

  if (!ATTOM_KEY) {
    // Return mock data if no key configured yet
    return getMockData(address);
  }

  // Strip city/state if user typed it in, to avoid duplicating in the query
  const cleanAddress = address
    .replace(/,?\s*(san francisco|sf)\s*,?\s*(ca)?\s*,?\s*\d{5}?\s*/gi, "")
    .trim();

  const url = `/api/property?address1=${encodeURIComponent(cleanAddress)}&address2=San+Francisco+CA`;
  console.log("[ATTOM] Fetching via proxy:", url);

  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    console.log("[ATTOM] Result address:", json?.property?.[0]?.address?.oneLine);
    return parseAttomResponse(json);
  } catch (err) {
    console.error("[ATTOM] Error:", err);
    return getMockData(address);
  }
}

function parseAttomResponse(json) {
  const prop = json?.property?.[0];
  if (!prop) return { vacancyStatus: "Unknown", ownerName: null, noData: true };

  const owner = prop.owner;
  const ownerName =
    owner?.owner1?.fullname ||
    owner?.owner1?.lastname ||
    null;

  const ownerMailing =
    owner?.mailingAddress?.oneLine ||
    owner?.mailoneline ||
    [owner?.mailingAddress?.line1, owner?.mailingAddress?.line2].filter(Boolean).join(", ") ||
    null;

  // Vacancy inference from absenteeInd + propIndicator
  const absentee = prop.summary?.absenteeInd || "";
  const propIndicator = String(prop.summary?.propIndicator || "");
  let vacancyStatus = "Unknown";
  if (absentee.toLowerCase().includes("owner occupied")) vacancyStatus = "Occupied";
  const commercialTypes = ["21","22","23","24","25","26","27","28","29"];
  if (commercialTypes.includes(propIndicator) && absentee.toLowerCase().includes("absentee")) vacancyStatus = "Vacant";

  // Sale
  const sale = prop.sale;
  const lastSaleDate = sale?.amount?.saleRecDate || sale?.salesearchdate || null;
  const lastSaleAmount = sale?.amount?.saleamt
    ? `$${Number(sale.amount.saleamt).toLocaleString()}` : null;

  // Building
  const bldg = prop.building;
  const buildingSize = bldg?.size?.universalsize
    ? `${Number(bldg.size.universalsize).toLocaleString()} sq ft`
    : bldg?.size?.bldgsize
    ? `${Number(bldg.size.bldgsize).toLocaleString()} sq ft` : null;

  return {
    vacancyStatus,
    ownerName,
    ownerMailingAddress: ownerMailing,
    ownerPhone: ownerName ? "See county records" : null,
    ownerEmail: ownerName ? "Not in public records" : null,
    lastBusiness: null,
    brokerName: null,
    brokerPhone: null,
    brokerEmail: null,
    brokerFirm: null,
    lastSaleDate,
    lastSaleAmount,
    yearBuilt: prop.summary?.yearbuilt || null,
    buildingSize,
    landUse: prop.summary?.propclass || prop.summary?.propLandUse || null,
    constructionType: prop.building?.construction?.constructiontype || null,
    levels: prop.building?.summary?.levels || null,
    lotSize: prop.lot?.lotsize2 ? `${Number(prop.lot.lotsize2).toLocaleString()} sq ft` : null,
    apn: prop.identifier?.apn || null,
    subdivision: prop.area?.subdname || null,
    zipCode: prop.address?.postal1 || null,
    confirmedAddress: prop.address?.oneLine || null,
  };
}

function buildPropertyRecord(address, geo, attomData, bizData = [], vacancyData = [], loopnetData = null) {
  // Use first LoopNet listing as primary property data source, fall back to ATTOM
  const ln = loopnetData?.listings?.[0] || null;
  return {
    address,
    lat: geo.lat,
    lon: geo.lon,
    vacancyStatus: parseVacancyStatus(vacancyData, attomData),
    vacancyData,
    // Owner: LoopNet ExtendedDetails first, then ATTOM
    ownerName: ln?.ownerName || attomData.ownerName,
    ownerWebsite: ln?.ownerWebsite || null,
    ownerDescription: ln?.ownerDescription || null,
    ownerMailingAddress: attomData.ownerMailingAddress,
    ownerPhone: attomData.ownerPhone,
    ownerEmail: attomData.ownerEmail,
    lastBusiness: parseBizHistory(bizData),
    bizHistory: bizData,
    loopnetData,
    // Brokers: LoopNet first (has phone+email), ATTOM fallback
    brokerName: ln?.brokers?.[0]?.name || attomData.brokerName || null,
    brokerPhone: ln?.brokers?.[0]?.phone || attomData.brokerPhone || null,
    brokerEmail: ln?.brokers?.[0]?.email || attomData.brokerEmail || null,
    // Building facts: LoopNet first, ATTOM fallback
    yearBuilt: ln?.yearBuilt || attomData.yearBuilt,
    yearRenovated: ln?.yearRenovated || null,
    buildingSize: ln?.totalBuildingSize || attomData.buildingSize,
    buildingClass: ln?.buildingClass || null,
    stories: ln?.stories || null,
    lotSize: ln?.lotSize || null,
    zoning: ln?.zoning || null,
    parkingRatio: ln?.parkingRatio || null,
    amenities: ln?.amenities || [],
    sustainability: ln?.sustainability || null,
    highlights: ln?.highlights || [],
    totalSpaceAvailable: ln?.totalSpaceAvailable || null,
    landUse: ln?.category || attomData.landUse,
    apn: ln?.apn || attomData.apn,
    lastSaleDate: attomData.lastSaleDate,
    lastSaleAmount: attomData.lastSaleAmount,
    lookedUpAt: new Date().toISOString(),
  };
}

// ─── SF Vacancy Tax Parser ───────────────────────────────────────────────────
function parseVacancyStatus(vacancyData, attomData) {
  if (vacancyData && vacancyData.length > 0) {
    // Get most recent year's data
    const sorted = [...vacancyData].sort((a, b) => (b.taxyear || "").localeCompare(a.taxyear || ""));
    const latest = sorted[0];
    if (latest.vacant === "YES") return "Vacant";
    if (latest.vacant === "NO") return "Occupied";
  }
  // Fall back to ATTOM inference
  return attomData.vacancyStatus || "Unknown";
}

// ─── SF Business License Parser ──────────────────────────────────────────────
function parseBizHistory(bizData) {
  if (!bizData || bizData.length === 0) return null;

  // Sort: active businesses first, then by most recent end date
  const sorted = [...bizData].sort((a, b) => {
    const aActive = !a.location_end_date && !a.business_end_date;
    const bActive = !b.location_end_date && !b.dba_end_date;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    const aDate = a.location_end_date || a.business_end_date || "";
    const bDate = b.location_end_date || b.dba_end_date || "";
    return bDate.localeCompare(aDate);
  });

  const current = sorted.filter(b => !b.location_end_date && !b.dba_end_date);
  const past = sorted.filter(b => b.location_end_date || b.dba_end_date);

  if (current.length > 0) {
    const names = current.map(b => b.dba_name || b.ownership_name).filter(Boolean);
    return `Active: ${names.slice(0, 2).join(", ")}`;
  }
  if (past.length > 0) {
    const last = past[0];
    const name = last.dba_name || last.ownership_name || "Unknown";
    const endDate = last.location_end_date || last.business_end_date;
    const year = endDate ? new Date(endDate).getFullYear() : null;
    return year ? `${name} (closed ${year})` : name;
  }
  return null;
}

// ─── Mock data for development (no API key needed) ───────────────────────────
function getMockData(address = "") {
  const statuses = ["Vacant", "Vacant", "Occupied", "Unknown"];
  const businesses = [
    "Boba Guys",
    "Wells Fargo Branch",
    "Tartine Bakery Pop-up",
    "Sprint Store",
    "Urban Outfitters",
  ];
  const brokers = [
    { name: "Sarah Chen", phone: "(415) 555-0192", email: "s.chen@colliers.com", firm: "Colliers SF" },
    { name: "Marcus Webb", phone: "(415) 555-0847", email: "mwebb@cbre.com", firm: "CBRE" },
    { name: null, phone: null, email: null, firm: null },
  ];
  const owners = [
    { name: "Pacific Realty Trust LLC", mailing: "100 Pine St, Suite 1200, SF CA 94111", phone: "(415) 555-2210", email: "info@pacificrealtytrust.com" },
    { name: "Chan Family Holdings", mailing: "PO Box 7741, SF CA 94120", phone: "Not public", email: "Not public" },
    { name: "SFO Properties Inc.", mailing: "1 Market Plaza, SF CA 94105", phone: "(415) 555-0033", email: "mgmt@sfoproperties.com" },
  ];

  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const owner = owners[Math.floor(Math.random() * owners.length)];
  const broker = brokers[Math.floor(Math.random() * brokers.length)];
  const business = businesses[Math.floor(Math.random() * businesses.length)];

  return {
    vacancyStatus: status,
    ownerName: owner.name,
    ownerMailingAddress: owner.mailing,
    ownerPhone: owner.phone,
    ownerEmail: owner.email,
    lastBusiness: status === "Occupied" ? "Current tenant" : business,
    brokerName: broker.name,
    brokerPhone: broker.phone,
    brokerEmail: broker.email,
    brokerFirm: broker.firm,
    lastSaleDate: "2019-03-15",
    lastSaleAmount: "$1,250,000",
    yearBuilt: 1924 + Math.floor(Math.random() * 60),
    buildingSize: `${(Math.floor(Math.random() * 5) + 1) * 1000} sq ft`,
    landUse: "Commercial",
    apn: `3${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 90 + 10)}`,
  };
}