begin;

create table public.care_circle_inbox_events (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  relationship_id uuid not null references public.care_relationships(id) on delete cascade,
  event_type text not null check (event_type in ('carer_request_pending', 'caree_request_accepted')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (recipient_user_id, relationship_id, event_type)
);

alter table public.care_circle_inbox_events enable row level security;
revoke all on table public.care_circle_inbox_events from anon, authenticated;
grant all on table public.care_circle_inbox_events to service_role;

create or replace function public.record_care_circle_lifecycle_inbox_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending_caree_acceptance' then
    insert into public.care_circle_inbox_events(recipient_user_id, relationship_id, event_type)
    values (new.caree_user_id, new.id, 'carer_request_pending')
    on conflict do nothing;
  elsif tg_op = 'UPDATE' and new.status = 'active' and old.status is distinct from 'active' then
    insert into public.care_circle_inbox_events(recipient_user_id, relationship_id, event_type)
    values (new.carer_user_id, new.id, 'caree_request_accepted')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger care_circle_lifecycle_inbox_event
after insert or update of status on public.care_relationships
for each row execute function public.record_care_circle_lifecycle_inbox_event();

create or replace function public.list_care_circle_inbox()
returns table(event_type text, unread boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = '48007';
  end if;
  return query
    select event.event_type, event.read_at is null
    from public.care_circle_inbox_events event
    where event.recipient_user_id = auth.uid()
    order by event.created_at desc, event.event_type
    limit 25;
end;
$$;

revoke all on function public.list_care_circle_inbox() from public, anon;
grant execute on function public.list_care_circle_inbox() to authenticated, service_role;

commit;
