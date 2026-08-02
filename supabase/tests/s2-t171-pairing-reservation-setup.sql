\set ON_ERROR_STOP on
insert into public.users (id, display_name, account_mode)
select
  ('30000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid,
  'Synthetic Reservation Caree ' || value,
  'standard'
from generate_series(1, 22) value;

insert into public.account_entitlements (user_id, plan_tier, product_code, status, source)
select
  ('30000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid,
  'essential',
  'ESSENTIAL_M',
  'active',
  'admin'
from generate_series(1, 22) value;
