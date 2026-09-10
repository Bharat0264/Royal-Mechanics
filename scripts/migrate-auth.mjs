import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGODB_URI||process.env.MONGO_URI);
try{const users=mongoose.connection.collection('users');const indexes=await users.indexes();const index=indexes.find(i=>i.key.googleSubject===1);if(index&&!index.sparse)await users.dropIndex(index.name);await users.createIndex({googleSubject:1},{unique:true,sparse:true});console.log('Google subject sparse index is ready.');}finally{await mongoose.disconnect();}
