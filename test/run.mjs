// Logik-Tests fuer die Darts-App. Kein npm, kein Build:
// zieht den <script>-Block aus index.html und fuehrt ihn in einem vm-Kontext
// mit minimalem DOM-/localStorage-Stub aus. Getestet wird ueber window.DARTS.
//   Aufruf:  node test/run.mjs
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Kein <script>-Block gefunden"); process.exit(1); }
const code = m[1];

function makeEl() {
  const el = { innerHTML: "", value: "", _listeners: {} };
  el.addEventListener = (t, fn) => { el._listeners[t] = fn; };
  el.setAttribute = () => {};
  el.getAttribute = () => null;
  return el;
}

function boot(seedStorage = {}) {
  const store = new Map(Object.entries(seedStorage));
  const app = makeEl();
  const els = { app };
  const win = {
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    document: {
      getElementById: id => els[id] || null,
      addEventListener: () => {},
    },
    scrollTo: () => {},
    confirm: () => true,
    prompt: () => null,
    alert: () => {},
    setTimeout, clearTimeout,
    console,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(code, win, { filename: "index.html#script" });
  return { win, D: win.DARTS, app, store };
}

// ---------------------------------------------------------------- Mini-Framework
let pass = 0, fail = 0;
const fails = [];
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; fails.push(name + "\n      " + e.message); }
}
function eq(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ": " : "") + "erwartet " + B + ", war " + A);
}
function ok(v, msg) { if (!v) throw new Error(msg || "erwartet wahr, war " + v); }

// Wuerfe kompakt eintragen: "T20" "D16" "20" "BULL" "25" "MISS"
function throwDart(D, s) {
  s = String(s).toUpperCase();
  if (s === "BULL") return D.applyDart(1, 50);
  if (s === "MISS") return D.applyDart(1, 0);
  if (s === "25") return D.applyDart(1, 25);
  const mult = s[0] === "T" ? 3 : s[0] === "D" ? 2 : 1;
  const num = parseInt(mult === 1 ? s : s.slice(1), 10);
  return D.applyDart(mult, num);
}
const seq = (D, arr) => arr.map(x => throwDart(D, x));

// ================================================================ Regeln
t("dartValue: T20=60, Doppel-Flag stimmt", () => {
  const { D } = boot();
  eq(D.dartValue(3, 20).value, 60);
  eq(D.dartValue(2, 16).isDouble, true);
  eq(D.dartValue(1, 25).isDouble, false, "aeusserer Bull ist kein Doppel");
  eq(D.dartValue(1, 50).isDouble, true, "Bull zaehlt als Doppel-25");
});

t("checkout: 170 ist das hoechste Finish", () => {
  const { D } = boot();
  eq(D.checkout(170, 3, true), ["T20", "T20", "Bull"]);
  eq(D.checkout(171, 3, true), null, "171 gibt es nicht");
  eq(D.checkout(40, 1, true), ["D20"]);
  eq(D.checkout(50, 1, true), ["Bull"]);
  ok(D.checkout(3, 2, true) !== null, "3 geht in 2 Darts");
  eq(D.checkout(159, 3, true), null, "159 ist ein Bogey-Score");
});

t("Bust setzt die ganze Aufnahme zurueck", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 60);
  seq(D, ["20", "20"]);                       // 60 -> 40 -> 20
  eq(D.getMatch().players[0].score, 20);
  eq(throwDart(D, "T20"), "bust");            // 20-60 < 0
  eq(D.getMatch().players[0].score, 60, "zurueck auf den Stand vor der Aufnahme");
  eq(D.getMatch().currentIdx, 1, "nach Bust ist der naechste dran");
});

t("Sieg nur mit Doppel, wenn Doppel-Out an ist", () => {
  const { D } = boot();
  D.startMatch(["lion"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40);
  eq(throwDart(D, "20"), "ok");               // 40 -> 20
  eq(throwDart(D, "20"), "bust", "0 ohne Doppel ist Bust");
  D.setScore(0, 40);
  eq(throwDart(D, "D20"), "win");
});

t("Rest 1 ist bei Doppel-Out ein Bust", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 21);
  eq(throwDart(D, "20"), "bust", "Rest 1 ist nicht ausspielbar");
  eq(D.getMatch().players[0].score, 21);
});

t("Beliebiger Ausgang: Single macht aus", () => {
  const { D } = boot();
  D.startMatch(["lion"], { gameType: 301, doubleOut: false, bestOf: 1 });
  D.setScore(0, 20);
  eq(throwDart(D, "20"), "win");
});

