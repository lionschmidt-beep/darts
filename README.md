# 🎯 Darts

Handy-Web-App zum Darts-Spielen für Lions Team. Eine Datei, kein Login, kein Server.

**Live:** https://lionschmidt-beep.github.io/darts/ · installierbar über „Zum Startbildschirm hinzufügen"

## Was sie kann

**Spielen** — X01 (301/501/701), Single/Double/Triple, 25 & Bull, volle Bust-Logik,
Doppel-Out oder beliebiger Ausgang, optional Doppel-In. Legs als einzelnes Leg oder
Best of 3/5/7 mit wechselndem Anwurf.

**Eingeben, wie es gerade passt** — entweder Dart für Dart oder die **ganze Aufnahme am
Stück** („einer ruft einundachtzig, du tippst 81"). Beim Ausmachen fragt die App nach der
Dart-Zahl, sonst wäre der Schnitt falsch. Unter den Wurf-Feldern steht immer, was zuletzt
passiert ist — inklusive „💥 überworfen, zurück auf 40", damit ein Bust nicht wie
„nichts passiert" aussieht.

**Finish-Vorschlag ab Rest ≤ 170** — und zwar der, den man auch wirft: der Rechner
bevorzugt D20/D16/D8/D4, weil die sich beim Danebenwerfen sauber halbieren, und schlägt
nie einen Doppelring als Stellwurf vor. Bei 60 steht dort `20 D20`, nicht `T18 D3`.

**Duelle** — Jedes beendete Spiel wird gespeichert; daraus entsteht der Direktvergleich:
„Lion gegen Arne 8:3", Siegesserie, Legs, 3-Dart-Schnitt, beste Aufnahme, höchstes Finish,
180er und die letzten zwölf Begegnungen. Im laufenden Spiel steht der Duellstand im Kopf.
Gezählt werden nur echte Duelle zu zweit — Runden mit mehr Leuten stehen separat darunter.

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

**Einstellungen** — Standardmodus, Ausgang, Legs, Doppel-In, Ansage, Verlauf, Sicherung.

## Speicher

Alles liegt im `localStorage` dieses Browsers — kein Server, kein Sync, keine Konten.
**Cache leeren oder Handy wechseln heißt: weg.** Darum gibt es unter Einstellungen →
Sicherung einen Export als Datei oder in die Zwischenablage und einen Import zurück.

Die App sagt es, wenn etwas nicht stimmt: kann das Gerät nicht speichern (Safari im
Privatmodus), liegt oben ein rotes Band. Ist der gespeicherte Stand beschädigt, wird der
Rohtext unter `darts_v2_defekt` beiseitegelegt, bevor irgendetwas ihn überschreibt. Ist
die App in zwei Fenstern offen, warnt sie, statt den Verlauf des anderen zu löschen.
„Verlauf löschen" friert die erreichten Wins vorher als Zahl ein.

## Entwicklung

Single-File-App: `index.html`. Kein Build, kein npm. Dazu `manifest.webmanifest`,
`icon.svg` und `sw.js` (Service Worker, bewusst *network first* — offline nutzbar, ohne
eine alte Fassung auf dem Handy festzunageln).

```
node test/run.mjs      # 174 Logik-Tests, ohne Abhängigkeiten
```

Der Testrunner zieht den `<script>`-Block aus `index.html` und führt ihn gegen einen
DOM-Stub aus. Geprüft wird über den Haken `window.DARTS` **und über den echten
Klick-Handler** (`click`/`has`/`classOf`), denn genau in der Kette Bildschirm → Zustand →
Regel saßen die schwersten Fehler. `reboot()` simuliert das Wegwischen der App auf dem
Handy. Zwei Tests suchen alle Screens nach toten Klickzielen ab und erzwingen, dass jeder
Handler-Zweig mindestens einmal angesteuert wird.

Version steht in `VERSION` und im Kopf der App (Einstellungen). Push auf `main`
veröffentlicht über GitHub Pages sofort.
