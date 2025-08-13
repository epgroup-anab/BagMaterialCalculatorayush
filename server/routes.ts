import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  app.get("/api/inventory", async (req, res) => {
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

      res.json({ sapCode, stock });
    } catch (error) {
      console.error('Error fetching inventory from QuickBase:', error);
      console.error('Environment variables:', {
        QB_REALM_HOSTNAME: !!process.env.QB_REALM_HOSTNAME,
        QB_USER_TOKEN: !!process.env.QB_USER_TOKEN,
        QB_TABLE_ID: !!process.env.QB_TABLE_ID
      });
      res.status(500).json({ error: "Failed to fetch inventory data", details: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
