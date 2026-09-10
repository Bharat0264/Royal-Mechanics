import mongoose from 'mongoose';
const email=process.argv[2]?.trim().toLowerCase();
if(!email||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Usage: node --env-file=.env.local scripts/promote-admin.mjs owner@example.com');
await mongoose.connect(process.env.MONGODB_URI||process.env.MONGO_URI);
try{const result=await mongoose.connection.collection('users').updateOne({email,isAllowed:true},{$set:{role:'ADMIN'}});if(!result.matchedCount)throw new Error('Create the account first.');console.log(`Administrator access granted to ${email}.`);}finally{await mongoose.disconnect();}
