import {supportedDimensions} from './image-spec';
import {SwapError} from './engine';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import type { EventState } from './engine';
export class HttpError extends Error { constructor(message:string,public status=400){super(message);} }
export async function authClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new HttpError('Private events need Supabase setup. You can still explore the solo demo.',503);
 const jar=await cookies();
 return createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll:items=>{for(const {name,value,options} of items)jar.set(name,value,{...options,sameSite:'lax',secure:process.env.NODE_ENV==='production'});}}});
}
export async function user(){const auth=await authClient();const {data,error}=await auth.auth.getUser();if(error||!data.user)throw new HttpError('Sign in to your private event or to create a live preview.',401);return data.user;}
export function guard(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new HttpError('Request origin is not allowed.',403);}
export function failure(error:unknown){return Response.json({error:error instanceof Error?error.message:'Something went wrong. Please try again.'},{status:error instanceof HttpError?error.status:error instanceof SwapError?400:503,headers:{'Cache-Control':'no-store'}});}
export function json(value:unknown){return Response.json(value,{headers:{'Cache-Control':'private, no-store'}});}
export function uuid(value:unknown):value is string{return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
export async function member(eventId:string,userId:string){if(!uuid(eventId))throw new HttpError('Event not found.',404);const db=supabaseAdmin();const {data}=await db.from('sn_members').select('event_id').eq('event_id',eventId).eq('user_id',userId).maybeSingle();if(!data)throw new HttpError('This event is private. Join with its invitation first.',403);return db;}
export async function eventRow(eventId:string,userId:string){const db=await member(eventId,userId);const {data,error}=await db.from('sn_events').select('state,revision').eq('id',eventId).single();if(error)throw new HttpError('This event could not load.',503);return {db,state:data.state as EventState,revision:data.revision as number};}
export async function signed(path:string){const db=supabaseAdmin();const {data,error}=await db.storage.from('swapnight').createSignedUrl(path,900);if(error)throw new HttpError('This photo could not load.',503);return data.signedUrl;}
export async function publicState(state:EventState,userId:string){
 await member(state.id,userId);
 const next=structuredClone(state);const ids=next.items.filter(i=>i.image.startsWith('media:')).map(i=>i.image.slice(6));
 if(ids.length){const {data,error}=await supabaseAdmin().from('sn_media').select('id,path').eq('event_id',state.id).eq('kind','garment').in('id',ids);if(error)throw new HttpError('Garment photos could not load.',503);const urls=new Map(await Promise.all((data||[]).map(async m=>[m.id,await signed(m.path)] as const)));for(const i of next.items)if(i.image.startsWith('media:'))i.image=urls.get(i.image.slice(6))||'';}
 return next;
}
export async function validateImage(file:FormDataEntryValue|null,max=4*1024*1024){
 if(!(file instanceof File)||!['image/jpeg','image/png'].includes(file.type)||file.size===0||file.size>max)throw new HttpError('Use a JPG or PNG up to 4 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 if(!(jpg||png))throw new HttpError('That file is not a JPG or PNG.');if(!supportedDimensions(bytes))throw new HttpError('Use a photo at least 512 × 384, with no side over 4096 pixels.');return{file,bytes,type:png?'image/png':'image/jpeg',ext:png?'png':'jpg'};
}
