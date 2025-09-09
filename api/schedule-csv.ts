import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple CSV Row interface
interface CSVRow {
  DATE: string;
  SHIFTS: string;
  'MC GM-1': string;
  'MC GM-2': string;
  'MC GM-3': string;
  'MC GM-4': string;
  'MC GM-5': string;
  'MC GM-6': string;
  'MC NL-1': string;
  'MC NL-2': string;
  'Upcoming.': string;
}

// Machine mapping from CSV columns to display names
const MACHINE_MAPPING: Record<string, string> = {
  'MC GM-1': 'GM-1',
  'MC GM-2': 'GM-2', 
  'MC GM-3': 'GM-3',
  'MC GM-4': 'GM-4',
  'MC GM-5': 'GM-5',
  'MC GM-6': 'GM-6',
  'MC NL-1': 'NL-1',
  'MC NL-2': 'NL-2'
};

// Parse date from CSV format "DD, DayName, MMM YYYY"
function parseCSVDate(dateStr: string): Date | null {
  try {
    // Remove quotes and parse "03, Monday, Feb 2025" format
    const cleanDateStr = dateStr.replace(/"/g, '').trim();
    const parts = cleanDateStr.split(', ');
    
    if (parts.length >= 3) {
      const day = parseInt(parts[0]);
      const monthYear = parts[2]; // "Feb 2025"
      const [monthStr, year] = monthYear.split(' ');
      
      const monthMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const month = monthMap[monthStr];
      if (month !== undefined && !isNaN(day) && year) {
        return new Date(parseInt(year), month, day);
      }
    }
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
  }
  
  return null;
}

// Simple CSV parsing function
function parseCSVContent(csvContent: string): any[] {
  try {
    // Remove BOM if present
    let content = csvContent.replace(/^\uFEFF/, '');
    
    // Split into lines and filter out empty ones
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV has no data rows');
    }
    
    // Parse header
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim());
    console.log('📋 CSV Headers:', headers);
    
    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      // Simple CSV parsing - handle quoted values
      const values = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      
      // Add the last value
      values.push(currentValue.trim());
      
      // Create row object
      const row: any = {};
      for (let k = 0; k < headers.length && k < values.length; k++) {
        row[headers[k]] = values[k];
      }
      
      rows.push(row);
    }
    
    console.log(`✅ Parsed ${rows.length} CSV rows`);
    return rows;
    
  } catch (error) {
    console.error('❌ CSV parsing error:', error);
    throw error;
  }
}

// Transform CSV data to calendar format
function transformToCalendarData(csvRows: any[]): any {
  const calendarData: any = {};
  
  csvRows.forEach((row, index) => {
    const dateStr = row.DATE;
    const shift = row.SHIFTS;
    
    if (!dateStr || !shift) {
      console.log(`⚠️ Skipping row ${index}: missing date or shift`);
      return;
    }
    
    const date = parseCSVDate(dateStr);
    if (!date) {
      console.log(`⚠️ Skipping row ${index}: invalid date ${dateStr}`);
      return;
    }
    
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Initialize date entry if needed
    if (!calendarData[dateKey]) {
      calendarData[dateKey] = {
        date: date,
        dateString: date.toDateString(),
        shifts: {}
      };
    }
    
    // Initialize shift if needed
    if (!calendarData[dateKey].shifts[shift]) {
      calendarData[dateKey].shifts[shift] = {};
    }
    
    // Add machine data for this shift
    Object.entries(MACHINE_MAPPING).forEach(([csvColumn, machineId]) => {
      const productCode = row[csvColumn];
      calendarData[dateKey].shifts[shift][machineId] = {
        productCode: productCode || 'NO PLANNING',
        isPlanned: productCode && productCode !== 'NO PLANNING' && productCode !== 'NO JOBS'
      };
    });
  });
  
  console.log(`📅 Created calendar data for ${Object.keys(calendarData).length} days`);
  return calendarData;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // In Vercel, try multiple strategies to find the CSV file
    let csvContent = '';
    let csvPath = '';
    
    // Strategy 1: Try common Vercel paths
    const vercelPaths = [
      // Vercel's typical build paths
      '/var/task/machine_timeplan.csv',
      path.join(process.cwd(), 'machine_timeplan.csv'),
      path.join(process.cwd(), '..', 'machine_timeplan.csv'),
      path.join(__dirname, 'machine_timeplan.csv'),
      path.join(__dirname, '..', 'machine_timeplan.csv'),
      path.join(__dirname, '..', '..', 'machine_timeplan.csv'),
    ];
    
    console.log('🔍 Environment:', process.env.VERCEL ? 'Vercel' : 'Local');
    console.log('🔍 Process CWD:', process.cwd());
    console.log('🔍 __dirname:', __dirname);
    
    for (const possiblePath of vercelPaths) {
      try {
        if (fs.existsSync(possiblePath)) {
          csvContent = fs.readFileSync(possiblePath, 'utf-8');
          csvPath = possiblePath;
          console.log(`✅ Found CSV at: ${csvPath}`);
          break;
        }
      } catch (err) {
        // Continue silently to next path
        continue;
      }
    }
    
    // Strategy 2: If not found, try to read from current directory listing
    if (!csvContent) {
      try {
        const currentDirFiles = fs.readdirSync(process.cwd());
        console.log('📁 Files in current directory:', currentDirFiles);
        
        // Look for any CSV file that might be the machine timeplan
        const csvFiles = currentDirFiles.filter(f => f.includes('machine') && f.endsWith('.csv'));
        if (csvFiles.length > 0) {
          const foundCsvPath = path.join(process.cwd(), csvFiles[0]);
          csvContent = fs.readFileSync(foundCsvPath, 'utf-8');
          csvPath = foundCsvPath;
          console.log(`✅ Found CSV by search: ${csvPath}`);
        }
      } catch (err) {
        console.log('❌ Directory search failed:', err);
      }
    }
    
    if (!csvContent) {
      throw new Error(`CSV file not found. Searched paths: ${vercelPaths.join(', ')}`);
    }
    
    console.log(`📊 CSV file size: ${csvContent.length} characters`);
    
    // Parse CSV content
    const csvRows = parseCSVContent(csvContent);
    
    if (csvRows.length === 0) {
      throw new Error('No data rows found in CSV');
    }
    
    // Transform to calendar format
    const calendarData = transformToCalendarData(csvRows);
    
    return res.status(200).json({
      success: true,
      data: calendarData,
      summary: {
        totalDays: Object.keys(calendarData).length,
        totalRows: csvRows.length,
        machines: Object.values(MACHINE_MAPPING),
        csvPath: csvPath
      }
    });

  } catch (error) {
    console.error('❌ Schedule API error:', error);
    
    // Only include debug info in development
    const isDevelopment = !process.env.VERCEL;
    
    return res.status(500).json({ 
      error: 'Failed to load schedule data',
      message: error instanceof Error ? error.message : 'Unknown error',
      ...(isDevelopment && {
        debug: {
          stack: error instanceof Error ? error.stack : 'No stack trace',
          cwd: process.cwd(),
          dirname: __dirname,
          env: process.env.NODE_ENV
        }
      })
    });
  }
}