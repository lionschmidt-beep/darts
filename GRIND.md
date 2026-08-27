# GRIND-Log Darts

Gegenstand: `C:\dev\darts` — Single-File-Web-App (`index.html`), GitHub Pages, localStorage.
Auftrag Lion 27.08.2026: *"Speicher-Funktion, Einstellungsmöglichkeiten, vollwertige App,
Einzelspieler und Duo-Matchups — z.B. tracken wie es zwischen Arne und mir steht."*

## Backlog (priorisiert)
- [x] 1 **Datenmodell v2 + Match-Historie** — Fundament. Ohne gespeicherte Spiele kann die App nie
      sagen, GEGEN WEN gewonnen wurde. Migration v1→v2, Lions Hand-Wins bleiben als Basis-Offset.
- [x] 2 **Head-to-Head / Matchup-Ansicht** — "Lion vs Arne 7:3", letzte Spiele, Ø. Der eigentliche Wunsch.
- [x] 3 **Legs & Best-of** — ohne Legs ist eine Darts-App nicht vollwertig (Bo3/Bo5/Bo7).
- [x] 4 **Einstellungen-Screen** — Standardmodus, Doppel-In/Out, Legs, TTS, Export/Import, Reset.
- [x] 5 **Einzelspieler** — Solo-X01 gegen Bestwert + Trainingsmodi (Doppel-Training, Around the Clock).
- [x] 6 **Spieler-Statistik** — 3-Dart-Ø, bester Checkout, höchste Aufnahme, 180er, Form letzte 10.
- [x] 7 **PWA** — Manifest + Service Worker, offline installierbar auf dem Handy.
- [x] 8 **Logik-Tests** — node-Testrunner gegen `window.DARTS`, ohne npm-Abhängigkeit.

## Live-bereit — wartet auf dein GO
- **Darts 1.2 → 1.8** — Match-Historie, Duell-Bilanz (Lion↔Arne↔Justus), Legs/Best-of,
  Einstellungen mit Export/Import, Allein-Üben mit Doppel-Training, Spieler-Akte, PWA.
  — verifiziert: 73/73 Logik-Tests, 20 Mutationen in Rot-Proben (alle gefangen nach
  Reparatur von 3 blinden Tests), Screenshots auf 390×844, SW+Offline im Browser gemessen.
  — 🔴 **Autodeploy: JA.** `gh api repos/lionschmidt-beep/darts/pages` meldet
  `source.branch: main`, `status: built`, `public: true` → **Push = sofort live**
  auf https://lionschmidt-beep.github.io/darts/
  — Kommando: `git -C C:\dev\darts push origin main`

## Für Lion (Entscheidungen / Blocker)
- (noch nichts)

## Iterationen

### 27.08.2026 19:05 — Iteration 5+6: Spieler-Akte und PWA
- Was: `playerStats(id)` + Spieler-Akte (Rangliste antippen): Spiele, Quote, Schnitt,
  beste Aufnahme, höchstes Finish, 180er, Legs für/gegen, Form der letzten zehn, alle
  Duelle, Trainings-Rekorde, „das bin ich"/umbenennen/löschen.
  Dazu PWA: `manifest.webmanifest`, `icon.svg`, `sw.js` (**network first**, damit kein
  alter Stand auf dem Handy festklebt), Registrierung in `index.html`.
- 🔴 **Rot-Probe deckte ZWEI weitere blinde Tests auf** — dieselbe Ursache wie in
  Iteration 4: `state.history` ist neueste-zuerst, deshalb trifft „nimm den zuletzt
  gelesenen Eintrag" zufällig den ältesten. Lag der Rekord im ältesten Spiel, blieb die
  Mutation unsichtbar. **Regel daraus: bei unshift-Listen muss der Extremwert in der
  MITTE liegen** — dann sind „erster" und „letzter" beide falsch. Beide Tests neu gebaut.
- Verifiziert: 73/73 Tests. Im Browser gemessen statt angenommen: SW aktiv
  (`scope http://127.0.0.1:8777/`), Manifest 200 mit 2 Icons, **Neuladen mit gekapptem
  Netz lädt die App** und das laufende Spiel ist noch da.
- Version: 1.8

### 27.08.2026 18:40 — Iteration 4: Allein üben
- Was: Solo-Screen (wer übt + drei Karten), Trainings-Engine mit **Doppel-Training**
  (D1→Bull) und **Around the Clock**, Bestwert je Spieler und Modus, Solo-X01-Rekord
  (wenigste Darts je Startwert).
