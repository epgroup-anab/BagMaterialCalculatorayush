import { VercelRequest, VercelResponse } from '@vercel/node';
import multer from 'multer';
import { parse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { z } from 'zod';

// Import storage and models - define inline for serverless
import mongoose, { Document, Schema } from 'mongoose';

// Define models inline for serverless compatibility
interface IBulkOrder extends Document {
  _id: string;
  fileName: string;
  totalOrders: number;
  totalCost: number;
  orders: any[];
  feasible: number;
  uploadedAt: Date;
}

const BulkOrderSchema = new Schema<IBulkOrder>({
  fileName: { type: String, required: true },
  totalOrders: { type: Number, required: true },
  totalCost: { type: Number, required: true },
  orders: { type: [Schema.Types.Mixed], required: true },
  feasible: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

// Use a different model name to avoid conflicts
const ServerlessBulkOrder = mongoose.models.ServerlessBulkOrder || mongoose.model<IBulkOrder>('ServerlessBulkOrder', BulkOrderSchema);

// MongoDB connection for serverless
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) return;

  try {
    const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    await mongoose.connect(mongoURI);
    isConnected = true;
    console.log('✅ MongoDB connected for serverless function');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

// Storage interface for serverless
interface ServerlessStorage {
  insertBulkOrder(bulkOrder: {
    fileName: string;
    totalOrders: number;
    totalCost: number;
    orders: string;
    feasible: number;
  }): Promise<{
    id: string;
    fileName: string;
    totalOrders: number;
    totalCost: string;
    orders: string;
    feasible: number;
    uploadedAt: Date;
  }>;
}

class ServerlessMongoStorage implements ServerlessStorage {
  async insertBulkOrder(insertBulkOrder: {
    fileName: string;
    totalOrders: number;
    totalCost: number;
    orders: string;
    feasible: number;
  }) {
    await connectToDatabase();
    
    const ordersArray = JSON.parse(insertBulkOrder.orders);
    
    const bulkOrder = new ServerlessBulkOrder({
      fileName: insertBulkOrder.fileName,
      totalOrders: insertBulkOrder.totalOrders,
      totalCost: insertBulkOrder.totalCost,
      orders: ordersArray,
      feasible: insertBulkOrder.feasible
    });
    
    const savedBulkOrder = await bulkOrder.save();
    
    return {
      id: savedBulkOrder._id.toString(),
      fileName: savedBulkOrder.fileName,
      totalOrders: savedBulkOrder.totalOrders,
      totalCost: savedBulkOrder.totalCost.toString(),
      orders: JSON.stringify(savedBulkOrder.orders),
      feasible: savedBulkOrder.feasible,
      uploadedAt: savedBulkOrder.uploadedAt
    };
  }
}

class ServerlessMemStorage implements ServerlessStorage {
  private orderIdCounter = 1;

  async insertBulkOrder(insertBulkOrder: {
    fileName: string;
    totalOrders: number;
    totalCost: number;
    orders: string;
    feasible: number;
  }) {
    const id = (this.orderIdCounter++).toString();
    return {
      id,
      fileName: insertBulkOrder.fileName,
      totalOrders: insertBulkOrder.totalOrders,
      totalCost: insertBulkOrder.totalCost.toString(),
      orders: insertBulkOrder.orders,
      feasible: insertBulkOrder.feasible,
      uploadedAt: new Date()
    };
  }
}

// Initialize storage
const storage: ServerlessStorage = process.env.MONGODB_URI || process.env.DATABASE_URL 
  ? new ServerlessMongoStorage() 
  : new ServerlessMemStorage();

// Configure multer for Vercel (in-memory storage)
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

// Middleware wrapper for Vercel
function runMiddleware(req: any, res: any, fn: any) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Run multer middleware
    await runMiddleware(req, res, upload.single('file'));
    
    const file = (req as any).file;
    
    if (!file) {
      console.error('No file uploaded in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing file: ${file.originalname}, size: ${file.size} bytes`);

    let parsedData: any[] = [];
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    // Parse file based on type
    if (fileExtension === 'csv') {
      console.log('Parsing CSV file...');
      parsedData = await parseCSV(file.buffer);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      console.log('Parsing Excel file...');
      parsedData = await parseExcel(file.buffer);
    } else {
      console.error(`Unsupported file format: ${fileExtension}`);
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    console.log(`Parsed ${parsedData.length} rows from file`);

    // Validate and process data
    console.log('Validating order data...');
    const validatedOrders = validateOrderData(parsedData);
    console.log(`Validated ${validatedOrders.length} orders`);
    
    // Calculate all orders using sequential processing logic
    console.log('🚀 Starting sequential inventory and machine planning...');
    const { results: calculatedOrders, summary } = await processOrdersWithSequentialInventory(validatedOrders);
    console.log(`✅ Processing complete: ${summary.feasibleOrders}/${summary.totalOrders} orders feasible`);
    
    try {
      // Save to database with enhanced data
      console.log('Saving to database...');
      const bulkOrder = await storage.insertBulkOrder({
        fileName: file.originalname,
        totalOrders: summary.totalOrders,
        totalCost: summary.totalCost,
        orders: JSON.stringify(calculatedOrders),
        feasible: summary.feasibleOrders,
      });
      console.log(`Database save successful with ID: ${bulkOrder.id}`);

      // Ensure we return a proper JSON response
      const response = {
        id: bulkOrder.id,
        message: 'Bulk upload processed successfully with sequential inventory and machine planning',
        summary: {
          totalOrders: summary.totalOrders,
          feasibleOrders: summary.feasibleOrders,
          totalCost: summary.totalCost,
          remainingInventory: summary.remainingInventory || [],
          machineUtilization: summary.machineUtilization || [],
          productionSchedule: summary.productionSchedule || []
        },
        orders: calculatedOrders.slice(0, 10) // Limit response size for serverless
      };

      res.status(200).json(response);
    } catch (dbError) {
      console.error('Database save error:', dbError);
      // Return success even if DB save fails, with in-memory results
      const response = {
        id: Date.now().toString(),
        message: 'Bulk upload processed successfully (database save failed, using temporary storage)',
        summary: {
          totalOrders: summary.totalOrders,
          feasibleOrders: summary.feasibleOrders,
          totalCost: summary.totalCost,
          remainingInventory: summary.remainingInventory || [],
          machineUtilization: summary.machineUtilization || [],
          productionSchedule: summary.productionSchedule || []
        },
        orders: calculatedOrders.slice(0, 10)
      };
      
      res.status(200).json(response);
    }

  } catch (error: unknown) {
    console.error('Bulk upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process bulk upload';
    res.status(500).json({ error: errorMessage });
  }
}

// Helper functions
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

// All the helper functions from routes.ts

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

// Sequential processing with inventory deduction and machine scheduling
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

// Enhanced version without external inventory/machine checks (used by sequential processor)
async function calculateOrderAnalysisWithoutInventoryCheck(order: any) {
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
  
  return {
    specs,
    actualBags,
    bom,
    totalCost,
    bagWeight,
    calculationSteps: [
      `Paper: ${totalAreaMm2.toFixed(0)}mm² × ${specs.gsm}g/m² = ${paperWeightPerBag.toFixed(6)}kg`,
      `Cold Glue: Standard amount = ${coldGlueQty}kg`,
      specs.handleType === 'FLAT HANDLE' ? 'Flat Handle: 0.0052kg + Patch: 0.0012kg + Hot Glue: 0.0001kg' :
      specs.handleType === 'TWISTED HANDLE' ? 'Twisted Handle: 0.7665kg + Patch: 0.0036kg + Hot Glue: 0.0011kg' : 'No handle',
      `Carton: Standard packaging = ${cartonQty} pieces`
    ]
  };
}

export const config = {
  api: {
    bodyParser: false,
  },
};