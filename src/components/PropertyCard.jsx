import { TAGS } from "../constants";

export default function PropertyCard({ property: p, onClick }) {
  const statusClass = {
    Vacant: "status-vacant",
    Occupied: "status-occupied",
    Unknown: "status-unknown",
  }[p.vacancyStatus] || "status-unknown";

  const tag = p.tag ? TAGS.find(t => t.id === p.tag) : null;

  return (
    <div className="property-card" onClick={onClick}>
      <div className="card-top">
        <span className={`status-badge ${statusClass}`}>{p.vacancyStatus}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {tag && (
            <span className="card-tag" style={{ background: tag.color + "22", color: tag.color, border: `1px solid ${tag.color}55` }}>
              {tag.label}
            </span>
          )}
          <span className="card-date">{new Date(p.lookedUpAt).toLocaleDateString()}</span>
        </div>
      </div>

      <p className="card-address">{p.confirmedAddress || p.address}</p>

      <div className="card-meta">
        <div className="card-meta-item">
          <span className="meta-label">Owner</span>
          <span className="meta-value">{p.ownerName || p.vacancyData?.find(v => v.entity)?.entity || "—"}</span>
        </div>
        <div className="card-meta-item">
          <span className="meta-label">Land Use</span>
          <span className="meta-value">{p.landUse || "—"}</span>
        </div>
        <div className="card-meta-item">
          <span className="meta-label">Available Units</span>
          <span className="meta-value">
            {p.loopnetData?.listings?.length > 0
              ? p.loopnetData.listings.reduce((sum, l) => sum + (l.spaces?.length || 0), 0) + " spaces"
              : "—"}
          </span>
        </div>
      </div>

      {p.notes && (
        <p className="card-notes">{p.notes.slice(0, 80)}{p.notes.length > 80 ? "…" : ""}</p>
      )}

      <div className="card-footer">
        <span className="card-cta">View details →</span>
        {p.buildingSize && <span className="card-size">{p.buildingSize}</span>}
      </div>
    </div>
  );
}