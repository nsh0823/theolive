-- Extend profiles (migration 2). The applied create_profiles migration is not edited.
-- Email, phone and login provider stay in auth.users only.

alter table public.profiles
  add column nickname text not null default '올리브 회원'
    check (char_length(nickname) between 1 and 20),
  add column created_at timestamptz not null default now(),
  add column deleted_at timestamptz;

update public.profiles set updated_at = now() where updated_at is null;
alter table public.profiles alter column updated_at set not null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- A customer may change only nickname and avatar; never id, username, deleted_at or timestamps.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nickname, avatar_url) on public.profiles to authenticated;

-- Fill the nickname (and avatar) from provider metadata. Kakao sends `nickname`/`name`, Google `full_name`/`name`,
-- Apple sends nothing, so the default nickname applies.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  picked_nickname text;
begin
  picked_nickname := left(
    nullif(btrim(coalesce(meta ->> 'nickname', meta ->> 'name', meta ->> 'full_name', '')), ''),
    20
  );
  insert into public.profiles (id, nickname, avatar_url)
  values (
    new.id,
    coalesce(picked_nickname, '올리브 회원'),
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), '')
  );
  return new;
end;
$$;
