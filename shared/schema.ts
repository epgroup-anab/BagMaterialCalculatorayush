import { z } from "zod";

// User schemas - compatible with MongoDB
export const insertUserSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1),
});

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
});

// Bulk order schemas - compatible with MongoDB
export const insertBulkOrderSchema = z.object({
  fileName: z.string().min(1),
  totalOrders: z.number().int().positive(),
  totalCost: z.number().positive(),
  orders: z.string(), // JSON string
  feasible: z.number().int().min(0),
});

export const bulkOrderSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  totalOrders: z.number().int(),
  totalCost: z.string(), // Stored as string for consistency
  orders: z.string(), // JSON string
  feasible: z.number().int(),
  uploadedAt: z.date(),
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof userSchema>;
export type InsertBulkOrder = z.infer<typeof insertBulkOrderSchema>;
export type BulkOrder = z.infer<typeof bulkOrderSchema>;

// Legacy exports for PostgreSQL compatibility (if needed)
export const users = null; // Placeholder - not used with MongoDB
export const bulkOrders = null; // Placeholder - not used with MongoDB
