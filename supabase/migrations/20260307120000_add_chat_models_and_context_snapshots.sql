alter table if exists public.chats
  add column if not exists model text null;

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
