export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const ATTOM_KEY = process.env.VITE_ATTOM_API_KEY;

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

}
