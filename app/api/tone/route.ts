import {failure,guard,HttpError,json,user,validateImage} from '@/lib/swap/server';
import {supabaseAdmin} from '@/lib/supabase';
import {providerUpload} from '@/lib/swap/preview';
import {youcam} from '@/lib/youcam';
import {analyze,retakeMessage,validHex,type ToneReading} from '@/lib/swap/palette';

// "Colors that love you": one close-up selfie → YouCam AI Facial Color Tones
// Analyzer → our palette logic. The selfie is streamed to YouCam and never
// stored by SwapNight; only the returned hex tones are kept.
const TASK='/task/skin-tone-analysis';
type Row={tones:ToneReading|null;pending_task:string|null};

function reading(color:Record<string,unknown>|undefined):ToneReading{
 if(!color||!validHex(color.skin_color))throw new HttpError('YouCam did not return a skin tone. Try another close-up selfie.',502);
 const hex=(v:unknown)=>validHex(v)?v:undefined,name=(v:unknown)=>typeof v==='string'&&v.length<=20?v:undefined;
 return {skin:color.skin_color,lip:hex(color.lip_color),eyebrow:hex(color.eyebrow_color),hair:hex(color.hair_color),eye:hex(color.eye_color),eyeName:name(color.eye_color_name),hairName:name(color.hair_color_name)};
}
// Poll once. Returns the reading, or null while YouCam is still working.
// Polling is mandatory: an unpolled task can time out and still consume units.
async function pollOnce(userId:string,taskId:string){
 const db=supabaseAdmin();const task=await youcam(TASK+'/'+encodeURIComponent(taskId));
 if(task.task_status==='error'){await db.from('sn_tones').update({pending_task:null,pending_at:null}).eq('user_id',userId).eq('pending_task',taskId);throw new HttpError(retakeMessage(task.error||task.error_code),422);}
 if(task.task_status!=='success')return null;
 const tones=reading(task.results?.color);analyze(tones);
 const {error}=await db.from('sn_tones').update({tones,pending_task:null,pending_at:null,updated_at:new Date().toISOString()}).eq('user_id',userId);if(error)throw new HttpError('Your colors are ready but could not be saved. Refresh to retry.',503);
 return tones;
}
const profile=(tones:ToneReading)=>analyze(tones,'youcam');

export async function GET(){try{
 const u=await user();const {data,error}=await supabaseAdmin().from('sn_tones').select('tones,pending_task').eq('user_id',u.id).maybeSingle<Row>();if(error){if(/sn_tones|schema cache|does not exist/i.test(error.message))return json({status:'none'});throw new HttpError('Your colors could not load.',503);}
 if(data?.pending_task){const tones=await pollOnce(u.id,data.pending_task);return json(tones?{status:'success',profile:profile(tones)}:{status:'running'});}
 return json(data?.tones?{status:'success',profile:profile(data.tones)}:{status:'none'});
}catch(e){return failure(e);}}

export async function POST(request:Request){try{
 guard(request);const u=await user();if(!process.env.YOUCAM_API_KEY)throw new HttpError('Color analysis needs the YouCam API key. Demo colors still work without it.',503);
 const form=await request.formData();if(form.get('consent')!=='true')throw new HttpError('Allow YouCam to analyze your selfie first.');
 const selfie=await validateImage(form.get('selfie'));const db=supabaseAdmin();
 const {error:claimError}=await db.rpc('sn_claim_tone',{p_user:u.id});if(claimError)throw new HttpError(claimError.message,429);
 const src=await providerUpload(selfie.bytes,selfie.type,`selfie.${selfie.ext}`);
 const task=await youcam(TASK,'POST',{src_file_id:src,face_angle_strictness_level:'medium'});if(!task.task_id)throw new HttpError('YouCam did not return a task ID.',502);
 const {error}=await db.from('sn_tones').update({pending_task:task.task_id,pending_at:new Date().toISOString()}).eq('user_id',u.id);if(error)throw new HttpError('Analysis started but could not be tracked. Refresh in a moment.',503);
 // Tone analysis is quick; poll inline for ~40s, then let the client resume via GET.
 for(let i=0;i<14;i++){await new Promise(r=>setTimeout(r,i===0?1500:3000));const tones=await pollOnce(u.id,task.task_id);if(tones)return json({status:'success',profile:profile(tones)});}
 return json({status:'running'});
}catch(e){return failure(e);}}

export async function DELETE(request:Request){try{guard(request);const u=await user();const {error}=await supabaseAdmin().from('sn_tones').update({tones:null}).eq('user_id',u.id);if(error)throw new HttpError('Could not forget your colors.',503);return json({ok:true});}catch(e){return failure(e);}}
