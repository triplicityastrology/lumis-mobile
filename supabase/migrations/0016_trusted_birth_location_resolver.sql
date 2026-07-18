-- Backend-owned birthplace/timezone resolution for the current staging cities.
-- Mobile-provided tz_str is never authoritative. Add rows here as the production
-- geocoding/timezone service expands beyond the current supported locations.

create table if not exists public.birth_location_reference (
  location_key text primary key,
  place_name text not null,
  aliases text[] not null default '{}',
  country_code varchar(2) not null,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  tz_str text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.birth_location_reference enable row level security;
revoke all on table public.birth_location_reference from anon, authenticated;
grant all on table public.birth_location_reference to service_role;

insert into public.birth_location_reference (
  location_key,
  place_name,
  aliases,
  country_code,
  lat,
  lng,
  tz_str
) values
  ('hong-kong-hk', 'Hong Kong', array['hong kong'], 'HK', 22.319300, 114.169400, 'Asia/Hong_Kong'),
  ('london-gb', 'London, UK', array['london', 'london, uk'], 'GB', 51.507200, -0.127600, 'Europe/London'),
  ('new-york-us', 'New York, US', array['new york', 'new york, us'], 'US', 40.712800, -74.006000, 'America/New_York')
on conflict (location_key) do update set
  place_name = excluded.place_name,
  aliases = excluded.aliases,
  country_code = excluded.country_code,
  lat = excluded.lat,
  lng = excluded.lng,
  tz_str = excluded.tz_str,
  active = true,
  updated_at = now();

create or replace function public.resolve_trusted_birth_location(
  p_place_name text,
  p_country_code text,
  p_lat numeric,
  p_lng numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved public.birth_location_reference%rowtype;
  normalized_place text := lower(trim(regexp_replace(coalesce(p_place_name, ''), '\s+', ' ', 'g')));
begin
  if auth.role() <> 'service_role' then
    raise exception 'BIRTH_LOCATION_ACCESS_DENIED' using errcode = '42501';
  end if;

  if normalized_place = '' or nullif(trim(p_country_code), '') is null or p_lat is null or p_lng is null then
    return null;
  end if;

  select reference.*
  into resolved
  from public.birth_location_reference reference
  where reference.active
    and upper(reference.country_code) = upper(trim(p_country_code))
    and (
      lower(reference.place_name) = normalized_place
      or normalized_place = any(reference.aliases)
    )
    and abs(reference.lat - p_lat) <= 0.25
    and abs(reference.lng - p_lng) <= 0.25
  order by
    power(reference.lat - p_lat, 2) + power(reference.lng - p_lng, 2)
  limit 1;

  if resolved.location_key is null then
    return null;
  end if;

  return jsonb_build_object(
    'location_key', resolved.location_key,
    'place_name', resolved.place_name,
    'country_code', resolved.country_code,
    'lat', resolved.lat,
    'lng', resolved.lng,
    'tz_str', resolved.tz_str
  );
end;
$$;

revoke all on function public.resolve_trusted_birth_location(text, text, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.resolve_trusted_birth_location(text, text, numeric, numeric)
  to service_role;

comment on function public.resolve_trusted_birth_location(text, text, numeric, numeric) is
  'Service-only birthplace resolver. Returns backend-owned coordinates and IANA timezone; client tz_str is ignored.';
