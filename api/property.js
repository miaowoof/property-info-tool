export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { address1, address2 } = req.query;
  const ATTOM_KEY = process.env.VITE_ATTOM_API_KEY;

  if (!ATTOM_KEY) return res.status(500).json({ error: "ATTOM API key not configured" });
  if (!address1) return res.status(400).json({ error: "address1 required" });

  const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address1=${encodeURIComponent(address1)}&address2=${encodeURIComponent(address2 || 'San Francisco CA')}`;

  try {
    const response = await fetch(url, {
      headers: { apikey: ATTOM_KEY, accept: "application/json" }
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
