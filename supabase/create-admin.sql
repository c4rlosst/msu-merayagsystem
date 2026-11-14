-- Create the first administrator (run once; not a migration).
--
-- 1. Supabase dashboard → Authentication → Users → Add user → Create new user.
--    Email:    a01@admins.merayag.invalid   (the ID A-01 without the dash, then @admins.merayag.invalid)
--    Password: choose one (at least 6 characters)
--    Tick "Auto Confirm User". The address never receives mail; the ID A-01 is what you type to sign in.
-- 2. Run this in the SQL Editor (change the email and name to match):

insert into public.staff_roles (user_id, role)
select id, 'admin' from auth.users where email = 'a01@admins.merayag.invalid'
on conflict (user_id) do update set role = 'admin', active = true;

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', 'Your Name')
where email = 'a01@admins.merayag.invalid';

-- 3. Sign in at /nurse-login (the staff log in) with the ID A-01 and your password.
--    More administrators: repeat with A-02, A-03, ...
--    Nurses are added from the admin page, so there is no SQL for them.
