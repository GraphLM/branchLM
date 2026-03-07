-- Minimal schema for branchLM chat nodes.
-- Run in the Supabase SQL editor if tables do not exist.

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