t("Doppel-In: vor dem ersten Doppel zaehlt kein Punkt", () => {
  const { D } = boot();
  D.startMatch(["lion"], { gameType: 501, doubleIn: true, doubleOut: true, bestOf: 1 });
  eq(throwDart(D, "T20"), "nostart");
  eq(D.getMatch().players[0].score, 501, "Score unveraendert");
  eq(D.getMatch().players[0].darts, 1, "der Dart zaehlt trotzdem");
  eq(throwDart(D, "D20"), "ok");
  eq(D.getMatch().players[0].score, 461, "40 abgezogen, jetzt ist er drin");
  eq(throwDart(D, "T20"), "ok");
  eq(D.getMatch().players[0].score, 401);
});

// ================================================================ Legs
t("Bo3: zwei gewonnene Legs beenden das Match", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  eq(D.legsNeeded(D.getMatch()), 2);
  D.setScore(0, 40); eq(throwDart(D, "D20"), "leg", "erstes Leg -> Zwischenstand");
  ok(!D.getMatch().finished, "Match laeuft weiter");
  eq(D.getMatch().legNo, 2);
  eq(D.getMatch().startIdx, 1, "Anwurf wechselt");
  eq(D.getMatch().currentIdx, 1, "Arne wirft das zweite Leg an");
  eq(D.getMatch().players[0].score, 501, "Scores fuer das neue Leg zurueckgesetzt");
  D.setScore(1, 40); eq(throwDart(D, "D20"), "leg", "Arne holt Leg 2");
  eq(D.getMatch().currentIdx, 0, "Anwurf wechselt zurueck");
  D.setScore(0, 32); eq(throwDart(D, "D16"), "win", "Lion holt Leg 3 = Match");
  eq(D.getMatch().winnerId, "lion");
  eq(D.getMatch().players[0].legsWon, 2);
  eq(D.getMatch().legs.length, 3);
});

t("Ein Leg (Bo1) endet sofort als Match", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  D.setScore(0, 40);
  eq(throwDart(D, "D20"), "win");
  eq(D.getMatch().finished, true);
});

t("legsNeeded: Bo5 braucht 3, Bo7 braucht 4", () => {
  const { D } = boot();
  eq(D.legsNeeded({ bestOf: 5 }), 3);
  eq(D.legsNeeded({ bestOf: 7 }), 4);
  eq(D.legsNeeded({ bestOf: 1 }), 1);
});

// ================================================================ Statistik
t("Aufnahme-Statistik: 180er, beste Aufnahme, Tons", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  seq(D, ["T20", "T20", "T20"]);              // 180, Aufnahme voll -> Wechsel
  const p = D.getMatch().players[0];
  eq(p.oneEighties, 1);
  eq(p.best, 180);
  eq(p.tons, 1);
  eq(p.scored, 180);
  eq(p.darts, 3);
  eq(D.getMatch().currentIdx, 1, "nach drei Darts ist der naechste dran");
});

t("Checkout-Wert ist der Rest vor der Aufnahme", () => {
  const { D } = boot();
  D.startMatch(["lion"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 100);
  seq(D, ["T20", "D20"]);                     // 100 aus: T20 + D20
  eq(D.getMatch().players[0].checkout, 100);
  eq(D.getMatch().players[0].scored, 100, "der ganze Rest zaehlt als erzielt");
});

t("Bust verdirbt den Schnitt, aber nicht den Punktestand", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 20);
  throwDart(D, "T20");                        // Bust
  const p = D.getMatch().players[0];
  eq(p.scored, 0, "nichts gutgeschrieben");
  eq(p.darts, 1, "der Dart zaehlt fuer den Schnitt");
});

// ================================================================ Historie & Wins
t("Match landet in der Historie und zaehlt als Win", () => {
  const { D } = boot();
  eq(D.totalWins("lion"), 1, "Startbestand aus dem Roster");
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");
  const rec = D.finishMatch();
  eq(D.getHistory().length, 1);
  eq(rec.winnerId, "lion");
  eq(rec.players.length, 2);
  eq(D.totalWins("lion"), 2, "Handstand 1 + 1 gespielt");
  eq(D.totalWins("arne"), 3, "unveraendert");
  eq(D.getMatch(), null, "Match ist abgeschlossen");
});

