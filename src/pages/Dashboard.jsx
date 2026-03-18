import { useState } from "react";
import ExportButton from "../components/ExportButton";
import { TAGS } from "../App";

const InfoRow = ({ label, value, highlight }) => {
  if (!value) return null;
  return (
    <div className={`info-row ${highlight ? "highlight" : ""}`}>
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
};

const Section = ({ title, icon, children, fullWidth }) => (
  <div className={`detail-section ${fullWidth ? "full-width" : ""}`}>
    <h3 className="section-title">
      <span className="section-icon">{icon}</span>
      {title}
    </h3>
    <div className="section-body">{children}</div>
  </div>
);

// Detect if a unit is likely ground floor / retail
function isGroundFloor(address) {
  if (!address) return false;
  const lower = address.toLowerCase();
  // No suite = entire building street address = likely ground floor storefront
  if (!/ste|suite|fl |floor|#|apt|unit/.test(lower)) return true;
  // Low suite numbers like 100, 101, 102, A, B, C, R, GF, Retail
  const suiteMatch = lower.match(/(?:ste|suite|unit|#)\s*([a-z0-9]+)/);
  if (suiteMatch) {
    const s = suiteMatch[1];
    if (/^(retail|gf|ground|r|a|b|c|1[0-9]{2})$/i.test(s)) return true;
    const num = parseInt(s);
    if (!isNaN(num) && num >= 1 && num <= 199) return true;
  }
  return false;
}

// Group biz records by suite
function groupBySuite(bizHistory) {
  const suites = {};
  for (const b of bizHistory) {
    const addr = b.full_business_address || "";
    // Extract suite from address
    const suiteMatch = addr.match(/(?:ste|suite|fl|floor|#|apt|unit)\s*([\w-]+)/i);
    const suite = suiteMatch ? suiteMatch[0] : "Ground Floor / No Suite";
    if (!suites[suite]) suites[suite] = [];
    suites[suite].push(b);
  }
  return suites;
}

function buildLoopNetUrl(address) {
  const q = `"${address}" San Francisco for lease site:loopnet.com`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

// Google search scoped to CoStar for a specific address
function buildCoStarUrl(address) {
  const q = `"${address}" site:costar.com`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}


const BusinessModal = ({ business: b, onClose }) => {
  if (!b) return null;
  const rows = [
    { label: "DBA Name", value: b.dba_name },
    { label: "Ownership Name", value: b.ownership_name },
    { label: "Business Account #", value: b.certificate_number || b.ttxid || "—" },
    { label: "Street Address", value: b.full_business_address },
    { label: "Industry", value: b.naic_code_description },
    { label: "Location Start", value: b.location_start_date ? new Date(b.location_start_date).toLocaleDateString() : "—" },
    { label: "Location End", value: b.location_end_date ? new Date(b.location_end_date).toLocaleDateString() : "Active" },
  ];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{b.dba_name || b.ownership_name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {rows.map(({ label, value }) => value && (
            <div key={label} className="modal-row">
              <span className="modal-label">{label}</span>
              <span className="modal-value">{value}</span>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <a
            href={`https://data.sfgov.org/Economy-and-Community/Registered-Business-Locations-San-Francisco/g8m3-pdis?$q=${encodeURIComponent(b.dba_name || b.ownership_name || "")}`}
            target="_blank"
            rel="noreferrer"
            className="modal-sf-link"
          >
            View in SF Business Registry ↗
          </a>
        </div>
      </div>
    </div>
  );
};

export default function PropertyDetail({ property: p, onBack, onUpdateMeta, onSearchAddress }) {
  const statusClass = {
    Vacant: "status-vacant",
    Occupied: "status-occupied",
    Unknown: "status-unknown",
  }[p.vacancyStatus] || "status-unknown";

  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [notes, setNotes] = useState(p.notes || "");
  const [activeTag, setActiveTag] = useState(p.tag || null);
  const [vacancyOverride, setVacancyOverride] = useState(p.vacancyOverride || "");
  const [manualOwner, setManualOwner] = useState("");
  const [manualOwnerSubmitted, setManualOwnerSubmitted] = useState("");
  const suiteGroups = p.bizHistory ? groupBySuite(p.bizHistory) : {};
  const baseAddress = (p.confirmedAddress || p.address || "").replace(/,.*$/, "").trim();
  const loopnetUrl = `https://www.loopnet.com/search/retail-space/${encodeURIComponent("san-francisco-ca")}/for-lease/?sk=${encodeURIComponent(baseAddress)}`;

  return (
    <div className="detail-page">
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <ExportButton properties={[p]} single />
      </div>

      <div className="detail-hero">
        <div>
          <p className="detail-address">{p.confirmedAddress || p.address}</p>
          <div className={`status-badge large ${statusClass}`}>
            {p.vacancyStatus}
          </div>
        </div>
        {p.apn && <div className="apn-chip">APN {p.apn}</div>}
      </div>

      <div className="detail-grid">

        <Section title="Ownership" icon="◎">
          {/* Owner from LoopNet ExtendedDetails */}
          {p.ownerName && (
            <div className="info-row highlight">
              <span className="info-label">Owner</span>
              <span className="info-value">
                {p.ownerName}
                {p.ownerWebsite && (
                  <a href={p.ownerWebsite} target="_blank" rel="noreferrer"
                    style={{ marginLeft: 8, color: "var(--accent)", fontSize: 11 }}>
                    Website ↗
                  </a>
                )}
              </span>
            </div>
          )}
          {p.ownerDescription && (
            <div style={{ padding: "4px 20px 8px", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
              {p.ownerDescription}
            </div>
          )}
          {/* Owner from vacancy tax filings */}
          {p.vacancyData && p.vacancyData.length > 0 && (() => {
            const sorted = [...p.vacancyData].sort((a, b) => (b.taxyear || "").localeCompare(a.taxyear || ""));
            const ownerFiling = sorted.find(v => v.filertype === "Owner");
            const tenantFiling = sorted.find(v => v.filertype === "Tenant");
            const contactFiling = ownerFiling || sorted.find(v => v.entity);
            return (
              <div>
                {contactFiling && (
                  <>
                    <div className="info-row" style={p.ownerName ? {} : { background: "var(--card-hover)" }}>
                      <span className="info-label">Filing Entity</span>
                      <span className="info-value">
                        {contactFiling.entity}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Tax Year</span>
                      <span className="info-value">{contactFiling.taxyear}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Vacancy Filed</span>
                      <span className="info-value">{contactFiling.vacant === "YES" ? "⚠ Reported Vacant" : "Not vacant"}</span>
                    </div>
                    {/* Contact lookup links */}
                    <div className="owner-contact-links">
                      <p className="owner-contact-label">Find contact info:</p>
                      <div className="owner-contact-grid">
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(`"${p.ownerName || contactFiling.entity}" "San Francisco" building management contact`)}`}
                          target="_blank" rel="noreferrer" className="contact-link management">
                          <span className="contact-link-title">🏢 Building Management</span>
                          <span className="contact-link-sub">Find property manager & contact</span>
                        </a>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(`"${p.ownerName || contactFiling.entity}" "San Francisco" phone email`)}`}
                          target="_blank" rel="noreferrer" className="contact-link google">
                          <span className="contact-link-title">🔍 Google Search</span>
                          <span className="contact-link-sub">Phone, email, website</span>
                        </a>
                        <a
                          href={`https://bizfileonline.sos.ca.gov/search/business?businessName=${encodeURIComponent(contactFiling.entity)}`}
                          target="_blank" rel="noreferrer" className="contact-link sos">
                          <span className="contact-link-title">📋 CA Secretary of State</span>
                          <span className="contact-link-sub">Registered agent & address</span>
                        </a>
                        <a
                          href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(contactFiling.entity)}`}
                          target="_blank" rel="noreferrer" className="contact-link linkedin">
                          <span className="contact-link-title">💼 LinkedIn</span>
                          <span className="contact-link-sub">Decision makers & staff</span>
                        </a>
                        <a
                          href={`https://data.sfgov.org/Economy-and-Community/Registered-Business-Locations-San-Francisco/g8m3-pdis?$q=${encodeURIComponent(contactFiling.entity)}`}
                          target="_blank" rel="noreferrer" className="contact-link sfbiz">
                          <span className="contact-link-title">📍 SF Business Registry</span>
                          <span className="contact-link-sub">Tax contact & address</span>
                        </a>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(`"${p.ownerName || contactFiling.entity}" site:linkedin.com OR site:zoominfo.com OR site:bizapedia.com`)}`}
                          target="_blank" rel="noreferrer" className="contact-link deep">
                          <span className="contact-link-title">🕵️ Deep Search</span>
                          <span className="contact-link-sub">LinkedIn, ZoomInfo, BizApedia</span>
                        </a>
                      </div>
                    </div>
                  </>
                )}
                {tenantFiling && (
                  <div className="info-row">
                    <span className="info-label">Tenant Entity</span>
                    <span className="info-value">{tenantFiling.entity}</span>
                  </div>
                )}
                {p.vacancyData.length > 1 && (
                  <div className="vacancy-history">
                    <p className="vacancy-history-label">Filing History</p>
                    {[...p.vacancyData]
                      .sort((a, b) => (b.taxyear || "").localeCompare(a.taxyear || ""))
                      .map((v, i) => (
                        <div key={i} className="vacancy-row">
                          <span className="vacancy-year">{v.taxyear}</span>
                          <span className="vacancy-entity">{v.entity}</span>
                          <span className={`vacancy-status ${v.vacant === "YES" ? "is-vacant" : "not-vacant"}`}>
                            {v.vacant === "YES" ? "Vacant" : "Occupied"}
                          </span>
                          <span className="vacancy-filer">{v.filertype}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Manual owner entry — always shown, message only when no data at all */}
          {(!p.vacancyData || p.vacancyData.length === 0) && !p.ownerName && (
            <div style={{ padding: "14px 20px 0" }}>
              <p className="no-data" style={{ marginBottom: 12 }}>
                No ownership data found. Enter owner info you already know:
              </p>
            </div>
          )}
          <div className="manual-owner-section">
            <div className="manual-owner-input-row">
              <input
                className="manual-owner-input"
                type="text"
                placeholder={manualOwnerSubmitted ? manualOwnerSubmitted : "Enter owner or building name…"}
                value={manualOwner}
                onChange={e => setManualOwner(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && manualOwner.trim()) setManualOwnerSubmitted(manualOwner.trim()); }}
              />
              <button
                className="manual-owner-btn"
                onClick={() => { if (manualOwner.trim()) setManualOwnerSubmitted(manualOwner.trim()); }}
                disabled={!manualOwner.trim()}
              >
                Search →
              </button>
            </div>
            {manualOwnerSubmitted && (
              <div className="owner-contact-links" style={{ marginTop: 12 }}>
                <p className="owner-contact-label">Searching for: <strong style={{ color: "var(--text)" }}>{manualOwnerSubmitted}</strong></p>
                <div className="owner-contact-grid">
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`"${manualOwnerSubmitted}" "San Francisco" building management contact`)}`}
                    target="_blank" rel="noreferrer" className="contact-link management">
                    <span className="contact-link-title">🏢 Building Management</span>
                    <span className="contact-link-sub">Find property manager & contact</span>
                  </a>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`"${manualOwnerSubmitted}" "San Francisco" phone email`)}`}
                    target="_blank" rel="noreferrer" className="contact-link google">
                    <span className="contact-link-title">🔍 Google Search</span>
                    <span className="contact-link-sub">Phone, email, website</span>
                  </a>
                  <a
                    href={`https://bizfileonline.sos.ca.gov/search/business?businessName=${encodeURIComponent(manualOwnerSubmitted)}`}
                    target="_blank" rel="noreferrer" className="contact-link sos">
                    <span className="contact-link-title">📋 CA Secretary of State</span>
                    <span className="contact-link-sub">Registered agent & address</span>
                  </a>
                  <a
                    href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(manualOwnerSubmitted)}`}
                    target="_blank" rel="noreferrer" className="contact-link linkedin">
                    <span className="contact-link-title">💼 LinkedIn</span>
                    <span className="contact-link-sub">Decision makers & staff</span>
                  </a>
                  <a
                    href={`https://data.sfgov.org/Economy-and-Community/Registered-Business-Locations-San-Francisco/g8m3-pdis?$q=${encodeURIComponent(manualOwnerSubmitted)}`}
                    target="_blank" rel="noreferrer" className="contact-link sfbiz">
                    <span className="contact-link-title">📍 SF Business Registry</span>
                    <span className="contact-link-sub">Tax contact & address</span>
                  </a>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(`"${manualOwnerSubmitted}" site:linkedin.com OR site:zoominfo.com OR site:bizapedia.com`)}`}
                    target="_blank" rel="noreferrer" className="contact-link deep">
                    <span className="contact-link-title">🕵️ Deep Search</span>
                    <span className="contact-link-sub">LinkedIn, ZoomInfo, BizApedia</span>
                  </a>
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: "10px 20px 14px" }}>
            <div className="assessor-links">
              {p.apn && (
                <a
                  href={`https://sfassessor.org/property-information/detailed-property-information?blklot=${p.apn.replace(/\s/g, "")}`}
                  target="_blank" rel="noreferrer"
                  className="assessor-link"
                >
                  <span className="assessor-link-title">SF Assessor-Recorder ↗</span>
                  <span className="assessor-link-sub">APN {p.apn} · Full ownership records</span>
                </a>
              )}
              <a
                href={`https://propertymap.sfplanning.org/?search=${encodeURIComponent(p.confirmedAddress || p.address)}`}
                target="_blank" rel="noreferrer"
                className="assessor-link"
              >
                <span className="assessor-link-title">SF Property Information Map ↗</span>
                <span className="assessor-link-sub">Zoning, permits, ownership, tax history</span>
              </a>
            </div>
          </div>
        </Section>

        <Section title="Available Spaces" icon="⬡">
          {p.loopnetData && p.loopnetData.listings && p.loopnetData.listings.length > 0 ? (
            p.loopnetData.listings.slice(0, 3).map((listing, li) => {
              // "Did you mean?" — show when listing address differs from searched address
              const searchedNum = (p.address || "").trim().match(/^\d+/)?.[0];
              const listingNum = (listing.address || "").trim().match(/^\d+/)?.[0];
              const addressMismatch = listing.address && searchedNum && listingNum && listingNum !== searchedNum;
              return (
              <div key={li} style={li > 0 ? { borderTop: "1px solid var(--border)" } : {}}>
                {/* "Did you mean?" banner */}
                {addressMismatch && li === 0 && onSearchAddress && (
                  <button
                    onClick={() => onSearchAddress(listing.address + ", San Francisco, CA")}
                    style={{ width: "100%", padding: "9px 20px", background: "var(--accent)11", borderBottom: "1px solid var(--accent)33", border: "none", borderTop: "none", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "'DM Mono', monospace" }}>
                      ⚠ LoopNet lists this building as <strong>{listing.address}</strong> — click to search that address →
                    </span>
                  </button>
                )}
                {/* Header: address + link */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px 4px" }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>
                    {listing.address || listing.title}
                  </span>
                  {listing.url && (
                    <a href={listing.url} target="_blank" rel="noreferrer"
                      style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>
                      LoopNet ↗
                    </a>
                  )}
                </div>
                {/* Spaces table */}
                {listing.spaces && listing.spaces.length > 0 ? (
                  <div className="spaces-table">
                    <div className="spaces-header">
                      <span>Suite / Floor</span>
                      <span>Size</span>
                      <span>Rate</span>
                      <span>Available</span>
                    </div>
                    {listing.spaces.map((s, si) => {
                      const rate = s.rentalRate && !s.rentalRate.includes("Upon Request")
                        ? s.rentalRate.split(" ").slice(0,2).join(" ")
                        : "Upon Request";
                      return (
                        <div key={si} className="spaces-row">
                          <span className="spaces-suite">{s.space || "—"}</span>
                          <span className="spaces-size">{s.size || "—"}</span>
                          <span className="spaces-rate">{rate}</span>
                          <span className="spaces-avail">{s.available || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="no-data" style={{ padding: "8px 20px" }}>No space details available</p>
                )}
                {/* Brokers */}
                {listing.brokers && listing.brokers.length > 0 && (
                  <div style={{ padding: "8px 20px 12px", borderTop: "1px solid var(--border)" }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                      Brokers
                    </p>
                    {listing.brokers.map((b, bi) => (
                      <div key={bi} style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ color: "var(--text)" }}>{b.name}</span>
                          {b.title && <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{b.title}</span>}
                          {b.company && <span style={{ color: "var(--text-dim)" }}>· {b.company}</span>}
                          {b.url && <a href={b.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 11, marginLeft: "auto" }}>Profile ↗</a>}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 2, fontSize: 12 }}>
                          {b.phone && <a href={`tel:${b.phone}`} style={{ color: "var(--accent)", textDecoration: "none" }}>📞 {b.phone}</a>}
                          {b.email && <a href={`mailto:${b.email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>✉ {b.email}</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
            })
          ) : (
            <div style={{ padding: "16px 20px" }}>
              <p className="no-data">No active LoopNet listing found nearby.</p>
              <p className="no-data" style={{ marginTop: 8, lineHeight: 1.6 }}>
                Search manually:{" "}
                <a href={`https://www.google.com/search?q=${encodeURIComponent('"' + (p.confirmedAddress || p.address) + '" San Francisco for lease site:loopnet.com')}`}
                  target="_blank" rel="noreferrer" style={{ color: "#4a9eff" }}>LoopNet ↗</a>
                {" · "}
                <a href={`https://www.google.com/search?q=${encodeURIComponent('"' + (p.confirmedAddress || p.address) + '" site:costar.com')}`}
                  target="_blank" rel="noreferrer" style={{ color: "#ff6b6b" }}>CoStar ↗</a>
              </p>
            </div>
          )}
        </Section>

        <Section title="Property Details" icon="△">
          <InfoRow label="Year Built" value={p.yearBuilt} />
          {p.yearRenovated && <InfoRow label="Year Renovated" value={p.yearRenovated} />}
          <InfoRow label="Building Size" value={p.buildingSize} />
          {p.buildingClass && <InfoRow label="Building Class" value={`Class ${p.buildingClass}`} />}
          {p.stories && <InfoRow label="Stories" value={p.stories} />}
          <InfoRow label="Land Use" value={p.landUse} />
          {p.lotSize && <InfoRow label="Lot Size" value={p.lotSize} />}
          {p.zoning && <InfoRow label="Zoning" value={p.zoning} />}
          {p.parkingRatio && <InfoRow label="Parking Ratio" value={p.parkingRatio} />}
          {p.totalSpaceAvailable && <InfoRow label="Space Available" value={p.totalSpaceAvailable} />}
          <InfoRow label="Last Sale Date" value={p.lastSaleDate} />
          <InfoRow label="Last Sale Price" value={p.lastSaleAmount} />
          {p.amenities && p.amenities.length > 0 && (
            <InfoRow label="Amenities" value={p.amenities.join(" · ")} />
          )}
          {p.sustainability?.leedScoreLevel && (
            <InfoRow label="LEED" value={p.sustainability.leedScoreLevel} />
          )}
        </Section>

      </div>

      {/* Suite-level business history — full width */}
      <div className="suite-section">
        <h3 className="section-title" style={{ marginBottom: 16 }}>
          <span className="section-icon">◈</span>
          Business History by Unit
          <span className="section-count">{p.bizHistory?.length || 0} records</span>
        </h3>

        {p.bizHistory && p.bizHistory.length > 0 ? (
          <div className="suite-grid">
            {Object.entries(suiteGroups).map(([suite, businesses]) => {
              const groundFloor = businesses.some(b => isGroundFloor(b.full_business_address));
              const hasActive = businesses.some(b => !b.location_end_date && !b.dba_end_date);
              return (
                <div key={suite} className={`suite-card ${groundFloor ? "suite-ground" : ""}`}>
                  <div className="suite-header">
                    <span className="suite-label">
                      {groundFloor && <span className="ground-tag">Ground Floor</span>}
                      {suite}
                    </span>
                    <span className={`suite-status ${hasActive ? "active" : "vacant"}`}>
                      {hasActive ? "● Active" : "○ Dark"}
                    </span>
                  </div>
                  <div className="suite-links">
                    <a
                      href={buildLoopNetUrl(p.confirmedAddress || p.address)}
                      target="_blank" rel="noreferrer" className="suite-link loopnet">
                      LoopNet ↗
                    </a>
                    <a
                      href={buildCoStarUrl(p.confirmedAddress || p.address)}
                      target="_blank" rel="noreferrer" className="suite-link costar">
                      CoStar ↗
                    </a>
                  </div>
                  <div className="suite-businesses">
                    {businesses.map((b, i) => {
                      const name = b.dba_name || b.ownership_name || "Unknown";
                      const isActive = !b.location_end_date && !b.dba_end_date;
                      const startYear = b.location_start_date
                        ? new Date(b.location_start_date).getFullYear()
                        : b.dba_start_date ? new Date(b.dba_start_date).getFullYear() : null;
                      const endYear = b.location_end_date
                        ? new Date(b.location_end_date).getFullYear() : null;
                      const period = startYear && endYear
                        ? `${startYear}–${endYear}`
                        : startYear ? `${startYear}–present` : null;
                      return (
                        <div key={i} className={`suite-biz ${isActive ? "suite-biz-active" : ""}`}>
                          <div className="suite-biz-top">
                            <span
                              className="suite-biz-name suite-biz-clickable"
                              onClick={() => setSelectedBusiness(b)}
                            >
                              {name}
                            </span>
                          </div>
                          <div className="suite-biz-meta">
                            {b.naic_code_description && <span>{b.naic_code_description}</span>}
                            {period && <span className="biz-period">{period}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "20px 0" }}>
            <p className="no-data">No SF business license records found for this address.</p>
            <p className="no-data" style={{ marginTop: 8 }}>
              <a href="https://data.sfgov.org/Economy-and-Community/Registered-Business-Locations-San-Francisco/g8m3-pdis"
                target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                Search SF Business Licenses manually
              </a>
            </p>
          </div>
        )}
      </div>

      <BusinessModal business={selectedBusiness} onClose={() => setSelectedBusiness(null)} />

      {/* ─── CRM Panel ─────────────────────────────────────────── */}
      <div className="crm-panel">
        <h3 className="crm-title">Outreach Tracker</h3>

        {/* Tags */}
        <div className="crm-section">
          <p className="crm-label">Status Tag</p>
          <div className="tag-row">
            {TAGS.map(t => (
              <button
                key={t.id}
                className={`tag-btn ${activeTag === t.id ? "active" : ""}`}
                style={{ "--tag-color": t.color }}
                onClick={() => {
                  const next = activeTag === t.id ? null : t.id;
                  setActiveTag(next);
                  onUpdateMeta?.(p.address, { tag: next });
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vacancy Override */}
        <div className="crm-section">
          <p className="crm-label">Vacancy Override</p>
          <div className="vacancy-override-row">
            {["Vacant", "Occupied", "Unknown"].map(v => (
              <button
                key={v}
                className={`vacancy-override-btn ${vacancyOverride === v ? "active" : ""} status-${v.toLowerCase()}`}
                onClick={() => {
                  const next = vacancyOverride === v ? "" : v;
                  setVacancyOverride(next);
                  onUpdateMeta?.(p.address, { vacancyOverride: next || null });
                }}
              >
                {v}
              </button>
            ))}
            {vacancyOverride && (
              <span className="override-note">Overriding auto-detected status</span>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="crm-section">
          <p className="crm-label">Notes</p>
          <textarea
            className="notes-textarea"
            placeholder="Add notes about this property, contacts, conversations…"
            value={notes}
            onChange={e => {
              setNotes(e.target.value);
              onUpdateMeta?.(p.address, { notes: e.target.value });
            }}
            rows={4}
          />
        </div>
      </div>

      <p className="lookup-time">
        Looked up {new Date(p.lookedUpAt).toLocaleString()}
      </p>
    </div>
  );
}