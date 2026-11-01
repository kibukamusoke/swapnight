-- Additive: "Colors that love you". Stores only the four-ish hex tones YouCam
-- returns per user (never the selfie), plus a daily analysis quota.
create table public.sn_tones (
 user_id uuid primary key references auth.users on delete cascade,
 tones jsonb, pending_task text, pending_at timestamptz,
 runs integer not null default 0, window_start timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.sn_tones enable row level security;
revoke all on public.sn_tones from anon,authenticated;
grant all on public.sn_tones to service_role;

-- Atomically reserve one analysis (3 per rolling day, 20 YouCam units each).
create function public.sn_claim_tone(p_user uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t sn_tones;
begin
 insert into sn_tones(user_id) values(p_user) on conflict (user_id) do nothing;
 select * into t from sn_tones where user_id=p_user for update;
 if t.pending_task is not null and t.pending_at>now()-interval '2 minutes' then raise exception 'Your color analysis is already running.'; end if;
 if t.window_start<now()-interval '1 day' then update sn_tones set runs=0,window_start=now() where user_id=p_user; t.runs:=0; end if;
 if t.runs>=3 then raise exception 'Daily color analysis limit reached (3). Come back tomorrow.'; end if;
 update sn_tones set runs=runs+1,updated_at=now() where user_id=p_user;
end $$;
revoke all on function public.sn_claim_tone(uuid) from public,anon,authenticated;
grant execute on function public.sn_claim_tone(uuid) to service_role;
