-- Prevent legacy provider debug payloads from surviving in client-readable
-- chart data. Migration 0008 is also hardened for fresh environments; this
-- forward migration protects staging databases where 0008 already ran.

update public.ai_profiles
set chart_json = chart_json - 'rawProviderResponse'
where chart_json ? 'rawProviderResponse';

update public.birth_data_history
set chart_json = chart_json - 'rawProviderResponse'
where chart_json ? 'rawProviderResponse';

create or replace function public.strip_raw_provider_response_from_chart_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.chart_json is not null then
    new.chart_json := new.chart_json - 'rawProviderResponse';
  end if;

  return new;
end;
$$;

revoke all on function public.strip_raw_provider_response_from_chart_history() from public;
revoke all on function public.strip_raw_provider_response_from_chart_history() from anon, authenticated;

drop trigger if exists strip_raw_provider_response_from_chart_history
  on public.birth_data_history;

create trigger strip_raw_provider_response_from_chart_history
before insert or update of chart_json on public.birth_data_history
for each row
execute function public.strip_raw_provider_response_from_chart_history();
