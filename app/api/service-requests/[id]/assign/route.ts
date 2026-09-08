import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { MechanicInvite, ServiceRequest, User } from '@/lib/models';

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status});
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){const viewer=await getViewer();if(viewer?.role!=='ADMIN')return reply({error:'Admin access required.'},403);const {email}=await request.json().catch(()=>({}));const mechanicEmail=typeof email==='string'?email.trim().toLowerCase():'';await connectMongo();const mechanic=await MechanicInvite.findOne({email:mechanicEmail}).lean();if(!mechanic)return reply({error:'Add this mechanic before assigning a booking.'},400);const user=await User.findOne({email:mechanicEmail}).lean();const {id}=await params;const job=await ServiceRequest.findByIdAndUpdate(id,{mechanicId:user?user._id:undefined,mechanicEmail,status:'ASSIGNED'},{new:true});if(!job)return reply({error:'Booking was not found.'},404);return reply({request:{id:String(job._id),status:job.status,mechanicEmail:job.mechanicEmail}});}
