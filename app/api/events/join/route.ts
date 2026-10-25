import {createHash} from 'node:crypto';
import {failure,guard,HttpError,json,user} from '@/lib/swap/server';
import {supabaseAdmin} from '@/lib/supabase';
export async function POST(request:Request){try{guard(request);const u=await user();const {invite,name,adult}=await request.json();if(adult!==true)throw new HttpError('Please confirm you are 18 or older.');if(typeof invite!=='string'||!/^[a-f0-9]{48}$/.test(invite)||typeof name!=='string'||!name.trim()||name.length>60)throw new HttpError('Enter your name and a valid invitation code.');const {data,error}=await supabaseAdmin().rpc('sn_join',{p_hash:createHash('sha256').update(invite).digest('hex'),p_user:u.id,p_name:name.trim()});if(error)throw new HttpError(error.message);return json({id:data});}catch(e){return failure(e);}}
