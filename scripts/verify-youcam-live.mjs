// Intentional paid smoke test: one genuine YouCam task with generated fictional adult imagery.
// The test account and private source/result objects are removed after the result is saved locally.
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const n=l.indexOf('=');return[l.slice(0,n),l.slice(n+1).trim().replace(/^['"]|['"]$/g,'')];}));
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const base='https://swapnight.trevorsuna-c38.workers.dev';
const photoPath=process.argv[2];if(!photoPath)throw new Error('Provide generated adult source photo path.');
const photo=readFileSync(photoPath),garment=readFileSync('public/garments/denim.png');
const email=`swapnight-youcam-${randomUUID()}@example.test`,password=randomUUID()+'A1!';let userId,cookie,previewId,success=false;
async function api(path,options={}){const r=await fetch(base+path,{...options,headers:{...(options.headers||{}),Cookie:cookie||''},signal:AbortSignal.timeout(120000)});let data;try{data=await r.json()}catch{data={error:'Non-JSON response'}}return{r,data};}
try{
 const created=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{fixture:'swapnight-youcam-verification'}});if(created.error)throw created.error;userId=created.data.user.id;
 const login=await api('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'signin',email,password})});assert.equal(login.r.status,200,JSON.stringify(login.data));cookie=login.r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.ok(cookie);
 const form=new FormData();form.set('photo',new Blob([photo],{type:'image/png'}),'generated-adult.png');form.set('reference',new Blob([garment],{type:'image/png'}),'generated-jacket.png');form.set('itemId','denim');form.set('eventId','demo');form.set('requestId',randomUUID());form.set('consent','true');
 console.log('Submitting one real YouCam jacket preview.');
 const submitted=await api('/api/previews',{method:'POST',body:form});if(submitted.r.status!==200)throw new Error(`Submission ${submitted.r.status}: ${JSON.stringify(submitted.data)}`);previewId=submitted.data.id;assert.ok(previewId);console.log('YouCam task accepted and persisted.');
 for(let n=0;n<28;n++){
  await new Promise(r=>setTimeout(r,11000));const polled=await api('/api/previews/'+previewId);if(polled.r.status!==200)throw new Error(`Polling ${polled.r.status}: ${JSON.stringify(polled.data)}`);console.log('Preview status:',polled.data.status);
  if(polled.data.status==='error')throw new Error(polled.data.error||'Provider returned an error');
  if(polled.data.status==='success'){
   const image=await fetch(polled.data.url,{signal:AbortSignal.timeout(25000)});assert.equal(image.status,200);const type=(image.headers.get('content-type')||'').split(';')[0];const ext=type==='image/png'?'png':type==='image/webp'?'webp':type==='image/jpeg'?'jpg':null;if(!ext)throw new Error('Unexpected provider image type '+type);
   mkdirSync('public/previews',{recursive:true});const output='public/previews/saved-youcam-jacket.'+ext;writeFileSync(output,Buffer.from(await image.arrayBuffer()));writeFileSync('public/previews/generated-adult-source.png',photo);writeFileSync('public/previews/README.md',`# Genuine YouCam example\n\nSaved from a successful YouCam AI Clothes API cloth-v4 task on ${new Date().toISOString()} using a generated fictional adult source photo and the generated denim jacket sample. The source and saved result are public demo assets; they are not customer photos. The provider result was saved through SwapNight's private Supabase preview flow before being copied here.\n`);console.log('Saved genuine result:',output);success=true;break;
  }
 }
 if(!success)throw new Error('Provider task did not finish within the smoke-test window.');
}finally{
 if(userId&&cookie){try{const {data:rows}=await db.from('sn_previews').select('id').eq('user_id',userId);for(const row of rows||[]){const deleted=await api('/api/previews/'+row.id,{method:'DELETE'});console.log('Private preview cleanup:',deleted.r.status);} }catch(e){console.log('Private preview cleanup needs attention:',e.message)}}
 if(userId){const deleted=await db.auth.admin.deleteUser(userId);console.log('Test account cleanup:',deleted.error?'needs attention':'done');}
}
