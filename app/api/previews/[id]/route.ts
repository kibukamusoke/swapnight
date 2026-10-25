import {failure,guard,HttpError,json,user,signed,uuid,member} from '@/lib/swap/server';
import {supabaseAdmin} from '@/lib/supabase';
import {boundedImage} from '@/lib/swap/preview';
import {youcam} from '@/lib/youcam';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
 const u=await user(),{id}=await params;if(!uuid(id))throw new HttpError('Preview not found.',404);const db=supabaseAdmin();
 const {data:t,error}=await db.from('sn_previews').select('*').eq('id',id).eq('user_id',u.id).neq('status','deleted').single();if(error||!t)throw new HttpError('Preview not found.',404);if(t.event_id)await member(t.event_id,u.id);
 if(t.status==='success')return json({id,status:t.status,url:await signed(t.result_path)});
 if(t.status==='error')return json({id,status:t.status,error:t.error});
 if((t.status==='starting'&&Date.now()-Date.parse(t.created_at)>120000)||t.polls>=36||Date.now()-Date.parse(t.created_at)>30*60*1000){await db.from('sn_previews').update({status:'error',error:'This preview timed out. Start a new preview when you are ready.'}).eq('id',id).eq('user_id',u.id).in('status',['starting','running']);return json({id,status:'error',error:'This preview timed out.'});}
 if(t.status==='starting')return json({id,status:'starting'});
 const {data:claimed,error:claimError}=await db.rpc('sn_claim_poll',{p_id:id,p_user:u.id});if(claimError)throw new HttpError('Preview status is temporarily unavailable.',503);if(!claimed)return json({id,status:'running'});
 const task=await youcam('/task/cloth-v4/'+encodeURIComponent(t.provider_id));
 if(task.task_status==='error'){await db.from('sn_previews').update({status:'error',error:'YouCam could not apply this garment. Try a clear, front-facing photo.'}).eq('id',id).eq('user_id',u.id).eq('status','running');return json({id,status:'error',error:'YouCam could not apply this garment. Try another photo.'});}
 if(task.task_status!=='success')return json({id,status:'running'});
 if(!task.results?.url)throw new HttpError('YouCam did not return a result image.',502);
 const {bytes,type}=await boundedImage(await fetch(task.results.url,{signal:AbortSignal.timeout(20000)}));const path=`${u.id}/previews/${id}.${type.split('/')[1]}`;
 const {error:saveError}=await db.storage.from('swapnight').upload(path,bytes,{contentType:type,upsert:true});if(saveError)throw new HttpError('The preview is ready but could not be saved. Resume to try saving again.',503);
 const {data:updated,error:updateError}=await db.from('sn_previews').update({status:'success',result_path:path}).eq('id',id).eq('user_id',u.id).eq('status','running').select('id');if(updateError)throw new HttpError('Could not finalize this preview. Resume to retry.',503);if(!updated?.length){const {data:current}=await db.from('sn_previews').select('status,result_path').eq('id',id).eq('user_id',u.id).single();if(current?.status==='success'&&current.result_path)return json({id,status:'success',url:await signed(current.result_path)});if(current?.status==='deleted')await db.storage.from('swapnight').remove([path]);throw new HttpError('This preview is no longer processing.',410);}
 return json({id,status:'success',url:await signed(path)});
 }catch(e){return failure(e);}}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{guard(request);const u=await user(),{id}=await params;if(!uuid(id))throw new HttpError('Preview not found.',404);const db=supabaseAdmin();const {data:t}=await db.from('sn_previews').select('photo_path,result_path').eq('id',id).eq('user_id',u.id).single();if(!t)throw new HttpError('Preview not found.',404);const {error:markError}=await db.from('sn_previews').update({status:'deleted'}).eq('id',id).eq('user_id',u.id);if(markError)throw new HttpError('Could not delete this preview.',503);const paths=[t.photo_path,t.result_path].filter(Boolean);if(paths.length){const {error}=await db.storage.from('swapnight').remove(paths);if(error)throw new HttpError('Preview hidden, but photo deletion failed. Retry deletion.',503);}await db.from('sn_previews').update({photo_path:null,result_path:null,provider_id:null,error:null}).eq('id',id).eq('user_id',u.id);return json({ok:true});}catch(e){return failure(e);}}
