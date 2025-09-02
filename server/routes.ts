import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { parse } from "csv-parse";
import * as XLSX from "xlsx";
import puppeteer from "puppeteer";
import { z } from "zod";
import { SKU_DATA } from "../client/src/data/skuData";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Utility functions for data processing
function cleanValue(value: any): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return null;
    return trimmed;
  }
  return value;
}

function parseNumericValue(value: any): number | null {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    // Handle comma-separated numbers like "7,92,000" or "3,12,500"
    const cleaned = value.replace(/,/g, '').replace(/\s+/g, '').trim();
    
    if (cleaned === '' || cleaned.toLowerCase().includes('mto')) return null;
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}


export async function registerRoutes(app: Express): Promise<Server> {


  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      const allowedExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      
      console.log(`🔍 File upload: ${file.originalname} (${file.mimetype}) - Extension: ${fileExtension}`);
      
      // Accept based on file extension (more reliable than MIME type)
      if (allowedExtensions.includes(fileExtension)) {
        console.log(`✅ File accepted by extension: ${file.originalname}`);
        cb(null, true);
      } else {
        console.log(`❌ File rejected - invalid extension: ${fileExtension}`);
        cb(new Error(`Only CSV and Excel files are allowed. File extension: ${fileExtension}`));
      }
    }
  });

  app.post('/api/bulk-upload', upload.single('file'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let parsedData: any[] = [];
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        parsedData = await parseCSV(req.file.buffer);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        parsedData = await parseExcel(req.file.buffer);
      } else {
        return res.status(400).json({ error: 'Unsupported file format' });
      }

      console.log('📊 Parsed data sample:', parsedData.slice(0, 2));
      console.log(`📊 Total rows parsed: ${parsedData.length}`);
      
      // Consolidate orders by client to sum requirements across months
      const consolidatedData = consolidateOrdersByClient(parsedData);
      
      const validatedOrders = validateOrderData(consolidatedData);
      
      const { results: calculatedOrders, summary } = await processOrdersWithSequentialInventory(validatedOrders);
      
      const bulkOrder = await storage.insertBulkOrder({
        fileName: req.file.originalname,
        totalOrders: summary.totalOrders,
        totalCost: summary.totalCost,
        orders: JSON.stringify(calculatedOrders),
        feasible: summary.feasibleOrders,
      });

      res.json({
        id: bulkOrder.id,
        message: 'Bulk upload processed successfully with sequential inventory and machine planning',
        summary: {
          totalOrders: summary.totalOrders,
          feasibleOrders: summary.feasibleOrders,
          totalCost: summary.totalCost,
          remainingInventory: summary.remainingInventory,
          machineUtilization: summary.machineUtilization,
          productionSchedule: summary.productionSchedule
        },
        orders: calculatedOrders
      });

    } catch (error: unknown) {
      console.error('Bulk upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process bulk upload';
      res.status(500).json({ error: errorMessage });
    }
  });

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

  app.get('/api/bulk-orders/:id/export/html', async (req, res) => {
    try {
      const bulkOrder = await storage.getBulkOrder(req.params.id);
      if (!bulkOrder) {
        return res.status(404).json({ error: 'Bulk order not found' });
      }

      const html = await generateHTMLReport(bulkOrder);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    } catch (error) {
      console.error('HTML view error:', error);
      res.status(500).json({ error: 'Failed to view HTML report' });
    }
  });

  app.get('/api/bulk-orders/:id/export/pdf', async (req, res) => {
    try {
      const bulkOrder = await storage.getBulkOrder(req.params.id);
      if (!bulkOrder) {
        return res.status(404).json({ error: 'Bulk order not found' });
      }

      const html = await generateHTMLReport(bulkOrder);
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: "Failed to fetch inventory data", details: errorMessage });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// Helper function to fetch all inventory from Quickbase once
async function fetchAllInventory(): Promise<Map<string, number>> {
  const inventoryMap = new Map<string, number>();
  
  try {
    const QB_REALM_HOSTNAME = process.env.QB_REALM_HOSTNAME;
    const QB_USER_TOKEN = process.env.QB_USER_TOKEN;
    const QB_TABLE_ID = process.env.QB_TABLE_ID;

    if (!QB_REALM_HOSTNAME || !QB_USER_TOKEN || !QB_TABLE_ID) {
      console.warn('QuickBase configuration missing for inventory fetch');
      return inventoryMap;
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
        select: [6, 13], // SAP Code field (6) and Stock field (13)
        options: {
          compareWithAppLocalTime: false
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`QuickBase API error: ${response.status}`);
      return inventoryMap;
    }

    const data = await response.json();
    
    // Build inventory map from Quickbase data
    for (const record of data.data) {
      const sapCode = record['6']?.value;
      const stock = record['13']?.value || 0;
      
      if (sapCode) {
        inventoryMap.set(sapCode, stock);
      }
    }

    console.log(`✅ Fetched inventory for ${inventoryMap.size} materials from QuickBase`);
    return inventoryMap;
    
  } catch (error) {
    console.error('Error fetching inventory from QuickBase:', error);
    return inventoryMap;
  }
}

// Consolidate orders by client to sum requirements across months
function consolidateOrdersByClient(orders: any[]): any[] {
  if (!orders || orders.length === 0) {
    console.log('⚠️ No orders to consolidate');
    return [];
  }

  console.log(`🔧 Consolidating ${orders.length} orders by client/SAP code...`);
  
  // Group orders by SAP code (or bagName as fallback)
  const orderGroups = new Map<string, any[]>();
  
  orders.forEach(order => {
    const key = order.sku || order.originalSAPCode || order.bagName || 'unknown';
    if (!orderGroups.has(key)) {
      orderGroups.set(key, []);
    }
    orderGroups.get(key)!.push(order);
  });
  
  const consolidatedOrders: any[] = [];
  
  orderGroups.forEach((groupOrders, sapCode) => {
    if (groupOrders.length === 1) {
      // Single order, no consolidation needed
      consolidatedOrders.push(groupOrders[0]);
      return;
    }
    
    // Multiple orders for same SAP code - consolidate them
    const firstOrder = groupOrders[0];
    let totalBags = 0;
    let totalCartons = 0;
    const combinedMonthlyBreakdown: any = {};
    
    console.log(`📦 Consolidating ${groupOrders.length} orders for SAP: ${sapCode}`);
    
    groupOrders.forEach((order, index) => {
      console.log(`   Order ${index + 1}: ${order.orderQty} ${order.orderUnit} (${order.totalBagsRequired || order.actualBags || 0} bags)`);
      
      // Sum up total bags
      if (order.totalBagsRequired) {
        totalBags += order.totalBagsRequired;
      } else if (order.orderUnit === 'bags') {
        totalBags += order.orderQty;
      } else if (order.orderUnit === 'cartons') {
        const bagsPerCarton = order.bagsPerCarton || 1000;
        totalBags += order.orderQty * bagsPerCarton;
        totalCartons += order.orderQty;
      }
      
      // Combine monthly breakdown if available
      if (order.monthlyBreakdown) {
        Object.entries(order.monthlyBreakdown).forEach(([month, bags]) => {
          combinedMonthlyBreakdown[month] = (combinedMonthlyBreakdown[month] || 0) + (bags as number);
        });
      }
    });
    
    // Create consolidated order
    const consolidatedOrder = {
      ...firstOrder,
      orderQty: totalBags,
      orderUnit: 'bags',
      totalBagsRequired: totalBags,
      monthlyBreakdown: combinedMonthlyBreakdown,
      consolidatedFrom: groupOrders.length,
      sourceFormat: firstOrder.sourceFormat + '_CONSOLIDATED'
    };
    
    console.log(`✅ Consolidated ${sapCode}: ${totalBags.toLocaleString()} total bags from ${groupOrders.length} orders`);
    consolidatedOrders.push(consolidatedOrder);
  });
  
  console.log(`🔧 Consolidation complete: ${orders.length} orders → ${consolidatedOrders.length} consolidated orders`);
  return consolidatedOrders;
}

// Machine configuration and availability tracking
interface MachineSpec {
  id: string;
  name: string;
  maxWidth: number;
  maxHeight: number;
  maxGusset: number;
  minGsm: number;
  maxGsm: number;
  supportedHandles: string[];
  capacity: number; // bags per hour
  available: boolean;
  nextAvailableTime: Date;
}

interface MachineSchedule {
  machineId: string;
  orderId: string;
  startTime: Date;
  endTime: Date;
  bagQuantity: number;
}

// Initialize machine fleet
function initializeMachineFleet(): MachineSpec[] {
  const baseTime = new Date();
  
  return [
    {
      id: 'MACHINE_01',
      name: 'High Speed Paper Bag Machine #1',
      maxWidth: 450,
      maxHeight: 600,
      maxGusset: 200,
      minGsm: 50,
      maxGsm: 120,
      supportedHandles: ['FLAT HANDLE', 'TWISTED HANDLE'],
      capacity: 15000, // bags per hour
      available: true,
      nextAvailableTime: baseTime
    },
    {
      id: 'MACHINE_02', 
      name: 'Standard Paper Bag Machine #2',
      maxWidth: 400,
      maxHeight: 500,
      maxGusset: 180,
      minGsm: 40,
      maxGsm: 100,
      supportedHandles: ['FLAT HANDLE'],
      capacity: 12000, // bags per hour
      available: true,
      nextAvailableTime: baseTime
    },
    {
      id: 'MACHINE_03',
      name: 'Premium Handle Machine #3',
      maxWidth: 350,
      maxHeight: 450,
      maxGusset: 160,
      minGsm: 70,
      maxGsm: 120,
      supportedHandles: ['TWISTED HANDLE'],
      capacity: 8000, // bags per hour
      available: true,
      nextAvailableTime: baseTime
    }
  ];
}

// Helper function to check inventory with running total
function checkInventoryWithRunningTotal(bom: any[], runningInventory: Map<string, number>): {feasible: boolean, insufficientMaterials: string[], consumedMaterials: any[]} {
  const insufficientMaterials: string[] = [];
  const consumedMaterials: any[] = [];
  
  for (const material of bom) {
    if (!material.sapCode) continue;
    
    const available = runningInventory.get(material.sapCode) || 0;
    const required = material.totalQuantity;
    
    if (available < required) {
      insufficientMaterials.push(
        `${material.description || material.sapCode} (need ${required}, have ${available})`
      );
    } else {
      // Material is sufficient, track what would be consumed
      consumedMaterials.push({
        sapCode: material.sapCode,
        description: material.description,
        consumed: required,
        remaining: available - required
      });
    }
  }
  
  return {
    feasible: insufficientMaterials.length === 0,
    insufficientMaterials,
    consumedMaterials
  };
}

// Helper function to find available machine for order specs
function findAvailableMachine(specs: any, machines: MachineSpec[], deliveryDays: number = 14): {machine: MachineSpec | null, scheduledEndTime: Date | null} {
  const compatibleMachines = machines.filter(machine => {
    return specs.width <= machine.maxWidth &&
           specs.height <= machine.maxHeight &&
           specs.gusset <= machine.maxGusset &&
           specs.gsm >= machine.minGsm &&
           specs.gsm <= machine.maxGsm &&
           machine.supportedHandles.includes(specs.handleType || 'FLAT HANDLE');
  });
  
  if (compatibleMachines.length === 0) {
    return { machine: null, scheduledEndTime: null };
  }
  
  // Sort by next available time (earliest first)
  compatibleMachines.sort((a, b) => a.nextAvailableTime.getTime() - b.nextAvailableTime.getTime());
  
  // Check if the earliest available machine can meet delivery deadline
  const selectedMachine = compatibleMachines[0];
  const deliveryDeadline = new Date();
  deliveryDeadline.setDate(deliveryDeadline.getDate() + deliveryDays);
  
  if (selectedMachine.nextAvailableTime > deliveryDeadline) {
    return { machine: null, scheduledEndTime: null };
  }
  
  return { machine: selectedMachine, scheduledEndTime: null };
}

// Helper function to schedule production on machine
function scheduleProductionOnMachine(machine: MachineSpec, bagQuantity: number, orderId: string): MachineSchedule {
  const productionHours = Math.ceil(bagQuantity / machine.capacity);
  const startTime = new Date(machine.nextAvailableTime);
  const endTime = new Date(startTime.getTime() + productionHours * 60 * 60 * 1000); // Add hours in milliseconds
  
  // Update machine availability
  machine.nextAvailableTime = endTime;
  
  return {
    machineId: machine.id,
    orderId,
    startTime,
    endTime,
    bagQuantity
  };
}

// Helper function to check inventory feasibility against Quickbase with detailed results
async function checkInventoryFeasibilityDetailed(bom: any[]): Promise<{feasible: boolean, insufficientMaterials: string[]}> {
  const insufficientMaterials: string[] = [];
  try {
    const QB_REALM_HOSTNAME = process.env.QB_REALM_HOSTNAME;
    const QB_USER_TOKEN = process.env.QB_USER_TOKEN;
    const QB_TABLE_ID = process.env.QB_TABLE_ID;

    if (!QB_REALM_HOSTNAME || !QB_USER_TOKEN || !QB_TABLE_ID) {
      console.warn('QuickBase configuration missing for inventory check');
      return { feasible: false, insufficientMaterials: ['QuickBase configuration missing'] };
    }

    // Check inventory for each material in the BOM
    for (const material of bom) {
      if (!material.sapCode) continue;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`https://api.quickbase.com/v1/records/query`, {
          method: 'POST',
          headers: {
            'QB-Realm-Hostname': QB_REALM_HOSTNAME,
            'Authorization': `QB-USER-TOKEN ${QB_USER_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: QB_TABLE_ID,
            select: [13], // Stock field ID
            where: `{6.EX.'${material.sapCode}'}`, // SAP Code field
            options: {
              compareWithAppLocalTime: false
            }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`QuickBase API error for SAP code ${material.sapCode}: ${response.status}`);
          insufficientMaterials.push(`${material.description || material.sapCode} (API Error)`);
          continue;
        }

        const data = await response.json();
        const availableStock = data.data.length > 0 ? (data.data[0]['13']?.value || 0) : 0;

        // Check if we have sufficient stock
        if (availableStock < material.totalQuantity) {
          console.warn(`Insufficient inventory for ${material.sapCode}: need ${material.totalQuantity}, have ${availableStock}`);
          insufficientMaterials.push(`${material.description || material.sapCode} (need ${material.totalQuantity}, have ${availableStock})`);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.warn(`Error checking inventory for SAP code ${material.sapCode}:`, error);
        insufficientMaterials.push(`${material.description || material.sapCode} (Check Failed)`);
      }
    }

    return { feasible: insufficientMaterials.length === 0, insufficientMaterials };
  } catch (error) {
    console.error('Error in inventory feasibility check:', error);
    return { feasible: false, insufficientMaterials: ['Inventory check system error'] };
  }
}

// Helper function to check machine feasibility
function checkMachineFeasibility(specs: any): boolean {
  try {
    // Define machine compatibility constraints
    const MACHINE_CONSTRAINTS = {
      MAX_WIDTH: 450,  // mm
      MAX_HEIGHT: 600, // mm
      MAX_GUSSET: 200, // mm
      MIN_GSM: 40,
      MAX_GSM: 120,
      SUPPORTED_HANDLES: ['FLAT HANDLE', 'TWISTED HANDLE', 'NO HANDLE']
    };

    // Check dimensional constraints
    if (specs.width > MACHINE_CONSTRAINTS.MAX_WIDTH) {
      return false;
    }
    if (specs.height > MACHINE_CONSTRAINTS.MAX_HEIGHT) {
      return false;
    }
    if (specs.gusset > MACHINE_CONSTRAINTS.MAX_GUSSET) {
      return false;
    }

    // Check GSM constraints
    if (specs.gsm < MACHINE_CONSTRAINTS.MIN_GSM || specs.gsm > MACHINE_CONSTRAINTS.MAX_GSM) {
      return false;
    }

    // Check handle type compatibility
    if (!MACHINE_CONSTRAINTS.SUPPORTED_HANDLES.includes(specs.handleType)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in machine feasibility check:', error);
    return false;
  }
}

// Helper functions for file parsing and processing
async function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    // First, parse without headers to check for PSL format
    const allRows: any[][] = [];
    parse(buffer, {
      columns: false, // Parse as raw arrays first
      skip_empty_lines: true,
      delimiter: ',',
    })
    .on('readable', function(this: any) {
      let record;
      while (record = this.read()) {
        allRows.push(record);
      }
    })
    .on('error', reject)
    .on('end', () => {
      console.log('📊 CSV parsed as raw rows, checking for PSL format...');
      console.log(`📊 Total rows: ${allRows.length}`);
      console.log('📊 Row 1 sample:', allRows[0]?.slice(0, 10));
      console.log('📊 Row 2 sample:', allRows[1]?.slice(0, 10)); 
      console.log('📊 Row 3 sample:', allRows[2]?.slice(0, 10));
      
      // Check if this is PSL format (row 2 should have "Sap Code ", "Desc", etc.)
      if (allRows.length >= 3 && 
          allRows[1] && 
          allRows[1].join('|').toLowerCase().includes('sap code') &&
          allRows[1].join('|').toLowerCase().includes('desc')) {
        
        console.log('🔍 Detected PSL format in CSV - converting with proper headers...');
        const convertedData = convertPSLCSVToInternalFormat(allRows);
        resolve(convertedData);
      } else {
        console.log('📊 Standard CSV format - reparsing with headers...');
        // Reparse with headers for standard CSV
        const standardRecords: any[] = [];
        parse(buffer, {
          columns: true,
          skip_empty_lines: true,
          delimiter: ',',
        })
        .on('readable', function(this: any) {
          let record;
          while (record = this.read()) {
            standardRecords.push(record);
          }
        })
        .on('error', reject)
        .on('end', () => resolve(standardRecords));
      }
    });
  });
}

async function parseExcel(buffer: Buffer): Promise<any[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Try multiple parsing approaches for robustness
  let rawData: any[] = [];
  
  try {
    // First attempt: Parse as JSON with header detection
    rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log('📊 Raw sheet data (first 3 rows):', rawData.slice(0, 3));
    
    // Convert to cleaner format by finding header row and mapping columns
    const cleanedData = cleanExcelData(rawData);
    
    if (cleanedData.length > 0) {
      console.log('✅ Successfully cleaned Excel data');
      console.log('📊 Cleaned data sample:', cleanedData.slice(0, 2));
      return cleanedData;
    }
    
    // Fallback: Try original JSON parsing
    console.log('⚠️ Cleaning failed, trying original JSON parsing...');
    const fallbackData = XLSX.utils.sheet_to_json(worksheet);
    
    // Check if this is PSL format by looking for key PSL columns
    if (isPSLFormat(fallbackData)) {
      console.log('🔍 Detected PSL Production Requirement format - converting to internal format');
      const convertedData = convertPSLToInternalFormat(fallbackData);
      console.log('🔍 Converted data sample:', convertedData.slice(0, 2));
      return convertedData;
    }
    
    return fallbackData;
    
  } catch (error) {
    console.error('Excel parsing error:', error);
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Robust Excel data cleaning function
function cleanExcelData(rawRows: any[][]): any[] {
  if (!rawRows || rawRows.length < 2) return [];
  
  console.log('🧹 Starting Excel data cleaning...');
  console.log(`📊 Input: ${rawRows.length} raw rows`);
  
  // Find header row by looking for key PSL indicators
  // PSL format: Row 1 = month names, Row 2 = actual headers, Row 3+ = data
  let headerRowIndex = -1;
  let dataStartIndex = -1;
  
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = rawRows[i];
    if (Array.isArray(row)) {
      // Look for PSL header patterns in row content
      const rowText = row.join('|').toLowerCase();
      if (rowText.includes('sap code') && rowText.includes('desc') && rowText.includes('paper')) {
        headerRowIndex = i;
        dataStartIndex = i + 1;
        console.log(`🎯 Found PSL header at row ${i + 1} (Excel row ${i + 1})`);
        
        // Log the month row if it exists (should be row before header)
        if (i > 0) {
          console.log(`📅 Month row at row ${i}: ${rawRows[i - 1].join(', ')}`);
        }
        break;
      }
    }
  }
  
  if (headerRowIndex === -1) {
    console.log('⚠️ No PSL header found, using smart column detection...');
    return smartColumnMapping(rawRows);
  }
  
  const headerRow = rawRows[headerRowIndex];
  const dataRows = rawRows.slice(dataStartIndex);
  
  console.log('📋 Header row:', headerRow);
  console.log(`📊 Processing ${dataRows.length} data rows`);
  
  // Map column indices for PSL format
  const columnMap = {
    bagType: -1,        // Column A: bag type (NL2, G4, etc.)
    sapCode: -1,        // Column B: SAP Code
    description: -1,    // Column C: Description
    paper: -1,          // Column D: Paper width
    monthlyReq: -1,     // Column E: Monthly Requirement
    weeklyUsage: -1,    // Column F: Weekly Usage
    bagsPerCarton: -1   // Column G: No of Bags
  };
  
  // Find column positions
  headerRow.forEach((header: any, index: number) => {
    const headerStr = (header || '').toString().toLowerCase().trim();
    
    if (headerStr.includes('sap code')) columnMap.sapCode = index;
    else if (headerStr.includes('desc')) columnMap.description = index;
    else if (headerStr.includes('paper')) columnMap.paper = index;
    else if (headerStr.includes('monthly requirement')) columnMap.monthlyReq = index;
    else if (headerStr.includes('weekly usage')) columnMap.weeklyUsage = index;
    else if (headerStr.includes('no of bags')) columnMap.bagsPerCarton = index;
  });
  
  // Bag type is typically in column A (index 0)
  columnMap.bagType = 0;
  
  console.log('🗺️ Column mapping:', columnMap);
  
  const cleanedOrders: any[] = [];
  
  dataRows.forEach((row: any[], rowIndex: number) => {
    try {
      if (!Array.isArray(row) || row.length === 0) return;
      
      // Extract data using column mapping
      const bagType = cleanValue(row[columnMap.bagType]);
      const sapCode = cleanValue(row[columnMap.sapCode]);
      const description = cleanValue(row[columnMap.description]);
      const paper = parseNumericValue(row[columnMap.paper]);
      const monthlyReq = parseNumericValue(row[columnMap.monthlyReq]);
      const bagsPerCarton = parseNumericValue(row[columnMap.bagsPerCarton]) || (monthlyReq > 0 ? Math.floor(monthlyReq) : 1000);
      
      // Skip rows with insufficient data
      if (!sapCode || !description || !monthlyReq || monthlyReq <= 0) {
        console.log(`⏭️ Skipping row ${rowIndex + dataStartIndex + 1}: insufficient data`);
        return;
      }
      
      // Skip MTO (Made To Order) items
      if (description.toString().toLowerCase().includes('mto') || monthlyReq.toString().toLowerCase().includes('mto')) {
        console.log(`⏭️ Skipping MTO item: ${description}`);
        return;
      }
      
      // Get bag specifications from SAP code
      const bagSpecs = getBagSpecsFromSAPCode(sapCode.toString());
      const finalBagName = description.toString().trim(); // Don't include bagType in name
      const totalBags = monthlyReq * bagsPerCarton;
      
      console.log(`✅ Processing: ${finalBagName} - SAP: ${sapCode} - ${monthlyReq} cartons (${totalBags} bags)`);
      
      cleanedOrders.push({
        bagName: finalBagName,
        sku: sapCode.toString(),
        orderQty: monthlyReq,
        orderUnit: 'cartons',
        
        // Use specifications from SAP code lookup
        width: bagSpecs.width,
        gusset: bagSpecs.gusset,
        height: bagSpecs.height,
        gsm: bagSpecs.gsm,
        handleType: bagSpecs.handleType,
        paperGrade: bagSpecs.paperGrade,
        certification: bagSpecs.cert,
        
        // PSL-specific metadata
        originalSAPCode: sapCode,
        cartonsRequired: monthlyReq,
        bagsPerCarton: bagsPerCarton,
        totalBags: totalBags,
        rollWidth: paper || null,
        
        // Source tracking
        sourceRow: rowIndex + dataStartIndex + 1,
        sourceFormat: 'PSL_CLEANED'
      });
      
    } catch (error) {
      console.error(`❌ Error processing row ${rowIndex + dataStartIndex + 1}:`, error);
    }
  });
  
  console.log(`✅ Cleaned Excel data: ${rawRows.length} rows → ${cleanedOrders.length} valid orders`);
  return cleanedOrders;
}

// Smart column mapping for non-standard Excel files
function smartColumnMapping(rawRows: any[][]): any[] {
  console.log('🤖 Using smart column detection for non-standard Excel format...');
  
  if (rawRows.length < 2) return [];
  
  // Look for numeric SAP codes and descriptions in the first few rows
  const cleanedOrders: any[] = [];
  
  rawRows.forEach((row: any[], rowIndex: number) => {
    try {
      if (!Array.isArray(row) || row.length < 3) return;
      
      // Try to find SAP code (should be numeric, 5-6 digits)
      let sapCode = null;
      let description = null;
      let quantity = null;
      
      for (let colIndex = 0; colIndex < Math.min(10, row.length); colIndex++) {
        const value = cleanValue(row[colIndex]);
        
        // Look for SAP code pattern (5-6 digit numbers)
        if (typeof value === 'number' && value >= 10000 && value <= 999999) {
          sapCode = value;
        }
        
        // Look for descriptions (non-empty strings that aren't numbers)
        if (typeof value === 'string' && value.length > 2 && !value.match(/^\d+$/)) {
          description = value;
        }
        
        // Look for quantities (numbers > 10)
        if (typeof value === 'number' && value > 10 && value < 1000000) {
          quantity = value;
        }
      }
      
      // If we found essential data, create an order
      if (sapCode && description && quantity) {
        const bagSpecs = getBagSpecsFromSAPCode(sapCode.toString());
        const finalBagName = description;
        
        console.log(`🔍 Smart detected: ${finalBagName} - SAP: ${sapCode} - Qty: ${quantity}`);
        
        cleanedOrders.push({
          bagName: finalBagName,
          sku: sapCode.toString(),
          orderQty: quantity,
          orderUnit: 'cartons',
          
          // Use specifications from SAP code lookup
          width: bagSpecs.width,
          gusset: bagSpecs.gusset,
          height: bagSpecs.height,
          gsm: bagSpecs.gsm,
          handleType: bagSpecs.handleType,
          paperGrade: bagSpecs.paperGrade,
          certification: bagSpecs.cert,
          
          // Metadata
          originalSAPCode: sapCode,
          cartonsRequired: quantity,
          bagsPerCarton: 250, // default
          totalBags: quantity * 250,
          
          // Source tracking
          sourceRow: rowIndex + 1,
          sourceFormat: 'SMART_DETECTED'
        });
      }
      
    } catch (error) {
      console.error(`❌ Error in smart detection for row ${rowIndex + 1}:`, error);
    }
  });
  
  console.log(`🤖 Smart detection: ${rawRows.length} rows → ${cleanedOrders.length} detected orders`);
  return cleanedOrders;
}


// PSL Format Detection and Conversion Functions
function isPSLFormat(data: any[]): boolean {
  if (!data || data.length < 2) return false; // Need at least 2 rows
  
  const firstRow = data[0];
  console.log('🔍 PSL Format detection - First row keys:', Object.keys(firstRow || {}));
  console.log('🔍 PSL Format detection - First row sample:', {
    key0: Object.keys(firstRow || {})[0],
    key1: Object.keys(firstRow || {})[1], 
    key2: Object.keys(firstRow || {})[2],
    key3: Object.keys(firstRow || {})[3],
    key4: Object.keys(firstRow || {})[4]
  });
  
  // For CSV files, the headers become the object keys directly
  // For Excel files, headers are in __EMPTY_X format
  const allKeys = Object.keys(firstRow || {}).join('|').toLowerCase();
  
  // Check for PSL header patterns
  const hasSAPCode = allKeys.includes('sap code');
  const hasDesc = allKeys.includes('desc');
  const hasPaper = allKeys.includes('paper');
  const hasMonthlyReq = allKeys.includes('monthly requirement');
  const hasMonthData = allKeys.includes('requirement') && 
                      (allKeys.includes('aug') || allKeys.includes('sept') || allKeys.includes('oct'));
  
  const isPSL = hasSAPCode && hasDesc && hasPaper && hasMonthlyReq && hasMonthData;
  
  console.log('🔍 PSL Format check:', {
    hasSAPCode,
    hasDesc,
    hasPaper,
    hasMonthlyReq,
    hasMonthData,
    isPSL,
    allKeys: allKeys.substring(0, 200) + '...'
  });
  
  return isPSL;
}


function getBagSpecsFromSAPCode(sapCode: string): any {
  // First try to find by SKU code
  let skuData = SKU_DATA.find(sku => sku.sku === sapCode);
  
  // If not found, try to find by BOM SAP codes
  if (!skuData) {
    skuData = SKU_DATA.find(sku => 
      sku.bom.some(bomItem => bomItem.sapCode === sapCode)
    );
  }
  
  if (skuData) {
    // Parse dimensions "32×16×38" (in cm) → convert to mm by multiplying by 10
    const [width, gusset, height] = skuData.dimensions.split('×').map(d => parseInt(d.trim()) * 10);
    
    return {
      name: skuData.name,
      width: width,   // converted from cm to mm
      gusset: gusset, // converted from cm to mm
      height: height, // converted from cm to mm
      gsm: parseInt(skuData.gsm),
      handleType: skuData.handle_type,
      paperGrade: skuData.paper_grade,
      cert: skuData.cert,
      existingBOM: skuData.bom,
      boxQty: parseInt(skuData.box_qty)
    };
  }
  
  // If not found in SKU data, return defaults
  console.warn(`SAP Code ${sapCode} not found in SKU database, using defaults`);
  return {
    name: `Product ${sapCode}`,
    width: 320,
    gusset: 160,
    height: 380,
    gsm: 90,
    handleType: 'FLAT HANDLE',
    paperGrade: 'VIRGIN',
    cert: 'FSC',
    existingBOM: [],
    boxQty: 250
  };
}

// Specialized function for PSL CSV format parsing
function convertPSLCSVToInternalFormat(rawRows: any[][]): any[] {
  if (!rawRows || rawRows.length < 3) return [];
  
  // PSL CSV structure:
  // Row 0: Month names (Aug Requirement, Sept Requirement, etc.)
  // Row 1: Headers (28-Aug, Sap Code, Desc, Paper, Monthly Requirement, etc.)
  // Row 2+: Data (NL2, 35718, ALDI, 990, 5000, etc.)
  
  const monthRow = rawRows[0];
  const headerRow = rawRows[1];
  const dataRows = rawRows.slice(2);
  
  console.log(`📊 PSL CSV Structure: ${dataRows.length} data rows`);
  console.log('📅 Month row:', monthRow.slice(0, 15));
  console.log('📋 Header row:', headerRow.slice(0, 10));
  
  // Find requirement column indices - enhanced detection for PSL format
  const requirementColumnIndices: number[] = [];
  monthRow.forEach((header: any, index: number) => {
    const headerStr = header ? header.toString().trim().toLowerCase() : '';
    
    // Enhanced matching for various PSL formats
    const isMonthColumn = headerStr.includes('requirement') || // Aug Requirement, Oct Requirement etc.
                         headerStr.includes('req') || // Short form: Aug Req, Oct Req etc.
                         /^\d{2}-[a-z]{3}$/.test(headerStr) || // 04-aug, 11-aug format
                         /^[a-z]{3}$/.test(headerStr) || // Oct, Nov etc.
                         /^[a-z]{3}\s+requirement$/i.test(headerStr) || // "Oct Requirement", "Nov Requirement"
                         /^[a-z]{3}\s+req$/i.test(headerStr) || // "Oct Req", "Nov Req"
                         /^\d{4}-\d{2}$/.test(headerStr) || // 2024-10, 2024-11 format
                         /^[a-z]{3,9}\s*\d{4}$/i.test(headerStr); // October 2024, Nov 2024 etc.
    
    if (isMonthColumn && headerStr !== '' && headerStr !== 'sap code' && headerStr !== 'desc') {
      requirementColumnIndices.push(index);
      console.log(`📅 Found requirement column at index ${index}: "${header}" (normalized: "${headerStr}")`);
    }
  });
  
  console.log(`📊 Found ${requirementColumnIndices.length} requirement columns`);
  
  let allOrders: any[] = [];
  let processedCount = 0;
  let skippedCount = 0;
  
  // Process each data row
  dataRows.forEach((row: any[], rowIndex: number) => {
    try {
      if (!Array.isArray(row) || row.length < 5) {
        skippedCount++;
        return;
      }
      
      // Extract basic data based on CSV structure
      const bagType = cleanValue(row[0]); // Column A
      const sapCode = cleanValue(row[1]); // Column B  
      const productName = cleanValue(row[2]); // Column C
      const rollWidth = parseNumericValue(row[3]); // Column D
      const monthlyCartons = parseNumericValue(row[4]); // Column E
      const weeklyUsage = parseNumericValue(row[5]); // Column F
      const bagsPerCarton = parseNumericValue(row[6]) || 1000; // Column G - avoid hardcoded 250
      
      console.log(`🔍 Row ${rowIndex + 3}: "${bagType}" | SAP=${sapCode} | "${productName}" | Paper=${rollWidth} | Monthly=${monthlyCartons}`);
      
      // Skip if missing essential data
      if (!sapCode || !productName || sapCode.toString().trim() === '' || productName.toString().trim() === '') {
        console.log(`⏭️ Row ${rowIndex + 3}: Skipping - missing essential data`);
        skippedCount++;
        return;
      }
      
      // Skip MTO items
      if (productName.toString().toLowerCase().includes('mto')) {
        console.log(`⏭️ Row ${rowIndex + 3}: Skipping MTO item: ${productName}`);
        skippedCount++;
        return;
      }
      
      // Calculate total bags from requirement columns
      let totalBagsRequired = 0;
      const monthlyBreakdown: any = {};
      
      requirementColumnIndices.forEach(colIndex => {
        const monthName = monthRow[colIndex];
        let bagsInMonth = parseNumericValue(row[colIndex]) || 0;
        
        // Handle comma-separated numbers like "3,12,500"
        if (typeof row[colIndex] === 'string' && row[colIndex].includes(',')) {
          const cleanedNumber = row[colIndex].replace(/,/g, '');
          bagsInMonth = parseFloat(cleanedNumber) || 0;
        }
        
        if (bagsInMonth > 0) {
          monthlyBreakdown[monthName] = bagsInMonth;
          totalBagsRequired += bagsInMonth;
          console.log(`   📅 ${monthName}: ${bagsInMonth.toLocaleString()} bags`);
        }
      });
      
      // If no requirement data, use monthly cartons fallback
      if (totalBagsRequired === 0 && monthlyCartons > 0) {
        totalBagsRequired = monthlyCartons * bagsPerCarton;
        console.log(`   🔄 Using fallback: ${monthlyCartons} cartons × ${bagsPerCarton} bags = ${totalBagsRequired} total bags`);
      }
      
      if (totalBagsRequired <= 0) {
        console.log(`⏭️ Row ${rowIndex + 3}: No requirements found`);
        skippedCount++;
        return;
      }
      
      // Get bag specifications
      const bagSpecs = getBagSpecsFromSAPCode(sapCode.toString());
      const finalBagName = productName.toString().trim(); // Don't include bagType
      
      allOrders.push({
        bagName: finalBagName,
        sku: sapCode.toString(),
        orderQty: totalBagsRequired,
        orderUnit: 'bags',
        
        width: bagSpecs.width,
        gusset: bagSpecs.gusset,
        height: bagSpecs.height,
        gsm: bagSpecs.gsm,
        handleType: bagSpecs.handleType,
        paperGrade: bagSpecs.paperGrade,
        certification: bagSpecs.cert,
        
        // PSL metadata
        rollWidth: rollWidth,
        originalSAPCode: sapCode,
        monthlyBreakdown: monthlyBreakdown,
        totalBagsRequired: totalBagsRequired,
        bagsPerCarton: bagsPerCarton,
        weeklyUsage: weeklyUsage,
        
        sourceRow: rowIndex + 3,
        sourceFormat: 'PSL_CSV_CORRECTED'
      });
      
      processedCount++;
      console.log(`📦 Generated order ${processedCount}: ${finalBagName} - ${totalBagsRequired.toLocaleString()} bags`);
      
    } catch (error) {
      console.error(`❌ Error processing CSV row ${rowIndex + 3}:`, error);
      skippedCount++;
    }
  });
  
  console.log(`✅ PSL CSV conversion: ${dataRows.length} rows → ${processedCount} orders (${skippedCount} skipped)`);
  if (allOrders.length > 0) {
    console.log(`📊 Total bags: ${allOrders.reduce((sum, order) => sum + order.totalBagsRequired, 0).toLocaleString()}`);
  }
  return allOrders;
}

function convertPSLToInternalFormat(pslData: any[]): any[] {
  if (!pslData || pslData.length < 1) return [];
  
  const firstRow = pslData[0];
  console.log(`📊 PSL Conversion: Processing ${pslData.length} data rows`);
  
  // Find all requirement columns with enhanced detection
  const requirementColumns: string[] = [];
  Object.keys(firstRow).forEach(key => {
    const keyLower = key.toLowerCase().trim();
    
    // Enhanced matching for various PSL requirement column formats
    const isRequirementColumn = keyLower.includes('requirement') || // Aug Requirement, Oct Requirement etc.
                               keyLower.includes('req') || // Short form: Aug Req, Oct Req
                               /^[a-z]{3}$/.test(keyLower) || // Oct, Nov etc.
                               /^[a-z]{3}\s+requirement$/i.test(keyLower) || // "Oct Requirement"
                               /^[a-z]{3}\s+req$/i.test(keyLower) || // "Oct Req"
                               /^\d{4}-\d{2}$/.test(keyLower) || // 2024-10, 2024-11 format
                               /^[a-z]{3,9}\s*\d{4}$/i.test(keyLower); // October 2024, Nov 2024
    
    if (isRequirementColumn && 
        !keyLower.includes('sap') && 
        !keyLower.includes('desc') && 
        !keyLower.includes('paper') && 
        !keyLower.includes('weekly') && 
        !keyLower.includes('bags') && 
        !keyLower.includes('monthly requirement') && // Exclude the generic "monthly requirement" field
        keyLower !== '') {
      requirementColumns.push(key);
      console.log(`📅 Found requirement column: "${key}" (normalized: "${keyLower}")`);
    }
  });
  
  console.log(`📊 Found ${requirementColumns.length} requirement columns`);
  
  let allOrders: any[] = [];
  
  // Process each PSL data row
  pslData.forEach((pslRow, rowIndex) => {
    try {
      // For CSV files, the column headers become keys directly
      // Extract basic PSL data using the actual column names from CSV
      const firstKey = Object.keys(pslRow)[0]; // This should be the bag type column
      const sapCodeKey = Object.keys(pslRow).find(key => key.toLowerCase().includes('sap code'));
      const descKey = Object.keys(pslRow).find(key => key.toLowerCase().includes('desc'));
      const paperKey = Object.keys(pslRow).find(key => key.toLowerCase().includes('paper'));
      const monthlyReqKey = Object.keys(pslRow).find(key => key.toLowerCase().includes('monthly requirement'));
      const weeklyUsageKey = Object.keys(pslRow).find(key => key.toLowerCase().includes('weekly usage'));
      const bagsKey = Object.keys(pslRow).find(key => key.toLowerCase().includes('no of bags'));
      
      const bagType = cleanValue(pslRow[firstKey]);
      const sapCode = cleanValue(pslRow[sapCodeKey || '']);
      const productName = cleanValue(pslRow[descKey || '']);
      const rollWidth = parseNumericValue(pslRow[paperKey || '']);
      const monthlyCartons = parseNumericValue(pslRow[monthlyReqKey || '']);
      const weeklyUsage = parseNumericValue(pslRow[weeklyUsageKey || '']);
      const bagsPerCarton = parseNumericValue(pslRow[bagsKey || '']) || 1000; // Avoid hardcoded 250
      
      console.log(`🔍 Row ${rowIndex + 1}: BagType="${bagType}", SAP="${sapCode}", Product="${productName}"`);
      
      // Enhanced validation for data integrity
      if (!sapCode || !productName) {
        console.log(`⏭️ Row ${rowIndex + 1}: Skipping - missing SAP code="${sapCode}" or product name="${productName}"`);
        return;
      }
      
      // Skip MTO (Made To Order) items and invalid entries
      if (productName.toString().toLowerCase().includes('mto') ||
          sapCode.toString().toLowerCase().includes('mto')) {
        console.log(`⏭️ Skipping MTO item: ${productName} (SAP: ${sapCode})`);
        return;
      }
      
      // Skip header/invalid rows
      if (productName.toString().toLowerCase().trim() === 'desc' ||
          sapCode.toString().toLowerCase().trim() === 'sap code') {
        console.log(`⏭️ Skipping header row: ${productName} (SAP: ${sapCode})`);
        return;
      }
      
      // Calculate total bags across all requirement columns
      let totalBagsRequired = 0;
      const monthlyBreakdown: any = {};
      
      requirementColumns.forEach(reqColumn => {
        const bagsInMonth = parseNumericValue(pslRow[reqColumn]) || 0;
        if (bagsInMonth > 0) {
          monthlyBreakdown[reqColumn] = bagsInMonth;
          totalBagsRequired += bagsInMonth;
          console.log(`   📅 ${reqColumn}: ${bagsInMonth.toLocaleString()} bags`);
        }
      });
      
      // If no requirement columns have data, use the monthly cartons as fallback
      if (totalBagsRequired === 0 && monthlyCartons > 0) {
        totalBagsRequired = monthlyCartons * bagsPerCarton;
        console.log(`   🔄 Using fallback: ${monthlyCartons} cartons × ${bagsPerCarton} bags = ${totalBagsRequired} total bags`);
      }
      
      if (totalBagsRequired <= 0) {
        console.log(`⏭️ Row ${rowIndex + 1}: No valid requirements found`);
        return;
      }
      
      console.log(`✅ Processing PSL row: ${productName} - Total: ${totalBagsRequired.toLocaleString()} bags`);
      
      // Get bag specifications from SAP code
      const bagSpecs = getBagSpecsFromSAPCode(sapCode.toString());
      const finalBagName = productName.toString().trim(); // Don't include bagType in name
      
      allOrders.push({
        bagName: finalBagName,
        sku: sapCode.toString(),
        orderQty: totalBagsRequired, // Total bags across all months
        orderUnit: 'bags', // Changed to bags since we're totaling actual bag requirements
        
        // Use specifications from SAP code lookup
        width: bagSpecs.width,
        gusset: bagSpecs.gusset,
        height: bagSpecs.height,
        gsm: bagSpecs.gsm,
        handleType: bagSpecs.handleType,
        paperGrade: bagSpecs.paperGrade,
        certification: bagSpecs.cert,
        
        // PSL-specific metadata for tracking
        rollWidth: rollWidth,
        originalSAPCode: sapCode,
        monthlyBreakdown: monthlyBreakdown,
        totalBagsRequired: totalBagsRequired,
        bagsPerCarton: bagsPerCarton,
        weeklyUsage: weeklyUsage,
        
        // Source tracking
        sourceRow: rowIndex + 1,
        sourceFormat: 'PSL_WITH_TOTALS'
      });
      
      console.log(`📦 Generated order: ${finalBagName}: ${totalBagsRequired.toLocaleString()} bags total`);
      
    } catch (error) {
      console.error(`❌ Error processing PSL row ${rowIndex + 1}:`, error);
    }
  });
  
  console.log(`✅ Converted PSL data: ${pslData.length} rows → ${allOrders.length} valid orders`);
  if (allOrders.length > 0) {
    console.log(`📊 Total bags across all orders: ${allOrders.reduce((sum, order) => sum + order.totalBagsRequired, 0).toLocaleString()}`);
  }
  return allOrders;
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
      // Enhanced data cleaning and conversion
      const processedRow = {
        ...row,
        // Clean and convert bagName
        bagName: cleanStringValue(row.bagName) || `Order ${index + 1}`,
        
        // Clean and convert quantities - support multiple field names, prioritize actual PSL data
        orderQty: parseNumericValue(row.orderQty || row.totalBagsRequired || row.cartonsRequired || row.quantity || row.qty) || 1000,
        
        // Clean numeric fields with fallbacks
        width: row.width ? parseNumericValue(row.width) : undefined,
        gusset: row.gusset ? parseNumericValue(row.gusset) : undefined,
        height: row.height ? parseNumericValue(row.height) : undefined,
        gsm: row.gsm ? parseNumericValue(row.gsm) : undefined,
        deliveryDays: parseNumericValue(row.deliveryDays) || 14,
        colors: parseInt(cleanStringValue(row.colors) || '0') || 0,
        
        // Clean string fields
        handleType: cleanStringValue(row.handleType) || 'FLAT HANDLE',
        paperGrade: cleanStringValue(row.paperGrade) || 'VIRGIN',
        certification: cleanStringValue(row.certification) || 'FSC',
        orderUnit: cleanStringValue(row.orderUnit) || 'cartons',
        sku: cleanStringValue(row.sku || row.originalSAPCode) || undefined
      };

      // Additional validation for required fields
      if (!processedRow.bagName || processedRow.bagName.trim() === '') {
        throw new Error('bagName is required and cannot be empty');
      }
      
      if (!processedRow.orderQty || processedRow.orderQty <= 0) {
        throw new Error('orderQty must be a positive number');
      }

      return orderSchema.parse(processedRow);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      console.error(`❌ Validation failed for row ${index + 1}:`, {
        original: row,
        error: errorMessage
      });
      throw new Error(`Validation error in row ${index + 1}: ${errorMessage}`);
    }
  });
}

// Helper function to clean string values
function cleanStringValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  const str = value.toString().trim();
  if (str === '' || str === '#VALUE!' || str === '#DIV/0!' || str === '#N/A' || str === 'undefined' || str === 'null') {
    return null;
  }
  
  return str;
}

// NEW: Sequential processing with inventory deduction and machine scheduling
async function processOrdersWithSequentialInventory(orders: any[]): Promise<{results: any[], summary: any}> {
  console.log('🚀 Starting sequential order processing with inventory and machine planning...');
  
  // Initialize systems
  const runningInventory = await fetchAllInventory();
  const machineFleet = initializeMachineFleet();
  const productionSchedule: MachineSchedule[] = [];
  const results = [];
  
  let totalProcessedCost = 0;
  let feasibleOrdersCount = 0;
  
  // Process orders sequentially
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const orderIndex = i + 1;
    
    console.log(`📦 Processing Order ${orderIndex}/${orders.length}: ${order.bagName}`);
    
    try {
      // Calculate BOM for this order
      const orderAnalysis = await calculateOrderAnalysisWithoutInventoryCheck(order);
      
      // Check inventory against running totals
      const inventoryCheck = checkInventoryWithRunningTotal(orderAnalysis.bom, runningInventory);
      
      // Check machine availability
      const machineCheck = findAvailableMachine(orderAnalysis.specs, machineFleet, order.deliveryDays || 14);
      
      const isFeasible = inventoryCheck.feasible && machineCheck.machine !== null;
      
      // Build result object
      const orderResult = {
        ...order,
        ...orderAnalysis,
        processingOrder: orderIndex,
        inventoryFeasible: inventoryCheck.feasible,
        machineFeasible: machineCheck.machine !== null,
        feasible: isFeasible,
        insufficientMaterials: inventoryCheck.insufficientMaterials,
        assignedMachine: machineCheck.machine?.name || null,
        machineId: machineCheck.machine?.id || null,
        productionSchedule: null as MachineSchedule | null,
        consumedMaterials: inventoryCheck.consumedMaterials
      };
      
      // If feasible, actually consume inventory and schedule machine
      if (isFeasible) {
        console.log(`✅ Order ${orderIndex} is FEASIBLE - Consuming materials and scheduling production`);
        
        // Consume inventory
        for (const consumption of inventoryCheck.consumedMaterials) {
          const currentStock = runningInventory.get(consumption.sapCode) || 0;
          runningInventory.set(consumption.sapCode, currentStock - consumption.consumed);
          console.log(`   📉 ${consumption.description}: ${currentStock} → ${currentStock - consumption.consumed}`);
        }
        
        // Schedule machine production
        if (machineCheck.machine) {
          const schedule = scheduleProductionOnMachine(
            machineCheck.machine, 
            orderAnalysis.actualBags, 
            `ORDER_${orderIndex}`
          );
          orderResult.productionSchedule = schedule;
          productionSchedule.push(schedule);
          
          console.log(`   🏭 Scheduled on ${machineCheck.machine.name}: ${schedule.startTime.toLocaleDateString()} - ${schedule.endTime.toLocaleDateString()}`);
        }
        
        totalProcessedCost += orderAnalysis.totalCost;
        feasibleOrdersCount++;
        
      } else {
        console.log(`❌ Order ${orderIndex} is NOT FEASIBLE`);
        if (!inventoryCheck.feasible) {
          console.log(`   📉 Inventory issues: ${inventoryCheck.insufficientMaterials.join(', ')}`);
        }
        if (!machineCheck.machine) {
          console.log(`   🏭 No compatible machine available`);
        }
      }
      
      results.push(orderResult);
      
    } catch (error) {
      console.log(`💥 Error processing Order ${orderIndex}: ${error}`);
      results.push({
        ...order,
        processingOrder: orderIndex,
        error: error instanceof Error ? error.message : 'Unknown error',
        feasible: false,
        inventoryFeasible: false,
        machineFeasible: false
      });
    }
  }
  
  // Create summary with remaining inventory
  const remainingInventory = Array.from(runningInventory.entries()).map(([sapCode, remaining]) => ({
    sapCode,
    remaining
  }));
  
  const summary = {
    totalOrders: orders.length,
    feasibleOrders: feasibleOrdersCount,
    totalCost: totalProcessedCost,
    remainingInventory,
    productionSchedule,
    machineUtilization: machineFleet.map(machine => ({
      machineId: machine.id,
      machineName: machine.name,
      nextAvailable: machine.nextAvailableTime,
      scheduledOrders: productionSchedule.filter(s => s.machineId === machine.id).length
    }))
  };
  
  console.log(`🎯 Sequential processing complete: ${feasibleOrdersCount}/${orders.length} orders feasible`);
  
  return { results, summary };
}

// Legacy function kept for backwards compatibility (but now deprecated)
async function processOrders(orders: any[]): Promise<any[]> {
  console.warn('⚠️  Using legacy processOrders - consider migrating to processOrdersWithSequentialInventory');
  const { results } = await processOrdersWithSequentialInventory(orders);
  return results;
}

// Roll width efficiency calculation for PSL integration
function calculateRollEfficiency(rollWidth: number, bagWidth: number, bagGusset: number): number {
  // Calculate how many bags can fit across the roll width
  const effectiveBagWidth = bagWidth + bagGusset; // Total width needed per bag
  const bagsAcrossRoll = Math.floor(rollWidth / effectiveBagWidth);
  
  // Calculate efficiency as ratio of used width to total roll width
  const usedWidth = bagsAcrossRoll * effectiveBagWidth;
  const efficiency = usedWidth / rollWidth;
  
  // Add waste factor for cutting and setup (typical 5-10% waste)
  const wasteMultiplier = 1.08; // 8% waste factor
  
  console.log(`📏 Roll efficiency: ${rollWidth}mm roll, ${bagsAcrossRoll} bags across, ${(efficiency * 100).toFixed(1)}% efficiency`);
  
  return efficiency * wasteMultiplier;
}

// Enhanced version without external inventory/machine checks (used by sequential processor)
async function calculateOrderAnalysisWithoutInventoryCheck(order: any) {
  const calculateActualBags = (qty: number, unit: 'bags' | 'cartons'): number => {
    // Use bags per carton from PSL data if available, otherwise default
    const bagsPerCarton = order.bagsPerCarton || 250;
    return unit === 'cartons' ? qty * bagsPerCarton : qty;
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

  // Calculate detailed paper requirements with roll width consideration
  const frontBack = 2 * (specs.width * specs.height);
  const gussetArea = 2 * (specs.gusset * specs.height);
  const bottomArea = specs.width * specs.gusset;
  const overlapArea = (specs.width + specs.gusset) * 2;
  const totalAreaMm2 = frontBack + gussetArea + bottomArea + overlapArea;
  const paperWeightPerMm2 = specs.gsm / 1000000;
  let paperWeightPerBag = (totalAreaMm2 * paperWeightPerMm2) / 1000; // kg per bag
  
  // Apply roll width efficiency if available (from PSL data)
  if (order.rollWidth && order.rollWidth > 0) {
    const rollEfficiency = calculateRollEfficiency(order.rollWidth, specs.width, specs.gusset);
    paperWeightPerBag = paperWeightPerBag * rollEfficiency;
    console.log(`📏 Roll width ${order.rollWidth}mm applied, efficiency factor: ${rollEfficiency.toFixed(3)}`);
  }
  
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
  
  return {
    specs,
    actualBags,
    bom,
    totalCost,
    bagWeight,
    calculationSteps: [
      `Paper: ${totalAreaMm2.toFixed(0)}mm² × ${specs.gsm}g/m² = ${paperWeightPerBag.toFixed(6)}kg`,
      order.rollWidth ? `Roll Width: ${order.rollWidth}mm (efficiency applied)` : 'No roll width specified',
      `Cold Glue: Standard amount = ${coldGlueQty}kg`,
      specs.handleType === 'FLAT HANDLE' ? 'Flat Handle: 0.0052kg + Patch: 0.0012kg + Hot Glue: 0.0001kg' :
      specs.handleType === 'TWISTED HANDLE' ? 'Twisted Handle: 0.7665kg + Patch: 0.0036kg + Hot Glue: 0.0011kg' : 'No handle',
      `Carton: Standard packaging = ${cartonQty} pieces`,
      order.bagsPerCarton ? `PSL Conversion: ${order.cartonsRequired} cartons × ${order.bagsPerCarton} bags/carton = ${actualBags} bags` : ''
    ].filter(step => step.length > 0)
  };
}

// Legacy function that includes inventory checks (kept for backwards compatibility)
async function calculateOrderAnalysis(order: any) {
  const calculateActualBags = (qty: number, unit: 'bags' | 'cartons'): number => {
    return unit === 'cartons' ? qty * (order.bagsPerCarton || 1000) : qty;
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
  
  // Enhanced inventory and machine feasibility with real Quickbase checks
  const inventoryCheck = await checkInventoryFeasibilityDetailed(bom);
  const machineFeasible = checkMachineFeasibility(specs);
  
  const warnings = [];
  if (inventoryCheck.insufficientMaterials.length > 0) {
    warnings.push(`Insufficient inventory for: ${inventoryCheck.insufficientMaterials.join(', ')}`);
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
    inventoryFeasible: inventoryCheck.feasible,
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

async function generateHTMLReport(bulkOrder: any): Promise<string> {
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

  // Fetch current inventory data for accurate shortage calculation
  const currentInventory = await fetchAllInventory();

  // Debug logging to see what data we have
  console.log('BulkOrder data structure:', {
    totalOrders: bulkOrder.totalOrders,
    feasible: bulkOrder.feasible,
    totalCost: bulkOrder.totalCost,
    totalCostType: typeof bulkOrder.totalCost,
    fileName: bulkOrder.fileName
  });
  
  // Ensure data consistency - convert string values to numbers if needed
  const processedBulkOrder = {
    ...bulkOrder,
    totalOrders: typeof bulkOrder.totalOrders === 'string' ? parseInt(bulkOrder.totalOrders) : bulkOrder.totalOrders,
    feasible: typeof bulkOrder.feasible === 'string' ? parseInt(bulkOrder.feasible) : bulkOrder.feasible,
    totalCost: typeof bulkOrder.totalCost === 'string' ? parseFloat(bulkOrder.totalCost) : bulkOrder.totalCost
  };
  
  console.log('Processed BulkOrder data:', {
    totalOrders: processedBulkOrder.totalOrders,
    feasible: processedBulkOrder.feasible,
    totalCost: processedBulkOrder.totalCost
  });
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Bulk Order Report - ${bulkOrder.fileName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                margin: 0;
                padding: 20px; 
                background-color: hsl(0 0% 100%);
                color: hsl(222.2 84% 4.9%); 
                line-height: 1.5;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                padding: 24px;
                border-radius: 8px;
                border: 1px solid hsl(214.3 31.8% 91.4%);
            }
            h1 { 
                color: hsl(222.2 84% 4.9%); 
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 8px; 
            }
            h2 { 
                color: hsl(222.2 84% 4.9%); 
                font-size: 18px; 
                font-weight: 600;
                margin: 32px 0 16px 0; 
                padding-bottom: 8px;
                border-bottom: 1px solid hsl(214.3 31.8% 91.4%);
            }
            h3 { 
                color: hsl(222.2 84% 4.9%); 
                font-size: 16px; 
                font-weight: 500;
                margin: 24px 0 12px 0; 
            }
            .header-info {
                color: hsl(215.4 16.3% 46.9%);
                font-size: 14px;
                margin-bottom: 4px;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 32px;
                border: 1px solid hsl(214.3 31.8% 91.4%);
                border-radius: 8px;
                overflow: hidden;
            }
            th, td { 
                padding: 12px; 
                text-align: left; 
                border-bottom: 1px solid hsl(214.3 31.8% 91.4%); 
            }
            th { 
                background: hsl(210 40% 96%);
                font-weight: 600; 
                color: hsl(222.2 84% 4.9%);
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            tr:hover { 
                background: hsl(210 40% 98%); 
            }
            tr:last-child td {
                border-bottom: none;
            }
            .status-feasible { 
                color: hsl(142.1 76.2% 36.3%); 
                font-weight: 600; 
            }
            .status-not-feasible { 
                color: hsl(0 84.2% 60.2%); 
                font-weight: 600; 
            }
            .order-box { 
                border: 1px solid hsl(214.3 31.8% 91.4%);
                margin-bottom: 24px; 
                background: white; 
                border-radius: 8px;
                overflow: hidden;
            }
            .order-title { 
                background: hsl(210 40% 96%);
                padding: 16px 20px; 
                margin: 0; 
                font-size: 16px; 
                font-weight: 600; 
                color: hsl(222.2 84% 4.9%);
                border-bottom: 1px solid hsl(214.3 31.8% 91.4%);
            }
            .order-body { 
                padding: 20px; 
            }
            .specs { 
                background: hsl(210 40% 98%);
                border: 1px solid hsl(214.3 31.8% 91.4%);
                padding: 16px; 
                margin: 16px 0; 
                border-radius: 6px; 
            }
            .spec-row { 
                display: inline-block; 
                margin-right: 24px; 
                margin-bottom: 8px; 
            }
            .spec-label { 
                font-weight: 600; 
                color: hsl(215.4 16.3% 46.9%);
                margin-right: 4px;
            }
            .spec-value {
                color: hsl(222.2 84% 4.9%);
            }
            .materials-table { 
                margin-top: 16px; 
                font-size: 14px; 
            }
            .warning { 
                background: hsl(48 96% 89%);
                border: 1px solid hsl(48 96% 76%);
                color: hsl(25 95% 39%);
                padding: 12px; 
                margin: 16px 0; 
                border-radius: 6px; 
            }
            .machine-assignment { 
                background: hsl(210 40% 96%);
                border: 1px solid hsl(221.2 83.2% 53.3%);
                color: hsl(221.2 83.2% 53.3%);
                padding: 8px 12px; 
                margin: 8px 0; 
                border-radius: 6px; 
                font-size: 13px; 
                font-weight: 500;
            }
            .order-number { 
                background: hsl(222.2 84% 4.9%);
                color: white; 
                padding: 4px 8px; 
                border-radius: 12px; 
                font-size: 12px; 
                font-weight: 500;
                margin-right: 8px; 
            }
            .cost { 
                font-weight: 600; 
                color: hsl(222.2 84% 4.9%);
            }
            .footer {
                margin-top: 40px; 
                padding: 16px; 
                background: hsl(210 40% 96%);
                border-radius: 6px;
                text-align: center; 
                color: hsl(215.4 16.3% 46.9%); 
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Bulk Order Analysis Report</h1>
            <p class="header-info"><strong>File:</strong> ${processedBulkOrder.fileName}</p>
            <p class="header-info"><strong>Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
        
        
        <h2>Order Overview</h2>
        <table>
            <thead>
                <tr>
                    <th>Order</th>
                    <th>Bag Name</th>
                    <th>Dimensions (mm)</th>
                    <th>Quantity</th>
                    <th>Unit Cost</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map((order: any) => `
                    <tr>
                        <td>
                            ${order.processingOrder ? `<span class="order-number">#${order.processingOrder}</span>` : ''}
                        </td>
                        <td><strong>${order.bagName || 'Custom Bag'}</strong></td>
                        <td>${order.specs ? `${order.specs.width}×${order.specs.gusset}×${order.specs.height}` : 'N/A'}</td>
                        <td>${order.actualBags?.toLocaleString() || (order.orderUnit === 'cartons' ? (order.orderQty * 250).toLocaleString() : order.orderQty)} bags</td>
                        <td>€${((order.totalCost || 0) / (order.actualBags || (order.orderUnit === 'cartons' ? order.orderQty * 250 : order.orderQty) || 1)).toFixed(4)}</td>
                        <td class="cost">€${(order.totalCost || 0).toFixed(2)}</td>
                        <td class="${order.feasible ? 'status-feasible' : 'status-not-feasible'}">
                            ${order.feasible ? 'Feasible' : 'Not Feasible'}
                            ${order.assignedMachine ? `<div class="machine-assignment">Machine: ${order.assignedMachine}</div>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <!-- Combined Materials Requirements Table -->
        <h2>Combined Materials Requirements</h2>
        ${(() => {
            try {
                // Calculate total requirements across all orders
                const materialRequirements = new Map();
                let totalOrdersProcessed = 0;
                let totalOrdersWithBOM = 0;
                
                orders.forEach((order: any, index: number) => {
                    if (order.bom && Array.isArray(order.bom)) {
                        totalOrdersWithBOM++;
                        order.bom.forEach((item: any) => {
                            if (!item.sapCode) return;
                            
                            const existing = materialRequirements.get(item.sapCode) || {
                                sapCode: item.sapCode,
                                description: item.description || 'N/A',
                                type: item.type || 'N/A',
                                unit: item.unit || 'N/A',
                                totalRequired: 0,
                                availableStock: currentInventory.get(item.sapCode) || 0,
                                ordersUsingThis: []
                            };
                            
                            existing.totalRequired += (item.totalQuantity || 0);
                            existing.ordersUsingThis.push(`#${order.processingOrder || index + 1}`);
                            materialRequirements.set(item.sapCode, existing);
                        });
                    }
                    totalOrdersProcessed++;
                });
                
                if (materialRequirements.size === 0) {
                    return '<p>No material requirements found in orders.</p>';
                }
                
                const materials = Array.from(materialRequirements.values()).sort((a, b) => {
                    // Sort by shortage severity first, then by type and description
                    const aShortage = Math.max(0, a.totalRequired - a.availableStock);
                    const bShortage = Math.max(0, b.totalRequired - b.availableStock);
                    const aShortagePercentage = a.totalRequired > 0 ? (aShortage / a.totalRequired) : 0;
                    const bShortagePercentage = b.totalRequired > 0 ? (bShortage / b.totalRequired) : 0;
                    
                    // First sort by shortage percentage (highest first)
                    if (aShortagePercentage !== bShortagePercentage) {
                        return bShortagePercentage - aShortagePercentage;
                    }
                    
                    // Then sort by material type and description
                    return a.type.localeCompare(b.type) || a.description.localeCompare(b.description);
                });
                
                return `
                    <div class="summary" style="margin-bottom: 24px;">
                        <p><strong>Analysis:</strong> ${totalOrdersWithBOM} of ${totalOrdersProcessed} orders have detailed material requirements.</p>
                        <p><strong>Note:</strong> This table shows total material requirements across all orders vs current inventory levels. Red rows indicate materials with shortages.</p>
                        ${(() => {
                            const shortages = materials.filter(m => m.totalRequired > m.availableStock);
                            const criticalShortages = shortages.filter(m => (m.totalRequired - m.availableStock) / m.totalRequired > 0.5);
                            
                            if (criticalShortages.length > 0) {
                                return `<p style="color: hsl(0 84.2% 60.2%); font-weight: 600;">⚠️ <strong>Critical Alert:</strong> ${criticalShortages.length} materials have severe shortages (>50% short).</p>`;
                            } else if (shortages.length > 0) {
                                return `<p style="color: hsl(48 96% 53%); font-weight: 600;">⚠️ <strong>Warning:</strong> ${shortages.length} materials have shortages but may be manageable.</p>`;
                            } else {
                                return `<p style="color: hsl(142.1 76.2% 36.3%); font-weight: 600;">✅ <strong>Good News:</strong> All required materials appear to be sufficiently stocked.</p>`;
                            }
                        })()}
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Material Type</th>
                                <th>SAP Code</th>
                                <th>Description</th>
                                <th>Total Required</th>
                                <th>Unit</th>
                                <th>Available Stock</th>
                                <th>Shortage</th>
                                <th>Used By Orders</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${materials.map(material => {
                                const shortage = Math.max(0, material.totalRequired - material.availableStock);
                                const hasShortage = shortage > 0;
                                const shortagePercentage = material.totalRequired > 0 ? (shortage / material.totalRequired * 100) : 0;
                                const isCritical = shortagePercentage > 50;
                                
                                return `
                                    <tr style="${hasShortage ? (isCritical ? 'background: hsl(0 84.2% 92%);' : 'background: hsl(48 96% 92%);') : ''}">
                                        <td><strong>${material.type}</strong></td>
                                        <td>${material.sapCode}</td>
                                        <td>${material.description}</td>
                                        <td class="cost">${material.totalRequired.toFixed(3)}</td>
                                        <td>${material.unit}</td>
                                        <td class="cost">${material.availableStock.toFixed(3)}</td>
                                        <td class="${hasShortage ? 'status-not-feasible' : 'status-feasible'}">
                                            ${hasShortage ? `${shortage.toFixed(3)} (${shortagePercentage.toFixed(1)}%)` : '0.000 (0%)'}
                                        </td>
                                        <td style="font-size: 12px;">${material.ordersUsingThis.join(', ')}</td>
                                        <td class="${hasShortage ? 'status-not-feasible' : 'status-feasible'}">
                                            ${hasShortage ? (isCritical ? 'CRITICAL' : 'SHORTAGE') : 'SUFFICIENT'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    
                    <div class="summary">
                        <h3>Materials Summary by Type</h3>
                        <div class="summary-grid">
                            ${(() => {
                                const typeGroups = new Map();
                                materials.forEach(material => {
                                    if (!typeGroups.has(material.type)) {
                                        typeGroups.set(material.type, { total: 0, shortage: 0 });
                                    }
                                    const group = typeGroups.get(material.type);
                                    group.total += 1;
                                    if (material.totalRequired > material.availableStock) {
                                        group.shortage += 1;
                                    }
                                });
                                
                                return Array.from(typeGroups.entries()).map(([type, data]) => `
                                    <div class="summary-item">
                                        <div class="summary-number ${data.shortage > 0 ? 'status-not-feasible' : 'status-feasible'}">${data.shortage}</div>
                                        <div class="summary-label">${type} Shortages</div>
                                    </div>
                                `).join('');
                            })()}
                        </div>
                    </div>
                `;
            } catch (error) {
                console.error('Error generating materials summary:', error);
                return '<p>Error generating materials summary table.</p>';
            }
        })()}

        ${orders.map((order: any, index: number) => `
            <div class="order-box">
                <div class="order-title">
                    Order #${order.processingOrder || index + 1}: ${order.bagName || 'Custom Bag'}
                    ${order.assignedMachine ? ` - Assigned to: ${order.assignedMachine}` : ''}
                </div>
                
                <div class="order-body">
                    ${order.specs ? `
                        <div class="specs">
                            <strong>Specifications:</strong><br>
                            <div class="spec-row">
                                <span class="spec-label">Dimensions:</span> 
                                <span class="spec-value">${order.specs.width} × ${order.specs.gusset} × ${order.specs.height} mm</span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-label">GSM:</span> 
                                <span class="spec-value">${order.specs.gsm}</span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-label">Handle:</span> 
                                <span class="spec-value">${order.specs.handleType || 'N/A'}</span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-label">Paper:</span> 
                                <span class="spec-value">${order.specs.paperGrade || 'N/A'}</span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-label">Quantity:</span> 
                                <span class="spec-value">${(order.actualBags || (order.orderUnit === 'cartons' ? order.orderQty * (order.bagsPerCarton || 1000) : order.orderQty) || 0).toLocaleString()} bags ${order.orderUnit === 'cartons' ? `(${order.orderQty} cartons)` : ''}</span>
                            </div>
                            <div class="spec-row">
                                <span class="spec-label">Total Cost:</span> 
                                <span class="cost">€${(order.totalCost || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${order.bom && order.bom.length > 0 ? `
                        <h3>Bill of Materials</h3>
                        <table class="materials-table">
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th>SAP Code</th>
                                    <th>Description</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.bom.map((item: any) => `
                                    <tr>
                                        <td>${item.type}</td>
                                        <td>${item.sapCode}</td>
                                        <td>${item.description}</td>
                                        <td>${item.totalQuantity?.toFixed(3) || 'N/A'}</td>
                                        <td>${item.unit}</td>
                                        <td class="cost">€${item.totalCost?.toFixed(2) || '0.00'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : ''}
                    
                    ${order.insufficientMaterials && order.insufficientMaterials.length > 0 ? `
                        <div class="warning">
                            <strong>Insufficient Materials:</strong><br>
                            ${order.insufficientMaterials.join('<br>')}
                        </div>
                    ` : ''}
                    
                    ${order.consumedMaterials && order.consumedMaterials.length > 0 ? `
                        <h3>Materials Consumed by This Order</h3>
                        <table class="materials-table">
                            <thead>
                                <tr>
                                    <th>SAP Code</th>
                                    <th>Description</th>
                                    <th>Consumed</th>
                                    <th>Remaining</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.consumedMaterials.map((material: any) => `
                                    <tr>
                                        <td>${material.sapCode}</td>
                                        <td>${material.description || 'N/A'}</td>
                                        <td class="cost">${material.consumed?.toFixed(3) || 'N/A'}</td>
                                        <td>${material.remaining?.toFixed(3) || 'N/A'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : ''}
                </div>
            </div>
        `).join('')}
        
            <div class="footer">
                Report generated by Bag Material Calculator System on ${new Date().toLocaleString()}
            </div>
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
