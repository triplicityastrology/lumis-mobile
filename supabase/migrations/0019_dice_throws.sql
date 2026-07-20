-- Dice mini-game throw history (AC-DICE-01 §6).
-- Every throw persists as its own row until the user deletes it — including
-- chat-initiated throws (source = 'chat') — independent of chat-session deletion.
-- Symbols are stored as stable face keys (see apps/mobile src/features/dice/constants.ts);
-- results are drawn client-side by app physics, never by the model.

create table if not exists public.dice_throws (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question text,
  planet_key varchar(24) not null,
  sign_key varchar(24) not null,
  house_key varchar(24) not null,
  source varchar(12) not null default 'dice_tab'
    check (source in ('dice_tab', 'chat')),
  -- Set once the interpretation is generated (route.dice charges at that moment);
  -- null for throws the user never asked Lumis to read.
  interpretation_message_id uuid,
  created_at timestamptz not null default now()
);

alter table public.dice_throws enable row level security;

create policy "users can read own dice throws" on public.dice_throws
  for select using (auth.uid() = user_id);

create policy "users can insert own dice throws" on public.dice_throws
  for insert with check (auth.uid() = user_id);

create policy "users can delete own dice throws" on public.dice_throws
  for delete using (auth.uid() = user_id);

create index if not exists dice_throws_user_created_idx
  on public.dice_throws (user_id, created_at desc);
