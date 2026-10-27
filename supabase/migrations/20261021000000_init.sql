create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  plan_code text not null default 'free',
  plan_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.plans (
  code text primary key,
  name text not null,
  price_cents integer not null,
  duration_days integer not null,
  promo boolean not null default false,
  active boolean not null default true,
  image_daily integer not null,
  chat_daily integer not null,
  video_daily integer not null,
  max_image_size text not null,
  description text not null
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_code text not null references public.plans (code),
  amount_cents integer not null,
  status text not null check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.usage_daily (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('image', 'chat', 'video')),
  count integer not null default 0,
  primary key (user_id, day, kind)
);

create table public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  prompt text not null,
  ratio text not null,
  size text not null,
  model text not null,
  url text,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  prompt text not null,
  mode text not null,
  aspect_ratio text not null,
  seconds text not null,
  model text not null,
  provider_video_id text,
  upstream text not null default 'cn',
  url text,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);

create table public.provider_secrets (
  provider text primary key,
  api_key text not null,
  updated_at timestamptz not null default now()
);

create index images_user_created_idx on public.images (user_id, created_at desc);
create index videos_user_created_idx on public.videos (user_id, created_at desc);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

insert into public.plans (code, name, price_cents, duration_days, promo, active, image_daily, chat_daily, video_daily, max_image_size, description)
values
  ('free', '免费', 0, 0, false, true, 10, 200, 0, '1K', '每天 10 张图、200 条问答，适合先试一句。'),
  ('launch', '限时会员', 190, 30, true, true, 100, 2000, 5, '2K', '限时 1.9 元开通 30 天。每天 100 张图、2000 条问答、5 段视频。'),
  ('monthly', '月费会员', 990, 30, false, true, 100, 2000, 5, '2K', '9.9 元开通 30 天，额度和限时会员相同。');

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.password_resets enable row level security;
alter table public.plans enable row level security;
alter table public.orders enable row level security;
alter table public.usage_daily enable row level security;
alter table public.images enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.videos enable row level security;
alter table public.provider_secrets enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.password_resets from anon, authenticated;
revoke all on table public.plans from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.usage_daily from anon, authenticated;
revoke all on table public.images from anon, authenticated;
revoke all on table public.conversations from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.videos from anon, authenticated;
revoke all on table public.provider_secrets from anon, authenticated;
