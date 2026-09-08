import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
const globalMongo = globalThis as typeof globalThis & { mongoPromise?: Promise<typeof mongoose> };
export async function connectMongo(){if(!uri)throw new Error('MongoDB is not configured.');globalMongo.mongoPromise??=mongoose.connect(uri,{maxPoolSize:10});return globalMongo.mongoPromise;}
