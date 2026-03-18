import { useState, useEffect, useCallback } from "react";
import Dashboard from "./pages/Dashboard";
import PropertyDetail from "./pages/PropertyDetail";
import History from "./pages/History";
import MapView from "./pages/MapView";
import BulkImport from "./pages/BulkImport";
import PasswordGate from "./components/PasswordGate";
import "./index.css";

const STORAGE_KEY = "vtv_search_history";
const META_KEY = "vtv_property_meta"; // notes, tags, vacancy overrides
const CACHE_VERSION = "v3"; // bump this to auto-clear stale cache

// Auto-clear stale cache on version mismatch
if (localStorage.getItem("vtv_cache_version") !== CACHE_VERSION) {
  localStorage.setItem("vtv_session_props", "[]");
  localStorage.setItem(STORAGE_KEY, "[]");
  localStorage.removeItem(META_KEY);
  localStorage.setItem("vtv_cache_version", CACHE_VERSION);
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); }
  catch { return {}; }
}

function saveMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); }
  catch {}
}

function saveHistory(history) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 200))); }
  catch {}
}

export const TAGS = [
  { id: "contacted", label: "Contacted", color: "#60a5fa" },
  { id: "not_interested", label: "Not Interested", color: "#f87171" },
  { id: "follow_up", label: "Follow Up", color: "#fbbf24" },
  { id: "in_progress", label: "In Progress", color: "#34d399" },
  { id: "converted", label: "Converted", color: "#a78bfa" },
];

export default function App() {
  const [dashboardKey, setDashboardKey] = useState(0);
  const [pendingSearch, setPendingSearch] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [meta, setMeta] = useState(loadMeta); // { [address]: { notes, tag, vacancyOverride } }

  // Merge meta into a property object
  const enrichProperty = useCallback((property) => {
    const m = meta[property.address] || {};
    return {
      ...property,
      notes: m.notes || "",
      tag: m.tag || null,
      vacancyOverride: m.vacancyOverride || null,
      vacancyStatus: m.vacancyOverride || property.vacancyStatus,
    };
  }, [meta]);

  // Update meta for a property
  const updateMeta = useCallback((address, updates) => {
    setMeta(prev => {
      const updated = { ...prev, [address]: { ...(prev[address] || {}), ...updates } };
      saveMeta(updated);
      return updated;
    });
  }, []);

  const handleSelectProperty = useCallback((property) => {
    const enriched = enrichProperty(property);
    setSelectedProperty(enriched);
    setPage("detail");
    setHistory(prev => {
      const filtered = prev.filter(p => p.address !== property.address);
      const updated = [property, ...filtered];
      saveHistory(updated);
      return updated;
    });
  }, [enrichProperty]);

  const handleSearchAddress = useCallback((address) => {
    setPage("dashboard");
    setSelectedProperty(null);
    setPendingSearch(address);
  }, []);

  const handleBack = useCallback(() => {
    setPage("dashboard");
    setSelectedProperty(null);
  }, []);

  // Re-enrich selected property when meta changes
  useEffect(() => {
    if (selectedProperty) {
      setSelectedProperty(prev => enrichProperty(prev));
    }
  }, [meta]); // eslint-disable-line

  const historyWithMeta = history.map(enrichProperty);
  const navPages = [
    { id: "dashboard", label: "Search" },
    { id: "history", label: "Tracker", badge: history.length },
    { id: "map", label: "Map" },
    { id: "bulk", label: "Bulk Import" },
  ];

  return (
    <PasswordGate>
    <div className="app">
      <nav className="app-nav">
        <div className="nav-logo" onClick={() => setPage("dashboard")} style={{ cursor: "pointer" }}>
          <span className="logo-icon">◈</span>
          <span className="nav-logo-text">Vacant to Vibrant</span>
        </div>
        <div className="nav-links">
          {navPages.map(({ id, label, badge }) => (
            <button
              key={id}
              className={`nav-link ${page === id ? "active" : ""}`}
              onClick={() => setPage(id)}
            >
              {label}
              {badge > 0 && <span className="nav-badge">{badge}</span>}
            </button>
          ))}
        </div>
      </nav>

      <div className="page-content">
        {page === "detail" && selectedProperty ? (
          <PropertyDetail
            property={selectedProperty}
            onBack={handleBack}
            onUpdateMeta={updateMeta}
            onSearchAddress={handleSearchAddress}
          />
        ) : page === "history" ? (
          <History
            history={historyWithMeta}
            onSelectProperty={handleSelectProperty}
            onUpdateMeta={updateMeta}
            onClearHistory={() => {
              setHistory([]);
              saveHistory([]);
              saveMeta({});
              setPropertyMeta({});
              localStorage.setItem("vtv_session_props", "[]");
              localStorage.removeItem("vtv_auth");
              setDashboardKey(k => k + 1);
            }}
          />
        ) : page === "map" ? (
          <MapView
            properties={historyWithMeta}
            onSelectProperty={handleSelectProperty}
          />
        ) : page === "bulk" ? (
          <BulkImport
            onSelectProperty={handleSelectProperty}
            onGoToDashboard={() => setPage("dashboard")}
          />
        ) : (
          <Dashboard key={dashboardKey} onSelectProperty={handleSelectProperty} pendingSearch={pendingSearch} onClearPending={() => setPendingSearch(null)} />
        )}
      </div>
    </div>
    </PasswordGate>
  );
}