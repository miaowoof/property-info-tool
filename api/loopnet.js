export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

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

}
