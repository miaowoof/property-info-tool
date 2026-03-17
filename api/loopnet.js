export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon, address } = req.query;
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

  if (!RAPIDAPI_KEY) return res.status(500).json({ error: "RapidAPI key not configured" });

  try {
    let listingIds = [];

    // Step 1: Search by coordinates if available, otherwise by zip
    if (lat && lon) {
      const searchUrl = `https://loopnet-api.p.rapidapi.com/loopnet/lease/searchByCoordination`;
      const searchRes = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'loopnet-api.p.rapidapi.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordination: [parseFloat(lon), parseFloat(lat)],
          distance: 0.5
        })
      });
      const searchData = await searchRes.json();
      if (searchData?.data?.[0]?.listings) {
        const allListings = searchData.data[0].listings || [];
        const targetLat = parseFloat(lat);
        const targetLon = parseFloat(lon);
        listingIds = allListings
          .filter(l => {
            if (!l.coordinations?.[0]) return true; // include if no coords
            const [lLon, lLat] = l.coordinations[0];
            const dist = Math.sqrt(Math.pow(lLat - targetLat, 2) + Math.pow(lLon - targetLon, 2));
            return dist < 0.003;
          })
          .slice(0, 5)
          .map(l => String(l.listingId));
      }
    }

    if (listingIds.length === 0) {
      return res.status(200).json({ listings: [] });
    }

    // Step 2: Get details for each listing
    const details = await Promise.all(
      listingIds.map(async (id) => {
        try {
          const detailRes = await fetch('https://loopnet-api.p.rapidapi.com/loopnet/property/LeaseDetails', {
            method: 'POST',
            headers: {
              'x-rapidapi-key': RAPIDAPI_KEY,
              'x-rapidapi-host': 'loopnet-api.p.rapidapi.com',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ listingId: id })
          });
          const data = await detailRes.json();
          return data?.data?.[0] || null;
        } catch { return null; }
      })
    );

    // Step 3: Format into clean listings
    const listings = details
      .filter(Boolean)
      .map(d => ({
        listingId: d.listingId,
        title: d.title,
        address: d.location?.streetAddress,
        category: d.category,
        spaces: (d.spaces?.[0]?.spaces || []).map(s => ({
          space: s.space,
          size: s.size,
          rentalRate: s.rentalRate,
          available: s.available,
          condition: s.condition,
          term: s.term,
          spaceUse: s.spaceUse,
        })),
        brokers: (d.broker || []).map(b => ({
          name: b.name,
          company: b.worksFor?.name,
          phone: b.phoneNumber,
          url: b.url,
        })),
        url: `https://www.loopnet.com/Listing/${d.listingId}/`,
        summary: d.summary,
        lastUpdated: d.lastUpdated,
      }));

    return res.status(200).json({ listings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}