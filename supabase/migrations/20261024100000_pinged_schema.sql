-- PINGED: Grundschema
-- Alle Tabellen haben das Präfix pinged_, damit das Schema auch in einem geteilten Projekt sauber getrennt bleibt.
-- Grundsatz: Rohstandorte sieht kein Client. Jäger sehen nur Pings, die der Server erzeugt.

-- ---------- Profile ----------
create table if not exists public.pinged_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 14),
  color text not null default '#4fd88f',
  birthdate date not null,
  parent_email text,
  parent_confirmed_at timestamptz,
  emergency_contact text,
  created_at timestamptz not null default now(),
  constraint pinged_min_age check (birthdate <= (current_date - interval '14 years'))
);

-- ---------- Einwilligungen (nur anhängen, nie ändern: Nachweis nach Art. 7 Abs. 1 DSGVO) ----------
create table if not exists public.pinged_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('agb', 'datenschutz', 'sicherheit', 'loc', 'cam', 'mic', 'push', 'stats', 'parent', 'round_loc', 'round_film')),
  granted boolean not null,
  doc_version text not null default '2026-10-24',
  round_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists pinged_consents_user_idx on public.pinged_consents (user_id, kind, created_at desc);

-- ---------- Runden ----------
create table if not exists public.pinged_rounds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'classic' check (mode in ('classic', 'traitor', 'infect', 'zone', 'mrx')),
  max_players int not null default 6 check (max_players between 2 and 100),
  duration_min int not null default 45,
  ping_every_min int not null default 3,
  head_start_min int not null default 3,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m int not null default 320 check (radius_m between 100 and 3000),
  loot boolean not null default false,
  voice boolean not null default false,
  status text not null default 'lobby' check (status in ('lobby', 'running', 'paused', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pinged_round_players (
  round_id uuid not null references public.pinged_rounds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  team text check (team in ('hunter', 'runner')),
  is_traitor boolean not null default false,
  is_mrx boolean not null default false,
  location_consent_at timestamptz,
  film_consent boolean not null default false,
  caught_at timestamptz,
  caught_by uuid references auth.users (id),
  joined_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

-- ---------- Standorte und Pings ----------
-- Rohstandorte: nur der Spieler selbst schreibt, niemand liest per API. Löschung 24 h nach Rundenende.
create table if not exists public.pinged_positions (
  id bigint generated always as identity primary key,
  round_id uuid not null references public.pinged_rounds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  recorded_at timestamptz not null default now()
);
create index if not exists pinged_positions_round_idx on public.pinged_positions (round_id, user_id, recorded_at desc);

-- Pings: vom Server erzeugt, für Jäger und Verräter der Runde lesbar
create table if not exists public.pinged_pings (
  id bigint generated always as identity primary key,
  round_id uuid not null references public.pinged_rounds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  fuzzy_radius_m int,
  kind text not null default 'ping' check (kind in ('ping', 'tip', 'out', 'sos')),
  created_at timestamptz not null default now()
);
create index if not exists pinged_pings_round_idx on public.pinged_pings (round_id, created_at desc);

-- ---------- Käufe, Meldungen ----------
create table if not exists public.pinged_purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete restrict,
  store text not null check (store in ('apple', 'google', 'web')),
  transaction_id text not null unique,
  product text not null default 'pinged_pass',
  price_eur numeric(6, 2) not null default 19.99,
  exec_consent boolean not null,
  withdrawal_waived boolean not null,
  parent_consent boolean,
  purchased_at timestamptz not null default now()
);

create table if not exists public.pinged_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_id uuid not null references auth.users (id) on delete cascade,
  round_id uuid references public.pinged_rounds (id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'closed')),
  created_at timestamptz not null default now()
);

-- ---------- Hilfsfunktionen ----------
create or replace function public.pinged_is_player(r uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pinged_round_players where round_id = r and user_id = auth.uid());
$$;

create or replace function public.pinged_sees_pings(r uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pinged_round_players
    where round_id = r and user_id = auth.uid() and (team = 'hunter' or is_traitor)
  );
$$;

create or replace function public.pinged_has_pass(u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from pinged_purchases where user_id = u and product = 'pinged_pass');
$$;

-- Erzeugt einen Ping aus dem letzten Standort jedes noch freien Läufers (vom Host oder per Cron aufgerufen)
create or replace function public.pinged_emit_pings(r uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from pinged_rounds where id = r and status = 'running'
                 and (host_id = auth.uid() or auth.role() = 'service_role')) then
    raise exception 'Runde läuft nicht oder du bist nicht der Host';
  end if;
  insert into pinged_pings (round_id, user_id, lat, lng, fuzzy_radius_m)
  select distinct on (p.user_id) p.round_id, p.user_id, p.lat, p.lng,
         case when rp.is_mrx then 60 else null end
  from pinged_positions p
  join pinged_round_players rp on rp.round_id = p.round_id and rp.user_id = p.user_id
  where p.round_id = r and rp.team = 'runner' and rp.caught_at is null
    and p.recorded_at > now() - interval '2 minutes'
  order by p.user_id, p.recorded_at desc;
  get diagnostics n = row_count;
  return n;
