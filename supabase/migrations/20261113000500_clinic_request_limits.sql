begin;
create table clinic_private.request_limits (
  scope text not null,
  fingerprint text not null,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key (scope, fingerprint)
);
alter table clinic_private.request_limits enable row level security;
create policy request_limits_server_only on clinic_private.request_limits as restrictive
  for all to anon, authenticated using (false) with check (false);

create function public.consume_clinic_limit(limit_scope text, limit_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  boundary timestamptz := date_trunc('minute', statement_timestamp());
  used integer;
begin
  if limit_scope not in ('sign_in_ip', 'sign_in_email', 'booking') or limit_key !~ '^[a-f0-9]{64}$' then
    return false;
  end if;
  insert into clinic_private.request_limits as limits (scope, fingerprint, window_start, attempts)
  values (limit_scope, limit_key, boundary, 1)
  on conflict (scope, fingerprint) do update
    set attempts = case when limits.window_start < boundary then 1 else least(limits.attempts + 1, 100) end,
        window_start = greatest(limits.window_start, boundary)
  returning attempts into used;
  return used <= case limit_scope when 'sign_in_ip' then 20 else 5 end;
end;
$$;
revoke all on function public.consume_clinic_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_clinic_limit(text, text) to service_role;
commit;
