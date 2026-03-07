-- Initial schema for branchLM (multi-workspace), including chat model and context snapshots.

create extension if not exists "pgcrypto";

drop table if exists public.context_edges;
drop table if exists public.context_node_assets;
drop table if exists public.context_node_chat_links;
drop table if exists public.context_nodes;
drop table if exists public.chat_context_messages;
drop table if exists public.messages;
drop table if exists public.chats;
drop table if exists public.workspaces;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspaces_user_id_idx on public.workspaces (user_id);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  model text null,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_user_id_workspace_id_idx on public.chats (user_id, workspace_id);

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

create table if not exists public.context_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  backboard_thread_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists context_nodes_user_workspace_idx
  on public.context_nodes (user_id, workspace_id);

create table if not exists public.context_node_chat_links (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  from_context_node_id uuid not null references public.context_nodes(id) on delete cascade,
  to_chat_id uuid not null references public.chats(id) on delete cascade,
  rank integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists context_node_links_user_chat_idx
  on public.context_node_chat_links (user_id, to_chat_id);

create table if not exists public.context_node_assets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  context_node_id uuid not null references public.context_nodes(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null default 0,
  backboard_document_id text null,
  status text not null default 'stored',
  status_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists context_node_assets_user_node_idx
  on public.context_node_assets (user_id, context_node_id);

create table if not exists public.chat_context_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  to_chat_id uuid not null references public.chats(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  role text not null check (role in ('user', 'app')),
  text text not null,
  rank integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists chat_context_messages_chat_message_uq
  on public.chat_context_messages (to_chat_id, message_id);
create index if not exists chat_context_messages_to_chat_rank_idx
  on public.chat_context_messages (to_chat_id, rank);

-- NOTE: for a real app, enable RLS and replace `user_id` with auth.uid().