end $$;

-- Löscht Rohstandorte 24 h nach Rundenende (Datenschutzerklärung 2.2)
create or replace function public.pinged_cleanup_positions()
returns void language sql security definer set search_path = public as $$
  delete from pinged_positions p using pinged_rounds r
  where p.round_id = r.id and r.status = 'ended' and r.ended_at < now() - interval '24 hours';
  delete from pinged_pings g using pinged_rounds r
  where g.round_id = r.id and r.status = 'ended' and r.ended_at < now() - interval '30 days';
$$;

-- ---------- Row Level Security ----------
alter table public.pinged_profiles enable row level security;
alter table public.pinged_consents enable row level security;
alter table public.pinged_rounds enable row level security;
alter table public.pinged_round_players enable row level security;
alter table public.pinged_positions enable row level security;
alter table public.pinged_pings enable row level security;
alter table public.pinged_purchases enable row level security;
alter table public.pinged_reports enable row level security;

create policy "profil: eigenes lesen" on public.pinged_profiles for select using (id = auth.uid());
create policy "profil: eigenes anlegen" on public.pinged_profiles for insert with check (id = auth.uid());
create policy "profil: eigenes ändern" on public.pinged_profiles for update using (id = auth.uid());
create policy "profil: eigenes löschen" on public.pinged_profiles for delete using (id = auth.uid());

create policy "einwilligung: eigene lesen" on public.pinged_consents for select using (user_id = auth.uid());
create policy "einwilligung: eigene anlegen" on public.pinged_consents for insert with check (user_id = auth.uid());

create policy "runde: spieler lesen" on public.pinged_rounds for select using (host_id = auth.uid() or public.pinged_is_player(id));
create policy "runde: host anlegen" on public.pinged_rounds for insert with check (host_id = auth.uid());
create policy "runde: host ändern" on public.pinged_rounds for update using (host_id = auth.uid());

create policy "spieler: mitspieler lesen" on public.pinged_round_players for select using (public.pinged_is_player(round_id));
create policy "spieler: selbst beitreten" on public.pinged_round_players for insert with check (user_id = auth.uid() and location_consent_at is not null);
create policy "spieler: selbst ändern" on public.pinged_round_players for update using (user_id = auth.uid());
create policy "spieler: selbst verlassen" on public.pinged_round_players for delete using (user_id = auth.uid());

-- Positionen: nur schreiben, nur in laufenden Runden, in denen man zugestimmt hat. Kein select-Recht für Clients.
create policy "position: eigene schreiben" on public.pinged_positions for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.pinged_round_players rp join public.pinged_rounds r on r.id = rp.round_id
    where rp.round_id = pinged_positions.round_id and rp.user_id = auth.uid()
      and rp.location_consent_at is not null and r.status = 'running'
  )
);

create policy "ping: jäger lesen" on public.pinged_pings for select using (public.pinged_sees_pings(round_id) or user_id = auth.uid());

create policy "kauf: eigene lesen" on public.pinged_purchases for select using (user_id = auth.uid());

create policy "meldung: anlegen" on public.pinged_reports for insert with check (reporter_id = auth.uid());
create policy "meldung: eigene lesen" on public.pinged_reports for select using (reporter_id = auth.uid());

-- Realtime für Pings und Rundenstatus
do $$ begin
  alter publication supabase_realtime add table public.pinged_pings;
  alter publication supabase_realtime add table public.pinged_rounds;
  alter publication supabase_realtime add table public.pinged_round_players;
exception when others then null; end $$;

-- Spieler dürfen an ihrer Teilnahme nur Zustimmungen ändern, nicht Team, Verräter-Rolle oder Fang-Status
revoke update on public.pinged_round_players from anon, authenticated;
grant update (film_consent, location_consent_at) on public.pinged_round_players to authenticated;

-- Funktionen nur für angemeldete Nutzer bzw. den Server
revoke execute on function public.pinged_emit_pings(uuid) from public, anon;
grant execute on function public.pinged_emit_pings(uuid) to authenticated;
revoke execute on function public.pinged_cleanup_positions() from public, anon, authenticated;
revoke execute on function public.pinged_has_pass(uuid) from public, anon;
grant execute on function public.pinged_has_pass(uuid) to authenticated;
