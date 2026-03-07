alter table public.chats
  add column if not exists width double precision null,
  add column if not exists height double precision null;
