import { VercelRequest, VercelResponse } from '@vercel/node';
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
class ServerlessStorage {
  async getBulkOrder(id: string) {
    await connectToDatabase();
    
    const bulkOrder = await ServerlessBulkOrder.findById(id);
    if (!bulkOrder) return null;
    
    return {
      id: bulkOrder._id.toString(),
      fileName: bulkOrder.fileName,
      totalOrders: bulkOrder.totalOrders,
      totalCost: bulkOrder.totalCost.toString(),
      orders: bulkOrder.orders, // Return as array, not JSON string
      feasible: bulkOrder.feasible,
      uploadedAt: bulkOrder.uploadedAt
    };
  }
}

const storage = new ServerlessStorage();

// Helper function to fetch current inventory from Quickbase
async function fetchCurrentInventory(): Promise<Map<string, number>> {
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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Shorter timeout for serverless

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
  const currentInventory = await fetchCurrentInventory();

  // Ensure data consistency - convert string values to numbers if needed
  const processedBulkOrder = {
    ...bulkOrder,
    totalOrders: typeof bulkOrder.totalOrders === 'string' ? parseInt(bulkOrder.totalOrders) : bulkOrder.totalOrders,
    feasible: typeof bulkOrder.feasible === 'string' ? parseInt(bulkOrder.feasible) : bulkOrder.feasible,
    totalCost: typeof bulkOrder.totalCost === 'string' ? parseFloat(bulkOrder.totalCost) : bulkOrder.totalCost
  };
  
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
            <p class="header-info"><strong>Total Orders:</strong> ${processedBulkOrder.totalOrders}</p>
            <p class="header-info"><strong>Feasible Orders:</strong> ${processedBulkOrder.feasible}</p>
            <p class="header-info"><strong>Total Cost:</strong> €${processedBulkOrder.totalCost?.toFixed(2) || '0.00'}</p>
        
        <h2>Order Overview</h2>
        <table>
            <thead>
                <tr>
                    <th>Order</th>
                    <th>Bag Name</th>
                    <th>Dimensions (mm)</th>
                    <th>Quantity</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${orders.slice(0, 50).map((order: any, index: number) => `
                    <tr>
                        <td>
                            <span class="order-number">#${order.processingOrder || index + 1}</span>
                        </td>
                        <td><strong>${order.bagName || 'Custom Bag'}</strong></td>
                        <td>${order.specs ? `${order.specs.width}×${order.specs.gusset}×${order.specs.height}` : 'N/A'}</td>
                        <td>${order.actualBags?.toLocaleString() || (order.orderUnit === 'cartons' ? (order.orderQty * 250).toLocaleString() : order.orderQty)} bags</td>
                        <td class="cost">€${(order.totalCost || 0).toFixed(2)}</td>
                        <td class="${order.feasible ? 'status-feasible' : 'status-not-feasible'}">
                            ${order.feasible ? 'Feasible' : 'Not Feasible'}
                        </td>
                    </tr>
                `).join('')}
                ${orders.length > 50 ? `<tr><td colspan="6" style="text-align: center; font-style: italic; color: hsl(215.4 16.3% 46.9%);">... and ${orders.length - 50} more orders</td></tr>` : ''}
            </tbody>
        </table>
        
        <div class="footer">
            Report generated by Bag Material Calculator System on ${new Date().toLocaleString()}<br>
            <small>Showing first 50 orders. For complete report, contact system administrator.</small>
        </div>
        </div>
    </body>
    </html>
  `;
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid bulk order ID' });
    }

    console.log(`Generating HTML report for bulk order ID: ${id}`);

    const bulkOrder = await storage.getBulkOrder(id);
    
    if (!bulkOrder) {
      return res.status(404).json({ error: 'Bulk order not found' });
    }

    console.log('Bulk order found, generating HTML report...');
    const html = await generateHTMLReport(bulkOrder);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(html);

  } catch (error: unknown) {
    console.error('HTML export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate HTML report';
    
    // Return HTML error page instead of JSON for better user experience
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Error - Bulk Order Report</title>
          <style>
              body { font-family: system-ui, sans-serif; padding: 40px; background: #f5f5f5; }
              .error { background: white; padding: 24px; border-radius: 8px; border: 1px solid #e5e5e5; }
              .error h1 { color: #dc2626; margin: 0 0 16px 0; }
              .error p { color: #666; margin: 0; }
          </style>
      </head>
      <body>
          <div class="error">
              <h1>Error Loading Report</h1>
              <p>${errorMessage}</p>
          </div>
      </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(errorHtml);
  }
}