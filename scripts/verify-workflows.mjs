import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import mongoose from 'mongoose';

const base=process.env.TEST_URL||'http://localhost:3000';
const uri=process.env.MONGODB_URI||process.env.MONGO_URI;
if(!uri?.startsWith('mongodb://127.0.0.1:27018/'))throw new Error('This check is restricted to the local development database.');
await mongoose.connect(uri);
const db=mongoose.connection;
const suffix=Date.now();const email=`verification-${suffix}@example.test`;const staffEmail=`mechanic-${suffix}@example.test`;
let customerId;let staffId;let bookingId;let serviceId;let reviewId;
async function call(path,body,cookie,method='POST') {const response=await fetch(base+path,{method,redirect:'manual',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),Origin:base},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json().catch(()=>({}));return {response,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
try{
  assert.equal((await call('/api/admin',null,null,'GET')).response.status,403);
  assert.equal((await fetch(base+'/admin',{redirect:'manual'})).status,307);
  const signup=await call('/api/auth/signup',{name:'Verification Rider',email,phone:'9876543210',password:'TestingRoyal123!',terms:true,role:'ADMIN'});
  assert.equal(signup.response.status,200,JSON.stringify(signup.data));assert.equal(signup.data.redirect,'/');assert.ok(signup.response.headers.get('set-cookie').includes('HttpOnly'));
  let cookie=signup.cookie;const user=await db.collection('users').findOne({email});customerId=user._id;assert.equal(user.role,'CUSTOMER');assert.ok(user.passwordHash&&!user.passwordHash.includes('TestingRoyal123!'));
  assert.equal((await call('/api/admin',null,cookie,'GET')).response.status,403);
  assert.equal((await call('/api/admin',{section:'services',data:{name:'bad',price:1}},cookie)).response.status,403);
  assert.equal((await call('/api/auth/signup',{name:'Verification Rider',email,phone:'9876543210',password:'TestingRoyal123!',terms:true})).response.status,409);
  assert.equal((await call('/api/auth/login',{email,password:'wrong'})).response.status,401);
  const booking=await call('/api/service-requests',{vehicleName:'Verification bike',serviceCategory:'General Service',serviceMode:'SELF_DROP',preferredSlot:'2026-10-01T10:00'},cookie);assert.equal(booking.response.status,201);bookingId=new mongoose.Types.ObjectId(booking.data.request.id);
  const staff=await call('/api/auth/signup',{name:'Verification Mechanic',email:staffEmail,phone:'9876543211',password:'TestingRoyal123!',terms:true});assert.equal(staff.response.status,200);staffId=(await db.collection('users').findOne({email:staffEmail}))._id;
  const review=await call('/api/reviews',{vehicle:'Verification bike',text:`Workflow check ${suffix}`,rating:5},cookie);assert.equal(review.response.status,200);reviewId=(await db.collection('reviews').findOne({customerId}))._id;
  assert.ok(!(await (await fetch(base+'/api/site')).json()).reviews.some(r=>r._id===String(reviewId)));
  await db.collection('users').updateOne({_id:customerId},{$set:{role:'ADMIN'}});
  const admin=await call('/api/admin',null,cookie,'GET');assert.equal(admin.response.status,200);assert.ok(!JSON.stringify(admin.data).includes(user.passwordHash));
  assert.equal((await call('/api/admin',{section:'staff',id:String(staffId),data:{displayName:'Verification Mechanic',specialties:'Diagnostics',isAllowed:true}},cookie)).response.status,200);
  assert.equal((await call('/api/admin',{section:'bookings',id:String(bookingId),data:{status:'AWAITING_APPROVAL',estimate:1250,mechanicId:String(staffId),estimateApproved:true,notes:'Inspected',inspectionPhotos:[]}},cookie)).response.status,200);
  assert.equal((await db.collection('servicerequests').findOne({_id:bookingId})).status,'AWAITING_APPROVAL');
  assert.equal((await call('/api/admin',{section:'services',data:{name:`Verification ${suffix}`,description:'Temporary test service',price:321}},cookie)).response.status,200);serviceId=(await db.collection('servicecatalogs').findOne({name:`Verification ${suffix}`}))._id;
  assert.ok((await (await fetch(base+'/api/services')).json()).services.some(s=>s.name===`Verification ${suffix}`));
  assert.equal((await call('/api/admin',{section:'reviews',id:String(reviewId),data:{approved:true}},cookie)).response.status,200);
  assert.ok((await (await fetch(base+'/api/site')).json()).reviews.some(r=>r._id===String(reviewId)));
  const raw=randomBytes(32).toString('hex');await db.collection('passwordresets').insertOne({userId:customerId,tokenHash:createHash('sha256').update(raw).digest('hex'),expiresAt:new Date(Date.now()+60000)});
  assert.equal((await call('/api/auth/reset-password',{token:raw,password:'ChangedRoyal456!'})).response.status,200);
  assert.equal((await call('/api/auth/reset-password',{token:raw,password:'ChangedRoyal456!'})).response.status,400);
  assert.equal((await call('/api/admin',null,cookie,'GET')).response.status,403);
  const login=await call('/api/auth/login',{email,password:'ChangedRoyal456!',remember:true});assert.equal(login.data.redirect,'/admin');assert.ok(login.response.headers.get('set-cookie').includes('Expires='));cookie=login.cookie;
  assert.equal((await call('/api/auth/signout',{},cookie)).response.status,200);
  assert.equal((await call('/api/admin',null,cookie,'GET')).response.status,403);
  console.log('PASS: signup, password hashing, duplicate email, invalid credentials, customer/admin isolation, bookings, mechanic assignment, service publishing, review moderation, one-use reset token, session revocation, role redirect and signout.');
} finally {
  const ids=[customerId,staffId].filter(Boolean);
  if(ids.length){await db.collection('sessions').deleteMany({userId:{$in:ids}});await db.collection('passwordresets').deleteMany({userId:{$in:ids}});await db.collection('users').deleteMany({_id:{$in:ids}});}
  if(bookingId)await db.collection('servicerequests').deleteOne({_id:bookingId});
  if(serviceId)await db.collection('servicecatalogs').deleteOne({_id:serviceId});
  if(reviewId)await db.collection('reviews').deleteOne({_id:reviewId});
  await mongoose.disconnect();
}
