import { User, BulkOrder, type IUser, type IBulkOrder } from "./models";
import "./db"; // Initialize MongoDB connection

// Storage interfaces to match the existing API
export interface StorageUser {
  id: string;
  username: string;
  password: string;
}

export interface StorageBulkOrder {
  id: string;
  fileName: string;
  totalOrders: number;
  totalCost: string;
  orders: string; // JSON string
  feasible: number;
  uploadedAt: Date;
}

export interface InsertUser {
  username: string;
  password: string;
}

export interface InsertBulkOrder {
  fileName: string;
  totalOrders: number;
  totalCost: number;
  orders: string; // JSON string
  feasible: number;
}

// Interface for storage operations
export interface IStorage {
  getUser(id: string): Promise<StorageUser | undefined>;
  getUserByUsername(username: string): Promise<StorageUser | undefined>;
  createUser(user: InsertUser): Promise<StorageUser>;
  insertBulkOrder(bulkOrder: InsertBulkOrder): Promise<StorageBulkOrder>;
  getBulkOrder(id: string): Promise<StorageBulkOrder | undefined>;
  getAllBulkOrders(): Promise<StorageBulkOrder[]>;
}

export class MongoDBStorage implements IStorage {
  async getUser(id: string): Promise<StorageUser | undefined> {
    try {
      const user = await User.findById(id);
      if (!user) return undefined;
      
      return {
        id: user._id.toString(),
        username: user.username,
        password: user.password
      };
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<StorageUser | undefined> {
    try {
      const user = await User.findOne({ username });
      if (!user) return undefined;
      
      return {
        id: user._id.toString(),
        username: user.username,
        password: user.password
      };
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<StorageUser> {
    try {
      const user = new User(insertUser);
      const savedUser = await user.save();
      
      return {
        id: savedUser._id.toString(),
        username: savedUser.username,
        password: savedUser.password
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async insertBulkOrder(insertBulkOrder: InsertBulkOrder): Promise<StorageBulkOrder> {
    try {
      // Parse the JSON string to store as array
      const ordersArray = JSON.parse(insertBulkOrder.orders);
      
      const bulkOrder = new BulkOrder({
        fileName: insertBulkOrder.fileName,
        totalOrders: insertBulkOrder.totalOrders,
        totalCost: insertBulkOrder.totalCost,
        orders: ordersArray, // Store as array
        feasible: insertBulkOrder.feasible
      });
      
      const savedBulkOrder = await bulkOrder.save();
      
      return {
        id: savedBulkOrder._id.toString(),
        fileName: savedBulkOrder.fileName,
        totalOrders: savedBulkOrder.totalOrders,
        totalCost: savedBulkOrder.totalCost.toString(),
        orders: JSON.stringify(savedBulkOrder.orders), // Return as JSON string
        feasible: savedBulkOrder.feasible,
        uploadedAt: savedBulkOrder.uploadedAt
      };
    } catch (error) {
      console.error('Error inserting bulk order:', error);
      throw new Error('Failed to insert bulk order');
    }
  }

  async getBulkOrder(id: string): Promise<StorageBulkOrder | undefined> {
    try {
      const bulkOrder = await BulkOrder.findById(id);
      if (!bulkOrder) return undefined;
      
      return {
        id: bulkOrder._id.toString(),
        fileName: bulkOrder.fileName,
        totalOrders: bulkOrder.totalOrders,
        totalCost: bulkOrder.totalCost.toString(),
        orders: JSON.stringify(bulkOrder.orders), // Convert array to JSON string
        feasible: bulkOrder.feasible,
        uploadedAt: bulkOrder.uploadedAt
      };
    } catch (error) {
      console.error('Error getting bulk order:', error);
      return undefined;
    }
  }

  async getAllBulkOrders(): Promise<StorageBulkOrder[]> {
    try {
      const bulkOrders = await BulkOrder.find({}).sort({ uploadedAt: -1 });
      
      return bulkOrders.map(bulkOrder => ({
        id: bulkOrder._id.toString(),
        fileName: bulkOrder.fileName,
        totalOrders: bulkOrder.totalOrders,
        totalCost: bulkOrder.totalCost.toString(),
        orders: JSON.stringify(bulkOrder.orders), // Convert array to JSON string
        feasible: bulkOrder.feasible,
        uploadedAt: bulkOrder.uploadedAt
      }));
    } catch (error) {
      console.error('Error getting all bulk orders:', error);
      return [];
    }
  }
}

// In-memory storage as fallback (for development/testing)
export class MemStorage implements IStorage {
  private users: Map<string, StorageUser>;
  private bulkOrders: Map<string, StorageBulkOrder>;
  private userIdCounter: number;
  private orderIdCounter: number;

  constructor() {
    this.users = new Map();
    this.bulkOrders = new Map();
    this.userIdCounter = 1;
    this.orderIdCounter = 1;
  }

  async getUser(id: string): Promise<StorageUser | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<StorageUser | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<StorageUser> {
    const id = (this.userIdCounter++).toString();
    const user: StorageUser = {
      id,
      username: insertUser.username,
      password: insertUser.password
    };
    this.users.set(id, user);
    return user;
  }

  async insertBulkOrder(insertBulkOrder: InsertBulkOrder): Promise<StorageBulkOrder> {
    const id = (this.orderIdCounter++).toString();
    const bulkOrder: StorageBulkOrder = {
      id,
      fileName: insertBulkOrder.fileName,
      totalOrders: insertBulkOrder.totalOrders,
      totalCost: insertBulkOrder.totalCost.toString(),
      orders: insertBulkOrder.orders,
      feasible: insertBulkOrder.feasible,
      uploadedAt: new Date()
    };
    this.bulkOrders.set(id, bulkOrder);
    return bulkOrder;
  }

  async getBulkOrder(id: string): Promise<StorageBulkOrder | undefined> {
    return this.bulkOrders.get(id);
  }

  async getAllBulkOrders(): Promise<StorageBulkOrder[]> {
    return Array.from(this.bulkOrders.values()).sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }
}

// Check if MongoDB connection is available
const isMongoDBAvailable = (): boolean => {
  try {
    const mongoose = require('mongoose');
    return mongoose.connection.readyState === 1;
  } catch (error) {
    return false;
  }
};

// Create storage instance - use MongoDB if available, otherwise fall back to in-memory
const createStorage = (): IStorage => {
  // Give MongoDB a moment to try connecting
  setTimeout(() => {
    if (isMongoDBAvailable()) {
      console.log('✅ MongoDB connection established, switching to MongoDB storage');
    } else {
      console.log('⚠️  MongoDB not available, using In-Memory storage');
    }
  }, 2000);
  
  try {
    // Try to create MongoDB storage first
    return new MongoDBStorage();
  } catch (error) {
    console.log('⚠️  MongoDB not available, using In-Memory storage');
    return new MemStorage();
  }
};

// Export storage instance
export const storage = createStorage();
