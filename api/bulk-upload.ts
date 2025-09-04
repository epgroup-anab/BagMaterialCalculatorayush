import { VercelRequest, VercelResponse } from '@vercel/node';
import multer from 'multer';
import { parse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { z } from 'zod';
// SKU_DATA import removed for serverless compatibility

import mongoose, { Document, Schema } from 'mongoose';

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
  orders: [{ type: Schema.Types.Mixed, required: true }],
  feasible: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const ServerlessBulkOrder = mongoose.models.ServerlessBulkOrder || mongoose.model<IBulkOrder>('ServerlessBulkOrder', BulkOrderSchema);

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

const storage: ServerlessStorage = process.env.MONGODB_URI || process.env.DATABASE_URL 
  ? new ServerlessMongoStorage() 
  : new ServerlessMemStorage();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
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

// PSL Processing Helper Functions
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
    const cleaned = value.replace(/,/g, '').replace(/\s+/g, '').trim();
    
    if (cleaned === '' || cleaned.toLowerCase().includes('mto')) return null;
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

function cleanStringValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  const str = value.toString().trim();
  if (str === '' || str === '#VALUE!' || str === '#DIV/0!' || str === '#N/A' || str === 'undefined' || str === 'null') {
    return null;
  }
  
  return str;
}

