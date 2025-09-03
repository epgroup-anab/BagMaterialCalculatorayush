import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/bagcalculator';
    console.log('🔄 Connecting to MongoDB...');
    console.log('📍 MONGODB_URI from env:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      maxPoolSize: 10,
    });
    console.log('✅ MongoDB connected successfully');
    
  } catch (error) {
    console.log('❌ MongoDB connection failed:', error.message);
    console.log('⚠️  Using In-Memory storage');
  }
};

connectDB();

export { mongoose };
export default connectDB;