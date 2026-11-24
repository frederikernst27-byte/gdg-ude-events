-- Click tracking for the GDG event landing page.
-- Raw events live in their own schema that the public API cannot reach.
-- Only the edge functions (service role) call gdg_track / gdg_stats.

create schema if not exists gdg_events;
revoke all on schema gdg_events from public, anon, authenticated;

create table if not exists gdg_events.track (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null check (name in ('page_view', 'register_click', 'more_event_click', 'more_link_click')),
  event_id   bigint,
  mode       text,
  target     text,
  src        text,
  path       text,
  referrer   text,
  session    text
);
create index if not exists track_created_at_idx on gdg_events.track (created_at);
alter table gdg_events.track enable row level security;

-- Insert one event (payload is validated by the gdg-track edge function).
create or replace function public.gdg_track(p jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into gdg_events.track (name, event_id, mode, target, src, path, referrer, session)
  values (
    p ->> 'name',
    case when (p ->> 'event_id') ~ '^\d{1,12}$' then (p ->> 'event_id')::bigint end,
    left(p ->> 'mode', 20),
    left(p ->> 'target', 40),
    left(p ->> 'src', 60),
    left(p ->> 'path', 300),
    left(p ->> 'referrer', 300),
    left(p ->> 'session', 64)
  );
$$;

-- Aggregates for the dashboard. No raw rows leave the database.
create or replace function public.gdg_stats(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select *, coalesce(nullif(src, ''), 'direct') as source
    from gdg_events.track
    where created_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
  )
  select jsonb_build_object(
    'days', greatest(1, least(p_days, 365)),
    'generated_at', now(),
    'totals', (
      select jsonb_build_object(
        'views', count(*) filter (where name = 'page_view'),
        'register', count(*) filter (where name = 'register_click'),
        'more_events', count(*) filter (where name = 'more_event_click'),
        'more_links', count(*) filter (where name = 'more_link_click'),
        'visitors', count(distinct session) filter (where name = 'page_view'),
        'registered_visitors', count(distinct session) filter (where name = 'register_click')
      ) from t
    ),
    'daily', coalesce((
      select jsonb_agg(d order by d.day) from (
        select (created_at at time zone 'Europe/Berlin')::date as day,
               count(*) filter (where name = 'page_view') as views,
               count(*) filter (where name = 'register_click') as register
        from t group by 1
      ) d
    ), '[]'::jsonb),
    'by_source', coalesce((
      select jsonb_agg(s order by s.views desc, s.register desc) from (
        select source as src,
               count(*) filter (where name = 'page_view') as views,
               count(*) filter (where name = 'register_click') as register,
               count(distinct session) filter (where name = 'page_view') as visitors
        from t group by 1
      ) s
    ), '[]'::jsonb),
    'by_event', coalesce((
      select jsonb_agg(e order by e.views desc) from (
        select event_id,
               count(*) filter (where name = 'page_view') as views,
               count(*) filter (where name = 'register_click') as register
        from t where event_id is not null and name in ('page_view', 'register_click')
        group by 1
      ) e
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(l order by l.clicks desc) from (
        select target, count(*) as clicks from t
        where name = 'more_link_click' group by 1
      ) l
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.gdg_track(jsonb) from public, anon, authenticated;
revoke execute on function public.gdg_stats(int) from public, anon, authenticated;
grant execute on function public.gdg_track(jsonb) to service_role;
grant execute on function public.gdg_stats(int) to service_role;
