// Creates only explicitly named disposable test fixtures, then removes those fixtures.
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const n=l.indexOf('=');return[l.slice(0,n),l.slice(n+1)];}));
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(20000)})}});
const base=process.env.TEST_BASE_URL||'http://localhost:3001';const users=[],eventIds=[],mediaPaths=[];
async function call(path,session,body,method='POST'){const res=await fetch(base+path,{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',Cookie:session?.cookie||''},...(body?{body:JSON.stringify(body)}:{})});return{status:res.status,data:await res.json(),headers:res.headers};}
try{
 console.log('Creating three disposable Auth fixtures.');
 for(let i=0;i<3;i++){const email=`swapnight-test-${randomUUID()}@example.test`,password=randomUUID()+'A1!';const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{fixture:'swapnight-verification'}});if(error)throw error;users.push({id:data.user.id,cookie:''});const r=await call('/api/session',null,{action:'signin',email,password});assert.equal(r.status,200);users[i].cookie=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.ok(users[i].cookie);}
 console.log('Verifying private events and invitations.');
 const created=await call('/api/events',users[0],{name:'Disposable SwapNight verification',displayName:'Test Maya',location:'Simulated test room',adult:true});assert.equal(created.status,200,JSON.stringify(created.data));eventIds.push(created.data.id);const event=created.data.id;
 for(let i=1;i<3;i++){const joined=await call('/api/events/join',users[i],{invite:created.data.invite,name:['','Test Sara','Test Lina'][i],adult:true});assert.equal(joined.status,200);}
 const other=await call('/api/events',users[0],{name:'Disposable private access fixture',displayName:'Test Maya',location:'Test',adult:true});assert.equal(other.status,200);eventIds.push(other.data.id);
 assert.equal((await call('/api/events/'+other.data.id,users[1],null,'GET')).status,403);
 console.log('Verifying private garment uploads and preferences.');
 const ids=[];for(let i=0;i<3;i++){const form=new FormData();form.set('eventId',event);form.set('file',new Blob([readFileSync('public/garments/'+['denim','blouse','cardigan'][i]+'.png')],{type:'image/png'}),'garment.png');const response=await fetch(base+'/api/media',{method:'POST',signal:AbortSignal.timeout(30000),headers:{Cookie:users[i].cookie},body:form});const upload=await response.json();assert.equal(response.status,200,JSON.stringify(upload));const {data:row}=await db.from('sn_media').select('path').eq('id',upload.id).single();mediaPaths.push(row.path);const id=randomUUID();ids.push(id);const r=await call('/api/events/'+event,users[i],{requestId:randomUUID(),command:{type:'add',item:{id,eventId:event,ownerId:users[i].id,name:['Denim','Blouse','Cardigan'][i],category:i===1?'Top':'Jacket',size:'M',condition:'Test garment',measurements:'Chest 100 cm',image:'media:'+upload.id,status:'available'}}});assert.equal(r.status,200,JSON.stringify(r.data));}
 const action=(i,command,requestId=randomUUID())=>call('/api/events/'+event,users[i],{requestId,command});
 for(let i=0;i<3;i++)assert.equal((await action(i,{type:'preference',giveId:ids[i],receiveId:ids[(i+1)%3],selected:true})).status,200);
 const forged=await action(1,{type:'preference',giveId:ids[0],receiveId:ids[2],selected:true});assert.notEqual(forged.status,200);
 const pid=randomUUID();assert.equal((await action(0,{type:'propose',itemIds:ids,proposalId:pid})).status,200);
 console.log('Verifying simultaneous acceptance and handover.');
 const simultaneous=await Promise.all([0,1,2].map(i=>action(i,{type:'accept',proposalId:pid})));for(const r of simultaneous)assert.equal(r.status,200,JSON.stringify(r.data));
 let snapshot=(await call('/api/events/'+event,users[0],null,'GET')).data.state;assert.equal(snapshot.proposals[0].status,'reserved');assert.equal(snapshot.proposals[0].accepted.length,3);assert.ok(snapshot.items.every(i=>i.reservedBy===pid));
 assert.equal((await action(0,{type:'accept',proposalId:pid})).status,200);
 for(let i=0;i<3;i++)assert.equal((await action(i,{type:'handover',proposalId:pid,checklist:true})).status,200);
 snapshot=(await call('/api/events/'+event,users[0],null,'GET')).data.state;assert.equal(snapshot.proposals[0].status,'completed');assert.ok(snapshot.items.every(i=>i.status==='swapped'));
 const anonymous=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(20000)})}});assert.ok((await anonymous.from('sn_events').select('*')).error);assert.ok((await anonymous.storage.from('swapnight').download(mediaPaths[0])).error);
 console.log('PASS: real Supabase Auth, private event create/join, uploads, ownership denial, cross-event denial, simultaneous acceptance, reservations, physical handover, anonymous database/storage denial.');
}finally{
 if(mediaPaths.length)await db.storage.from('swapnight').remove(mediaPaths);
 if(eventIds.length)await db.from('sn_events').delete().in('id',eventIds);
 for(const u of users)await db.auth.admin.deleteUser(u.id);
 console.log('Disposable verification fixtures cleaned up.');
}
