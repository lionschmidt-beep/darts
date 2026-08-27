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
  — verifiziert: **196/196 Logik-Tests**, mindestens 91 Mutationen in Rot-Proben (Zahl aus
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

### 27.08.2026 21:35 — Iteration 18: Doku + Randzustände im Browser
- 🔴 **WIP-Gate meldet 7 offene Repos → Freeze**, keine neuen Features. Diese Iteration ist
  reine Leiter-Arbeit (Doku nachziehen + Verifikation härten), erzeugt also keine Reviewschuld.
- **Doku:** README und Vault-Changelog auf 1.19/1.20 nachgezogen, Testzahl gemessen statt
  abgeschrieben. Die Entscheidungsvorlage zum öffentlichen Repo (§ 18 MStV) steht jetzt als
  eigener Block im Vault-Changelog, nicht nur im GRIND-Log.
- **Verifikation gehärtet:** acht Konstellationen × sieben Ansichten im echten Browser
  durchgeschaltet — 320 px, Querformat 844×390, helles System, acht Spieler, lange Namen.
  Sieben waren sauber, **eine nicht**: bei „Maximilian-Alexander" war der Inhalt **417 px
  breit bei 390 px Viewport**. Klassische Flexbox-Falle — ohne `min-width:0` schrumpft ein
  Flex-Kind nicht unter seine Inhaltsbreite, und `text-overflow:ellipsis` greift dann nie.
- 🔴 **Der Screenshot zeigte den zweiten Teil des Fehlers:** nach dem Fix passten die Namen,
  wurden aber **hart abgeschnitten** statt gekürzt — der Legs-Badge lag absolut über dem
  Namensende. Der Legs-Stand steht jetzt in der Zahlenzeile („⌀ 60.0 · 3 D · 1 L").
  **Die Messung allein hätte das nicht gefunden, erst das Hinsehen.**
- Verifiziert: **196/196 Tests** (194 → 196), zwei neue Layout-Tests halten die CSS-Regeln
  fest (der Testrunner kann kein Layout messen), beide Mutationen gefangen. Nachgemessen:
  kein Überlauf mehr in 56 Kombinationen.
- Version: 1.20

### 27.08.2026 21:40 — Iteration 17: Deep-Research-Gate ausgewertet
- 🔴 **Der Forscher hat zwei eigene Erwartungen widerlegt** und eine Lücke benannt
  (r/Darts war über alle Wege 403 — „was wird wirklich gespielt" ist damit schlechter belegt
  als möglich). Kein Feature-Wunschzettel, sondern belegte Befunde.
- **Gebaut:** Nach dem Sieger wird um **Platz 2** weitergespielt (belegtes Zitat: *„Platz zwei
  und drei können so nicht ausgespielt werden. Dies ist insbesondere dann demotivierend, wenn
  ein Spieler dominant ist."* — trifft Lion/Arne/Justus exakt). Wer durch ist, wirft nicht
  mehr mit; die Platzierung landet in der Historie, aber nur Platz 1 zählt als Sieg.
  Dazu **wakeLock** (Bildschirm bleibt im Spiel an) und der **Safari-7-Tage-Hinweis**
  (localStorage wird ohne Home-Bildschirm-Installation nach einer Woche gelöscht — genau der
  Fall „einmal die Woche spielen").
- 🔴 **Ehrliche Nullmeldung:** Der Forscher hat belegt, dass **D16 vor D20** gehört
  (32→16→8→4→2 hält fünf Halbierungsstufen, 40→20→10→5 nur drei und strandet ungerade).
  Die Reihenfolge steht jetzt richtig — **gemessen ändert sie an den Vorschlägen aber
  nichts: 0 von 169 Resten**, weil die Stellwurf-Kosten dominieren. Korrigiert, ohne eine
  Verbesserung zu behaupten.
- **Nicht gebaut, bewusst:** Sprachsteuerung nicht ausbauen (drei redende Leute sind das
  schlechteste Umfeld dafür; die Bewertungen vergleichbarer Apps sind schlecht) ·
  Elimination/Killer/Handicap → unter „Für Lion", weil neue Spielmodi über den Auftrag
  hinausgehen · Zielpunkt-Empfehlung aus σ (Tibshirani 2011: bei σ = 16,4 mm springt das
  optimale Ziel von T20 auf T19) — interessant, aber Nische.
- 🔴 **Rechtlicher Punkt unter „Für Lion":** öffentliches Repo + Vornamen + § 18 MStV.
- Verifiziert: **194/194 Tests** (182 → 194), 9 Mutationen alle gefangen. Platz-Screen im
  Browser geprüft, keine Seitenfehler. Recherche-Notiz:
  `LionVault/Research/Darts/Darts-App Luecken 2026-08-27.md`
- Version: 1.19

### 27.08.2026 21:05 — Iteration 16: Zweite Nutzer-Prüfung abgearbeitet
- Ergebnis der Gegenprüfung: **11 von 12 alten Punkten sitzen**, einer war halb (Tap-Größen
  im Team-Screen — Zahnrad ✅ 45×44, aber Stift 38 und Mülleimer 36 breit; jetzt beide 46×44,
  im Browser gemessen). Der Prüfer hat außerdem **einen eigenen Befund zurückgezogen**
  („kein Bust-Hinweis im Summenmodus") — das war ein Folgefehler seiner eigenen 200-Eingabe.
- 🔴 **Der schwerste Fund des ganzen Laufs:** Der Zehnerblock verwarf eine zu große Eingabe
  **still** und setzte das Feld auf die letzte Ziffer zurück — aus `2-0-0` wurde `0`. Kein
  Rot, keine Meldung. Wer nicht hinsah, buchte eine Null und merkte es zwei Runden später.
  *„Das ist die einzige Stelle in der ganzen App, wo mir die App was wegnimmt und es mir
  nicht sagt."* → jetzt wird die Ziffer verworfen, nicht die Eingabe, mit Hinweis darunter.
- 🔴 **Fehler in meinem eigenen Farb-Fix aus 1.15:** auf der Startseite trug die linke Zahl
  immer Grün, unabhängig von der Führung — bei „Lion 0:1 Justus" leuchtete Lions Null.
  In der Akte war es korrekt, auf der Startseite nicht. **Ein Fix, der nur die Hälfte der
  Stellen erreicht, ist kein Fix.**
- Dazu: unmögliche Aufnahmen (179, 178, 176, 175, 173, 172, 169, 166, 163) werden abgewiesen ·
  „1 Duelle" → „1 Duell" an sieben Stellen · Fehlwurf ist ein Kreuz statt eines
  Gedankenstrichs („20 5 – = 25" las sich wie eine Rechnung) · der Speicher-Satz wird durch
  einen Schreibtest beim Start gedeckt statt erst nach dem ersten Wurf · der Setup-Screen
  warnt **vor** dem Einstellen, dass ein Start das laufende Spiel verwirft.
- Verifiziert: **182/182 Tests** (174 → 182), 6 Mutationen alle gefangen. Im Browser
  gemessen: `2-0-0` hält jetzt „20" mit Hinweis; Tap-Ziele im Team 46×46 / 46×44 / 46×44.
- Version: 1.18

### 27.08.2026 20:20 — Iteration 14+15: Finish-Rechner und Doku
- 🔴 **Fund aus dem Vault, nicht aus dem Code:** Der `Darts VERSION-Changelog.md` im
  LionVault trug einen belegten, offenen Befund vom 27.08., den ich nicht kannte — der
  Checkout-Rechner schlug systematisch das **schlechteste Doppel** vor. Gegen die Platte
  geprüft: war noch drin. **Das ist der Wert des Vault-Changelogs** — er hat einen echten
  Bug über eine Session-Grenze getragen.
- Was: `checkout()` bewertet jetzt alle gleich langen Wege, statt den ersten Treffer zu
  nehmen. `DOPPEL_VORLIEBE` (D20/D16/D8/D4 zuerst) + `stellKosten()` (auf die 20 zielt man
  am liebsten, Triple schmal, Doppelring nie als Stellwurf). Drei-Dart-Wege stehen
  absteigend, so wie man sie ansagt.
- Gemessen: Finishes auf kleinem/ungeradem Doppel **93 → 11** (die 11 sind erzwungen),
  Doppelring als Stellwurf **2 → 0**. `60` gibt jetzt `20 D20` statt `T18 D3`,
  `5` gibt `1 D2` statt `T1 D1`.
- 🔴 **Drei meiner Tests waren zuerst zu streng** — sie meckerten über `1 D2` und `3 D4`,
  die aber die Standardwege sind. Gegengerechnet: bei Rest 5/7/9/11 gibt es **keinen** Weg
  ohne kleine Stellzahl. Tests gegen die Tabelle korrigiert, nicht gegen mein Bauchgefühl.
- Doku: README auf 1.17, Vault-Changelog von „AKTUELL 1.2" auf den echten Stand
  (14 Commits ungepusht) — und die dort geschätzte Mutationszahl durch die aus den
  Commit-Messages summierte ersetzt (**mindestens 91**).
- Verifiziert: **174/174 Tests** (165 → 174), 4 Mutationen alle gefangen.
- Version: 1.17

### 27.08.2026 22:40 — Iteration 10-13: Verifikationslauf abgearbeitet
Ein Workflow aus 10 Prüfagenten hat **89 Punkte** gegen den Stand 1.11 gemessen, **68 belegt**,
davon **16 bereits behoben**. Die restlichen 52 sind jetzt abgearbeitet — jeder mit einem
zuerst roten Test. Die Prüfer haben dabei **drei eigene Funde** gemacht, die weder die
Nutzer-Brille noch der Kritiker sahen (Modus-Wechsel zählt doppelt, Doppel-In im
Summen-Modus wirkungslos, Sprachmodus verwirft nach nostart den Rest der Aufnahme).

🔴 **Die fünf Fehlerklassen sind wertvoller als die Einzelfehler:**
1. **Zustand ohne einzige Wahrheitsquelle** — `snapshot()` zählte Felder von Hand auf, das
   neueste (`lastTurn`) fehlte. → gemeinsame Feldliste `MATCH_SNAP`; erledigt zugleich den
   Undo-Rückgabewert und den v1-Stapel-Crash.
2. **Drei Eingabewege, drei Kopien des Regelwerks** — Doppel-In galt im Tipp-Pfad, nicht im
   Summen-Pfad; die Ansage nur im Sprach-Pfad.
3. **Jedes leere `catch` ist stiller Datenverlust** — `save`, `load`, `exportClipboard`,
   `recog.start`, `undo` meldeten Erfolg, den es nicht gab.
4. **Beschriftung und Wirkung getrennt gepflegt** — „Speichern" speicherte nicht, „Neuer
   Rekord!" wurde verworfen, „In der Zwischenablage" war nie dort.
5. **Fremde Daten nur an der Tür geprüft** — und `render()` lief ohne Netz, also war jede
   weiße Seite endgültig.
- Verifiziert: **165/165 Tests** (117 → 165). Rot-Probe **47 Mutationen**, alle gefangen;
  **9 Tests waren zuerst blind** und wurden geschärft. Der Testrunner selbst hatte zwei
  Löcher: asynchrone Tests galten stillschweigend als bestanden, und `getElementById`
  lieferte Elemente, die gar nicht auf dem Bildschirm standen.
- Neu als Dauerprüfung: ein Test sucht **alle Screens systematisch nach toten Klickzielen**
  ab, ein zweiter prüft, dass jeder Handler-Zweig auch irgendwo angeboten wird.
- Version: 1.16

### 27.08.2026 21:10 — Iteration 9: Ganze Aufnahme eintippen
- Was: Umschalter **Einzeln | Ganze Aufnahme** im Spiel. Im Summen-Modus großer
  Ziffernblock, laufende Rest-Vorschau, Warnung vor Überwerfen schon beim Tippen.
  Beim Ausmachen fragt die App **„mit wie vielen Darts?"** — sonst wäre der Schnitt falsch.
- Grund (Nutzer-Brille): *„Beim Darts ruft einer ‚einundachtzig' und ich will 81 tippen,
  fertig. Hier muss ich drei Darts einzeln eingeben. Das ist dreimal so viel Getippe, und
  der Nächste wirft schon."*
- Beide Wege führen nachweislich zum selben Ergebnis — dafür gibt es einen eigenen Test,
  der Einzel- und Summen-Eingabe gegeneinander rechnet (Rest, Darts, erzielte Punkte).
- Verifiziert: **117/117 Tests** (106 → 117). Rot-Probe 6 Mutationen, alle gefangen
  (eine erst, nachdem ein Test über den echten Umschalter statt über den State ging).
  Screenshot: Ziffernblock 230×58 px pro Taste.
- Version: 1.11

### 27.08.2026 20:30 — Iteration 8: Bedienung nach der Nutzer-Brille
- Was: Duell-Chips bleiben seitenrichtig (vorher flog beim Antippen der eigene Name raus
  und die Bilanz stand gespiegelt) · Abwählen funktioniert überhaupt erst (die Vorbelegung
  sprang sofort zurück) · „Wurf zurück" und „Aufnahme beenden" sind keine Zwillinge mehr
  (der Testnutzer traf den falschen und verlor eine Aufnahme) · Zahnrad **30×27 → 45×44**,
  Kopf-Links 28×17 → 44×44 · Mitspieler direkt im Setup dazunehmen (und er spielt sofort mit)
  · Duell-Zahlen tragen die Farbe ihres Namens statt einer Legende · Spieler-Akte sagt,
  woher die Wins kommen („2 gespielt gewonnen · 1 von Hand") · „⌀ 3 Darts" → „Schnitt je
  3 Darts" · Legs-Zeile nur, wenn sie etwas anderes sagt als die Siege · „Daneben" so groß
  wie „Treffer" · „501 allein" erklärt sich selbst.
- 🔴 **Der Lautsprecher-Schalter war für Tipper ein totes Feature** — die App sprach
  ausschließlich im Sprachmodus. Jetzt sagt sie jede Aufnahme an („Lion 60, Rest 441") und
  jeden Bust; der Sprachmodus sagt nicht doppelt.
- 🔴 **Zwei Werkzeug-Fallen unterwegs gefunden:**
  (a) `` in einem Python-Patch-String wird zu **Backspace 0x08** — zwei Test-Regexe
      suchten wörtlich nach Steuerzeichen und waren dadurch immer wahr. Gegenprobe über
      alle Dateien: `index.html` war sauber, nur `test/run.mjs` betroffen.
  (b) Der Test-Stub lieferte `getElementById` für Elemente, die gar nicht im HTML standen →
      ein Test fand ein Eingabefeld, das die Ansicht nicht anzeigte. Stub misst jetzt gegen
      das gerenderte HTML.
- Verifiziert: **106/106 Tests** (96 → 106). Rot-Probe 10 Mutationen, alle gefangen
  (zwei erst nach Schärfen). Tap-Größen im Browser gemessen, nicht geschätzt.
- Version: 1.10

### 27.08.2026 19:50 — Iteration 7: Prüfer-Befunde abgearbeitet
Zwei Prüfer liefen blind (kritiker aufs Diff, skeptical-customer auf die Bedienung).
**Blinde Konvergenz auf denselben Fehler** — beide fanden unabhängig, dass der Setup-Screen
etwas anderes anzeigt als gespielt wird. Ursache: **mein eigener Patch aus Iteration 3 war
verlorengegangen** (erster Anlauf schlug fehl, im zweiten habe ich ihn nicht nachgezogen).

🔴 **Die wichtigste Erkenntnis war keine Einzelheit, sondern eine Fehlerklasse:**
*Kein einziger der 73 Tests fuhr den Klick-Handler.* Alle riefen `window.DARTS` direkt auf
und übersprangen genau die Kette Screen → UI-Zustand → Logik. Genau dort saßen die zwei
schwersten Fehler. → Klick-Harness (`click`/`has`/`classOf`/`reboot`) in `test/run.mjs`.

**Gefixt (jeder Fix mit einem zuerst roten Test):**
1. Setup-Screen zeigte 501/Doppel-Out fest an, spielte aber die Einstellungen — beide
   Richtungen falsch, der Einstellungs-Screen war zur Hälfte wirkungslos.
2. **Datenverlust:** Reload auf dem Sieger-Screen = Sieg spurlos weg. `view` lag nicht im
   Speicher, `finishMatch()` lief nur über die Knöpfe. Auf dem Handy ist das der Normalfall.
   → `view` wird mitgespeichert + Startseite bietet „Ergebnis eintragen" als Netz.
3. Sprach-Wurf auf dem Leg-Zwischenstand wurde ins nächste Leg gebucht (unsichtbar).
4. „Miss" bei gedrücktem Double eröffnete ein Doppel-In-Leg (`dartValue(2,0).isDouble`).
5. 🔴 **Bust war beim Tippen unsichtbar** — „überworfen" stand nur im Sprachpfad. Der
   Testnutzer: *„Das ist die Stelle, an der ich das Handy weitergebe."* → Letzte-Aufnahme-Zeile,
   die zugleich „was hatt ich?" beantwortet.
6. Doppel-In zeigte „Aufnahme: 60" für einen Wurf, der 0 zählte; Multiplikator blieb hängen.
7. Toter „Spieler ›"-Link im Ranglisten-Kopf.
8. 500er-Deckel der Historie fraß Wins · Trainings-Deckel fraß Rekorde · Import warf
   ungefangen · `_undo` fehlte nach Import (nächster Dart crashte) · gelöschter Spieler
   wurde zum Phantom mit rohem Slug · Rekordmeldung ≠ gespeicherter Rekord · fremde IDs
   konnten HTML-Attribute einschleusen · `checkout` kannte seine Grenzen nicht.
- Verifiziert: **96/96 Tests** (73 → 96). Rot-Probe **16 Mutationen, alle gefangen**;
  zwei Tests waren dabei zuerst blind und wurden geschärft. Screenshot: Bust-Zeile steht rot
  auf dem Board.
- Version: 1.9

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
