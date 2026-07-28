-- App-language preference foundation. Existing rows retain request-language
-- fallback until the user explicitly chooses a supported language.

alter table public.users
  add column if not exists language_preference_set_at timestamptz;

update public.users
set
  lang = 'zh-Hant',
  language_preference_set_at = null
where lang not in ('en', 'zh-Hant');

alter table public.users
  alter column lang set default 'zh-Hant';

alter table public.users
  drop constraint if exists users_lang_allowed;
alter table public.users
  add constraint users_lang_allowed check (lang in ('en', 'zh-Hant'));

create or replace function public.update_app_language_preference(
  p_language text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_language text := trim(coalesce(p_language, ''));
  v_set_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'LANGUAGE_PREFERENCE_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if v_language not in ('en', 'zh-Hant') then
    raise exception 'LANGUAGE_PREFERENCE_INVALID' using errcode = '22023';
  end if;

  update public.users
  set
    lang = v_language,
    language_preference_set_at = v_set_at
  where id = v_user_id
    and deleted_at is null;

  if not found then
    raise exception 'LANGUAGE_PREFERENCE_ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'language_preference', v_language,
    'language_preference_set_at', v_set_at
  );
end;
$$;

revoke all on function public.update_app_language_preference(text)
  from public, anon;
grant execute on function public.update_app_language_preference(text)
  to authenticated;

comment on column public.users.language_preference_set_at is
  'Null means no explicit app-language choice; deterministic templates use request-language fallback.';
comment on function public.update_app_language_preference(text) is
  'Owner-scoped app-language update. Caller identity is always derived from auth.uid().';
