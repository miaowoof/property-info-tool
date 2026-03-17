import { useState } from "react";
import ExportButton from "../components/ExportButton";
import { TAGS } from "../App";

const STATUS_FILTERS = ["All", "Vacant", "Occupied", "Unknown"];

export default function History({ history, onSelectProperty, onUpdateMeta, onClearHistory }) {
  const [tagFilter, setTagFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("All");

  if (history.length === 0) {
    return (
      <div className="dashboard">
        <div className="empty-state">
          <div className="empty-icon">⬡</div>
          <p>No properties tracked yet</p>
          <p className="empty-sub">Properties you look up will appear here with your notes and tags</p>
        </div>
      </div>
    );
  }

  const filtered = history.filter(p => {
    const tagMatch = tagFilter === "all" || p.tag === tagFilter || (tagFilter === "untagged" && !p.tag);
    const statusMatch = statusFilter === "All" || p.vacancyStatus === statusFilter;
    return tagMatch && statusMatch;
  });

  return (
    <div className="dashboard">
      <div className="history-header">
        <div>
          <h2 className="history-title">Property Tracker</h2>
          <p className="history-sub">{history.length} propert{history.length === 1 ? "y" : "ies"} tracked</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ExportButton properties={filtered} />
          <button className="clear-btn" onClick={() => { if (window.confirm("Clear all history?")) onClearHistory(); }}>
            Clear All
          </button>
        </div>
      </div>

      {/* Tag filter */}
      <div className="filter-bar" style={{ marginBottom: 8 }}>
        <span className="filter-label">Tag:</span>
        <button className={`filter-btn ${tagFilter === "all" ? "active" : ""}`} onClick={() => setTagFilter("all")}>
          All <span className="filter-count">{history.length}</span>
        </button>
        {TAGS.map(t => {
          const count = history.filter(p => p.tag === t.id).length;
          if (count === 0) return null;
          return (
            <button
              key={t.id}
              className={`filter-btn ${tagFilter === t.id ? "active" : ""}`}
              style={tagFilter === t.id ? { background: t.color, color: "#0e0f0c", borderColor: t.color } : { color: t.color, borderColor: t.color + "66" }}
              onClick={() => setTagFilter(t.id)}
            >
              {t.label} <span className="filter-count">{count}</span>
            </button>
          );
        })}
        <button className={`filter-btn ${tagFilter === "untagged" ? "active" : ""}`} onClick={() => setTagFilter("untagged")}>
          Untagged <span className="filter-count">{history.filter(p => !p.tag).length}</span>
        </button>
      </div>

      {/* Status filter */}
      <div className="filter-bar">
        <span className="filter-label">Status:</span>
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            className={`filter-btn ${statusFilter === s ? "active" : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s} <span className="filter-count">{s === "All" ? history.length : history.filter(p => p.vacancyStatus === s).length}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <p>No properties match these filters</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}