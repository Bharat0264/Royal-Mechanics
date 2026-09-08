import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { MechanicInvite, User } from '@/lib/models';

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status});
const admin=async()=>{const viewer=await getViewer();return viewer?.role==='ADMIN'?viewer:null};

export async function GET(){const viewer=await admin();if(!viewer)return reply({error:'Admin access required.'},403);await connectMongo();const mechanics=await MechanicInvite.find().sort({createdAt:-1}).lean();return reply({mechanics:mechanics.map(item=>({id:String(item._id),email:item.email,acceptedAt:item.acceptedAt??null}))});}

export async function POST(request:Request){const viewer=await admin();if(!viewer)return reply({error:'Admin access required.'},403);const {email}=await request.json().catch(()=>({}));const normalized=typeof email==='string'?email.trim().toLowerCase():'';if(!/^\S+@\S+\.\S+$/.test(normalized))return reply({error:'Enter a valid mechanic email.'},400);await connectMongo();await MechanicInvite.findOneAndUpdate({email:normalized},{$setOnInsert:{email:normalized,invitedBy:viewer.id}},{upsert:true,new:true});const user=await User.findOne({email:normalized});if(user&&user.role!=='ADMIN'){user.role='MECHANIC';await user.save();}return reply({ok:true,email:normalized});}
