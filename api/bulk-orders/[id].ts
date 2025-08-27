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
      orders: JSON.stringify(bulkOrder.orders),
      feasible: bulkOrder.feasible,
      uploadedAt: bulkOrder.uploadedAt
    };
  }
}

const storage = new ServerlessStorage();

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

    const bulkOrder = await storage.getBulkOrder(id);
    
    if (!bulkOrder) {
      return res.status(404).json({ error: 'Bulk order not found' });
    }

    res.status(200).json(bulkOrder);

  } catch (error: unknown) {
    console.error('Get bulk order error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get bulk order';
    res.status(500).json({ error: errorMessage });
  }
}