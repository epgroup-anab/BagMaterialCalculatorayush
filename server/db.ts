import mongoose from 'mongoose';

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/bagcalculator';
    
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    // Don't exit process, allow fallback to in-memory storage
  }
};

// Initialize connection
connectDB();

export { mongoose };
export default connectDB;