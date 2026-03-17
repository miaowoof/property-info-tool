import { useEffect, useRef, useState } from "react";
import { TAGS } from "../App";

export default function MapView({ properties, onSelectProperty }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [filter, setFilter] = useState("all");

  const filtered = properties.filter(p => {
    if (filter === "all") return true;
    if (filter === "Vacant") return p.vacancyStatus === "Vacant";
    if (filter === "untagged") return !p.tag;
    return p.tag === filter;
  });

  useEffect(() => {
    // Load Leaflet dynamically
    if (!window.L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current) updateMarkers();
  }, [filtered]);

  function initMap() {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = window.L.map(mapRef.current).setView([37.7749, -122.4194], 13);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    mapInstanceRef.current = map;
    updateMarkers();
  }

  function updateMarkers() {
    const map = mapInstanceRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    filtered.forEach(p => {
      if (!p.lat || !p.lon) return;
      const color = {
        Vacant: "#e8ff6b",
        Occupied: "#6bffc0",
        Unknown: "#ff9f6b",
      }[p.vacancyStatus] || "#ff9f6b";

      const tag = p.tag ? TAGS.find(t => t.id === p.tag) : null;
      const icon = window.L.divIcon({
        html: `<div style="
          width:14px;height:14px;border-radius:50%;
          background:${color};border:2px solid #0e0f0c;
          box-shadow:0 0 0 2px ${color}44;
        "></div>`,
        className: "",
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = window.L.marker([p.lat, p.lon], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:180px">
            <strong style="font-size:13px">${p.confirmedAddress || p.address}</strong>
            <div style="margin-top:6px;font-size:12px;color:#666">${p.vacancyStatus}${tag ? ` · ${tag.label}` : ""}</div>
            ${p.notes ? `<div style="margin-top:4px;font-size:11px;color:#888">${p.notes.slice(0, 60)}…</div>` : ""}
            <button onclick="window.__vtvSelect('${p.address}')" style="margin-top:8px;background:#e8ff6b;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600">
              View Details →
            </button>
          </div>
        `);
      markersRef.current.push(marker);
    });

    // Global handler for popup button
    window.__vtvSelect = (address) => {
      const prop = properties.find(p => p.address === address);
      if (prop) onSelectProperty(prop);
    };
  }

  if (properties.length === 0) {
    return (
      <div className="dashboard">
        <div className="empty-state">
          <div className="empty-icon">⬡</div>
          <p>No properties to map yet</p>
          <p className="empty-sub">Look up properties first and they'll appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-page">
      <div className="map-toolbar">
        <div className="map-filters">
          <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            All <span className="filter-count">{properties.length}</span>
          </button>
          <button className={`filter-btn ${filter === "Vacant" ? "active" : ""}`} onClick={() => setFilter("Vacant")}>
            Vacant <span className="filter-count">{properties.filter(p => p.vacancyStatus === "Vacant").length}</span>
          </button>
          {TAGS.map(t => {
            const count = properties.filter(p => p.tag === t.id).length;
            if (count === 0) return null;
            return (
              <button key={t.id}
                className={`filter-btn ${filter === t.id ? "active" : ""}`}
                style={filter === t.id ? { background: t.color, color: "#0e0f0c", borderColor: t.color } : { color: t.color, borderColor: t.color + "66" }}
                onClick={() => setFilter(t.id)}>
                {t.label} <span className="filter-count">{count}</span>
              </button>
            );
          })}
        </div>
        <span className="map-count">{filtered.length} shown</span>
      </div>
      <div ref={mapRef} className="map-container" />
    </div>
  );
}
