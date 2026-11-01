import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;const u='00000000-0000-4000-8000-0000000000aa';
beforeAll(async()=>{db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);');await db.exec(readFileSync('supabase/migrations/202611010001_tones.sql','utf8'));await db.query('insert into auth.users values($1)',[u]);});
afterAll(async()=>{await db.close();});
it('reserves at most three color analyses per user per day',async()=>{
 for(let i=0;i<3;i++)await db.query('select sn_claim_tone($1)',[u]);
 await expect(db.query('select sn_claim_tone($1)',[u])).rejects.toThrow(/limit reached/);
 await db.query("update sn_tones set window_start=now()-interval '25 hours' where user_id=$1",[u]);
 await db.query('select sn_claim_tone($1)',[u]);expect((await db.query<{runs:number}>('select runs from sn_tones where user_id=$1',[u])).rows[0].runs).toBe(1);
});
it('refuses a second analysis while one is still running',async()=>{
 await db.query("update sn_tones set pending_task='t1',pending_at=now() where user_id=$1",[u]);
 await expect(db.query('select sn_claim_tone($1)',[u])).rejects.toThrow(/already running/);
 await db.query("update sn_tones set pending_at=now()-interval '5 minutes' where user_id=$1",[u]);
 await db.query('select sn_claim_tone($1)',[u]);
});
it('keeps tones out of reach of anon and authenticated roles',async()=>{const r=await db.query<{a:boolean;b:boolean}>("select has_table_privilege('anon','public.sn_tones','select') a,has_table_privilege('authenticated','public.sn_tones','select') b");expect(r.rows[0]).toEqual({a:false,b:false});});