t("Abgebrochenes Match kommt NICHT in die Historie", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  seq(D, ["T20"]);
  eq(D.finishMatch(), null);
  eq(D.getHistory().length, 0);
});

t("Wins von Hand setzen bleibt nach Spielen konsistent", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20"); D.finishMatch();
  eq(D.totalWins("lion"), 2);
  D.setWins("lion", 10);
  eq(D.totalWins("lion"), 10, "eingetragene Zahl ist die Gesamtzahl");
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20"); D.finishMatch();
  eq(D.totalWins("lion"), 11, "ein weiteres Spiel = +1");
});

t("bumpWins geht nie unter 0", () => {
  const { D } = boot();
  D.bumpWins("lion", -1); eq(D.totalWins("lion"), 0);
  D.bumpWins("lion", -1); eq(D.totalWins("lion"), 0, "bleibt bei 0");
});

// ================================================================ Migration
t("v1 -> v2: die Hand-Wins ueberleben", () => {
  const v1 = JSON.stringify({
    roster: [{ id: "arne", name: "Arne", wins: 7, guest: false },
             { id: "lion", name: "Lion", wins: 4, guest: false }],
    match: null,
  });
  const { D } = boot({ darts_v1: v1 });
  eq(D.totalWins("arne"), 7);
  eq(D.totalWins("lion"), 4);
  eq(D.getRoster().length, 2);
  eq(D.getHistory().length, 0);
  ok(D.getSettings().gameType === 501, "Einstellungen sind da");
});

t("v1 -> v2: laufendes Spiel geht nicht verloren", () => {
  const v1 = JSON.stringify({
    roster: [{ id: "lion", name: "Lion", wins: 0 }, { id: "arne", name: "Arne", wins: 0 }],
    match: { gameType: 501, doubleOut: true, currentIdx: 1, currentTurn: [], turnStartScore: 301,
             finished: false, winnerId: null, _undo: [],
             players: [{ id: "lion", name: "Lion", score: 180, darts: 12 },
                       { id: "arne", name: "Arne", score: 301, darts: 9 }] },
  });
  const { D } = boot({ darts_v1: v1 });
  const mm = D.getMatch();
  ok(mm, "Match uebernommen");
  eq(mm.players[0].score, 180);
  eq(mm.bestOf, 1);
  eq(mm.legNo, 1);
  eq(mm.players[0].legsWon, 0);
  eq(typeof mm.players[0].scored, "number", "Statistikfelder ergaenzt");
});

t("v2 wird nicht durch v1 ueberschrieben", () => {
  const v2 = JSON.stringify({ v: 2, roster: [{ id: "lion", name: "Lion", winsManual: 9 }],
                              match: null, history: [], settings: null });
  const v1 = JSON.stringify({ roster: [{ id: "lion", name: "Lion", wins: 1 }], match: null });
  const { D } = boot({ darts_v2: v2, darts_v1: v1 });
  eq(D.totalWins("lion"), 9, "v2 hat Vorrang");
  ok(D.getSettings() && D.getSettings().bestOf === 1, "fehlende Einstellungen nachgezogen");
});

t("Speichern laeuft wirklich in localStorage", () => {
  const { D, store } = boot();
  D.startMatch(["lion"], { gameType: 301, bestOf: 1 });
  ok(store.has("darts_v2"), "unter dem v2-Schluessel");
  const raw = JSON.parse(store.get("darts_v2"));
  eq(raw.match.gameType, 301);
});

// ================================================================ Undo
t("Undo nimmt auch einen Leg-Gewinn zurueck", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  D.setScore(0, 40);
  throwDart(D, "D20");                        // Leg 1 an Lion
  eq(D.getMatch().legNo, 2);
  D.undo();
  eq(D.getMatch().legNo, 1, "zurueck in Leg 1");
  eq(D.getMatch().players[0].legsWon, 0);
  eq(D.getMatch().players[0].score, 40, "Score wieder auf 40");
  eq(D.getMatch().legs.length, 0);
});

