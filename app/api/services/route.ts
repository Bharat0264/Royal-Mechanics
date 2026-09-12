import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { ServiceCatalog, SiteContent } from '@/lib/models';
import { defaultServices } from '@/lib/site-defaults';

const defaults=defaultServices;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status});
export async function GET(){try{await connectMongo();const saved=await ServiceCatalog.find({active:true}).sort({createdAt:1}).lean();const initialized=await SiteContent.exists({key:'catalogueInitialized'});return reply({services:saved.length||initialized?saved.map(item=>({id:String(item._id),name:item.name,description:item.description,price:item.price})):defaults})}catch{return reply({services:defaults})}}
export async function PUT(request:Request){const viewer=await getViewer();if(viewer?.role!=='ADMIN'||viewer.isGuest)return reply({error:viewer?.isGuest?'Sign in to make changes.':'Admin access required.'},403);const {name,description,price}=await request.json().catch(()=>({}));if(typeof name!=='string'||typeof description!=='string'||typeof price!=='number'||price<0)return reply({error:'Valid service name, description, and price are required.'},400);await connectMongo();const service=await ServiceCatalog.findOneAndUpdate({name:name.trim()},{$set:{description:description.trim(),price,active:true}},{upsert:true,new:true,setDefaultsOnInsert:true});return reply({service:{id:String(service._id),name:service.name,description:service.description,price:service.price}})}
