import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { ServiceCatalog } from '@/lib/models';

const defaults=[{name:'General Service',description:'Full inspection, fluids & tune-up',price:899},{name:'Brakes & Safety',description:'Pads, discs, fluid & alignment',price:499},{name:'Tyres & Battery',description:'Fitment, balancing & health check',price:399}];
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status});
export async function GET(){try{await connectMongo();const saved=await ServiceCatalog.find({active:true}).sort({createdAt:1}).lean();return reply({services:saved.length?saved.map(item=>({id:String(item._id),name:item.name,description:item.description,price:item.price})):defaults})}catch{return reply({services:defaults})}}
export async function PUT(request:Request){const viewer=await getViewer();if(viewer?.role!=='ADMIN')return reply({error:'Admin access required.'},403);const {name,description,price}=await request.json().catch(()=>({}));if(typeof name!=='string'||typeof description!=='string'||typeof price!=='number'||price<0)return reply({error:'Valid service name, description, and price are required.'},400);await connectMongo();const service=await ServiceCatalog.findOneAndUpdate({name:name.trim()},{$set:{description:description.trim(),price,active:true}},{upsert:true,new:true,setDefaultsOnInsert:true});return reply({service:{id:String(service._id),name:service.name,description:service.description,price:service.price}})}