t("Undo nimmt den Matchsieg zurueck", () => {
  const { D } = boot();
  D.startMatch(["lion"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 32);
  eq(throwDart(D, "D16"), "win");
  D.undo();
  eq(D.getMatch().finished, false);
  eq(D.getMatch().winnerId, null);
  eq(D.getMatch().players[0].score, 32);
});

// ================================================================ Sprache
t("parseSpeech: Multiplikator vor der Zahl", () => {
  const { D } = boot();
  const p = D.parseSpeech("Triple 20, 20, Doppel 5", ["lion", "arne"]);
  eq(p.throws.map(x => x.label), ["T20", "20", "D5"]);
});

t("parseSpeech: Kommandos und Bull", () => {
  const { D } = boot();
  eq(D.parseSpeech("zurück", []).cmd, "undo");
  eq(D.parseSpeech("weiter", []).cmd, "skip");
  eq(D.parseSpeech("Bull", []).throws[0].label, "Bull");
  eq(D.parseSpeech("daneben daneben daneben", []).throws.map(x => x.num), [0, 0, 0]);
  eq(D.parseSpeech("daneben", []).throws[0].label, "0", "Fehlwurf traegt 0 ein");
});

// ================================================================ Rendering
t("Alle Ansichten rendern ohne Absturz", () => {
  const { D, app } = boot();
  for (const v of ["home", "roster", "setup"]) {
    D.setView(v); D.render();
    ok(app.innerHTML.length > 50, v + " liefert HTML");
  }
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  D.render(); ok(app.innerHTML.includes("Leg 1"), "Leg-Zeile im Spiel");
  D.setScore(0, 40); throwDart(D, "D20");
  D.render(); ok(app.innerHTML.includes("holt Leg"), "Leg-Zwischenscreen");
  D.startMatch(["lion"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");
  D.render(); ok(app.innerHTML.includes("gewinnt"), "Win-Screen");
});

t("Rangliste zeigt die Summe aus Hand und Historie", () => {
  const { D, app } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20"); D.finishMatch();
  D.setView("home"); D.render();
  ok(app.innerHTML.indexOf("Arne") < app.innerHTML.indexOf("Lion"), "Arne (3) vor Lion (2)");
});

// ================================================================ Direktvergleich
// Ein komplettes Match in einer Zeile: winIdx gewinnt alle noetigen Legs.
function playMatch(D, ids, winIdx, opts) {
  opts = opts || { gameType: 501, doubleOut: true, bestOf: 1 };
  D.startMatch(ids, opts);
  const need = D.legsNeeded({ bestOf: opts.bestOf || 1 });
  for (let l = 0; l < need; l++) {
    const m = D.getMatch();
    if (m.currentIdx !== winIdx) {                 // Anwurf beim Falschen: durchreichen
      D.endTurn();
    }
    D.setScore(winIdx, 40);
    D.applyDart(2, 20);
  }
  return D.finishMatch();
}

t("h2h zaehlt nur Duelle zu zweit", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["lion", "arne"], 1);
  playMatch(D, ["lion", "arne", "justus"], 0);     // Runde zu dritt
  const r = D.h2h("lion", "arne");
  eq(r.n, 3, "drei echte Duelle");
  eq(r.winsA, 2); eq(r.winsB, 1);
  eq(r.multiN, 1, "die Dreierrunde separat");
  eq(r.multiA, 1);
  eq(r.games.length, 3);
});

t("h2h ist seitenrichtig - Reihenfolge der Argumente zaehlt", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  eq(D.h2h("lion", "arne").winsA, 1);
  eq(D.h2h("arne", "lion").winsA, 0, "aus Arnes Sicht steht es 0:1");
  eq(D.h2h("arne", "lion").winsB, 1);
});

t("h2h: fremdes Duell faerbt nicht ab", () => {
  const { D } = boot();
  playMatch(D, ["justus", "arne"], 0);
  const r = D.h2h("lion", "arne");
  eq(r.n, 0, "Lion hat gegen Arne noch nichts gespielt");
  eq(r.winsA, 0); eq(r.winsB, 0);
});

t("h2h: Legs und Schnitt kommen aus den echten Matches", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  D.setScore(0, 40); D.applyDart(2, 20);          // Leg 1 Lion
  D.endTurn();                                     // Arne wirft an -> durchreichen
  D.setScore(0, 40); D.applyDart(2, 20);          // Leg 2 Lion -> Match
  D.finishMatch();
  const r = D.h2h("lion", "arne");
  eq(r.legsA, 2); eq(r.legsB, 0);
  ok(r.avgA > 0, "Schnitt berechnet");
  eq(r.dartsA, 2, "zwei Darts geworfen");
});

t("Siegesserie wird erkannt", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 1);              // Arne
  playMatch(D, ["lion", "arne"], 0);              // Lion
  playMatch(D, ["lion", "arne"], 0);              // Lion
  const r = D.h2h("lion", "arne");
  eq(r.streak.id, "lion");
  eq(r.streak.n, 2, "die letzten zwei");
});

