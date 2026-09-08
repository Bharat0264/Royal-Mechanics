import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { Invoice } from '@/lib/models';

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status});
export async function POST(request:Request){const viewer=await getViewer();if(viewer?.role!=='ADMIN')return reply({error:'Admin access required.'},403);const {invoiceId,razorpay_payment_id,razorpay_order_id,razorpay_signature}=await request.json().catch(()=>({}));if(!invoiceId||!razorpay_payment_id||!razorpay_order_id||!razorpay_signature)return reply({error:'Incomplete payment response.'},400);const secret=process.env.RAZORPAY_KEY_SECRET;if(!secret)return reply({error:'Razorpay is not configured.'},503);await connectMongo();const invoice=await Invoice.findById(invoiceId);if(!invoice||invoice.razorpayOrderId!==razorpay_order_id)return reply({error:'Invoice payment order mismatch.'},400);const expected=createHmac('sha256',secret).update(`${invoice.razorpayOrderId}|${razorpay_payment_id}`).digest('hex');const valid=expected.length===razorpay_signature.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(razorpay_signature));if(!valid)return reply({error:'Payment signature verification failed.'},400);invoice.paymentStatus='PAID';invoice.razorpayPaymentId=razorpay_payment_id;await invoice.save();return reply({ok:true,invoiceNumber:invoice.invoiceNumber});}
