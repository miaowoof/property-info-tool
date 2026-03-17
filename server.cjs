const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();
console.log("[ENV] ATTOM key:", process.env.VITE_ATTOM_API_KEY ? "Found ✓" : "MISSING ✗");
console.log("[ENV] RapidAPI key:", process.env.RAPIDAPI_KEY ? "Found ✓" : "MISSING ✗");

const app = express();
const PORT = 3001;
const ATTOM_KEY = process.env.VITE_ATTOM_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

app.use(cors());
app.use(express.json());

// ─── ATTOM ────────────────────────────────────────────────────────────────────
app.get("/api/property", async (req, res) => {
  const { address1, address2 } = req.query;
  if (!ATTOM_KEY) return res.status(500).json({ error: "No ATTOM key" });
  const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address1=${encodeURIComponent(address1)}&address2=${encodeURIComponent(address2 || "San Francisco CA")}`;
  console.log("[ATTOM]", url);
  try {
    const r = await fetch(url, { headers: { apikey: ATTOM_KEY, accept: "application/json" } });
    const data = await r.json();
    console.log("[ATTOM]", data?.status?.msg, "|", data?.property?.[0]?.address?.oneLine);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SF Businesses ────────────────────────────────────────────────────────────
app.get("/api/businesses", async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: "address required" });
  const normalized = address
    .replace(/,?\s*(SAN FRANCISCO|SF)\s*,?\s*(CA)?\s*,?\s*\d{5}?\s*/gi, "")
    .replace(/\bSTREET\b/gi, "St").replace(/\bAVENUE\b/gi, "Av")
    .replace(/\bBOULEVARD\b/gi, "Blvd").replace(/\bDRIVE\b/gi, "Dr")
    .replace(/\bROAD\b/gi, "Rd").replace(/\bCOURT\b/gi, "Ct")
    .replace(/\bPLACE\b/gi, "Pl").replace(/\bLANE\b/gi, "Ln")
    .replace(/\s+(STE|SUITE|APT|UNIT|#)\s*\w+/i, "")
    .trim().toUpperCase();
  const url = `https://data.sfgov.org/resource/g8m3-pdis.json?$where=${encodeURIComponent(`upper(full_business_address) like '${normalized}%'`)}&$order=location_end_date DESC&$limit=20&$select=dba_name,ownership_name,ttxid,dba_start_date,dba_end_date,location_start_date,location_end_date,naic_code_description,full_business_address`;
  console.log("[SF Biz]", normalized);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await r.json();
    console.log("[SF Biz] Found", Array.isArray(data) ? data.length : "error", "results");
    res.json(Array.isArray(data) ? data : []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SF Vacancy Tax ───────────────────────────────────────────────────────────
app.get("/api/vacancy", async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: "address required" });
  const normalized = address
    .replace(/,?\s*(SAN FRANCISCO|SF)\s*,?\s*(CA)?\s*,?\s*\d{5}?\s*/gi, "")
    .replace(/\bSTREET\b/gi, "ST").replace(/\bAVENUE\b/gi, "AV")
    .replace(/\bAVE\b/gi, "AV").replace(/\bBOULEVARD\b/gi, "BLVD")
    .replace(/\bDRIVE\b/gi, "DR").replace(/\bROAD\b/gi, "RD")
    .replace(/\bCOURT\b/gi, "CT").replace(/\bPLACE\b/gi, "PL")
    .replace(/\bLANE\b/gi, "LN")
    .trim().toUpperCase();
  const url = `https://data.sfgov.org/resource/rzkk-54yv.json?$where=${encodeURIComponent(`upper(parcelsitusaddress) like '${normalized}%'`)}&$order=taxyear DESC&$limit=10&$select=entity,filertype,vacant,taxyear,parcelsitusaddress,parcelnumber,ban,rate`;
  console.log("[Vacancy]", normalized);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await r.json();
    console.log("[Vacancy] Found", Array.isArray(data) ? data.length : "error", "results");
    res.json(Array.isArray(data) ? data : []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── LoopNet via RapidAPI ─────────────────────────────────────────────────────
app.get("/api/loopnet", async (req, res) => {
  const { lat, lon, address, zip } = req.query;
  if (!RAPIDAPI_KEY) return res.status(500).json({ error: "No RapidAPI key" });
  if (!lat || !lon) return res.status(200).json({ listings: [] });

  const targetLat = parseFloat(lat);
  const targetLon = parseFloat(lon);
  // Extract zip from address query param or explicit zip param
  const zipCode = zip || address?.match(/\b(9\d{4})\b/)?.[1] || null;

  const headers = {
    "x-rapidapi-key": RAPIDAPI_KEY,
    "x-rapidapi-host": "loopnet-api.p.rapidapi.com",
    "Content-Type": "application/json",
  };

  console.log("[LoopNet] address:", address, "| zip:", zipCode, "| coords:", targetLat, targetLon);

  try {
    let candidateIds = [];

    // Strategy 1: bounding box (~400m) around geocoded point
    const delta = 0.004; // ~400m in degrees
    const bbox = [targetLon - delta, targetLat - delta, targetLon + delta, targetLat + delta];
    const bboxRes = await fetch("https://loopnet-api.p.rapidapi.com/loopnet/lease/searchByBoundingBox", {
      method: "POST", headers,
      body: JSON.stringify({ boundingBox: bbox })
    }).then(r => r.json()).catch(() => ({ data: [] }));

    candidateIds = (bboxRes?.data || [])
      .map(l => ({
        id: String(l.listingId),
        dist: Math.sqrt(
          Math.pow((l.coordinations?.[0]?.[1] || 0) - targetLat, 2) +
          Math.pow((l.coordinations?.[0]?.[0] || 0) - targetLon, 2)
        )
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5)
      .map(l => l.id)
      .filter(id => id && id !== "undefined");

    console.log("[LoopNet] BBox results (sorted by dist):", candidateIds);

    // Strategy 2: wider bounding box (~500m) if first box found nothing
    if (candidateIds.length === 0) {
      const delta2 = 0.005;
      const bbox2 = [targetLon - delta2, targetLat - delta2, targetLon + delta2, targetLat + delta2];
      const bboxRes2 = await fetch("https://loopnet-api.p.rapidapi.com/loopnet/lease/searchByBoundingBox", {
        method: "POST", headers,
        body: JSON.stringify({ boundingBox: bbox2 })
      }).then(r => r.json()).catch(() => ({ data: [] }));

      candidateIds = (bboxRes2?.data || [])
        .map(l => ({
          id: String(l.listingId),
          dist: Math.sqrt(
            Math.pow((l.coordinations?.[0]?.[1] || 0) - targetLat, 2) +
            Math.pow((l.coordinations?.[0]?.[0] || 0) - targetLon, 2)
          )
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3)
        .map(l => l.id)
        .filter(id => id && id !== "undefined");

      console.log("[LoopNet] Wider bbox results:", candidateIds);
    }

    if (candidateIds.length === 0) return res.json({ listings: [] });

    // Fetch ExtendedDetails (richer) + LeaseDetails (spaces) in parallel for each candidate
    const details = await Promise.all(candidateIds.map(async (id) => {
      try {
        const [extRes, leaseRes] = await Promise.all([
          fetch("https://loopnet-api.p.rapidapi.com/loopnet/property/ExtendedDetails", {
            method: "POST", headers, body: JSON.stringify({ listingId: id })
          }).then(r => r.json()).catch(() => null),
          fetch("https://loopnet-api.p.rapidapi.com/loopnet/property/LeaseDetails", {
            method: "POST", headers, body: JSON.stringify({ listingId: id })
          }).then(r => r.json()).catch(() => null),
        ]);
        const ext = extRes?.data?.[0] || null;
        const lease = leaseRes?.data?.[0] || null;
        return ext ? { ext, lease } : (lease ? { ext: null, lease } : null);
      } catch { return null; }
    }));

    const listings = details.filter(Boolean).map(({ ext, lease }) => {
      const d = lease || {};
      const e = ext || {};
      const ls = e.leaseSummary || {};
      return {
        listingId: e.listingId || d.listingId,
        title: e.title || d.title,
        address: (e.address ? `${e.address}, ${e.location || ""}`.trim() : null) || d.location?.streetAddress,
        category: ls.propertyType || d.category,
        // Property facts from ExtendedDetails
        ownerName: e.ownerDetail?.name || null,
        ownerWebsite: e.ownerDetail?.website || null,
        ownerDescription: e.ownerDetail?.description || null,
        buildingClass: ls.buildingClass || null,
        totalBuildingSize: ls.totalBuildingSize || null,
        yearBuilt: ls.yearBuilt || null,
        yearRenovated: ls.yearRenovated || null,
        stories: ls.numberStories || null,
        lotSize: ls.lotSize || null,
        zoning: ls.zoningDescription || null,
        apn: ls.apn || null,
        parking: ls.parking?.[0] || null,
        parkingRatio: ls.parkingRatio || null,
        totalSpaceAvailable: ls.totalSpaceAvailable || null,
        amenities: e.amenities?.[0]?.amenitiesList || [],
        sustainability: e.sustainability || null,
        highlights: e.highlights || [],
        description: e.description || null,
        // Spaces from LeaseDetails
        spaces: (d.spaces?.[0]?.spaces || []).map(s => ({
          space: s.space, size: s.size, rentalRate: s.rentalRate,
          available: s.available, condition: s.condition, term: s.term, spaceUse: s.spaceUse,
        })),
        // Brokers — prefer brokersDetails (has phone+email) from ExtendedDetails
        brokers: (e.brokersDetails || d.broker || []).map(b => ({
          name: b.name,
          company: b.company || b.worksFor?.name,
          phone: b.phone || b.phoneNumber,
          email: b.email || null,
          title: b.title || null,
          url: b.url || null,
        })),
        url: `https://www.loopnet.com/Listing/${e.listingId || d.listingId}/`,
        summary: e.description || d.summary,
      };
    });

    console.log("[LoopNet] Returning", listings.length, "listings:", listings.map(l => l.address).join(", "));
    res.json({ listings });
  } catch (err) {
    console.error("[LoopNet] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✓ Proxy running at http://localhost:${PORT}`));