t("allDuels listet jede Paarung einmal, neueste zuerst", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["justus", "arne"], 0);
  playMatch(D, ["lion", "arne"], 1);
  const d = D.allDuels();
  eq(d.length, 2, "zwei Paarungen");
  const la = d.find(x => (x.a === "lion" || x.b === "lion") && (x.a === "arne" || x.b === "arne"));
  eq(la.n, 2, "Lion/Arne zweimal gespielt");
  eq(d[0], la, "die zuletzt gespielte Paarung steht oben");
});

t("Duell-Bilanz steht im laufenden Spiel im Kopf", () => {
  const { D, app } = boot();
  playMatch(D, ["lion", "arne"], 0);
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  D.render();
  ok(app.innerHTML.includes("Duell"), "Duell-Zeile sichtbar");
  ok(/Duell <b>1:0<\/b>/.test(app.innerHTML), "Stand 1:0 im Kopf");
});

t("Bei drei Spielern steht kein Duellstand im Kopf", () => {
  const { D, app } = boot();
  playMatch(D, ["lion", "arne"], 0);
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, bestOf: 1 });
  D.render();
  ok(!app.innerHTML.includes("Duell"), "waere irrefuehrend");
});

t("H2H-Ansicht rendert mit und ohne Historie", () => {
  const { D, app } = boot();
  D.setView("h2h"); D.render();
  ok(app.innerHTML.includes("Noch kein Duell"), "leerer Zustand ist beschriftet");
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["lion", "arne"], 0);
  D.setView("h2h"); D.render();
  ok(app.innerHTML.includes("Duelle"), "Duell-Zahl steht da");
  ok(app.innerHTML.includes("Die letzten Duelle"), "Spieleliste");
});

t("Startseite zeigt die Duell-Karte erst, wenn es Duelle gibt", () => {
  const { D, app } = boot();
  D.setView("home"); D.render();
  ok(!app.innerHTML.includes("DUELLE"), "vorher keine leere Karte");
  playMatch(D, ["lion", "arne"], 0);
  D.setView("home"); D.render();
  ok(app.innerHTML.includes("DUELLE"), "danach schon");
});

// ================================================================ Ich-Marker
t("Ich stehe im Duell immer links, egal wie der Gegner heisst", () => {
  const { D } = boot();
  eq(D.meId(), "lion", "Standard-Marker");
  playMatch(D, ["arne", "lion"], 1);              // Arne war Spieler 0
  playMatch(D, ["justus", "lion"], 1);
  const d = D.allDuels();
  d.forEach(x => eq(x.a, "lion", "Lion steht links in " + x.a + "/" + x.b));
});

t("Ohne Ich-Marker entscheidet die alphabetische Reihenfolge", () => {
  const { D } = boot();
  const st = D.getState();
  st.settings.meId = null;
  playMatch(D, ["lion", "arne"], 0);
  eq(D.allDuels()[0].a, "arne", "arne < lion");
});

t("Geloeschter Ich-Spieler faellt sauber zurueck", () => {
  const { D } = boot();
  const st = D.getState();
  st.settings.meId = "gibtsnicht";
  eq(D.meId(), null, "kein Marker statt Absturz");
  playMatch(D, ["lion", "arne"], 0);
  eq(D.allDuels().length, 1, "Duelle funktionieren trotzdem");
});

t("orderPair dreht nur, wenn ich hinten stehe", () => {
  const { D } = boot();
  eq(D.orderPair("arne", "lion"), ["lion", "arne"]);
  eq(D.orderPair("lion", "arne"), ["lion", "arne"], "bleibt");
  eq(D.orderPair("arne", "justus"), ["arne", "justus"], "ohne mich unveraendert");
});

t("Ergebnisliste zeigt den Legs-Stand aus Siegersicht", () => {
  const { D, app } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  D.setScore(1, 40); D.endTurn();                 // Lion ist dran -> weiterreichen
  D.setScore(1, 40); D.applyDart(2, 20);          // Leg 1 Arne
  D.setScore(1, 40); D.applyDart(2, 20);          // Leg 2 Arne -> Match
  D.finishMatch();
  D.setView("h2h"); D.render();
  ok(app.innerHTML.includes("<b>Arne</b> gewinnt"), "Arne als Sieger");
  ok(app.innerHTML.includes("2:1") || app.innerHTML.includes("2:0"),
     "Sieger-Legs zuerst, nie 0:2");
  ok(!app.innerHTML.includes("Bo3 &middot; 0:2"), "nie der verdrehte Stand");
});

