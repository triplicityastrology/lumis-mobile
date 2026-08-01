-- Owner-safe, idempotent Past Reflection deletion. Not deployed by this source task.

create table if not exists public.reflection_deletion_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  client_request_id uuid not null,
  thread_id uuid not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, client_request_id)
);

alter table public.reflection_deletion_requests enable row level security;
revoke all on table public.reflection_deletion_requests from anon, authenticated;

create or replace function public.delete_owned_reflection(
  p_thread_id uuid,
  p_client_request_id uuid
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_thread_id uuid;
  v_completed_at timestamptz;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'REFLECTION_AUTH_REQUIRED';
  end if;
  if p_thread_id is null or p_client_request_id is null then
    raise no_data_found using message = 'REFLECTION_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_client_request_id::text, 0));

  select thread_id, completed_at
    into v_existing_thread_id, v_completed_at
    from public.reflection_deletion_requests
   where user_id = v_user_id
     and client_request_id = p_client_request_id;

  if found then
    if v_existing_thread_id <> p_thread_id then
      raise unique_violation using message = 'REFLECTION_REQUEST_CONFLICT';
    end if;
    if v_completed_at is not null then
      return 'already_deleted';
    end if;
  else
    if not exists (
      select 1
        from public.chat_threads
       where id = p_thread_id
         and user_id = v_user_id
       for update
    ) then
      raise no_data_found using message = 'REFLECTION_NOT_FOUND';
    end if;
    insert into public.reflection_deletion_requests (user_id, client_request_id, thread_id)
    values (v_user_id, p_client_request_id, p_thread_id);
  end if;

  delete from public.chat_threads
   where id = p_thread_id
     and user_id = v_user_id;
  if not found then
    raise no_data_found using message = 'REFLECTION_NOT_FOUND';
  end if;

  update public.reflection_deletion_requests
     set completed_at = now()
   where user_id = v_user_id
     and client_request_id = p_client_request_id;
  return 'deleted';
end;
$$;

revoke all on function public.delete_owned_reflection(uuid, uuid) from public, anon;
grant execute on function public.delete_owned_reflection(uuid, uuid) to authenticated;

comment on function public.delete_owned_reflection(uuid, uuid) is
  'Deletes one authenticated owner chat thread; dependent messages cascade and retries are idempotent.';
