import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { ServiceRequest } from '@/lib/models';

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status});

export async function POST(request:Request){
  const viewer=await getViewer();
  if(!viewer)return reply({error:'Please sign in before confirming a booking.'},401);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const vehicleName=typeof body?.vehicleName==='string'?body.vehicleName.trim():'';
  const serviceCategory=typeof body?.serviceCategory==='string'?body.serviceCategory.trim():'';
  const serviceMode=body?.serviceMode==='PICKUP_DROP'?'PICKUP_DROP':body?.serviceMode==='SELF_DROP'?'SELF_DROP':'';
  if(!vehicleName||!serviceCategory||!serviceMode)return reply({error:'Vehicle, service category, and service mode are required.'},400);
  const pickup=body?.pickupLocation as Record<string,unknown>|undefined;
  const latitude=typeof pickup?.latitude==='number'?pickup.latitude:undefined;
  const longitude=typeof pickup?.longitude==='number'?pickup.longitude:undefined;
  const address=pickup?.address as Record<string,unknown>|undefined;
  const hasAddress=Boolean(address&&Object.values(address).some(value=>typeof value==='string'&&value.trim()));
  if(serviceMode==='PICKUP_DROP'&&latitude===undefined&&longitude===undefined&&!hasAddress)return reply({error:'Pickup location or address is required.'},400);
  await connectMongo();
  const created=await ServiceRequest.create({requestNumber:`RM-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,4).toUpperCase()}`,customerId:viewer.id,vehicleName,serviceCategory,serviceMode,notes:typeof body?.notes==='string'?body.notes.trim().slice(0,1500):'',preferredSlot:typeof body?.preferredSlot==='string'?body.preferredSlot.trim().slice(0,120):'',pickupLocation:pickup?{latitude,longitude,accuracy:typeof pickup.accuracy==='number'?pickup.accuracy:undefined,capturedAt:typeof pickup.capturedAt==='string'?new Date(pickup.capturedAt):undefined,address}:{}});
  return reply({request:{id:String(created._id),requestNumber:created.requestNumber,status:created.status}},201);
}

export async function GET(){
  const viewer=await getViewer();
  if(!viewer||viewer.role!=='ADMIN')return reply({error:'Admin access required.'},403);
  await connectMongo();
  const requests=await ServiceRequest.find().sort({createdAt:-1}).limit(50).lean();
  return reply({requests:requests.map(item=>({id:String(item._id),requestNumber:item.requestNumber,vehicleName:item.vehicleName,serviceCategory:item.serviceCategory,serviceMode:item.serviceMode,status:item.status,preferredSlot:item.preferredSlot,createdAt:item.createdAt,pickupLocation:item.pickupLocation}))});
}
