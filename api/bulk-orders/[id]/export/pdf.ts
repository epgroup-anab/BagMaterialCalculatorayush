import { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose, { Document, Schema } from 'mongoose';
import puppeteer from 'puppeteer';

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
      orders: bulkOrder.orders, // Return as array
      feasible: bulkOrder.feasible,
      uploadedAt: bulkOrder.uploadedAt
    };
  }
}

const storage = new ServerlessStorage();

async function generateHTMLForPDF(bulkOrder: any): Promise<string> {
  let orders: any[] = [];
  
  // Safely parse orders data
  try {
    if (typeof bulkOrder.orders === 'string') {
      orders = JSON.parse(bulkOrder.orders);
    } else if (Array.isArray(bulkOrder.orders)) {
      orders = bulkOrder.orders;
    } else {
      orders = [];
    }
  } catch (error) {
    orders = [];
  }

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
        <meta charset="utf-8">
        <style>
            body { 
                font-family: 'Arial', sans-serif; 
                margin: 0;
                padding: 20px; 
                font-size: 12px;
                line-height: 1.4;
            }
            .container {
                max-width: 100%;
            }
            h1 { 
                font-size: 20px;
                margin-bottom: 10px; 
            }
            h2 { 
                font-size: 16px; 
                margin: 20px 0 10px 0; 
                border-bottom: 1px solid #ccc;
                padding-bottom: 5px;
            }
            .header-info {
                margin-bottom: 3px;
                font-size: 11px;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 20px;
                font-size: 10px;
            }
            th, td { 
                padding: 6px; 
                text-align: left; 
                border: 1px solid #ddd; 
            }
            th { 
                background: #f5f5f5;
                font-weight: bold; 
                font-size: 9px;
            }
            .status-feasible { 
                color: #16a34a; 
                font-weight: bold; 
            }
            .status-not-feasible { 
                color: #dc2626; 
                font-weight: bold; 
            }
            .order-number { 
                background: #000;
                color: white; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-size: 9px; 
                font-weight: bold;
            }
            .cost { 
                font-weight: bold; 
            }
            .footer {
                margin-top: 20px; 
                padding: 10px; 
                background: #f5f5f5;
                text-align: center; 
                font-size: 10px;
                border-radius: 4px;
            }
            @page {
                margin: 1cm;
                size: A4;
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
        
        <h2>Order Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Bag Name</th>
                    <th>Dimensions</th>
                    <th>Quantity</th>
                    <th>Cost</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${orders.slice(0, 100).map((order: any, index: number) => `
                    <tr>
                        <td><span class="order-number">${order.processingOrder || index + 1}</span></td>
                        <td>${order.bagName || 'Custom Bag'}</td>
                        <td>${order.specs ? `${order.specs.width}×${order.specs.gusset}×${order.specs.height}mm` : 'N/A'}</td>
                        <td>${order.actualBags?.toLocaleString() || (order.orderUnit === 'cartons' ? (order.orderQty * 250).toLocaleString() : order.orderQty)} bags</td>
                        <td class="cost">€${(order.totalCost || 0).toFixed(2)}</td>
                        <td class="${order.feasible ? 'status-feasible' : 'status-not-feasible'}">
                            ${order.feasible ? 'Feasible' : 'Not Feasible'}
                        </td>
                    </tr>
                `).join('')}
                ${orders.length > 100 ? `<tr><td colspan="6" style="text-align: center; font-style: italic;">... and ${orders.length - 100} more orders (truncated for PDF)</td></tr>` : ''}
            </tbody>
        </table>
        
        <div class="footer">
            Report generated by Bag Material Calculator System on ${new Date().toLocaleString()}<br>
            <small>PDF Export - Contact system administrator for detailed analysis</small>
        </div>
        </div>
    </body>
    </html>
  `;
}

async function generatePDF(html: string): Promise<Buffer> {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '15px', right: '15px' }
    });
    
    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
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

    console.log(`Generating PDF report for bulk order ID: ${id}`);

    const bulkOrder = await storage.getBulkOrder(id);
    
    if (!bulkOrder) {
      return res.status(404).json({ error: 'Bulk order not found' });
    }

    console.log('Bulk order found, generating PDF report...');
    const html = await generateHTMLForPDF(bulkOrder);
    const pdf = await generatePDF(html);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bulk-order-${bulkOrder.id}.pdf"`);
    res.status(200).send(pdf);

  } catch (error: unknown) {
    console.error('PDF export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to export PDF';
    res.status(500).json({ error: errorMessage });
  }
}