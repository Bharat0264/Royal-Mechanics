import { NextResponse } from 'next/server';
import { getViewer, requestThrottle, sameOrigin } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { ServiceCatalog, SiteContent } from '@/lib/models';
import { defaultServices } from '@/lib/site-defaults';

const defaults=defaultServices;
const reply=(body:unknown,status=200,headers?:HeadersInit)=>NextResponse.json(body,{status,headers});
const publicCache={'Cache-Control':'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'};
export async function GET(){try{await connectMongo();const saved=await ServiceCatalog.find({active:true}).sort({createdAt:1}).lean();const initialized=await SiteContent.exists({key:'catalogueInitialized'});return reply({services:saved.length||initialized?saved.map(item=>({id:String(item._id),name:item.name,description:item.description,price:item.price})):defaults},200,publicCache)}catch{return reply({services:defaults},200,publicCache)}}
export async function PUT(request:Request){if(!sameOrigin(request))return reply({error:'Invalid request origin.'},403);const viewer=await getViewer();if(viewer?.role!=='ADMIN'||viewer.isGuest)return reply({error:viewer?.isGuest?'Sign in to make changes.':'Admin access required.'},403);if(!(await requestThrottle(request,'admin-service',30,viewer.id)))return reply({error:'Too many requests. Please try again later.'},429);const {name,description,price}=await request.json().catch(()=>({}));if(typeof name!=='string'||typeof description!=='string'||typeof price!=='number'||!Number.isFinite(price)||price<0||price>10_000_000||!name.trim()||name.trim().length>100||!description.trim()||description.trim().length>500)return reply({error:'Valid service name, description (up to 500 characters), and price are required.'},400);await connectMongo();const service=await ServiceCatalog.findOneAndUpdate({name:name.trim()},{$set:{description:description.trim(),price,active:true}},{upsert:true,new:true,setDefaultsOnInsert:true,runValidators:true});return reply({service:{id:String(service._id),name:service.name,description:service.description,price:service.price}})}
