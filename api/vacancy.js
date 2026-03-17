export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();


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

}
