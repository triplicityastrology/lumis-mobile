-- S2-T161 count-only Persona compatibility audit. Review and run manually only
-- after independently confirming staging project bmqhwofmdgebpcihjlnb.
-- Business Systems v1.1 / reconciliation v0.2 and S2-T159 are authority.
begin transaction read only;

with classifications as (
  select
    'users'::text as boundary_name,
    count(*) filter (where role in ('empathetic_peer', 'harmonious_catalyst', 'saturnian_anchor'))::bigint as stable_code_records,
    count(*) filter (
      where role not in ('empathetic_peer', 'harmonious_catalyst', 'saturnian_anchor')
        and persona_style in ('acceptance', 'spark', 'awareness')
    )::bigint as accepted_legacy_alias_records,
    count(*) filter (
      where nullif(trim(persona_style), '') is not null
        and persona_style not in (
          'acceptance', 'spark', 'awareness',
          'empathetic_peer', 'harmonious_catalyst', 'saturnian_anchor'
        )
    )::bigint as unknown_label_only_records,
    count(*) filter (where nullif(trim(persona_style), '') is null)::bigint as null_empty_records
  from public.users

  union all

  select
    'chat_threads',
    count(*) filter (where persona_style in ('empathetic_peer', 'harmonious_catalyst', 'saturnian_anchor'))::bigint,
    count(*) filter (where persona_style in ('acceptance', 'spark', 'awareness'))::bigint,
    count(*) filter (
      where nullif(trim(persona_style), '') is not null
        and persona_style not in (
          'acceptance', 'spark', 'awareness',
          'empathetic_peer', 'harmonious_catalyst', 'saturnian_anchor'
        )
    )::bigint,
    count(*) filter (where nullif(trim(persona_style), '') is null)::bigint
  from public.chat_threads

  union all

  select
    'chat_message_request_snapshots',
    count(*) filter (where request_persona_style in ('empathetic_peer', 'harmonious_catalyst', 'saturnian_anchor'))::bigint,
    count(*) filter (where request_persona_style in ('acceptance', 'spark', 'awareness'))::bigint,
    count(*) filter (
      where nullif(trim(request_persona_style), '') is not null
        and request_persona_style not in (
          'acceptance', 'spark', 'awareness',
          'empathetic_peer', 'harmonious_catalyst', 'saturnian_anchor'
        )
    )::bigint,
    count(*) filter (where nullif(trim(request_persona_style), '') is null)::bigint
  from public.chat_messages
)
select
  boundary_name,
  stable_code_records,
  accepted_legacy_alias_records,
  unknown_label_only_records,
  null_empty_records
from classifications
order by boundary_name;

rollback;
