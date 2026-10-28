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
-- Verlustschutz: jeder Eintrag, der in der Cloud liegt (Spiel, Uebung, Bull), muss
-- im neuen Stand entweder noch stehen oder einen Grabstein (grab."h:<id>", "p:", "b:")
-- haben - gepruefte ids, nicht gezaehlte (eine Zaehlung liess einen Stand durch, dem
-- ein anderes Spiel fehlte, kritiker 28.10.). Ein leerer Stand von einem frischen
-- Geraet kann so nie einen vollen ueberschreiben. Gegen jemanden, der den Code hat,
-- schuetzt das nicht (der darf loeschen) - es faengt Fehler der App ab.
create or replace function public.darts_push(p_code text, p_data jsonb, p_rev bigint, p_geraet text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  r public.darts_stand;
  n_fehlt int;
begin
  if p_code is null or p_code !~ '^[A-HJ-NP-Z2-9]{12}$' then
    return jsonb_build_object('fehler', 'code');
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
     or jsonb_typeof(p_data->'history') is distinct from 'array'
     or jsonb_typeof(p_data->'roster') is distinct from 'array' then
    return jsonb_build_object('fehler', 'format');
  end if;
  -- Ein echter Stand (500 Spiele, 300 Uebungen, 1000 Bull-Eintraege) liegt weit
  -- darunter; die App selbst laedt ab 1 MB nicht mehr hoch.
  if octet_length(p_data::text) > 1000000 then
    return jsonb_build_object('fehler', 'zu_gross');
  end if;

  select * into r from public.darts_stand where code = p_code for update;

  if not found then
    if coalesce(p_rev, 0) <> 0 then
      return jsonb_build_object('fehler', 'unbekannt');
    end if;
    -- Deckel gegen Vollmuellen: weit ueber jedem echten Bedarf. Zeilen UND Groesse
    -- (das Projekt teilt sich die Datenbank mit lernapp).
    if (select count(*) from public.darts_stand) >= 2000
       or pg_total_relation_size('public.darts_stand') > 200000000 then
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

  with alt as (
         select 'h' as art, e->>'id' as id from jsonb_array_elements(case when jsonb_typeof(r.data->'history') = 'array' then r.data->'history' else '[]'::jsonb end) e
         union all
         select 'p', e->>'id' from jsonb_array_elements(case when jsonb_typeof(r.data->'practice') = 'array' then r.data->'practice' else '[]'::jsonb end) e
         union all
         select 'b', e->>'id' from jsonb_array_elements(case when jsonb_typeof(r.data->'bull') = 'array' then r.data->'bull' else '[]'::jsonb end) e),
       neu as (
         select 'h' as art, e->>'id' as id from jsonb_array_elements(p_data->'history') e
         union all
         select 'p', e->>'id' from jsonb_array_elements(case when jsonb_typeof(p_data->'practice') = 'array' then p_data->'practice' else '[]'::jsonb end) e
         union all
         select 'b', e->>'id' from jsonb_array_elements(case when jsonb_typeof(p_data->'bull') = 'array' then p_data->'bull' else '[]'::jsonb end) e)
  select count(*) into n_fehlt
    from alt
   where alt.id is not null
     and not exists (select 1 from neu where neu.art = alt.art and neu.id = alt.id)
     and not (case when jsonb_typeof(p_data->'grab') = 'object'
                   then p_data->'grab' ? (alt.art || ':' || alt.id) else false end);
  if n_fehlt > 0 then
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
