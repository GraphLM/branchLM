-- Initial schema for graphLM (used by web/src/flow/FlowCanvas.tsx)

-- Enable UUID generation
create extension if not exists "pgcrypto";

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_user_id_idx on public.chats (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  chat_id uuid not null references public.chats(id) on delete cascade,
  ordinal integer not null,
  role text not null check (role in ('user', 'app')),
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_user_id_idx on public.messages (user_id);
create index if not exists messages_chat_id_idx on public.messages (chat_id);
create unique index if not exists messages_chat_ordinal_uq on public.messages (chat_id, ordinal);

create table if not exists public.context_edges (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  from_message_id uuid not null references public.messages(id) on delete cascade,
  to_chat_id uuid not null references public.chats(id) on delete cascade,
  rank integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists context_edges_user_id_idx on public.context_edges (user_id);
create index if not exists context_edges_to_chat_id_idx on public.context_edges (to_chat_id);

-- NOTE: for a real app, enable RLS and replace `user_id` with auth.uid().
