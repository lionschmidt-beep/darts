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
- [ ] 5 **Einzelspieler** — Solo-X01 gegen Bestwert + Trainingsmodi (Doppel-Training, Around the Clock).
- [ ] 6 **Spieler-Statistik** — 3-Dart-Ø, bester Checkout, höchste Aufnahme, 180er, Form letzte 10.
- [ ] 7 **PWA** — Manifest + Service Worker, offline installierbar auf dem Handy.
- [x] 8 **Logik-Tests** — node-Testrunner gegen `window.DARTS`, ohne npm-Abhängigkeit.

## Live-bereit — wartet auf dein GO
- (noch nichts)

## Für Lion (Entscheidungen / Blocker)
- (noch nichts)

## Iterationen

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
