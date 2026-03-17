export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

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

  const url = `https://data.sfgov.org/resource/g8m3-pdis.json` +
    `?$where=${encodeURIComponent(`upper(full_business_address) like '${normalized}%'`)}` +
    `&$order=location_end_date DESC&$limit=20` +
    `&$select=dba_name,ownership_name,ttxid,dba_start_date,dba_end_date,location_start_date,location_end_date,naic_code_description,full_business_address`;

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await response.json();
    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