// ================================================================ Einstellungen & Sicherung
t("Einstellungs-Screen rendert und zeigt die echten Zahlen", () => {
  const { D, app } = boot();
  playMatch(D, ["lion", "arne"], 0);
  D.setView("settings"); D.render();
  ok(app.innerHTML.includes("Standard für neue Spiele"), "Kopfbereich da");
  ok(/<b>1<\/b> Spiele/.test(app.innerHTML), "Verlaufszaehler zeigt die echte Zahl");
  ok(app.innerHTML.includes("Verlauf löschen (1 Spiele)"), "echte Zahl, nicht Platzhalter");
});

t("Verlauf loeschen friert die Wins ein statt sie zu verlieren", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["lion", "arne"], 0);
  eq(D.totalWins("lion"), 3, "1 von Hand + 2 gespielt");
  D.clearHistory();
  eq(D.getHistory().length, 0);
  eq(D.totalWins("lion"), 3, "die Zahl bleibt stehen");
  eq(D.totalWins("arne"), 3, "Arne unveraendert");
  eq(D.h2h("lion", "arne").n, 0, "Duell-Bilanz ist erwartungsgemaess weg");
});

t("Sicherung enthaelt Team, Verlauf und Einstellungen", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  const pay = D.exportPayload();
  eq(pay.app, "darts");
  eq(pay.state.history.length, 1);
  eq(pay.state.roster.length, 3);
  ok(pay.state.settings.gameType === 501);
});

t("Sicherung laesst sich wieder einspielen", () => {
  const A = boot();
  playMatch(A.D, ["lion", "arne"], 0);
  playMatch(A.D, ["lion", "arne"], 0);
  A.D.setWins("arne", 42);
  const json = JSON.stringify(A.D.exportPayload());

  const B = boot();
  eq(B.D.getHistory().length, 0, "frischer Stand");
  eq(B.D.importText(json), null, "kein Fehler");
  eq(B.D.getHistory().length, 2, "Verlauf uebernommen");
  eq(B.D.totalWins("arne"), 42, "Handstand uebernommen");
  eq(B.D.h2h("lion", "arne").winsA, 2, "Duell-Bilanz rekonstruiert");
});

t("Kaputte Sicherung wird abgewiesen statt eingespielt", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  ok(D.importText("kein json") !== null, "Fehlermeldung");
  ok(D.importText('{"foo":1}') !== null, "kein Team drin");
  eq(D.getHistory().length, 1, "der bestehende Stand ueberlebt beide Versuche");
});

t("Import einer alten v1-Sicherung geht auch", () => {
  const { D } = boot();
  const err = D.importText(JSON.stringify({
    roster: [{ id: "x", name: "Xaver", wins: 5 }], match: null }));
  eq(err, null);
  eq(D.totalWins("x"), 5, "wins wird zu winsManual");
  ok(D.getSettings().gameType === 501, "Einstellungen ergaenzt");
});

t("Alles zuruecksetzen stellt den Auslieferungszustand her", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  D.setWins("lion", 99);
  D.resetAll();
  eq(D.getHistory().length, 0);
  eq(D.totalWins("lion"), 1, "wieder der Startbestand");
  eq(D.getRoster().length, 3);
});

t("Einstellungen wirken auf neue Spiele", () => {
  const { D } = boot();
  const st = D.getState();
  st.settings.gameType = 301; st.settings.bestOf = 5; st.settings.doubleOut = false;
  D.startMatch(["lion", "arne"], {});
  const m = D.getMatch();
  eq(m.gameType, 301);
  eq(m.bestOf, 5);
  eq(m.doubleOut, false);
  eq(m.players[0].score, 301);
});

t("Ausdrueckliche Optionen schlagen die Einstellungen", () => {
  const { D } = boot();
  D.getState().settings.gameType = 301;
  D.startMatch(["lion"], { gameType: 701 });
  eq(D.getMatch().gameType, 701);
});

// ---------------------------------------------------------------- Ausgabe
console.log("");
if (fails.length) {
  console.log("FEHLGESCHLAGEN:");
  fails.forEach(f => console.log("  x " + f));
  console.log("");
}
console.log(pass + " von " + (pass + fail) + " Tests gruen.");
process.exit(fail ? 1 : 0);
