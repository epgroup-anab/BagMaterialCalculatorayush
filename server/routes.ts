import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { parse } from "csv-parse";
import * as XLSX from "xlsx";
import puppeteer from "puppeteer";
import { z } from "zod";

// Extend Express Request type for file uploads
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      if (file.mimetype === 'text/csv' || 
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        cb(null, true);
      } else {
        cb(new Error('Only CSV and Excel files are allowed'));
      }
    }
  });

  // Bulk order upload endpoint
  app.post('/api/bulk-upload', upload.single('file'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let parsedData: any[] = [];
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

      // Parse file based on type
      if (fileExtension === 'csv') {
        parsedData = await parseCSV(req.file.buffer);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        parsedData = await parseExcel(req.file.buffer);
      } else {
        return res.status(400).json({ error: 'Unsupported file format' });
      }

      // Validate and process data
      const validatedOrders = validateOrderData(parsedData);
      
      // Calculate all orders using existing logic
      const calculatedOrders = await processOrders(validatedOrders);
      
      // Save to database
      const bulkOrder = await storage.insertBulkOrder({
        fileName: req.file.originalname,
        totalOrders: calculatedOrders.length,
        totalCost: calculatedOrders.reduce((sum, order) => sum + order.totalCost, 0),
        orders: JSON.stringify(calculatedOrders),
        feasible: calculatedOrders.filter(order => order.feasible).length,
      });

      res.json({
        id: bulkOrder.id,
        message: 'Bulk upload processed successfully',
        summary: {
          totalOrders: calculatedOrders.length,
          feasibleOrders: calculatedOrders.filter(order => order.feasible).length,
          totalCost: calculatedOrders.reduce((sum, order) => sum + order.totalCost, 0),
        },
        orders: calculatedOrders
      });

    } catch (error: unknown) {
      console.error('Bulk upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process bulk upload';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get bulk order results
  app.get('/api/bulk-orders/:id', async (req, res) => {
    try {
      const bulkOrder = await storage.getBulkOrder(req.params.id);
      if (!bulkOrder) {
        return res.status(404).json({ error: 'Bulk order not found' });
      }
      res.json(bulkOrder);
    } catch (error) {
      console.error('Get bulk order error:', error);
      res.status(500).json({ error: 'Failed to get bulk order' });
    }
  });

  // Export to HTML
  app.get('/api/bulk-orders/:id/export/html', async (req, res) => {
    try {
      const bulkOrder = await storage.getBulkOrder(req.params.id);
      if (!bulkOrder) {
        return res.status(404).json({ error: 'Bulk order not found' });
      }

      const html = generateHTMLReport(bulkOrder);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="bulk-order-${bulkOrder.id}.html"`);
      res.send(html);
    } catch (error) {
      console.error('HTML export error:', error);
      res.status(500).json({ error: 'Failed to export HTML' });
    }
  });

  // Export to PDF
  app.get('/api/bulk-orders/:id/export/pdf', async (req, res) => {
    try {
      const bulkOrder = await storage.getBulkOrder(req.params.id);
      if (!bulkOrder) {
        return res.status(404).json({ error: 'Bulk order not found' });
      }

      const html = generateHTMLReport(bulkOrder);
      const pdf = await generatePDF(html);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bulk-order-${bulkOrder.id}.pdf"`);
      res.send(pdf);
    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).json({ error: 'Failed to export PDF' });
    }
  });

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: "Failed to fetch inventory data", details: errorMessage });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Helper functions for file parsing and processing
async function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const records: any[] = [];
    parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ',',
    })
    .on('readable', function(this: any) {
      let record;
      while (record = this.read()) {
        records.push(record);
      }
    })
    .on('error', reject)
    .on('end', () => resolve(records));
  });
}