- 🔴 Dabei **Bug im Bestand gefunden und behoben**: ein Solo-Spiel zählte als Sieg —
  man gewinnt gegen niemanden. `historyWins` ignoriert jetzt Matches mit < 2 Spielern.
  Test war zuerst rot (52/53), dann grün.
- Trennung: Übungsläufe gehen nach `state.practice`, NICHT in `state.history` — sonst
  zählte jede Übungsrunde in Rangliste und Duell-Bilanz.
- 🔴 **Rot-Probe deckte einen blinden Test auf**: „Bestwert = höchster Score" ließ die
  Mutation `b = r` (nimm irgendeinen) durch, weil der beste Lauf zufällig auch der
  älteste war. Test neu gebaut — bester Lauf liegt jetzt in der Mitte; beide Mutationen
  werden gefangen.
- Verifiziert: 62/62 Tests, Rot-Probe 6 Mutationen (nach der Reparatur alle gefangen),
  Screenshots Solo + Training auf 390x844.
- Version: 1.6

### 27.08.2026 18:05 — Iteration 3: Einstellungen + Datensicherung
- Was: Einstellungs-Screen (Zahnrad im Kopf): Standardmodus, Ausgang, Legs, Doppel-In,
  Sprachausgabe, Verlauf-Schalter, Export als Datei/Zwischenablage, Import, Verlauf
  löschen, alles zurücksetzen.
- Eigeninput: **Export/Import war nicht beauftragt, gehört aber dazu** — die App führt
  ab 1.3 eine Historie, und ein geleerter Browser-Cache hätte sie ersatzlos vernichtet.
  Ebenso: **Verlauf löschen friert die Wins ein** statt Lion von 10 auf 1 zurückzuwerfen.
- Ergebnis: OK. Ein Mangel im Screenshot gefunden: die Info-Karte missbrauchte das
  A-gegen-B-Vergleichslayout und las sich als Fehler („Spieler rechts") → eine Info-Zeile.
- Verifiziert: 51/51 Tests (9 neue: Export/Import-Rundlauf, kaputte Sicherung wird
  abgewiesen, v1-Sicherung importierbar, Wins-Einfrieren, Einstellungen wirken).
  Rot-Probe 3 Mutationen, alle gefangen. Screenshot 390x844.
- Version: 1.5

### 27.08.2026 17:15 — Iteration 1: Datenmodell v2
- Was: `wins`-Zaehler durch Match-Historie ersetzt, Legs/Best-of, Doppel-In,
  Statistik je Spieler und Match, Migration v1->v2.
- Ergebnis: OK. Lions Hand-Wins (Arne 3 / Justus 2 / Lion 1) ueberleben als Offset.
- Verifiziert: `node test/run.mjs` 27/27 gruen; Rot-Probe mit 5 Mutationen, alle gefangen
  (legsNeeded 4 Tests rot, Statistik 2, Migration 1, Bust-Reset 1, Anwurfwechsel 1).
- Version: 1.3

### 27.08.2026 17:35 — Iteration 2: Direktvergleich
- Was: `h2h(a,b)` zaehlt nur echte 1-gegen-1-Duelle (Dreierrunden separat ausgewiesen),
  Duell-Screen mit Bilanz/Balken/Serie/Vergleichszeilen/Spieleliste, Duell-Karte auf der
  Startseite, Duellstand live im Spielkopf.
- Ergebnis: OK. Im Screenshot-Durchgang vier echte Maengel gefunden und behoben:
  (1) Lion stand alphabetisch mal links, mal rechts -> **Ich-Marker** (`settings.meId`,
  im Team per Namensklick), (2) beide Auswahl-Chips waren gruen statt seitenrichtig,
  (3) Ergebnisliste las sich als "Lion gewinnt 1:2" -> Legs jetzt aus Siegersicht,
  (4) Leg-Stand stand doppelt (Kopfzeile + Karte).
- Verifiziert: 42/42 Tests; Rot-Probe mit 4 H2H-Mutationen, alle gefangen
  (Dreierrunden 1, Sieger-Zuordnung 3, Serie 1, Spielkopf 1).
  Screenshots 390x844 @2x: Startseite, Duell, Spiel, Setup, Team.
- Version: 1.4
