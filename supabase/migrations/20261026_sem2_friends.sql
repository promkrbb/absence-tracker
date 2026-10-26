-- Semester 2/2569: scope subjects per semester + friends (buddy) view.

alter table attendance.subjects add column if not exists semester text not null default '1/2569';

create table if not exists attendance.profiles (
  user_id      uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text,
  section      text,
  share_code   text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  created_at   timestamptz not null default now()
);

create table if not exists attendance.buddies (
  viewer_id  uuid not null references auth.users on delete cascade,
  owner_id   uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, owner_id)
);

alter table attendance.profiles enable row level security;
alter table attendance.buddies  enable row level security;

-- security definer so policies can check buddies without recursing through its RLS
create or replace function attendance.is_buddy_of(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from attendance.buddies b where b.viewer_id = auth.uid() and b.owner_id = owner);
$$;

create policy "profiles: read own or friends" on attendance.profiles for select to authenticated
  using (user_id = auth.uid() or attendance.is_buddy_of(user_id));
create policy "profiles: insert own" on attendance.profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy "profiles: update own" on attendance.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "buddies: read my links" on attendance.buddies for select to authenticated
  using (viewer_id = auth.uid() or owner_id = auth.uid());

-- friends can READ each other's subjects/absences (writes stay "own rows only")
create policy "subjects: friends can read" on attendance.subjects for select to authenticated
  using (attendance.is_buddy_of(user_id));
create policy "absences: friends can read" on attendance.absences for select to authenticated
  using (attendance.is_buddy_of(user_id));

-- link both directions from a share code
create or replace function attendance.link_buddy(code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare other uuid;
begin
  if auth.uid() is null then return false; end if;
  select p.user_id into other from attendance.profiles p where p.share_code = upper(trim(code));
  if other is null or other = auth.uid() then return false; end if;
  insert into attendance.buddies (viewer_id, owner_id) values (auth.uid(), other), (other, auth.uid())
    on conflict do nothing;
  return true;
end $$;

create or replace function attendance.unlink_buddy(other uuid) returns void
language sql security definer set search_path = '' as $$
  delete from attendance.buddies
  where (viewer_id = auth.uid() and owner_id = other) or (viewer_id = other and owner_id = auth.uid());
$$;

grant select, insert, update on attendance.profiles to authenticated;
grant select on attendance.buddies to authenticated;
revoke execute on function attendance.is_buddy_of(uuid), attendance.link_buddy(text), attendance.unlink_buddy(uuid) from public, anon;
grant execute on function attendance.is_buddy_of(uuid), attendance.link_buddy(text), attendance.unlink_buddy(uuid) to authenticated;