async function parseExcel(buffer: Buffer): Promise<any[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

function validateOrderData(data: any[]): any[] {
  const orderSchema = z.object({
    bagName: z.string().min(1),
    sku: z.string().optional(),
    orderQty: z.number().positive(),
    orderUnit: z.enum(['bags', 'cartons']).default('cartons'),
    width: z.number().positive().optional(),
    gusset: z.number().positive().optional(),
    height: z.number().positive().optional(),
    gsm: z.number().positive().optional(),
    handleType: z.string().default('FLAT HANDLE'),
    paperGrade: z.string().default('VIRGIN'),
    certification: z.string().default('FSC'),
    deliveryDays: z.number().positive().default(14),
    colors: z.number().min(0).max(4).default(0),
  });

  return data.map((row, index) => {
    try {
      // Convert string numbers to numbers
      const processedRow = {
        ...row,
        orderQty: parseFloat(row.orderQty || row.quantity || row.qty) || 1000,
        width: row.width ? parseFloat(row.width) : undefined,
        gusset: row.gusset ? parseFloat(row.gusset) : undefined,
        height: row.height ? parseFloat(row.height) : undefined,
        gsm: row.gsm ? parseFloat(row.gsm) : undefined,
        deliveryDays: row.deliveryDays ? parseFloat(row.deliveryDays) : 14,
        colors: row.colors ? parseInt(row.colors) : 0,
      };

      return orderSchema.parse(processedRow);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      throw new Error(`Validation error in row ${index + 1}: ${errorMessage}`);
    }
  });
}

async function processOrders(orders: any[]): Promise<any[]> {
  const results = [];
  
  for (const order of orders) {
    try {
      const result = calculateOrderAnalysis(order);
      results.push({
        ...order,
        ...result,
        feasible: result.inventoryFeasible && result.machineFeasible,
      });
    } catch (error) {
      results.push({
        ...order,
        error: error instanceof Error ? error.message : 'Unknown error',
        feasible: false,
      });
    }
  }
  
  return results;
}

function calculateOrderAnalysis(order: any) {
  const calculateActualBags = (qty: number, unit: 'bags' | 'cartons'): number => {
    return unit === 'cartons' ? qty * 250 : qty;
  };

  const actualBags = calculateActualBags(order.orderQty, order.orderUnit || 'cartons');
  
  // Enhanced BOM calculation based on combined calculator logic
  const specs = {
    width: order.width || 320,
    gusset: order.gusset || 160, 
    height: order.height || 380,
    gsm: order.gsm || 90,
    handleType: order.handleType || 'FLAT HANDLE',
    paperGrade: order.paperGrade || 'VIRGIN',
    certification: order.certification || 'FSC',
    bagName: order.bagName || 'Custom Bag'
  };
  
  // Material database from combined calculator
  const MATERIAL_DATABASE = {
    PAPER: {
      VIRGIN: {
        "50": { sapCode: "1004016", description: "Virgin Kraft 50 GSM" },
        "70": { sapCode: "1004359", description: "Virgin Kraft 70 GSM" },
        "75": { sapCode: "1003988", description: "Virgin Kraft 75 GSM" },
        "80": { sapCode: "1003696", description: "Virgin Kraft 80 GSM" },
        "85": { sapCode: "1003771", description: "Virgin Kraft 85 GSM" },
        "90": { sapCode: "1003696", description: "Virgin Kraft 90 GSM" },
        "100": { sapCode: "1004286", description: "Virgin Kraft 100 GSM" }
      },
      RECYCLED: {
        "50": { sapCode: "1004016", description: "Recycled Kraft 50 GSM" },
        "80": { sapCode: "1003696", description: "Recycled Kraft 80 GSM" },
        "90": { sapCode: "1003696", description: "Recycled Kraft 90 GSM" },
        "100": { sapCode: "1004017", description: "Recycled Kraft 100 GSM" }
      }
    },
    GLUE: {
      COLD: { sapCode: "1004557", description: "Cold Melt Adhesive" },
      HOT: { sapCode: "1004555", description: "Hot Melt Adhesive" }
    },
    HANDLE: {
      FLAT: { sapCode: "1003688", description: "Flat Paper Handle" },
      TWISTED: { sapCode: "1003967", description: "Twisted Paper Handle" }
    },
    PATCH: {
      FLAT: { sapCode: "1003695", description: "Handle Patch for Flat Handles" },
      TWISTED: { sapCode: "1003948", description: "Handle Patch for Twisted Handles" }
    },
    CARTON: {
      STANDARD: { sapCode: "1003530", description: "Standard Carton Box" }
    }
  };

  // Enhanced material pricing
  const materialPrices: Record<string, number> = {
    // Paper materials
    "1003696": 1.2, "1003697": 1.25, "1003771": 1.15, "1003988": 1.1,
    "1004016": 1.0, "1004017": 1.3, "1004061": 1.35, "1004286": 1.2,
    "1004359": 1.15,
    // Adhesives
    "1004557": 8.5, "1004555": 9.2,
    // Handles
    "1003688": 3.5, "1003930": 3.2, "1003967": 12.5,
    // Patches
    "1003695": 4.8, "1003823": 4.5, "1003948": 5.2,
    // Cartons
    "1003530": 0.15, "1004232": 0.12, "1004289": 0.18, "1004308": 0.22
  };

  // Calculate detailed paper requirements
  const frontBack = 2 * (specs.width * specs.height);
  const gussetArea = 2 * (specs.gusset * specs.height);
  const bottomArea = specs.width * specs.gusset;
  const overlapArea = (specs.width + specs.gusset) * 2;
  const totalAreaMm2 = frontBack + gussetArea + bottomArea + overlapArea;
  const paperWeightPerMm2 = specs.gsm / 1000000;
  const paperWeightPerBag = (totalAreaMm2 * paperWeightPerMm2) / 1000; // kg per bag
  
  // Get paper info from material database
  const paperGradeData = MATERIAL_DATABASE.PAPER[specs.paperGrade as keyof typeof MATERIAL_DATABASE.PAPER];
  const gsmStr = specs.gsm.toString();
  const paperInfo = (paperGradeData as any)?.[gsmStr] || (paperGradeData as any)?.["90"];
  
  // Build enhanced BOM
  const bom = [];
  
  // Paper
  if (paperInfo) {
    bom.push({
      type: 'PAPER',
      sapCode: paperInfo.sapCode,
      description: paperInfo.description,
      quantity: paperWeightPerBag,
      totalQuantity: paperWeightPerBag * actualBags,
      unit: 'KG',
      unitPrice: materialPrices[paperInfo.sapCode] || 1.2,
      totalCost: (paperWeightPerBag * actualBags) * (materialPrices[paperInfo.sapCode] || 1.2)
    });
  }

  // Cold glue
  const coldGlueQty = 0.0018;
  bom.push({
    type: 'COLD GLUE',
    sapCode: MATERIAL_DATABASE.GLUE.COLD.sapCode,
    description: MATERIAL_DATABASE.GLUE.COLD.description,
    quantity: coldGlueQty,
    totalQuantity: coldGlueQty * actualBags,
    unit: 'KG',
    unitPrice: materialPrices[MATERIAL_DATABASE.GLUE.COLD.sapCode] || 8.5,
    totalCost: (coldGlueQty * actualBags) * (materialPrices[MATERIAL_DATABASE.GLUE.COLD.sapCode] || 8.5)
  });

  // Handle materials
  if (specs.handleType === 'FLAT HANDLE') {
    const handleWeight = 0.0052;
    const patchWeight = 0.0012;
    const hotGlueQty = 0.0001;
    
    bom.push({
      type: 'HANDLE',
      sapCode: MATERIAL_DATABASE.HANDLE.FLAT.sapCode,
      description: MATERIAL_DATABASE.HANDLE.FLAT.description,
      quantity: handleWeight,
      totalQuantity: handleWeight * actualBags,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.HANDLE.FLAT.sapCode] || 3.5,
      totalCost: (handleWeight * actualBags) * (materialPrices[MATERIAL_DATABASE.HANDLE.FLAT.sapCode] || 3.5)
    });
    
    bom.push({
      type: 'PATCH',
      sapCode: MATERIAL_DATABASE.PATCH.FLAT.sapCode,
      description: MATERIAL_DATABASE.PATCH.FLAT.description,
      quantity: patchWeight,
      totalQuantity: patchWeight * actualBags,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.PATCH.FLAT.sapCode] || 4.8,
      totalCost: (patchWeight * actualBags) * (materialPrices[MATERIAL_DATABASE.PATCH.FLAT.sapCode] || 4.8)
    });
    
    bom.push({
      type: 'HOT GLUE',
      sapCode: MATERIAL_DATABASE.GLUE.HOT.sapCode,
      description: MATERIAL_DATABASE.GLUE.HOT.description,
      quantity: hotGlueQty,
      totalQuantity: hotGlueQty * actualBags,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.GLUE.HOT.sapCode] || 9.2,
      totalCost: (hotGlueQty * actualBags) * (materialPrices[MATERIAL_DATABASE.GLUE.HOT.sapCode] || 9.2)
    });
    
  } else if (specs.handleType === 'TWISTED HANDLE') {
    const handleWeight = 0.7665;
    const patchWeight = 0.0036;
    const hotGlueQty = 0.0011;
    
    bom.push({
      type: 'HANDLE',
      sapCode: MATERIAL_DATABASE.HANDLE.TWISTED.sapCode,
      description: MATERIAL_DATABASE.HANDLE.TWISTED.description,
      quantity: handleWeight,
      totalQuantity: handleWeight * actualBags,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.HANDLE.TWISTED.sapCode] || 12.5,
      totalCost: (handleWeight * actualBags) * (materialPrices[MATERIAL_DATABASE.HANDLE.TWISTED.sapCode] || 12.5)
    });
    
    bom.push({
      type: 'PATCH',
      sapCode: MATERIAL_DATABASE.PATCH.TWISTED.sapCode,
      description: MATERIAL_DATABASE.PATCH.TWISTED.description,
      quantity: patchWeight,
      totalQuantity: patchWeight * actualBags,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.PATCH.TWISTED.sapCode] || 5.2,
      totalCost: (patchWeight * actualBags) * (materialPrices[MATERIAL_DATABASE.PATCH.TWISTED.sapCode] || 5.2)
    });
    
    bom.push({
      type: 'HOT GLUE',
      sapCode: MATERIAL_DATABASE.GLUE.HOT.sapCode,
      description: MATERIAL_DATABASE.GLUE.HOT.description,
      quantity: hotGlueQty,
      totalQuantity: hotGlueQty * actualBags,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.GLUE.HOT.sapCode] || 9.2,
      totalCost: (hotGlueQty * actualBags) * (materialPrices[MATERIAL_DATABASE.GLUE.HOT.sapCode] || 9.2)
    });
  }

  // Carton
  const cartonQty = 0.004;
  bom.push({
    type: 'CARTON',
    sapCode: MATERIAL_DATABASE.CARTON.STANDARD.sapCode,
    description: MATERIAL_DATABASE.CARTON.STANDARD.description,
    quantity: cartonQty,
    totalQuantity: cartonQty * actualBags,
    unit: 'PC',
    unitPrice: materialPrices[MATERIAL_DATABASE.CARTON.STANDARD.sapCode] || 0.15,
    totalCost: (cartonQty * actualBags) * (materialPrices[MATERIAL_DATABASE.CARTON.STANDARD.sapCode] || 0.15)
  });
  
  const totalCost = bom.reduce((sum, item) => sum + item.totalCost, 0);
  const bagWeight = bom.filter(item => item.unit === 'KG').reduce((sum, item) => sum + item.quantity, 0);
  
  // Enhanced inventory and machine feasibility (simplified for bulk processing)
  const inventoryFeasible = true; // In production, check against real inventory
  const machineFeasible = true;   // In production, check machine compatibility
  
  const warnings = [];
  if (!inventoryFeasible) {
    warnings.push('Insufficient inventory for some materials');
  }
  if (!machineFeasible) {
    warnings.push('No compatible machines available for this specification');
  }
  
  return {
    specs,
    actualBags,
    bom,
    totalCost,
    bagWeight,
    inventoryFeasible,
    machineFeasible,
    warnings,
    calculationSteps: [
      `Paper: ${totalAreaMm2.toFixed(0)}mm² × ${specs.gsm}g/m² = ${paperWeightPerBag.toFixed(6)}kg`,
      `Cold Glue: Standard amount = ${coldGlueQty}kg`,
      specs.handleType === 'FLAT HANDLE' ? 'Flat Handle: 0.0052kg + Patch: 0.0012kg + Hot Glue: 0.0001kg' :
      specs.handleType === 'TWISTED HANDLE' ? 'Twisted Handle: 0.7665kg + Patch: 0.0036kg + Hot Glue: 0.0011kg' : 'No handle',
      `Carton: Standard packaging = ${cartonQty} pieces`
    ]
  };
}

