-- Darts: EIN gemeinsamer Spielstand fuer alle Geraete (App-Version 1.47).
-- Projekt ijxlbeezxfoxzrgtbyhn (teilt es sich mit lernapp_*), Vorbild lernapp_pull/push.
--
-- Schutzmodell: kein Konto. Der 12-stellige Code IST das Passwort (32^12 = 1,2e18).
-- Die Tabelle ist fuer anon/authenticated komplett gesperrt (RLS an, KEINE Policy,
-- dazu REVOKE - die Default-ACL in public gaebe jeder neuen Tabelle sonst anon-Vollrechte,
-- Befund J im rls-auditor-Bericht lernapp 14.09.2026). Lesen und schreiben geht nur ueber
-- die zwei SECURITY-DEFINER-Funktionen unten, und die verlangen den Code.
-- Keine Secrets in dieser Datei.

create table if not exists public.darts_stand (
  code       text primary key check (code ~ '^[A-HJ-NP-Z2-9]{12}$'),
  data       jsonb not null,
  rev        bigint not null default 1,
  geraet     text,
  updated_at timestamptz not null default now()
);

alter table public.darts_stand enable row level security;
revoke all on public.darts_stand from anon, authenticated, public;

-- Holen. p_rev = die Fassung, die das Geraet schon kennt: ist sie aktuell, kommt nur
-- {rev, gleich:true} zurueck statt des ganzen Stands (der 60-Sekunden-Takt kostet so
-- fast nichts). Unbekannter Code -> null.
create or replace function public.darts_pull(p_code text, p_rev bigint default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r public.darts_stand;
begin
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{12}$' then
    return jsonb_build_object('fehler', 'code');
  end if;
  select * into r from public.darts_stand where code = p_code;
  if not found then
    return null;
  end if;
  if p_rev is not null and p_rev = r.rev then
    return jsonb_build_object('rev', r.rev, 'gleich', true);
  end if;
  return jsonb_build_object('rev', r.rev, 'data', r.data);
end;
$$;

-- Schreiben mit optimistischer Sperre: nur wenn p_rev die aktuelle Fassung ist.
-- Sonst {konflikt:true, rev, data} - das Geraet vereinigt neu und versucht es wieder.
-- p_rev = 0 heisst "neu anlegen" und geht nur, wenn es den Code noch nicht gibt
-- (nie in einen fremden Stand hineinschreiben).
-- Verlustschutz: jedes Spiel, das in der Cloud liegt, muss im neuen Stand entweder
-- noch stehen oder einen Grabstein (grab."h:<id>") haben. Ein leerer Stand von
-- einem frischen Geraet kann so nie einen vollen ueberschreiben.
create or replace function public.darts_push(p_code text, p_data jsonb, p_rev bigint, p_geraet text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  r public.darts_stand;
  n_alt int;
  n_neu int;
  n_grab int := 0;
begin
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{12}$' then
    return jsonb_build_object('fehler', 'code');
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data->'history') is distinct from 'array'
     or jsonb_typeof(p_data->'roster') is distinct from 'array' then
    return jsonb_build_object('fehler', 'format');
  end if;
  if octet_length(p_data::text) > 2000000 then
    return jsonb_build_object('fehler', 'zu_gross');
  end if;

  select * into r from public.darts_stand where code = p_code for update;

  if not found then
    if coalesce(p_rev, 0) <> 0 then
      return jsonb_build_object('fehler', 'unbekannt');
    end if;
    -- Deckel gegen Vollmuellen: weit ueber jedem echten Bedarf.
    if (select count(*) from public.darts_stand) >= 5000 then
      return jsonb_build_object('fehler', 'voll');
    end if;
    begin
      insert into public.darts_stand (code, data, rev, geraet)
      values (p_code, p_data, 1, left(p_geraet, 40));
    exception when unique_violation then
      select * into r from public.darts_stand where code = p_code;
      return jsonb_build_object('konflikt', true, 'rev', r.rev, 'data', r.data);
    end;
    return jsonb_build_object('ok', true, 'rev', 1);
  end if;

  if p_rev is null or p_rev <> r.rev then
    return jsonb_build_object('konflikt', true, 'rev', r.rev, 'data', r.data);
  end if;

  n_alt := jsonb_array_length(r.data->'history');
  n_neu := jsonb_array_length(p_data->'history');
  if jsonb_typeof(p_data->'grab') = 'object' then
    select count(*) into n_grab from jsonb_object_keys(p_data->'grab') k where k like 'h:%';
  end if;
  if n_neu + n_grab < n_alt then
    return jsonb_build_object('fehler', 'verlust');
  end if;

  update public.darts_stand
     set data = p_data, rev = r.rev + 1, geraet = left(p_geraet, 40), updated_at = now()
   where code = p_code;
  return jsonb_build_object('ok', true, 'rev', r.rev + 1);
end;
$$;

revoke all on function public.darts_pull(text, bigint) from public;
revoke all on function public.darts_push(text, jsonb, bigint, text) from public;
grant execute on function public.darts_pull(text, bigint) to anon, authenticated;
grant execute on function public.darts_push(text, jsonb, bigint, text) to anon, authenticated;
