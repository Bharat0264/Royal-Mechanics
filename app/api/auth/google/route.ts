import { NextResponse } from 'next/server';
import { ADMIN_EMAIL, SESSION_COOKIE, hashSession } from '@/lib/auth';
import { connectMongo } from '@/lib/mongodb';
import { MechanicInvite, Session, User } from '@/lib/models';

type GoogleToken={aud?:string;sub?:string;email?:string;email_verified?:string|boolean;name?:string};
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status});

export async function POST(request:Request){
  try{
    const clientId=process.env.GOOGLE_CLIENT_ID;
    if(!clientId)return reply({error:'Authentication is not configured.'},503);
    const {credential}=await request.json().catch(()=>({}));
    if(typeof credential!=='string'||credential.length>4096)return reply({error:'Invalid Google credential.'},400);
    const verified=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if(!verified.ok)return reply({error:'Google could not verify this sign-in.'},401);
    const token=await verified.json() as GoogleToken;
    const email=token.email?.trim().toLowerCase();
    if(token.aud!==clientId||!token.sub||!email||(token.email_verified!==true&&token.email_verified!=='true'))return reply({error:'Google identity validation failed.'},401);
    await connectMongo();
    const invite=await MechanicInvite.findOne({email}).lean();
    const desiredRole=email===ADMIN_EMAIL?'ADMIN':invite?'MECHANIC':'CUSTOMER';
    let user=await User.findOne({$or:[{googleSubject:token.sub},{email}]});
    if(!user)user=await User.create({googleSubject:token.sub,email,displayName:token.name??null,role:desiredRole});
    else{user.googleSubject=token.sub;user.displayName=token.name??user.displayName;if(email===ADMIN_EMAIL)user.role='ADMIN';else if(invite)user.role='MECHANIC';await user.save();}
    if(invite&&!invite.acceptedAt)await MechanicInvite.updateOne({_id:invite._id},{$set:{acceptedAt:new Date()}});
    const raw=crypto.randomUUID()+crypto.randomUUID();
    const expiresAt=new Date(Date.now()+30*24*60*60*1000);
    await Session.create({tokenHash:await hashSession(raw),userId:user._id,expiresAt});
    const result=reply({viewer:{id:String(user._id),email:user.email,displayName:user.displayName??null,role:user.role}});
    result.cookies.set(SESSION_COOKIE,raw,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',expires:expiresAt});
    return result;
  }catch(error){
    console.error('[auth/google] failed after Google verification',{message:error instanceof Error?error.message:String(error)});
    return reply({error:'Sign-in could not create a secure session. Check the MongoDB connection and try again.'},503);
  }
}
