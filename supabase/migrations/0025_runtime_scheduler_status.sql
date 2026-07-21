-- Service-only scheduler evidence without exposing cron commands or secrets.
create or replace function public.runtime_scheduler_status()
returns jsonb
language sql
security definer
set search_path = public, cron
as $$
  with expected(job_name, expected_schedule) as (
    values
      ('lumis-runtime-alerts'::text, '*/15 * * * *'::text),
      ('lumis-runtime-retention'::text, '20 2 * * *'::text),
      ('lumis-external-sync-daily-report'::text, '30 2 * * *'::text)
  ), scheduler_jobs as (
    select
      expected.job_name,
      expected.expected_schedule,
      job.jobid,
      job.schedule,
      job.active,
      latest.status as latest_status,
      latest.start_time as latest_started_at,
      latest.end_time as latest_finished_at
    from expected
    left join cron.job job on job.jobname = expected.job_name
    left join lateral (
      select detail.status, detail.start_time, detail.end_time
      from cron.job_run_details detail
      where detail.jobid = job.jobid
      order by detail.start_time desc
      limit 1
    ) latest on true
  )
  select jsonb_build_object(
    'checked_at', now(),
    'all_configured', bool_and(
      jobid is not null
      and active is true
      and schedule = expected_schedule
    ),
    'all_have_successful_run', bool_and(latest_status = 'succeeded'),
    'jobs', jsonb_agg(jsonb_build_object(
      'name', job_name,
      'expected_schedule', expected_schedule,
      'schedule', schedule,
      'active', coalesce(active, false),
      'latest_status', latest_status,
      'latest_started_at', latest_started_at,
      'latest_finished_at', latest_finished_at
    ) order by job_name)
  )
  from scheduler_jobs;
$$;

revoke all on function public.runtime_scheduler_status()
  from public, anon, authenticated;
grant execute on function public.runtime_scheduler_status()
  to service_role;

comment on function public.runtime_scheduler_status() is
  'Backend-only proof of expected Lumis pg_cron schedules and their latest execution status; cron commands are intentionally omitted.';