function generateHTMLReport(bulkOrder: any): string {
  let orders: any[] = [];
  
  // Safely parse orders data
  try {
    if (typeof bulkOrder.orders === 'string') {
      orders = JSON.parse(bulkOrder.orders);
    } else if (Array.isArray(bulkOrder.orders)) {
      orders = bulkOrder.orders;
    } else {
      console.error('Orders data is not in expected format:', typeof bulkOrder.orders);
      orders = [];
    }
  } catch (error) {
    console.error('Failed to parse orders data:', error);
    orders = [];
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Bulk Order Report - ${bulkOrder.fileName}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; }
            .summary { background: #f8f9fa; padding: 25px; margin-bottom: 30px; border-radius: 10px; border-left: 5px solid #007bff; }
            .summary h2 { color: #007bff; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
            th { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px 10px; text-align: left; font-weight: 600; }
            td { padding: 12px 10px; border-bottom: 1px solid #e9ecef; }
            tr:hover { background-color: #f8f9fa; }
            .feasible { color: #28a745; font-weight: bold; }
            .not-feasible { color: #dc3545; font-weight: bold; }
            .order-section { margin-bottom: 40px; }
            .order-header { background: linear-gradient(135deg, #6c757d, #495057); color: white; padding: 15px; margin: 20px 0 10px 0; border-radius: 8px; }
            .bom-table { margin-top: 20px; font-size: 14px; }
            .bom-table th { background: linear-gradient(135deg, #17a2b8, #138496); padding: 10px 8px; }
            .bom-table td { padding: 8px; }
            .material-summary { background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .cost-highlight { background: linear-gradient(135deg, #ffc107, #ff8c00); color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold; }
            .specs-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
            .spec-item { background: #f8f9fa; padding: 10px; border-radius: 5px; border-left: 3px solid #007bff; }
            .spec-label { font-weight: bold; color: #495057; font-size: 12px; }
            .spec-value { font-size: 14px; color: #212529; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🏭 Bulk Order Analysis Report</h1>
            <p><strong>File:</strong> ${bulkOrder.fileName}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
        </div>
        
        <div class="summary">
            <h2>📊 Executive Summary</h2>
            <div class="specs-grid">
                <div class="spec-item">
                    <div class="spec-label">TOTAL ORDERS</div>
                    <div class="spec-value">${bulkOrder.totalOrders}</div>
                </div>
                <div class="spec-item">
                    <div class="spec-label">FEASIBLE ORDERS</div>
                    <div class="spec-value">${bulkOrder.feasible}</div>
                </div>
                <div class="spec-item">
                    <div class="spec-label">SUCCESS RATE</div>
                    <div class="spec-value">${((bulkOrder.feasible / bulkOrder.totalOrders) * 100).toFixed(1)}%</div>
                </div>
                <div class="spec-item">
                    <div class="spec-label">TOTAL COST</div>
                    <div class="spec-value cost-highlight">€${parseFloat(bulkOrder.totalCost).toFixed(2)}</div>
                </div>
            </div>
        </div>
        
        <div class="order-section">
            <h2>📋 Order Overview</h2>
            <table>
                <thead>
                    <tr>
                        <th>Bag Name</th>
                        <th>SKU</th>
                        <th>Dimensions</th>
                        <th>Quantity</th>
                        <th>Unit Cost</th>
                        <th>Total Cost</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map((order: any) => `
                        <tr>
                            <td><strong>${order.bagName || 'Custom Bag'}</strong></td>
                            <td>${order.sku || 'N/A'}</td>
                            <td>${order.specs ? `${order.specs.width}×${order.specs.gusset}×${order.specs.height}mm` : 'N/A'}</td>
                            <td><strong>${order.actualBags?.toLocaleString() || order.orderQty}</strong> ${order.orderUnit || 'bags'}</td>
                            <td>€${((order.totalCost || 0) / (order.actualBags || order.orderQty || 1)).toFixed(4)}</td>
                            <td class="cost-highlight">€${(order.totalCost || 0).toFixed(2)}</td>
                            <td class="${order.feasible ? 'feasible' : 'not-feasible'}">
                                ${order.feasible ? '✅ Feasible' : '❌ Not Feasible'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${orders.map((order: any, index: number) => `
            <div class="order-section">
                <div class="order-header">
                    <h3>📦 Order ${index + 1}: ${order.bagName || 'Custom Bag'} ${order.sku ? `(${order.sku})` : ''}</h3>
                </div>
                
                ${order.specs ? `
                    <div class="material-summary">
                        <h4>🏷️ Bag Specifications</h4>
                        <div class="specs-grid">
                            <div class="spec-item">
                                <div class="spec-label">DIMENSIONS</div>
                                <div class="spec-value">${order.specs.width} × ${order.specs.gusset} × ${order.specs.height} mm</div>
                            </div>
                            <div class="spec-item">
                                <div class="spec-label">GSM</div>
                                <div class="spec-value">${order.specs.gsm}</div>
                            </div>
                            <div class="spec-item">
                                <div class="spec-label">HANDLE TYPE</div>
                                <div class="spec-value">${order.specs.handleType || 'N/A'}</div>
                            </div>
                            <div class="spec-item">
                                <div class="spec-label">PAPER GRADE</div>
                                <div class="spec-value">${order.specs.paperGrade || 'N/A'}</div>
                            </div>
                            <div class="spec-item">
                                <div class="spec-label">CERTIFICATION</div>
                                <div class="spec-value">${order.specs.certification || 'N/A'}</div>
                            </div>
                            <div class="spec-item">
                                <div class="spec-label">BAG WEIGHT</div>
                                <div class="spec-value">${order.bagWeight ? order.bagWeight.toFixed(4) + ' kg' : 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${order.bom && order.bom.length > 0 ? `
                    <div class="material-summary">
                        <h4>🔧 Bill of Materials</h4>
                        <table class="bom-table">
                            <thead>
                                <tr>
                                    <th>Material Type</th>
                                    <th>SAP Code</th>
                                    <th>Description</th>
                                    <th>Qty per Bag</th>
                                    <th>Total Quantity</th>
                                    <th>Unit</th>
                                    <th>Unit Cost</th>
                                    <th>Total Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.bom.map((item: any) => `
                                    <tr>
                                        <td><strong>${item.type}</strong></td>
                                        <td>${item.sapCode}</td>
                                        <td>${item.description}</td>
                                        <td>${item.quantity?.toFixed(6) || 'N/A'}</td>
                                        <td><strong>${item.totalQuantity?.toFixed(3) || 'N/A'}</strong></td>
                                        <td>${item.unit}</td>
                                        <td>€${item.unitPrice?.toFixed(2) || '0.00'}</td>
                                        <td class="cost-highlight">€${item.totalCost?.toFixed(2) || '0.00'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
                
                ${order.inventoryFeasible !== undefined ? `
                    <div class="material-summary">
                        <h4>📦 Inventory Status</h4>
                        <p><strong>Inventory Feasible:</strong> <span class="${order.inventoryFeasible ? 'feasible' : 'not-feasible'}">${order.inventoryFeasible ? '✅ Yes' : '❌ No'}</span></p>
                        ${order.warnings && order.warnings.length > 0 ? `
                            <div style="margin-top: 15px;">
                                <strong>⚠️ Warnings:</strong>
                                <ul>
                                    ${order.warnings.map((warning: string) => `<li>${warning}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                ${order.machineFeasible !== undefined ? `
                    <div class="material-summary">
                        <h4>🏭 Machine Compatibility</h4>
                        <p><strong>Machine Compatible:</strong> <span class="${order.machineFeasible ? 'feasible' : 'not-feasible'}">${order.machineFeasible ? '✅ Yes' : '❌ No'}</span></p>
                        ${order.recommendedMachine ? `<p><strong>Recommended Machine:</strong> ${order.recommendedMachine}</p>` : ''}
                    </div>
                ` : ''}
                
                <div class="material-summary">
                    <h4>💰 Cost Breakdown</h4>
                    <div class="specs-grid">
                        <div class="spec-item">
                            <div class="spec-label">ORDER QUANTITY</div>
                            <div class="spec-value">${(order.actualBags || order.orderQty || 0).toLocaleString()} bags</div>
                        </div>
                        <div class="spec-item">
                            <div class="spec-label">COST PER BAG</div>
                            <div class="spec-value">€${((order.totalCost || 0) / (order.actualBags || order.orderQty || 1)).toFixed(4)}</div>
                        </div>
                        <div class="spec-item">
                            <div class="spec-label">TOTAL COST</div>
                            <div class="spec-value cost-highlight">€${(order.totalCost || 0).toFixed(2)}</div>
                        </div>
                        <div class="spec-item">
                            <div class="spec-label">FEASIBILITY</div>
                            <div class="spec-value ${order.feasible ? 'feasible' : 'not-feasible'}">${order.feasible ? '✅ Feasible' : '❌ Not Feasible'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('')}
        
        <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 10px; text-align: center;">
            <p style="color: #6c757d; margin: 0;"><em>Report generated by Bag Material Calculator System on ${new Date().toLocaleString()}</em></p>
        </div>
    </body>
    </html>
  `;
}

async function generatePDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ 
    format: 'A4', 
    printBackground: true,
    margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
  });
  
  await browser.close();
  return Buffer.from(pdf);
}
