import {readFileSync,readdirSync,statSync} from 'node:fs';
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
const secrets=['SUPABASE_SERVICE_ROLE_KEY','YOUCAM_API_KEY'].map(k=>env[k]).filter(Boolean);
function scan(dir){for(const file of readdirSync(dir)){const path=dir+'/'+file;if(statSync(path).isDirectory())scan(path);else{const text=readFileSync(path,'utf8');if(secrets.some(secret=>text.includes(secret)))throw new Error('Server secret found in public asset: '+path);}}}
scan('.open-next/assets');console.log('PASS: server secrets are absent from public Worker assets.');
