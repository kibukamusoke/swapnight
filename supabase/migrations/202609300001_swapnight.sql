-- Additive migration. Existing ClosetMath tables and buckets are untouched.
create table public.sn_events (
 id uuid primary key default gen_random_uuid(), host_id uuid not null,
 invite_hash text not null unique, state jsonb not null,
 revision integer not null default 0, created_at timestamptz not null default now()
);
create table public.sn_members (
 event_id uuid references public.sn_events on delete cascade,
 user_id uuid not null, primary key(event_id,user_id)
);
create table public.sn_media (
 id uuid primary key, user_id uuid not null,
 event_id uuid references public.sn_events on delete cascade,
 kind text not null check(kind in ('garment','person','preview')),
 path text not null unique, created_at timestamptz not null default now()
);
create table public.sn_previews (
 id uuid primary key, user_id uuid not null,
 event_id uuid references public.sn_events on delete cascade,
 item_id text not null, request_id uuid not null,
 provider_id text, status text not null default 'starting'
 check(status in ('starting','running','success','error','deleted')),
 photo_path text, result_path text, error text,
 polls integer not null default 0, last_poll_at timestamptz,
 created_at timestamptz not null default now(), unique(user_id,request_id)
);
create index sn_preview_user_idx on public.sn_previews(user_id,created_at desc);
alter table public.sn_events enable row level security;
alter table public.sn_members enable row level security;
alter table public.sn_media enable row level security;
alter table public.sn_previews enable row level security;
revoke all on public.sn_events,public.sn_members,public.sn_media,public.sn_previews from anon,authenticated;
grant all on public.sn_events,public.sn_members,public.sn_media,public.sn_previews to service_role;

-- One event row is the transaction boundary for every exchange and reservation.
-- A stale revision never overwrites a concurrent acceptance.
create function public.sn_commit(p_event uuid,p_user uuid,p_revision integer,p_state jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare current_revision integer;
begin
 select revision into current_revision from sn_events where id=p_event for update;
 if not found or not exists(select 1 from sn_members where event_id=p_event and user_id=p_user) then
   raise exception 'Event membership required';
 end if;
 if current_revision<>p_revision then return false; end if;
 if p_state->>'id'<>p_event::text then raise exception 'Event mismatch'; end if;
 update sn_events set state=p_state,revision=revision+1 where id=p_event;
 return true;
end $$;

create function public.sn_create(p_event uuid,p_user uuid,p_invite_hash text,p_state jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext(p_user::text));
 if (select count(*) from sn_events where host_id=p_user and created_at>now()-interval '1 day')>=5 then raise exception 'You can create up to five events a day'; end if;
 insert into sn_events(id,host_id,invite_hash,state) values(p_event,p_user,p_invite_hash,p_state);
 insert into sn_members values(p_event,p_user);
end $$;

create function public.sn_join(p_hash text,p_user uuid,p_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare e sn_events;
begin
 select * into e from sn_events where invite_hash=p_hash for update;
 if not found then raise exception 'Invitation not found'; end if;
 if exists(select 1 from sn_members where event_id=e.id and user_id=p_user) then return e.id; end if;
 if jsonb_array_length(e.state->'participants')>=30 then raise exception 'This event is full'; end if;
 insert into sn_members values(e.id,p_user);
 update sn_events set state=jsonb_set(state,'{participants}',(state->'participants')||jsonb_build_array(jsonb_build_object('id',p_user::text,'name',left(p_name,60),'adult',true))),revision=revision+1 where id=e.id;
 return e.id;
end $$;

-- Claim before calling YouCam: duplicate requests never start a second paid task.
create function public.sn_claim_preview(p_id uuid,p_user uuid,p_event uuid,p_item text,p_request uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing uuid;
begin
 perform pg_advisory_xact_lock(hashtext(p_user::text));
 select id into existing from sn_previews where user_id=p_user and request_id=p_request;
 if found then return existing; end if;
 if p_event is not null and not exists(select 1 from sn_members where event_id=p_event and user_id=p_user) then raise exception 'Event membership required';end if;
 if (select count(*) from sn_previews where user_id=p_user and created_at>now()-interval '1 day')>=5 then raise exception 'Daily preview limit reached (5). Come back tomorrow.'; end if;
 insert into sn_previews(id,user_id,event_id,item_id,request_id)values(p_id,p_user,p_event,p_item,p_request);
 return p_id;
end $$;

create function public.sn_claim_poll(p_id uuid,p_user uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare t sn_previews;
begin
 select * into t from sn_previews where id=p_id and user_id=p_user for update;
 if not found then raise exception 'Preview not found';end if;
 if t.status<>'running' or t.polls>=36 or (t.last_poll_at is not null and t.last_poll_at>now()-interval '10 seconds') then return false;end if;
 update sn_previews set polls=polls+1,last_poll_at=now() where id=p_id;
 return true;
end $$;

revoke all on function public.sn_commit(uuid,uuid,integer,jsonb),public.sn_create(uuid,uuid,text,jsonb),public.sn_join(text,uuid,text),public.sn_claim_preview(uuid,uuid,uuid,text,uuid),public.sn_claim_poll(uuid,uuid) from public,anon,authenticated;
grant execute on function public.sn_commit(uuid,uuid,integer,jsonb),public.sn_create(uuid,uuid,text,jsonb),public.sn_join(text,uuid,text),public.sn_claim_preview(uuid,uuid,uuid,text,uuid),public.sn_claim_poll(uuid,uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('swapnight','swapnight',false,15728640,array['image/jpeg','image/png','image/webp'])
on conflict(id)do nothing;
