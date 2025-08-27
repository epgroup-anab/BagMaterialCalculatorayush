import mongoose, { Document, Schema } from 'mongoose';

// User interface and model
export interface IUser extends Document {
  _id: string;
  username: string;
  password: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// BulkOrder interface and model
export interface IBulkOrder extends Document {
  _id: string;
  fileName: string;
  totalOrders: number;
  totalCost: number;
  orders: any[]; // JSON array of calculated orders
  feasible: number;
  uploadedAt: Date;
}

const BulkOrderSchema = new Schema<IBulkOrder>({
  fileName: {
    type: String,
    required: true
  },
  totalOrders: {
    type: Number,
    required: true
  },
  totalCost: {
    type: Number,
    required: true
  },
  orders: {
    type: Schema.Types.Mixed, // Store as array of objects
    required: true
  },
  feasible: {
    type: Number,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better query performance
UserSchema.index({ username: 1 });
BulkOrderSchema.index({ uploadedAt: -1 });
BulkOrderSchema.index({ fileName: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
export const BulkOrder = mongoose.model<IBulkOrder>('BulkOrder', BulkOrderSchema);