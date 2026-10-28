# 🎯 Darts

Handy-Web-App zum Darts-Spielen für Lions Team. Eine Datei, kein Login, kein Server.

**Live:** https://lionschmidt-beep.github.io/darts/ · installierbar über „Zum Startbildschirm hinzufügen"

## Was sie kann

**Spielen** — X01 (301/501/701), Single/Double/Triple, 25 & Bull, volle Bust-Logik,
Doppel-Out oder beliebiger Ausgang, optional Doppel-In. Legs als einzelnes Leg oder
Best of 3/5/7 mit wechselndem Anwurf.

**Der Anwurf wird ausgelost** — vor dem ersten Dart dreht ein Rad mit einem Feld je
Spieler; wer unter dem Zeiger landet, fängt an, und von ihm aus wandert der Anwurf bei
Best-of weiter. Ohne das Rad fing immer der erste in der Liste an, also praktisch immer
derselbe. Das Los fällt in JS, nicht in der Animation — eine abgebrochene CSS-Transition
darf nicht darüber entscheiden, wer anfängt. Abschaltbar unter Einstellungen.

**Zu dritt wird um Platz 2 weitergespielt** — wer ausgemacht hat, ist durch und wirft nicht
mehr mit, die anderen spielen den Rest aus. Sonst sitzt der Abgehängte nur da. Die
Platzierung landet im Verlauf, gezählt als Sieg wird nur Platz 1.

**Eingeben, wie es gerade passt** — entweder Dart für Dart oder die **ganze Aufnahme am
Stück** („einer ruft einundachtzig, du tippst 81"). Beim Ausmachen fragt die App nach der
Dart-Zahl, sonst wäre der Schnitt falsch. Unter den Wurf-Feldern steht immer, was zuletzt
passiert ist — inklusive „💥 überworfen, zurück auf 40", damit ein Bust nicht wie
„nichts passiert" aussieht.

**Finish-Vorschlag ab Rest ≤ 170** — und zwar der, den man auch wirft: der Rechner
bevorzugt D16 vor D20 (32→16→8→4→2 hält fünf Halbierungsstufen, 40→20→10→5 nur drei), und schlägt
nie einen Doppelring als Stellwurf vor. Bei 60 steht dort `20 D20`, nicht `T18 D3`.

**Madhouse** — Rest 2 bei Doppel-Out: es geht nur noch die D1, das kleinste Feld der
Scheibe. Die App ruft es aus (eigene Ansage, tiefer und langsamer) und zeigt ein Band über
dem Zahlenfeld. Der Ruf kommt nur, wenn die Lage neu entsteht — wer auf der 2 hängen
bleibt, hört sie nicht bei jeder Aufnahme wieder.

**Statistik** — drei Blickwinkel auf dieselben Leute: die Team-Rangliste (wer hat wie oft
gewonnen), eine Kreuztabelle „jeder gegen jeden" aus **allen gemeinsamen Spielen** (auch
denen zu dritt — eine reine Duell-Tabelle wäre bei drei Leuten, die meist zu dritt spielen,
leer), und alle Zahlen nebeneinander, sortierbar nach Siegen, Quote, Schnitt, bester
Aufnahme, höchstem Finish, 180ern oder Spielen.

**Duelle** — Jedes beendete Spiel wird gespeichert; daraus entsteht der Direktvergleich:
„Lion gegen Arne 8:3", Siegesserie, Legs, 3-Dart-Schnitt, beste Aufnahme, höchstes Finish,
180er und die letzten zwölf Begegnungen. Im laufenden Spiel steht der Duellstand im Kopf.
Gezählt werden nur echte Duelle zu zweit — Runden mit mehr Leuten stehen separat darunter.

