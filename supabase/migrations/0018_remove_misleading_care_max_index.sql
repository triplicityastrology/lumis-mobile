-- The old index name implied a five-carer cap, but its columns only enforced
-- uniqueness for one caree/carer pair. The broader active-pair index already
-- provides that protection. A real maximum must be added transactionally when
-- the Care Circle backend is implemented.

drop index if exists public.care_relationships_max_five_active_carers_idx;

comment on index public.care_relationships_active_pair_idx is
  'Prevents duplicate pending/active rows for the same caree and carer. This does not enforce a maximum carer count.';
