import { VercelRequest, VercelResponse } from '@vercel/node';
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
      orders: bulkOrder.orders,
      feasible: bulkOrder.feasible,
      uploadedAt: bulkOrder.uploadedAt
    };
  }
}

const storage = new ServerlessStorage();

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
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://api.quickbase.com/v1/records/query`, {
      method: 'POST',
      headers: {
        'QB-Realm-Hostname': QB_REALM_HOSTNAME,
        'Authorization': `QB-USER-TOKEN ${QB_USER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: QB_TABLE_ID,
        select: [6, 13],
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
  const orders = Array.isArray(bulkOrder.orders) 
    ? bulkOrder.orders 
    : typeof bulkOrder.orders === 'string' 
      ? JSON.parse(bulkOrder.orders) 
      : [];

  const currentInventory = await fetchCurrentInventory();
  const totalOrders = parseInt(bulkOrder.totalOrders) || 0;
  const feasible = parseInt(bulkOrder.feasible) || 0;
  // const totalCost = parseFloat(bulkOrder.totalCost) || 0;
  const successRate = totalOrders > 0 ? ((feasible / totalOrders) * 100).toFixed(3) : '0.000';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Bulk Order Report - ${bulkOrder.fileName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* Clean, modern styling matching main application */
            :root {
                --background: hsl(0 0% 100%);
                --foreground: hsl(222.2 84% 4.9%);
                --card: hsl(0 0% 100%);
                --card-foreground: hsl(222.2 84% 4.9%);
                --primary: hsl(221.2 83.2% 53.3%);
                --primary-foreground: hsl(210 40% 98%);
                --muted: hsl(210 40% 96%);
                --muted-foreground: hsl(215.4 16.3% 46.9%);
                --border: hsl(214.3 31.8% 91.4%);
                --success: hsl(142.1 76.2% 36.3%);
                --destructive: hsl(0 84.2% 60.2%);
                --warning: hsl(48 96% 53%);
            }
            
            * {
                box-sizing: border-box;
            }
            
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
                margin: 0;
                padding: 24px; 
                background: var(--muted);
                color: var(--foreground); 
                line-height: 1.5;
                min-height: 100vh;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: var(--background);
                border-radius: 8px;
                border: 1px solid var(--border);
                overflow: hidden;
            }
            
            .header {
                background: var(--background);
                text-align: center;
                padding: 32px 24px;
                border-bottom: 1px solid var(--border);
            }
            
            .header h1 { 
                color: var(--foreground); 
                font-size: 28px;
                font-weight: 600;
                margin: 0 0 8px 0; 
            }
            
            .header-info {
                color: var(--muted-foreground);
                font-size: 14px;
                margin: 4px 0;
            }
            
            .content {
                padding: 24px;
            }
            
            h2 { 
                color: var(--foreground); 
                font-size: 20px; 
                font-weight: 600;
                margin: 32px 0 16px 0; 
                padding-bottom: 8px;
                border-bottom: 1px solid var(--border);
            }
            
            h3 { 
                color: var(--foreground); 
                font-size: 16px; 
                font-weight: 600;
                margin: 24px 0 12px 0; 
            }
            
            .executive-summary {
                background: var(--muted);
                border-radius: 8px;
                padding: 24px;
                margin: 20px 0;
                border: 1px solid var(--border);
            }
            
            .summary-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-top: 16px;
            }
            
            .summary-item {
                text-align: center;
                background: var(--background);
                border-radius: 6px;
                padding: 20px 16px;
                border: 1px solid var(--border);
            }
            
            .summary-number {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 8px;
                color: var(--foreground);
            }
            
            .summary-label {
                font-size: 12px;
                font-weight: 500;
                color: var(--muted-foreground);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .success-rate { color: var(--success); }
            .total-orders { color: var(--foreground); }
            .feasible-orders { color: var(--warning); }
            
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 24px;
                border: 1px solid var(--border);
                border-radius: 8px;
                overflow: hidden;
                background: var(--background);
            }
            
            th, td { 
                padding: 12px 16px; 
                text-align: left; 
                border-bottom: 1px solid var(--border); 
            }
            
            th { 
                background: var(--muted);
                font-weight: 600; 
                color: var(--foreground);
                font-size: 12px;
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
                color: var(--success); 
                font-weight: 600; 
            }
            
            .status-not-feasible { 
                color: var(--destructive); 
                font-weight: 600; 
            }
            
            .order-number { 
                background: var(--foreground);
                color: var(--background); 
                padding: 4px 8px; 
                border-radius: 4px; 
                font-size: 11px; 
                font-weight: 600;
                margin-right: 8px; 
            }
            
            
            .machine-assignment { 
                background: hsl(221.2 83.2% 97%);
                border: 1px solid hsl(221.2 83.2% 85%);
                color: var(--primary);
                padding: 6px 10px; 
                margin: 6px 0; 
                border-radius: 4px; 
                font-size: 12px; 
                font-weight: 500;
            }
            
            .order-box { 
                border: 1px solid var(--border);
                margin-bottom: 24px; 
                background: var(--background); 
                border-radius: 8px;
                overflow: hidden;
            }
            
            .order-title { 
                background: var(--muted);
                padding: 16px 20px; 
                margin: 0; 
                font-size: 16px; 
                font-weight: 600; 
                color: var(--foreground);
                border-bottom: 1px solid var(--border);
            }
            
            .order-body { 
                padding: 20px; 
            }
            
            .specs { 
                background: hsl(210 40% 98%);
                border: 1px solid var(--border);
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
                color: var(--muted-foreground);
                margin-right: 4px;
            }
            
            .spec-value {
                color: var(--foreground);
            }
            
            .materials-table { 
                margin-top: 16px; 
                font-size: 14px; 
            }
            
            .warning { 
                background: hsl(48 96% 95%);
                border: 1px solid hsl(48 96% 85%);
                color: hsl(25 95% 35%);
                padding: 12px 16px; 
                margin: 16px 0; 
                border-radius: 6px; 
                font-size: 14px;
            }
            
            .footer {
                margin-top: 40px; 
                padding: 16px 24px; 
                background: var(--muted);
                text-align: center; 
                color: var(--muted-foreground); 
                font-size: 12px;
                border-top: 1px solid var(--border);
            }
            
            /* Print styles */
            @media print {
                body { 
                    padding: 0; 
                    background: white; 
                }
                .container { 
                    border: none; 
                    box-shadow: none; 
                }
                .header { 
                    background: white; 
                }
                tr:hover { 
                    background: none; 
                }
            }
            
            /* Responsive styles */
            @media (max-width: 768px) {
                body { 
                    padding: 16px; 
                }
                .content { 
                    padding: 16px; 
                }
                .header { 
                    padding: 24px 16px; 
                }
                .summary-grid {
                    grid-template-columns: 1fr 1fr;
                }
                th, td { 
                    padding: 8px 12px; 
                }
                .spec-row { 
                    display: block; 
                    margin-bottom: 8px; 
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="header-content">
                    <h1>📦 Bulk Order Analysis Report</h1>
                    <p class="header-info"><strong>File:</strong> ${bulkOrder.fileName}</p>
                    <p class="header-info"><strong>Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
                </div>
            </div>
            
            <div class="content">
                <div class="executive-summary">
                    <h2 style="margin-top: 0; border: none; padding: 0;">📊 Executive Summary</h2>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <div class="summary-number total-orders">${totalOrders}</div>
                            <div class="summary-label">Total Orders</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-number feasible-orders">${feasible}</div>
                            <div class="summary-label">Feasible Orders</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-number success-rate">${successRate}%</div>
                            <div class="summary-label">Success Rate</div>
                        </div>
                    </div>
                </div>

                <h2>🔍 Order Overview</h2>
        <table>
            <thead>
                <tr>
                    <th>Order</th>
                    <th>Bag Name</th>
                    <th>SAP Code</th>
                    <th>Dimensions (mm)</th>
                    <th>Quantity</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map((order: any, index: number) => `
                    <tr>
                        <td>
                            <span class="order-number">#${order.processingOrder || index + 1}</span>
                        </td>
                        <td><strong>${order.bagName || 'Custom Bag'}</strong></td>
                        <td>${order.originalSAPCode || order.sku || '-'}</td>
                        <td>${order.specs ? `${order.specs.width}×${order.specs.gusset}×${order.specs.height}${order.rollWidth ? ` (Roll: ${order.rollWidth}mm)` : ''}` : 'N/A'}</td>
                        <td>${(() => {
                            const bags = order.actualBags || (order.orderUnit === 'cartons' ? order.orderQty * 250 : order.orderQty);
                            return bags?.toLocaleString() || 0;
                        })()} bags</td>
                        <td class="${order.feasible ? 'status-feasible' : 'status-not-feasible'}">
                            ${order.feasible ? 'Feasible' : 'Not Feasible'}
                            ${order.assignedMachine ? `<div class="machine-assignment">Machine: ${order.assignedMachine}</div>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <h2>🔧 Combined Materials Requirements</h2>
        ${(() => {
            const materialRequirements = new Map();
            let totalOrdersWithBOM = 0;
            
            orders.forEach((order, index) => {
                if (order.bom?.length) {
                    totalOrdersWithBOM++;
                    order.bom.forEach(item => {
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
            });
            
            if (materialRequirements.size === 0) {
                return '<p>No material requirements found in orders.</p>';
            }
            
            const materials = Array.from(materialRequirements.values()).sort((a, b) => {
                const aShortage = Math.max(0, a.totalRequired - a.availableStock);
                const bShortage = Math.max(0, b.totalRequired - b.availableStock);
                const aPercent = a.totalRequired ? aShortage / a.totalRequired : 0;
                const bPercent = b.totalRequired ? bShortage / b.totalRequired : 0;
                
                return bPercent !== aPercent ? bPercent - aPercent : 
                       a.type.localeCompare(b.type) || a.description.localeCompare(b.description);
            });
                
                return `
                    <div class="summary" style="margin-bottom: 24px;">
                        <p><strong>Analysis:</strong> ${totalOrdersWithBOM} of ${orders.length} orders have detailed material requirements.</p>
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
                                        <td>${material.totalRequired.toFixed(3)}</td>
                                        <td>${material.unit}</td>
                                        <td>${material.availableStock.toFixed(3)}</td>
                                        <td class="${hasShortage ? 'status-not-feasible' : 'status-feasible'}">
                                            ${hasShortage ? `${shortage.toFixed(3)} (${shortagePercentage.toFixed(3)}%)` : '0.000 (0.000%)'}
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
                `;
        })()}

        ${orders.map((order: any, index: number) => `
            <div class="order-box">
                <div class="order-title">
                    📋 Order #${order.processingOrder || index + 1}: ${order.bagName || 'Custom Bag'}
                    ${order.assignedMachine ? ` - 🏭 Assigned to: ${order.assignedMachine}` : ''}
                </div>
                
                <div class="order-body">
                    ${order.specs ? `
                        <div class="specs">
                            <strong>Specifications:</strong><br>
                            <div class="spec-row">
                                <span class="spec-label">Dimensions:</span> 
                                <span class="spec-value">${order.specs.width} × ${order.specs.gusset} × ${order.specs.height} mm${order.rollWidth ? ` | Roll Width: ${order.rollWidth}mm` : ''}</span>
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
                                <span class="spec-value">${(() => {
                                    const bags = order.actualBags || (order.orderUnit === 'cartons' ? order.orderQty * 250 : order.orderQty) || 0;
                                    const cartonsText = order.orderUnit === 'cartons' ? ` (${order.orderQty} cartons)` : '';
                                    return `${bags.toLocaleString()} bags${cartonsText}`;
                                })()}</span>
                            </div>
                        </div>
                    ` : ''}
                    
                    ${order.bom && order.bom.length > 0 ? `
                        <h3>📋 Bill of Materials</h3>
                        <table class="materials-table">
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th>SAP Code</th>
                                    <th>Description</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
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
                        <h3>🔧 Materials Consumed by This Order</h3>
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
                                        <td>${material.consumed?.toFixed(3) || 'N/A'}</td>
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
        </div>
    </body>
    </html>
  `;
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