function getBagSpecsFromSAPCode(sapCode: string): any {
  // Specs mapping based on your PSL data (serverless-compatible)
  const commonSpecs: Record<string, any> = {
    "35718": { name: "ALDI", width: 320, gusset: 160, height: 380, gsm: 90, handleType: "FLAT HANDLE", paperGrade: "VIRGIN", cert: "FSC" },
    "35680": { name: "CF BELGIUM", width: 320, gusset: 160, height: 380, gsm: 90, handleType: "FLAT HANDLE", paperGrade: "VIRGIN", cert: "FSC" },
    "35627": { name: "CF FR", width: 320, gusset: 160, height: 380, gsm: 90, handleType: "FLAT HANDLE", paperGrade: "VIRGIN", cert: "FSC" },
    "36784": { name: "BON SENS", width: 350, gusset: 180, height: 400, gsm: 100, handleType: "FLAT HANDLE", paperGrade: "VIRGIN", cert: "FSC" },
    "37394": { name: "BON SENS", width: 350, gusset: 180, height: 400, gsm: 100, handleType: "FLAT HANDLE", paperGrade: "VIRGIN", cert: "FSC" },
    "35778": { name: "Burger King", width: 350, gusset: 180, height: 400, gsm: 100, handleType: "FLAT HANDLE", paperGrade: "VIRGIN", cert: "FSC" },
    "36749": { name: "LA FOURCHE", width: 300, gusset: 150, height: 350, gsm: 80, handleType: "FLAT HANDLE", paperGrade: "RECYCLED", cert: "FSC" },
    "35781": { name: "Kiabi Med", width: 400, gusset: 200, height: 450, gsm: 120, handleType: "TWISTED HANDLE", paperGrade: "VIRGIN", cert: "FSC" },
    "35780": { name: "Kiabi Small", width: 300, gusset: 150, height: 350, gsm: 80, handleType: "TWISTED HANDLE", paperGrade: "VIRGIN", cert: "FSC" },
    "36030": { name: "SPAR", width: 320, gusset: 160, height: 380, gsm: 90, handleType: "FLAT HANDLE", paperGrade: "VIRGIN", cert: "FSC" }
  };
  
  const specs = commonSpecs[sapCode];
  if (specs) {
    return {
      name: specs.name,
      width: specs.width,
      gusset: specs.gusset,
      height: specs.height,
      gsm: specs.gsm,
      handleType: specs.handleType,
      paperGrade: specs.paperGrade,
      cert: specs.cert,
      existingBOM: [],
      boxQty: 250
    };
  }
  
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

function isPSLFormat(data: any[]): boolean {
  if (!data || data.length < 2) return false;
  
  const firstRow = data[0];
  const allKeys = Object.keys(firstRow || {}).join('|').toLowerCase();
  
  const hasSAPCode = allKeys.includes('sap code');
  const hasDesc = allKeys.includes('desc');
  const hasPaper = allKeys.includes('paper');
  const hasMonthlyReq = allKeys.includes('monthly requirement');
  const hasMonthData = allKeys.includes('requirement') && 
                      (allKeys.includes('aug') || allKeys.includes('sept') || allKeys.includes('oct'));
  
  return hasSAPCode && hasDesc && hasPaper && hasMonthlyReq && hasMonthData;
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

function consolidateOrdersByClient(orders: any[]): any[] {
  if (!orders || orders.length === 0) {
    return [];
  }
  
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
      consolidatedOrders.push(groupOrders[0]);
      return;
    }
    
    const firstOrder = groupOrders[0];
    let totalBags = 0;
    let totalCartons = 0;
    const combinedMonthlyBreakdown: any = {};
    
    groupOrders.forEach((order) => {
      if (order.totalBagsRequired) {
        totalBags += order.totalBagsRequired;
      } else if (order.orderUnit === 'bags') {
        totalBags += order.orderQty;
      } else if (order.orderUnit === 'cartons') {
        const bagsPerCarton = order.bagsPerCarton || 1000;
        totalBags += order.orderQty * bagsPerCarton;
        totalCartons += order.orderQty;
      }
      
      if (order.monthlyBreakdown) {
        Object.entries(order.monthlyBreakdown).forEach(([month, bags]) => {
          combinedMonthlyBreakdown[month] = (combinedMonthlyBreakdown[month] || 0) + (bags as number);
        });
      }
    });
    
    const consolidatedOrder = {
      ...firstOrder,
      orderQty: totalBags,
      orderUnit: 'bags',
      totalBagsRequired: totalBags,
      monthlyBreakdown: combinedMonthlyBreakdown,
      consolidatedFrom: groupOrders.length,
      sourceFormat: firstOrder.sourceFormat + '_CONSOLIDATED'
    };
    
    consolidatedOrders.push(consolidatedOrder);
  });
  
  return consolidatedOrders;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    await runMiddleware(req, res, upload.single('file'));
    
    const file = (req as any).file;
    
    if (!file) {
      console.error('No file uploaded in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }


    let parsedData: any[] = [];
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      parsedData = await parseCSV(file.buffer);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      parsedData = await parseExcel(file.buffer);
    } else {
      console.error(`Unsupported file format: ${fileExtension}`);
      return res.status(400).json({ error: 'Unsupported file format' });
    }


    console.log('📊 Parsed data sample before consolidation:', parsedData.slice(0, 2));
    const consolidatedData = consolidateOrdersByClient(parsedData);
    console.log('📊 Consolidated data sample before validation:', consolidatedData.slice(0, 2));
    const validatedOrders = validateOrderData(consolidatedData);
    
    const { results: calculatedOrders, summary } = await processOrdersWithSequentialInventory(validatedOrders);
    
    try {
      const bulkOrder = await storage.insertBulkOrder({
        fileName: file.originalname,
        totalOrders: summary.totalOrders,
        totalCost: summary.totalCost,
        orders: JSON.stringify(calculatedOrders),
        feasible: summary.feasibleOrders,
      });

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
        orders: calculatedOrders.slice(0, 10)
      };

      res.status(200).json(response);
    } catch (dbError) {
      console.error('Database save error:', dbError);
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

// Helper function to clean string values
function cleanStringValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  
  const str = value.toString().trim();
  if (str === '' || str === '#VALUE!' || str === '#DIV/0!' || str === '#N/A' || str === 'undefined' || str === 'null') {
    return null;
  }
  
  return str;
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

function calculateMachineScore(machine: MachineSpec, specs: any, bagQuantity: number, deliveryDays: number, allMachines: MachineSpec[]): number {
  let score = 0;
  
  const productionHours = bagQuantity / machine.capacity;
  const optimalProductionHours = 8;
  
  if (productionHours <= optimalProductionHours) {
    score += 40 * (productionHours / optimalProductionHours);
  } else {
    score += 40 * (optimalProductionHours / productionHours);
  }
  
  const currentTime = new Date();
  const hoursUntilAvailable = Math.max(0, (machine.nextAvailableTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60));
  const avgBusyTime = allMachines.reduce((sum, m) => sum + Math.max(0, (m.nextAvailableTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60)), 0) / allMachines.length;
  
  const utilizationScore = avgBusyTime > 0 ? Math.max(0, 25 * (1 - (hoursUntilAvailable / avgBusyTime))) : 25;
  score += utilizationScore;
  
  const deliveryDeadline = new Date();
  deliveryDeadline.setDate(deliveryDeadline.getDate() + deliveryDays);
  const completionTime = new Date(machine.nextAvailableTime.getTime() + productionHours * 60 * 60 * 1000);
  
  if (completionTime <= deliveryDeadline) {
    const timeBuffer = (deliveryDeadline.getTime() - completionTime.getTime()) / (1000 * 60 * 60 * 24);
    score += 20 * Math.min(1, timeBuffer / 2);
  } else {
    score = 0;
  }
  
  if (specs.handleType === 'TWISTED HANDLE' && machine.id === 'MACHINE_03') {
    score += 10;
  } else if (specs.handleType === 'FLAT HANDLE' && machine.id === 'MACHINE_01') {
    score += 5;
  }
  
  if (bagQuantity > 50000) {
    score += 5 * (machine.capacity / 15000);
  }
  
  return Math.max(0, score);
}

function findAvailableMachine(specs: any, machines: MachineSpec[], deliveryDays: number = 14, bagQuantity: number = 1000): {machine: MachineSpec | null, scheduledEndTime: Date | null} {
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
  
  const machineScores = compatibleMachines.map(machine => ({
    machine,
    score: calculateMachineScore(machine, specs, bagQuantity, deliveryDays, machines)
  }));
  
  const viableMachines = machineScores.filter(item => item.score > 0);
  
  if (viableMachines.length === 0) {
    return { machine: null, scheduledEndTime: null };
  }
  
  viableMachines.sort((a, b) => b.score - a.score);
  
  const selectedMachine = viableMachines[0].machine;
  
  const productionHours = Math.ceil(bagQuantity / selectedMachine.capacity);
  const scheduledEndTime = new Date(selectedMachine.nextAvailableTime.getTime() + productionHours * 60 * 60 * 1000);
  
  
  return { machine: selectedMachine, scheduledEndTime };
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

async function processOrdersWithSequentialInventory(orders: any[]): Promise<{results: any[], summary: any}> {
  
  // Initialize systems
  const runningInventory = await fetchAllInventory();
  const machineFleet = initializeMachineFleet();
  const productionSchedule: MachineSchedule[] = [];
  const results: any[] = [];
  
  let totalProcessedCost = 0;
  let feasibleOrdersCount = 0;
  
  // Process orders sequentially
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const orderIndex = i + 1;
    
    
    try {
      // Calculate BOM for this order
      const orderAnalysis = await calculateOrderAnalysisWithoutInventoryCheck(order);
      
      // Check inventory against running totals
      const inventoryCheck = checkInventoryWithRunningTotal(orderAnalysis.bom, runningInventory);
      
      // Only check machine availability if inventory is feasible
      const machineCheck = inventoryCheck.feasible 
        ? findAvailableMachine(orderAnalysis.specs, machineFleet, order.deliveryDays || 14, orderAnalysis.actualBags)
        : { machine: null, scheduledEndTime: null };
      
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
  const paperWeightPerBag = Math.round(((totalAreaMm2 * paperWeightPerMm2) / 1000) * 1000000) / 1000000;
  
  // Get paper info from material database
  const paperGradeData = MATERIAL_DATABASE.PAPER[specs.paperGrade as keyof typeof MATERIAL_DATABASE.PAPER];
  const gsmStr = specs.gsm.toString();
  const paperInfo = (paperGradeData as any)?.[gsmStr] || (paperGradeData as any)?.["90"];
  
  // Build enhanced BOM
  const bom = [];
  
  // Paper
  if (paperInfo) {
    const totalPaperQuantity = Math.round((paperWeightPerBag * actualBags) * 1000) / 1000;
    bom.push({
      type: 'PAPER',
      sapCode: paperInfo.sapCode,
      description: paperInfo.description,
      quantity: paperWeightPerBag,
      totalQuantity: totalPaperQuantity,
      unit: 'KG',
      unitPrice: materialPrices[paperInfo.sapCode] || 1.2,
      totalCost: Math.round((totalPaperQuantity * (materialPrices[paperInfo.sapCode] || 1.2)) * 100) / 100
    });
  }

  // Cold glue
  const coldGlueQty = 0.0018;
  const totalColdGlueQuantity = Math.round((coldGlueQty * actualBags) * 1000) / 1000;
  bom.push({
    type: 'COLD GLUE',
    sapCode: MATERIAL_DATABASE.GLUE.COLD.sapCode,
    description: MATERIAL_DATABASE.GLUE.COLD.description,
    quantity: coldGlueQty,
    totalQuantity: totalColdGlueQuantity,
    unit: 'KG',
    unitPrice: materialPrices[MATERIAL_DATABASE.GLUE.COLD.sapCode] || 8.5,
    totalCost: Math.round((totalColdGlueQuantity * (materialPrices[MATERIAL_DATABASE.GLUE.COLD.sapCode] || 8.5)) * 100) / 100
  });

  // Handle materials
  if (specs.handleType === 'FLAT HANDLE') {
    const handleWeight = 0.0052;
    const patchWeight = 0.0012;
    const hotGlueQty = 0.0001;
    
    const totalHandleQuantity = Math.round((handleWeight * actualBags) * 1000) / 1000;
    const totalPatchQuantity = Math.round((patchWeight * actualBags) * 1000) / 1000;
    
    bom.push({
      type: 'HANDLE',
      sapCode: MATERIAL_DATABASE.HANDLE.FLAT.sapCode,
      description: MATERIAL_DATABASE.HANDLE.FLAT.description,
      quantity: handleWeight,
      totalQuantity: totalHandleQuantity,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.HANDLE.FLAT.sapCode] || 3.5,
      totalCost: Math.round((totalHandleQuantity * (materialPrices[MATERIAL_DATABASE.HANDLE.FLAT.sapCode] || 3.5)) * 100) / 100
    });
    
    bom.push({
      type: 'PATCH',
      sapCode: MATERIAL_DATABASE.PATCH.FLAT.sapCode,
      description: MATERIAL_DATABASE.PATCH.FLAT.description,
      quantity: patchWeight,
      totalQuantity: totalPatchQuantity,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.PATCH.FLAT.sapCode] || 4.8,
      totalCost: Math.round((totalPatchQuantity * (materialPrices[MATERIAL_DATABASE.PATCH.FLAT.sapCode] || 4.8)) * 100) / 100
    });
    
    const totalHotGlueQuantity = Math.round((hotGlueQty * actualBags) * 1000000) / 1000000;
    bom.push({
      type: 'HOT GLUE',
      sapCode: MATERIAL_DATABASE.GLUE.HOT.sapCode,
      description: MATERIAL_DATABASE.GLUE.HOT.description,
      quantity: hotGlueQty,
      totalQuantity: totalHotGlueQuantity,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.GLUE.HOT.sapCode] || 9.2,
      totalCost: Math.round((totalHotGlueQuantity * (materialPrices[MATERIAL_DATABASE.GLUE.HOT.sapCode] || 9.2)) * 100) / 100
    });
    
  } else if (specs.handleType === 'TWISTED HANDLE') {
    const handleWeight = 0.7665;
    const patchWeight = 0.0036;
    const hotGlueQty = 0.0011;
    
    const totalTwistedHandleQuantity = Math.round((handleWeight * actualBags) * 1000) / 1000;
    const totalTwistedPatchQuantity = Math.round((patchWeight * actualBags) * 1000) / 1000;
    const totalTwistedHotGlueQuantity = Math.round((hotGlueQty * actualBags) * 1000000) / 1000000;
    
    bom.push({
      type: 'HANDLE',
      sapCode: MATERIAL_DATABASE.HANDLE.TWISTED.sapCode,
      description: MATERIAL_DATABASE.HANDLE.TWISTED.description,
      quantity: handleWeight,
      totalQuantity: totalTwistedHandleQuantity,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.HANDLE.TWISTED.sapCode] || 12.5,
      totalCost: Math.round((totalTwistedHandleQuantity * (materialPrices[MATERIAL_DATABASE.HANDLE.TWISTED.sapCode] || 12.5)) * 100) / 100
    });
    
    bom.push({
      type: 'PATCH',
      sapCode: MATERIAL_DATABASE.PATCH.TWISTED.sapCode,
      description: MATERIAL_DATABASE.PATCH.TWISTED.description,
      quantity: patchWeight,
      totalQuantity: totalTwistedPatchQuantity,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.PATCH.TWISTED.sapCode] || 5.2,
      totalCost: Math.round((totalTwistedPatchQuantity * (materialPrices[MATERIAL_DATABASE.PATCH.TWISTED.sapCode] || 5.2)) * 100) / 100
    });
    
    bom.push({
      type: 'HOT GLUE',
      sapCode: MATERIAL_DATABASE.GLUE.HOT.sapCode,
      description: MATERIAL_DATABASE.GLUE.HOT.description,
      quantity: hotGlueQty,
      totalQuantity: totalTwistedHotGlueQuantity,
      unit: 'KG',
      unitPrice: materialPrices[MATERIAL_DATABASE.GLUE.HOT.sapCode] || 9.2,
      totalCost: Math.round((totalTwistedHotGlueQuantity * (materialPrices[MATERIAL_DATABASE.GLUE.HOT.sapCode] || 9.2)) * 100) / 100
    });
  }

  // Carton
  const cartonQty = 0.004;
  const totalCartonQuantity = Math.round((cartonQty * actualBags) * 1000) / 1000;
  bom.push({
    type: 'CARTON',
    sapCode: MATERIAL_DATABASE.CARTON.STANDARD.sapCode,
    description: MATERIAL_DATABASE.CARTON.STANDARD.description,
    quantity: cartonQty,
    totalQuantity: totalCartonQuantity,
    unit: 'PC',
    unitPrice: materialPrices[MATERIAL_DATABASE.CARTON.STANDARD.sapCode] || 0.15,
    totalCost: Math.round((totalCartonQuantity * (materialPrices[MATERIAL_DATABASE.CARTON.STANDARD.sapCode] || 0.15)) * 100) / 100
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