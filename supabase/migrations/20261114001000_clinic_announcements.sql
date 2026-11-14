-- Infirmary announcements: nurses post short notices (for example a closure) and every signed-in
-- student sees the recent ones on their home screen.
--
-- Everyone signed in can read current announcements. Only nurses can post or remove them, and only
-- through the two functions below, which also write to the audit log like the other clinic actions.

begin;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 600),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz
);
create index announcements_recent_idx on public.announcements (created_at desc);

alter table public.announcements enable row level security;
grant select on public.announcements to authenticated;
create policy announcements_read on public.announcements for select to authenticated
  using (expires_at is null or expires_at > now());
create policy announcements_staff_read on public.announcements for select to authenticated
  using ((select public.current_clinic_role()) in ('nurse', 'admin'));

create function public.post_clinic_announcement(
  announcement_title text, announcement_body text, show_until date default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := clinic_private.require_role('nurse');
  created public.announcements;
begin
  if char_length(btrim(coalesce(announcement_title, ''))) not between 1 and 120
     or char_length(btrim(coalesce(announcement_body, ''))) not between 1 and 600 then
    raise exception 'Enter a title up to 120 characters and a message up to 600 characters';
  end if;
  if show_until is not null and show_until < (now() at time zone 'Asia/Manila')::date then
    raise exception 'Choose today or a later date for the last day to show this';
  end if;
  insert into public.announcements (title, body, created_by, expires_at)
  values (btrim(announcement_title), btrim(announcement_body), actor,
          case when show_until is null then null else ((show_until + 1)::timestamp at time zone 'Asia/Manila') end)
  returning * into created;
  perform clinic_private.log_event('announcement_posted', 'announcement', created.id, null, null,
    jsonb_build_object('title', created.title));
  return created.id;
end;
$$;

create function public.remove_clinic_announcement(announcement_key uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  removed public.announcements;
begin
  perform clinic_private.require_role('nurse');
  delete from public.announcements where id = announcement_key returning * into removed;
  if not found then
    raise exception 'That announcement no longer exists';
  end if;
  perform clinic_private.log_event('announcement_removed', 'announcement', removed.id, null,
    jsonb_build_object('title', removed.title), null);
end;
$$;

revoke all on function public.post_clinic_announcement(text, text, date), public.remove_clinic_announcement(uuid)
  from public, anon, service_role;
grant execute on function public.post_clinic_announcement(text, text, date), public.remove_clinic_announcement(uuid)
  to authenticated;

commit;
