alter table public.profiles add column if not exists email_verified_at timestamptz;

update public.profiles
set email_verified_at = created_at
where email_verified_at is null;

create table if not exists public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_verifications enable row level security;
revoke all on table public.email_verifications from anon, authenticated;
