import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle inventory API
  if (req.url?.startsWith('/api/inventory') && req.method === 'GET') {
    try {
      const { sapCode } = req.query;
      
      if (!sapCode) {
        return res.status(400).json({ error: "SAP code is required" });
      }

      const QB_REALM_HOSTNAME = process.env.QB_REALM_HOSTNAME;
      const QB_USER_TOKEN = process.env.QB_USER_TOKEN;
      const QB_TABLE_ID = process.env.QB_TABLE_ID;

      if (!QB_REALM_HOSTNAME || !QB_USER_TOKEN || !QB_TABLE_ID) {
        return res.status(500).json({ error: "QuickBase configuration missing" });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`https://api.quickbase.com/v1/records/query`, {
        method: 'POST',
        headers: {
          'QB-Realm-Hostname': QB_REALM_HOSTNAME,
          'Authorization': `QB-USER-TOKEN ${QB_USER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: QB_TABLE_ID,
          select: [13], 
          where: `{6.EX.'${sapCode}'}`, 
          options: {
            compareWithAppLocalTime: false
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`QuickBase API error: ${response.status}`);
      }

      const data = await response.json();
      const stock = data.data.length > 0 ? (data.data[0]['13']?.value || 0) : 0;

      return res.json({ sapCode, stock });
    } catch (error: any) {
      console.error('Error fetching inventory from QuickBase:', error);
      return res.status(500).json({ error: "Failed to fetch inventory data", details: error.message });
    }
  }

  res.status(404).json({ error: 'Not found' });
}