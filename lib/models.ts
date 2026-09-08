import { Schema, model, models } from 'mongoose';
const userSchema=new Schema({googleSubject:{type:String,required:true,unique:true},email:{type:String,required:true,unique:true,lowercase:true},displayName:String,role:{type:String,enum:['ADMIN','MECHANIC','CUSTOMER'],default:'CUSTOMER'},isAllowed:{type:Boolean,default:true}},{timestamps:true});
const sessionSchema=new Schema({tokenHash:{type:String,required:true,unique:true},userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},expiresAt:{type:Date,required:true,index:{expires:0}}},{timestamps:true});
const inviteSchema=new Schema({email:{type:String,required:true,unique:true,lowercase:true},invitedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},acceptedAt:Date},{timestamps:true});
export const User=models.User||model('User',userSchema);export const Session=models.Session||model('Session',sessionSchema);export const MechanicInvite=models.MechanicInvite||model('MechanicInvite',inviteSchema);