**Bull-Nähe** (seit 1.47 ein Spiel mit Leben) — jeder startet mit 1 bis 5 Leben (zuletzt
gewählt bleibt vorbelegt). Ab zwei Spielern lost dasselbe Rad wie bei X01 den Anwurf aus
(Schalter „Anwurf auslosen"), danach wandert er je Runde weiter, nur unter den Lebenden.
Je Runde: „Bull! +1" bei einem Treffer, „Am weitesten weg" kostet ein Leben und beendet die
Runde. Bei 0 Leben ist man raus, der Letzte gewinnt. In die Bull-Bilanz zählt nur der
Gesamtsieger (Siege, Spiele, Quote, Bulls). Allein gespielt läuft es, bis die Leben weg
sind, ohne Sieg – nur die Bulls zählen. Letzter Tipp zurück, Spiel abbrechen ohne Eintrag.
Einträge bis 1.46 (nur der Sieger einer Runde) bleiben und zählen weiter als ein Sieg.
Zählt bewusst nicht in Team-Rangliste und Duelle. Das laufende Spiel liegt lokal
(`bullSpiel`), der fertige Eintrag in `bull` und damit im gemeinsamen Spielstand.

**Allein üben** — X01 gegen den eigenen Rekord (wenigste Darts), Doppel-Training
(D1 bis Bull, drei Darts pro Ziel) und Around the Clock. Übungsläufe zählen nicht in die
Rangliste und nicht in die Duell-Bilanz.

**Spieler-Akte** — Antippen in der Rangliste öffnet Spiele, Quote, Schnitt, Rekorde, Form
der letzten zehn Partien und alle Duelle. Solo-Runden stehen getrennt, damit sie die
Duell-Zahlen nicht verfälschen. Ein Spieler kann als „das bin ich" markiert werden; er
steht dann in jedem Duell links.

**Sprach-Eingabe („Bike-Modus")** — Mikro antippen und Würfe laut ansagen („Triple 20, 20,
Doppel 5"), die App trägt ein und sagt zurück, was sie verstanden hat. Doppel/Triple
**vor** die Zahl. Befehle: „zurück", „weiter", „stopp". Zuverlässig auf Android-Chrome,
iOS/Safari best-effort. Der Lautsprecher sagt auch beim Tippen jede Aufnahme an.

🔴 **Der Finishweg kommt VOR dem Wurf, nicht danach.** Bis 1.44 hing er an der eigenen
Aufnahme – also mehrere Aufnahmen zu früh: wer gerade geworfen hat, braucht ihn nicht,
und bis er wieder an der Scheibe steht, hat er ihn vergessen. Jetzt gilt: nach der Aufnahme
nur „Arne 105, Rest 396", und wenn der Nächste drankommt „Lion ist dran, 138, Finish:
Triple 20, Triple 18, Doppel 12". Beides in **einer** Ansage –
`speechSynthesis.cancel()` leert die ganze Schlange, zwei `say()` hintereinander schneiden
einander ab.

**Einstellungen** — Standardmodus, Ausgang, Legs, Doppel-In, Ansage, Verlauf, zweites Handy,
gemeinsamer Spielstand, Sicherung.

Während gespielt wird, bleibt der Bildschirm an (`wakeLock`) — zwischen zwei Aufnahmen
vergehen leicht zwei Minuten, in denen niemand das Handy anfasst.

## Speicher

Alles liegt im `localStorage` dieses Browsers. Ohne Verbindung gilt: **Cache leeren oder
Handy wechseln heißt weg.** Darum gibt es unter Einstellungen → Sicherung einen Export als
Datei oder in die Zwischenablage und einen Import zurück.

**Gemeinsamer Spielstand (seit 1.47)** — Einstellungen → Gemeinsamer Spielstand →
„Neu anlegen" zeigt einen Code `XXXX-XXXX-XXXX`; auf jedem weiteren Gerät denselben Code
eingeben → „Verbinden". Danach liegen **Team, Verlauf, Übungen und Bull-Einträge** in EINEM
Stand bei Supabase (EU, Projekt `ijxlbeezxfoxzrgtbyhn`, Tabelle `darts_stand`), jedes
verbundene Gerät zeigt dieselben Zahlen. **Nicht** geteilt: das laufende Spiel (dafür ist
der Raum über ntfy da), Übung/Bull-Spiel in Arbeit, Einstellungen (Laptop ≠ Handy).
Kein Konto: **der Code ist der Schlüssel.** Die Tabelle ist für den öffentlichen Schlüssel
gesperrt; lesen und schreiben geht nur über `darts_pull`/`darts_push`, die den Code
verlangen (`supabase/migrations/20261028210000_darts_stand.sql`).

- Abgleich beim Start, beim Zurückkommen in die App, wenn das Netz wiederkommt, 2 s nach
  einer Änderung und sonst jede Minute bei offener Seite. In Ruhe geht nichts hoch.
- **Zusammengeführt, nie ersetzt:** Einträge nach `id` vereinigt; jede Löschung (Spieler,
  Bull-Eintrag, Verlauf, Kappen über 500/300/1000) hinterlässt einen Grabstein in `grab`,
  damit sie auf allen Geräten gilt; Team-Änderungen tragen einen Stempel `geaendert`.
  Gekappte und gelöschte Siege zählen als `eingefroren` (nach Spiel-id, nie doppelt).
  Derselbe Mensch mit zwei Kennungen (`lion`/`lionx`), je eine von jedem Gerät, wird beim
  ersten Verbinden zusammengelegt (`alias`) – später nie mehr.
- Beim Verbinden liegt der vorherige Stand als `darts_v2_vor_verbund` daneben.
- „Alles zurücksetzen" setzt nur dieses Gerät zurück und trennt es; „Verlauf löschen"
  gilt verbunden für alle Geräte.
- Offline bleibt alles hier und wird nachgeholt. Verlustschutz in der Datenbank: ein
  Stand ohne die Spiele der Cloud (und ohne Grabstein dafür) wird abgelehnt.
- Nach dem ersten Verbinden zeigt der Block „Siege vor → nach dem Verbinden" je
  Stammspieler; „Stand von vorher zurückholen" stellt `darts_v2_vor_verbund` wieder her
  und trennt, „Passt so" blendet die Zeile aus.
- 🔴 **iPhone:** die App vom Home-Bildschirm und Safari haben **getrennten** Speicher —
  den Code in der installierten App eingeben.
- **Offen:** Grabsteine und eingefrorene Siege wachsen ohne Grenze (~59 Bytes je
  gekapptem Spiel, die 850-KB-Grenze der App nach grob 5.900 gekappten Spielen erreicht).
  Der Deckel von 2.000 Ständen lässt sich von Fremden mit eigenen Codes füllen – dann
  geht nur „Neu anlegen" nicht mehr, bestehende Codes bleiben unberührt.

🔴 **In Safari löscht iOS gespeicherte Daten nach sieben Tagen ohne Besuch** — außer die
Seite liegt über „Zum Home-Bildschirm" als App auf dem Gerät. Genau der Fall „einmal die
Woche spielen". Die App weist in Safari darauf hin.

Die App sagt es auch sonst, wenn etwas nicht stimmt: kann das Gerät nicht speichern (Safari
im Privatmodus), liegt oben ein rotes Band. Ist der gespeicherte Stand beschädigt, wird der
Rohtext unter `darts_v2_defekt` beiseitegelegt, bevor irgendetwas ihn überschreibt. Ist
die App in zwei Fenstern offen, warnt sie, statt den Verlauf des anderen zu löschen.
„Verlauf löschen" friert die erreichten Wins vorher ein.

## Entwicklung

Single-File-App: `index.html`. Kein Build, kein npm. Dazu `manifest.webmanifest`,
`icon.svg` und `sw.js` (Service Worker, bewusst *network first* — offline nutzbar, ohne
eine alte Fassung auf dem Handy festzunageln).

```
node test/run.mjs      # 433 Logik-Tests, ohne Abhängigkeiten
```

Der Testrunner zieht den `<script>`-Block aus `index.html` und führt ihn gegen einen
DOM-Stub aus. Geprüft wird über den Haken `window.DARTS` **und über den echten
Klick-Handler** (`click`/`has`/`classOf`), denn genau in der Kette Bildschirm → Zustand →
Regel saßen die schwersten Fehler. `reboot()` simuliert das Wegwischen der App auf dem
Handy. Zwei Tests suchen alle Screens nach toten Klickzielen ab und erzwingen, dass jeder
Handler-Zweig mindestens einmal angesteuert wird.

🔴 `boot()` schaltet das **Anwurf-Rad ab**, weil es sich sonst vor jeden der ~300
Wurf-Logik-Tests schiebt. Das Rad selbst wird mit `boot({}, {rad:true})` geprüft — wer es
ändert, muss dort hinsehen, nicht in der Wurf-Logik.

Version steht in `VERSION` und im Kopf der App (Einstellungen). Push auf `main`
veröffentlicht über GitHub Pages sofort.
