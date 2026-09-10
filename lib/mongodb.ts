import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const globalMongo = globalThis as typeof globalThis & { mongoPromise?: Promise<typeof mongoose> };
export async function connectMongo(){if(!uri)throw new Error('MongoDB is not configured.');globalMongo.mongoPromise??=mongoose.connect(uri,{maxPoolSize:10,serverSelectionTimeoutMS:5000}).catch(error=>{globalMongo.mongoPromise=undefined;throw error;});return globalMongo.mongoPromise;}
