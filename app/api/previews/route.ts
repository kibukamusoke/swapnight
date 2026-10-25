import {failure,guard,HttpError,json,user,validateImage,eventRow,signed,uuid} from '@/lib/swap/server';
import {supabaseAdmin} from '@/lib/supabase';
import {providerUpload} from '@/lib/swap/preview';
import {youcam} from '@/lib/youcam';
import {seedDemo} from '@/lib/swap/demo';
export async function GET(){try{const u=await user(),db=supabaseAdmin();const {data,error}=await db.from('sn_previews').select('id,item_id,status,result_path,error,created_at').eq('user_id',u.id).neq('status','deleted').order('created_at',{ascending:false}).limit(25);if(error)throw new HttpError('Previews could not load.',503);return json({previews:await Promise.all((data||[]).map(async p=>({id:p.id,itemId:p.item_id,status:p.status,error:p.error,createdAt:p.created_at,url:p.result_path?await signed(p.result_path):null})))});}catch(e){return failure(e);}}
export async function POST(request:Request){let claimedId:string|undefined;let userId:string|undefined;try{
 guard(request);const u=await user();userId=u.id;if(!process.env.YOUCAM_API_KEY)throw new HttpError('Live try-on needs the YouCam API key. Demo exchanges still work without it.',503);
 const form=await request.formData();if(form.get('consent')!=='true')throw new HttpError('Allow private photo processing before generating a preview.');
 const requestId=form.get('requestId'),itemId=String(form.get('itemId')||''),eventId=String(form.get('eventId')||'');if(!uuid(requestId))throw new HttpError('Invalid preview request.');
 const demo=eventId==='demo';const state=demo?seedDemo():(await eventRow(eventId,u.id)).state;
 const item=state.items.find(i=>i.id===itemId&&i.status==='available');if(!item)throw new HttpError('This garment is not available.',404);
 const photo=await validateImage(form.get('photo'));const db=supabaseAdmin();
 let reference:{fileId?:string;url?:string};
 if(demo){const ref=await validateImage(form.get('reference'));reference={fileId:undefined};
  // Reference upload is delayed until after the idempotent quota claim below.
  reference.url=undefined; void ref;
 }else{const mediaId=item.image.startsWith('media:')?item.image.slice(6):'';const {data}=await db.from('sn_media').select('path').eq('id',mediaId).eq('event_id',eventId).eq('user_id',item.ownerId).eq('kind','garment').single();if(!data)throw new HttpError('The original garment photo could not be found.',404);reference={url:await signed(data.path)};}
 const id=crypto.randomUUID();const {data:claimed,error}=await db.rpc('sn_claim_preview',{p_id:id,p_user:u.id,p_event:demo?null:eventId,p_item:item.id,p_request:requestId});if(error)throw new HttpError(error.message,429);if(claimed!==id)return json({id:claimed});claimedId=id;
 const path=`${u.id}/photos/${id}.${photo.ext}`;const {error:storageError}=await db.storage.from('swapnight').upload(path,photo.bytes,{contentType:photo.type});if(storageError)throw new HttpError('Your private photo could not upload.',503);
 const {error:photoError}=await db.from('sn_previews').update({photo_path:path}).eq('id',id).eq('user_id',u.id);if(photoError)throw new HttpError('Your photo could not be linked to this preview.',503);
 const src=await providerUpload(photo.bytes,photo.type,`photo.${photo.ext}`);
 if(demo){const ref=await validateImage(form.get('reference'));reference.fileId=await providerUpload(ref.bytes,ref.type,`garment.${ref.ext}`);}
 const task=await youcam('/task/cloth-v4','POST',{src_file_id:src,...(reference.fileId?{ref_file_id:reference.fileId}:{ref_file_url:reference.url}),garment_category:item.category==='Jacket'?'outer':'upper_body',filter_multi_person:'strict',change_shoes:false});
 if(!task.task_id)throw new HttpError('YouCam did not return a task ID.',502);
 const {error:taskError}=await db.from('sn_previews').update({provider_id:task.task_id,status:'running'}).eq('id',id).eq('user_id',u.id);if(taskError)throw new HttpError('The provider started but its task could not be saved. Do not retry this request.',503);
 return json({id});
 }catch(e){if(claimedId&&userId)await supabaseAdmin().from('sn_previews').update({status:'error',error:e instanceof Error?e.message:'Preview failed.'}).eq('id',claimedId).eq('user_id',userId);return failure(e);}}
