begin;

alter table public.staff_roles add column active boolean not null default true;

create or replace function public.current_clinic_role()
returns text language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select role::text from public.staff_roles where user_id = (select auth.uid()) and active
  ), 'student');
$$;

create or replace function clinic_private.require_role(expected text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or public.current_clinic_role() <> expected then
    raise exception 'This action requires the % role', expected using errcode = '42501';
  end if;
  return actor;
end;
$$;

create or replace function clinic_private.log_event(
  event_action text, target_kind text, target uuid, reference text,
  previous jsonb, current jsonb
)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (
    actor_id, actor_role, action, target_type, target_id, reference_number, before_summary, after_summary
  ) values (
    auth.uid(), public.current_clinic_role(), event_action, target_kind, target, reference, previous, current
  );
$$;

create function public.list_clinic_staff()
returns table (email text, role public.clinic_staff_role, active boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform clinic_private.require_role('admin');
  return query
    select u.email::text, s.role, s.active
    from public.staff_roles s join auth.users u on u.id = s.user_id
    order by s.active desc, s.role, u.email;
end;
$$;

create function public.manage_clinic_staff(
  staff_email text, staff_role public.clinic_staff_role, enable_access boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  previous public.staff_roles;
begin
  perform clinic_private.require_role('admin');
  if staff_role is null or staff_role = 'admin' or enable_access is null then
    raise exception 'Choose nurse or physician access';
  end if;

  select id into target from auth.users
  where lower(email) = lower(btrim(staff_email)) and email_confirmed_at is not null
  for update;
  if not found then
    raise exception 'This email needs a verified clinic account first';
  end if;

  select * into previous from public.staff_roles where user_id = target for update;
  if previous.role = 'admin' then
    raise exception 'Administrator access is managed separately';
  end if;
  if not enable_access and previous.user_id is null then
    raise exception 'This account has no staff access to remove';
  end if;
  if not enable_access then
    staff_role := previous.role;
  end if;
  if previous.role = staff_role and previous.active = enable_access then
    return;
  end if;

  insert into public.staff_roles (user_id, role, active)
  values (target, staff_role, enable_access)
  on conflict (user_id) do update set role = excluded.role, active = excluded.active;

  perform clinic_private.log_event('staff_access_changed', 'staff_role', target, null,
    case when previous.user_id is not null then jsonb_build_object('role', previous.role, 'active', previous.active) end,
    jsonb_build_object('role', staff_role, 'active', enable_access));
end;
$$;

revoke all on function public.list_clinic_staff(),
  public.manage_clinic_staff(text, public.clinic_staff_role, boolean) from public, anon, service_role;
grant execute on function public.list_clinic_staff(),
  public.manage_clinic_staff(text, public.clinic_staff_role, boolean) to authenticated;

commit;
