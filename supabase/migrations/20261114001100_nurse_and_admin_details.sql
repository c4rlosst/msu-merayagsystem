-- More detail for the nurse desk and the admin page.
--
-- 1) clinic_desk_students: lets a nurse see who each listed request or visit belongs to (name, student
--    number, course, year) in one call, instead of opening every appointment. Nurses already read this
--    through clinic_request_student(); this is the same data for many appointments at once.
-- 2) list_clinic_staff now also returns each staff member's full name and last sign-in, so the admin
--    page can show who is who. The old columns are unchanged and keep their order.

begin;

create function public.clinic_desk_students(appointment_keys uuid[])
returns table (appointment_id uuid, student_number text, full_name text, course text, year_level smallint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform clinic_private.require_role('nurse');
  if coalesce(array_length(appointment_keys, 1), 0) > 200 then
    raise exception 'Too many appointments requested at once';
  end if;
  return query
    select a.id, p.student_id, p.full_name, p.course, p.year_level
    from public.appointments a
    join public.profiles p on p.user_id = a.student_id
    where a.id = any(appointment_keys);
end;
$$;

drop function public.list_clinic_staff();
create function public.list_clinic_staff()
returns table (email text, role public.clinic_staff_role, active boolean, full_name text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform clinic_private.require_role('admin');
  return query
    select u.email::text, s.role, s.active,
           coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
           u.last_sign_in_at
    from public.staff_roles s join auth.users u on u.id = s.user_id
    order by s.active desc, s.role, u.email;
end;
$$;

revoke all on function public.clinic_desk_students(uuid[]), public.list_clinic_staff()
  from public, anon, service_role;
grant execute on function public.clinic_desk_students(uuid[]), public.list_clinic_staff() to authenticated;

commit;
