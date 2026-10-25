// Upload only the four application keys through stdin. Never print secret values.
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const allowed=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','YOUCAM_API_KEY'];
const secrets={};
for(const line of readFileSync('.env.local','utf8').split('\n')){const index=line.indexOf('=');if(index<0)continue;const key=line.slice(0,index).trim();let value=line.slice(index+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);if(allowed.includes(key)&&value)secrets[key]=value;}
for(const key of allowed.slice(0,3))if(!secrets[key])throw new Error(`Missing ${key}`);
execFileSync('npx',['wrangler','secret','bulk'],{input:JSON.stringify(secrets),stdio:['pipe','inherit','inherit']});
console.log('Application secrets uploaded securely. YouCam configured: '+Boolean(secrets.YOUCAM_API_KEY));
