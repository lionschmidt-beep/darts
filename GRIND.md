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
- **Darts 1.2 → 1.11** — Match-Historie, Duell-Bilanz (Lion↔Arne↔Justus), Legs/Best-of,
  Einstellungen mit Export/Import, Allein-Üben mit Doppel-Training, Spieler-Akte, PWA,
  dazu 15 Fehler aus zwei blinden Prüfungen (u.a. Datenverlust beim Wegwischen der App,
  unsichtbarer Bust, Setup zeigte andere Regeln als gespielt wurden) und die Bedienungs-
  Nacharbeit aus der Nutzer-Brille.
  — verifiziert: **209/209 Logik-Tests**, mindestens 91 Mutationen in Rot-Proben (Zahl aus
  den Commit-Messages summiert, alle gefangen; in 6 von 14 Commits musste ein Test geschärft
  werden), Screenshots auf 390×844, SW+Offline und Tap-Größen im Browser gemessen,
  alle 8 Ansichten ohne Konsolenfehler durchgeklickt.
  — 🔴 **Autodeploy: JA.** `gh api repos/lionschmidt-beep/darts/pages` meldet
  `source.branch: main`, `status: built`, `public: true` → **Push = sofort live**
  auf https://lionschmidt-beep.github.io/darts/
  — Kommando: `git -C C:\dev\darts push origin main`

## Für Lion (Entscheidungen / Blocker)
- 🔴 **27.08. — Das Repo ist öffentlich und heißt drei Leute beim Vornamen.** Die Recherche
  hält § 18 Abs. 1 MStV für wahrscheinlich einschlägig (der kennt nur „ausschließlich
  persönlich oder familiär") — ein Impressum würde aber **deine Wohnanschrift dauerhaft
  veröffentlichen**. Empfehlung des Forschers und meine: **Repo privat stellen** statt
  Impressum. Das löst die Namen in der Git-History gleich mit.
  ⚠️ Zu prüfen: GitHub Pages aus einem privaten Repo braucht **GitHub Pro**. Alternativen:
  Repo privat + Pages abschalten (App nur noch lokal/als Datei), oder öffentlich lassen und
  die Vornamen durch Kürzel ersetzen. **Deine Entscheidung, ich habe nichts geändert.**
- 💡 **Elimination und Killer** (Kneipenspiele für ungerade Spielerzahl) wären laut Recherche
  die naheliegendsten neuen Modi — Elimination ist „50 Zeilen Arbeit". Nicht gebaut, weil
  neue Spielmodi über deinen Auftrag hinausgehen. Sag Bescheid, wenn du willst.
- 💡 **Handicap**: Das übliche Vorsprung-Handicap ist laut MIT-Sloan-Paper *beweisbar unfair*
  (der Stärkere gewinnt trotz Ausgleich noch 70 %), weil ein Vorsprung das Scoring verkürzt,
  nicht das Finish. Fair wäre „Credit-Darts". Wäre ein eigenes Feature.

## Iterationen

> Ältere Iterationen: [[GRIND-Archiv]] (`GRIND-Archiv.md` im selben Ordner).

### 27.08.2026 22:15 — Iteration 19: Kritiker-Runde über v1.9 → v1.20
- Der Prüfer hat mit **unabhängigen Referenzimplementierungen** gearbeitet (BFS für
  `checkout`, ein eigenes x01-Modell über 300 zufällige Partien) statt gegen meine eigenen
  Tests zu prüfen. Rechenkerne, `MATCH_SNAP`, Undo über die Platzvergabe und Reload mitten
  im Ausspielen kamen **sauber** durch — das ist ein belastbares Ergebnis.
- 🔴 **Der Schaden saß an der Peripherie meines jüngsten Features:** `m.platz` hatte einen
  Schreiber und **null Anzeiger**. `renderWin` las die Reihenfolge nie und sortierte nach
  `legsWon`, das im Platz-Modus nie erhöht wird → **die Endtabelle stand in Sitzordnung und
  sah aus wie eine Platzierung**. Wer Platz 2 ausgespielt hatte, war von jemandem mit null
  geworfenen Darts nicht zu unterscheiden.
- **Regelfehler:** Doppel-Out galt nur im Tipp-Weg. Rest 20, „20" eingetippt → der
  Summen-Modus buchte einen Sieg, den derselbe Wurf beim Tippen als Bust verwirft.
  Für Doppel-**In** fragte die App längst nach; für Doppel-**Out** war derselbe Aufwand
  nie betrieben worden.
- Dazu: Bust im Summen-Modus kostete pauschal drei Darts (Schnitte zweier Spieler derselben
  Partie nicht vergleichbar) · `ttsOn` wurde an vier Stellen nicht nachgezogen · `wakeLock`
  forderte pro Dart eine Sperre an und gab nur die letzte frei · der Undo-Stapel war **98 %
  des gespeicherten Stands** (69 KB nach 120 Darts, bei jedem Dart neu serialisiert) ·
  Fremdfenster-Band blieb sticky · kein Undo auf dem Platz-Screen · `platzSpiel` war eine
  tote Bedingung ohne Schalter.
- 🔴 **Den einen Punkt, den der Kritiker nicht messen konnte, habe ich gemessen:** er
  vermutete, die Legs-Zahl werde bei vier Spielern auf 320 px abgeschnitten. Sie wurde in
  **allen fünf geprüften Konstellationen** abgeschnitten, auch bei drei Spielern auf 390 px —
  **mein v1.20-Fix hatte das Problem nur verschoben, nicht gelöst.**
- Verifiziert: **209/209 Tests** (196 → 209), 15 Mutationen. **Vier rutschten zuerst durch**:
  der Sieger saß im Test zufällig schon vorn (Sortierung von Sitzordnung nicht
  unterscheidbar), ein per `display:none` versteckter Knopf zählte als vorhanden, und Layout
  kann der Runner grundsätzlich nicht messen. Alle vier geschärft.
- Version: 1.21
