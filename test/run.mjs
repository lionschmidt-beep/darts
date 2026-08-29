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
  const el = { innerHTML: "", value: "", _listeners: {}, files: [] };
  el.addEventListener = (t, fn) => { el._listeners[t] = fn; };
  el.setAttribute = () => {};
  el.getAttribute = () => null;
  el.click = () => {};                    // Dateidialog oeffnet im Test nichts
  el.remove = () => {};
  return el;
}

function boot(seedStorage = {}, opt = {}) {
  const store = new Map(Object.entries(seedStorage));
  const gesagt = [];
  const zustand = { schreibenGeht: !opt.schreibenScheitert };
  const events = {};
  const app = makeEl();
  const els = { app, newName: makeEl(), voiceStatus: makeEl(), impFile: makeEl() };
  const answers = { confirm: true, prompt: null };
  const win = {
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      // Safari im Privatmodus wirft hier. Genau dieser Fall muss pruefbar sein.
      setItem: (k, v) => {
        if (!zustand.schreibenGeht) throw new Error("QuotaExceededError");
        store.set(k, String(v));
      },
      removeItem: k => store.delete(k),
    },
    document: {
      // Nur liefern, was auch wirklich auf dem Bildschirm steht. Sonst findet
      // ein Test ein Eingabefeld, das die Ansicht gar nicht anzeigt.
      getElementById: id => {
        if (id === "app") return app;
        return app.innerHTML.includes('id="' + id + '"') ? (els[id] || null) : null;
      },
      addEventListener: () => {},
      createElement: () => makeEl(),
      body: { appendChild: () => {} },
    },
    scrollTo: () => {},
    addEventListener: (typ, fn) => { (events[typ] = events[typ] || []).push(fn); },
    // Sprachausgabe mitschreiben statt sie zu verschlucken - sonst laesst sich
    // nicht pruefen, ob der Lautsprecher-Schalter ueberhaupt etwas bewirkt.
    speechSynthesis: { cancel() {}, speak(u) { gesagt.push(u.text); } },
    SpeechSynthesisUtterance: function (t) { this.text = t; },
    navigator: { userAgent: "test" },              // ohne serviceWorker: SW-Zweig bleibt aus
    location: { protocol: "http:", href: "http://localhost/" },
    confirm: () => answers.confirm,
    prompt: () => answers.prompt,
    alert: () => {},
    setTimeout, clearTimeout,
    console,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(code, win, { filename: "index.html#script" });

  // --- Der echte Klick-Handler, so wie ihn ein Finger ausloest ------------
  // Ohne den ueberspringt jeder Test die Kette Screen -> UI-State -> Logik,
  // und genau dort sassen zwei Fehler, die 73 gruene Tests nicht sahen.
  function findTag(html, act, filter) {
    const re = /<[a-z][^>]*?data-act="([^"]+)"[^>]*?>/gi;
    let m;
    while ((m = re.exec(html))) {
      if (m[1] !== act) continue;
      const attrs = {};
      const are = /([a-z][a-z0-9-]*)="([^"]*)"/gi;
      let a;
      while ((a = are.exec(m[0]))) attrs[a[1]] = a[2];
      if (!filter || Object.keys(filter).every(k => attrs[k] === String(filter[k]))) return attrs;
    }
    return null;
  }
  function click(act, filter) {
    const attrs = findTag(app.innerHTML, act, filter);
    if (!attrs) {
      throw new Error('kein klickbares Element data-act="' + act + '"' +
        (filter ? " " + JSON.stringify(filter) : "") + " im aktuellen Screen");
    }
    const el = { getAttribute: k => (k in attrs ? attrs[k] : null) };
    el.closest = () => el;
    app._listeners.click({ target: el });
    return attrs;
  }
  const has = (act, filter) => !!findTag(app.innerHTML, act, filter);
  // Klasse eines Elements lesen - fuer "ist der Knopf markiert?"
  function classOf(act, filter) {
    const t = findTag(app.innerHTML, act, filter);
    return t ? (t.class || "") : null;
  }
  return { win, D: win.DARTS, app, store, click, has, classOf, findTag, els, answers,
           gesagt, zustand, events };
}
// Neustart aus dem gespeicherten Zustand - simuliert Reload / App-Kill auf dem Handy.
function reboot(ctx) { return boot(Object.fromEntries(ctx.store)); }

// ---------------------------------------------------------------- Mini-Framework
let pass = 0, fail = 0;
const fails = [];
const offen = [];   // asynchrone Tests - ohne diese Liste zaehlten sie immer als gruen
function t(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === "function") {
      offen.push(r.then(() => { pass++; },
                        e => { fail++; fails.push(name + " (async) -- " + e.message); }));
      return;
    }
    pass++;
  }
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

// Die CSS-Klassen eines Elements als Liste - robuster als ein Regex mit
// Wortgrenzen, und es rutschen keine Steuerzeichen hinein.
function klassen(ctx, act, id) {
  return String(ctx.classOf(act, { "data-id": id }) || "").split(/\s+/).filter(Boolean);
}

// Nur die "Zuletzt"-Zeile - Namen und Zahlen stehen sonst ueberall auf dem Board.
function zuletztZeile(ctx) {
  const m = ctx.app.innerHTML.match(/<div class="lastturn[^"]*">([\s\S]*?)<\/div>/);
  return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : null;
}

// Die zwei Namen aus der Duell-Kopfzeile, in der Reihenfolge, in der sie stehen.
function duellNamen(ctx) {
  const m = ctx.app.innerHTML.match(/<div class="h2hnames">([\s\S]*?)<\/div>\s*<div class="h2hbig">/);
  if (!m) return null;
  return (m[1].match(/<span[^>]*>([^<]+)<\/span>/g) || [])
    .map(x => x.replace(/<[^>]+>/g, "").trim())
    .filter(x => x && x !== "vs");
}

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
  eq(D.parseSpeech("daneben", []).throws[0].label, "&#10007;", "Fehlwurf ist ein Kreuz, kein Strich");
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
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
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
  // Ab drei Spielern wird danach um Platz 2 gespielt - fuer die meisten Tests
  // ist nur das Endergebnis interessant, also durchspielen.
  let schutz = 0;
  while (D.getMatch() && !D.getMatch().finished && schutz++ < 6) {
    const m = D.getMatch();
    D.setView("game");
    D.setScore(m.currentIdx, 40);
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
  ok(app.innerHTML.indexOf("<b>1</b> Spiel &middot;") >= 0, "Verlaufszaehler im Singular");
  ok(app.innerHTML.includes("Verlauf löschen (1 Spiel)"), "echte Zahl im Singular");
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

// ================================================================ Allein spielen
t("Ein Solo-Spiel zaehlt nicht als Sieg", () => {
  const { D } = boot();
  eq(D.totalWins("lion"), 1);
  playMatch(D, ["lion"], 0);                      // allein: man gewinnt gegen niemanden
  eq(D.getHistory().length, 1, "das Spiel wird trotzdem gespeichert");
  eq(D.totalWins("lion"), 1, "aber die Rangliste bleibt unberuehrt");
});

t("Ein echtes Spiel zaehlt weiterhin", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  eq(D.totalWins("lion"), 2);
});

// ================================================================ Training
t("Doppel-Training: Treffer schaltet weiter, drei Fehlversuche auch", () => {
  const { D } = boot();
  D.startTraining("double", "lion");
  eq(D.trainTarget().short, "D1");
  eq(D.trainDart(true), "hit");
  eq(D.trainTarget().short, "D2", "nach dem Treffer das naechste Ziel");
  eq(D.getTrain().hits, 1);
  D.trainDart(false); D.trainDart(false);
  eq(D.trainTarget().short, "D2", "nach zwei Fehlern noch dasselbe Ziel");
  D.trainDart(false);
  eq(D.trainTarget().short, "D3", "nach dem dritten weiter");
  eq(D.getTrain().hits, 1, "kein Punkt fuer D2");
  eq(D.getTrain().darts, 4);
});

t("Training endet nach 21 Zielen und kennt seinen Bestwert", () => {
  const { D } = boot();
  D.startTraining("double", "lion");
  for (let i = 0; i < 20; i++) D.trainDart(true);
  eq(D.getTrain().done, false, "20 von 21");
  eq(D.trainDart(true), "done");
  eq(D.getTrain().hits, 21);
  const rec = D.finishTraining();
  eq(rec.score, 21); eq(rec.max, 21); eq(rec.darts, 21); eq(rec.mode, "double");
  eq(D.getPractice().length, 1);
  eq(D.bestPractice("lion", "double").score, 21);
  eq(D.bestPractice("arne", "double"), null, "fremder Bestwert bleibt leer");
  eq(D.getTrain(), null, "Lauf beendet");
});

t("Uebungsrunden zaehlen NICHT in Rangliste oder Duell", () => {
  const { D } = boot();
  const before = D.totalWins("lion");
  D.startTraining("double", "lion");
  for (let i = 0; i < 21; i++) D.trainDart(true);
  D.finishTraining();
  eq(D.totalWins("lion"), before, "Rangliste unberuehrt");
  eq(D.getHistory().length, 0, "nichts in der Match-Historie");
  eq(D.h2h("lion", "arne").n, 0);
});

t("Bestwert ist der hoechste Score - egal an welcher Stelle er steht", () => {
  const { D } = boot();
  // Der beste Lauf liegt bewusst in der MITTE: liefe bestPractice einfach bis
  // zum Ende durch, gaebe es den aeltesten zurueck und der Test merkte nichts.
  const lauf = (treffer) => {
    D.startTraining("double", "lion");
    for (let i = 0; i < treffer; i++) D.trainDart(true);
    for (let i = 0; i < (21 - treffer) * 3; i++) D.trainDart(false);
    D.finishTraining();
  };
  lauf(5);                                   // aeltester
  lauf(15);                                  // der beste
  lauf(2);                                   // neuester
  eq(D.getPractice().length, 3);
  eq(D.getPractice()[0].score, 2, "neuester steht vorn");
  eq(D.getPractice()[2].score, 5, "aeltester steht hinten");
  eq(D.bestPractice("lion", "double").score, 15, "weder der neueste noch der aelteste");
});

t("Bei gleichem Score gewinnen die wenigeren Darts", () => {
  const { D } = boot();
  // Lauf 1: 1 Treffer, danach lauter Fehlversuche -> viele Darts
  D.startTraining("double", "lion");
  D.trainDart(true);
  for (let i = 0; i < 60; i++) D.trainDart(false);
  D.finishTraining();
  const teuer = D.bestPractice("lion", "double").darts;
  // Lauf 2: ebenfalls 1 Treffer, aber ein Fehlversuch weniger
  D.startTraining("double", "lion");
  D.trainDart(true);
  for (let i = 0; i < 59; i++) D.trainDart(false);
  D.trainDart(false);
  D.trainUndo();                             // einen Dart wieder wegnehmen
  D.trainDart(false);
  D.finishTraining();
  const b = D.bestPractice("lion", "double");
  eq(b.score, 1);
  ok(b.darts <= teuer, "der sparsamere Lauf gewinnt (" + b.darts + " <= " + teuer + ")");
});

t("Training zurueck: der letzte Dart laesst sich wegnehmen", () => {
  const { D } = boot();
  D.startTraining("double", "lion");
  D.trainDart(true);                                    // D1 getroffen
  eq(D.getTrain().idx, 1);
  D.trainUndo();
  eq(D.getTrain().idx, 0, "wieder auf D1");
  eq(D.getTrain().hits, 0);
  eq(D.getTrain().darts, 0);
  D.trainDart(false);
  eq(D.getTrain().tries, 1);
  D.trainUndo();
  eq(D.getTrain().tries, 0, "Fehlversuch zurueckgenommen");
});

t("Around the Clock hat eigene Ziele und eigenen Bestwert", () => {
  const { D } = boot();
  D.startTraining("around", "lion");
  eq(D.trainTarget().short, "1");
  for (let i = 0; i < 21; i++) D.trainDart(true);
  D.finishTraining();
  eq(D.bestPractice("lion", "around").score, 21);
  eq(D.bestPractice("lion", "double"), null, "Modi werden nicht vermischt");
});

t("Solo-Rekord: wenigste Darts fuer diesen Startwert", () => {
  const { D } = boot();
  D.startMatch(["lion"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); D.applyDart(2, 20); D.finishMatch();
  const r1 = D.bestSolo("lion", 501);
  eq(r1.darts, 1);
  eq(D.bestSolo("lion", 301), null, "anderer Startwert, eigener Rekord");
  eq(D.bestSolo("arne", 501), null, "fremder Rekord bleibt leer");
});

t("Solo-Screen und Trainings-Screen rendern", () => {
  const { D, app } = boot();
  D.setView("solo"); D.render();
  ok(app.innerHTML.includes("Wer übt?"), "Auswahl da");
  ok(app.innerHTML.includes("Doppel-Training"), "Modus-Karte");
  ok(/noch kein Rekord/i.test(app.innerHTML), "leerer Zustand beschriftet");
  D.startTraining("double", "lion");
  D.setView("train"); D.render();
  ok(app.innerHTML.includes("Doppel 1"), "aktuelles Ziel gross");
  ok(app.innerHTML.includes("Treffer"), "Bedienung");
  for (let i = 0; i < 21; i++) D.trainDart(true);
  D.render();
  ok(app.innerHTML.includes("21 von 21"), "Abschluss");
  ok(app.innerHTML.includes("Neuer Rekord"), "erster Lauf ist immer Rekord");
});

// ================================================================ Spieler-Akte
t("playerStats zaehlt Spiele, Siege und Quote", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["lion", "arne"], 1);
  const s = D.playerStats("lion");
  eq(s.games, 3);
  eq(s.wins, 2);
  eq(s.quote, 67, "2 von 3 gerundet");
  eq(s.form, [false, true, true], "neueste zuerst - das letzte Spiel ging verloren");
});

t("Solo-Spiele stehen getrennt von den Duell-Zahlen", () => {
  const { D } = boot();
  playMatch(D, ["lion"], 0);
  playMatch(D, ["lion"], 0);
  const s = D.playerStats("lion");
  eq(s.games, 0, "keine Gegner, keine Bilanz");
  eq(s.solo, 2, "aber zwei Solo-Runden");
  eq(s.quote, 0);
  eq(s.darts, 0, "die Duell-Zahlen bleiben unberuehrt");
  ok(s.soloDarts > 0, "die Solo-Wuerfe stehen in eigenen Feldern");
});

t("Legs werden fuer und gegen gezaehlt", () => {
  const { D } = boot();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  D.setScore(0, 40); D.applyDart(2, 20);          // Leg 1 Lion
  D.setScore(1, 40); D.applyDart(2, 20);          // Leg 2 Arne
  D.setScore(0, 40); D.applyDart(2, 20);          // Leg 3 Lion -> Match
  D.finishMatch();
  const s = D.playerStats("lion");
  eq(s.legsWon, 2);
  eq(s.legsLost, 1);
  eq(D.playerStats("arne").legsWon, 1);
});

t("Beste Werte sind Maxima ueber alle Spiele, egal wann sie fielen", () => {
  const { D } = boot();
  // state.history ist neueste-zuerst. Der Rekord liegt deshalb bewusst im
  // AELTEREN Spiel und ein schwaecherer Wert im neueren - sonst kaeme auch ein
  // "nimm einfach den zuletzt gelesenen" ans richtige Ergebnis.
  const spiel = (wurf) => {
    D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
    seq(D, wurf);
    D.setScore(1, 40); D.applyDart(2, 20);        // Arne macht aus
    ok(D.finishMatch(), "Match beendet");
  };
  spiel(["20", "20", "20"]);                      // aeltestes: 60
  spiel(["T20", "T20", "T20"]);                   // mittleres: 180  <- der Rekord
  spiel(["20", "20", "20"]);                      // neuestes: 60
  const s = D.playerStats("lion");
  eq(s.best, 180, "weder das neueste noch das aelteste Spiel");
  eq(s.t180, 1);
  spiel(["T20", "T20", "T20"]);
  eq(D.playerStats("lion").t180, 2, "180er werden summiert, nicht ueberschrieben");
});

t("Form haelt nur die letzten zehn Spiele", () => {
  const { D } = boot();
  for (let i = 0; i < 14; i++) playMatch(D, ["lion", "arne"], i < 12 ? 0 : 1);
  const s = D.playerStats("lion");
  eq(s.games, 14);
  eq(s.form.length, 10, "nicht mehr als zehn");
  eq(s.form.slice(0, 3), [false, false, true],
     "neueste zuerst: die letzten zwei gingen an Arne");
});

t("Spieler-Akte rendert mit Duellen und Rekorden", () => {
  const { D, app } = boot();
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["lion", "justus"], 1);
  D.startTraining("double", "lion");
  for (let i = 0; i < 21; i++) D.trainDart(true);
  D.finishTraining();
  D.setPlayerSel("lion"); D.setView("player"); D.render();
  ok(app.innerHTML.includes("Lion"), "Name");
  ok(app.innerHTML.includes("gegen Arne"), "Duell gegen Arne");
  ok(app.innerHTML.includes("gegen Justus"), "Duell gegen Justus");
  ok(app.innerHTML.includes("Doppel-Training"), "Trainings-Rekord");
  ok(app.innerHTML.includes("Das bin ich"), "Marker setzbar");
});

t("Akte eines frischen Spielers stuerzt nicht ab", () => {
  const { D, app } = boot();
  D.setPlayerSel("justus"); D.setView("player"); D.render();
  ok(app.innerHTML.includes("Noch keine Spiele"), "leerer Zustand beschriftet");
  ok(!app.innerHTML.includes("NaN"), "keine kaputten Zahlen");
  ok(!app.innerHTML.includes("undefined"), "keine Luecken");
});

t("Rangliste fuehrt in die Akte, nicht mehr in die Team-Liste", () => {
  const { D, app } = boot();
  D.setView("home"); D.render();
  ok(app.innerHTML.includes('data-act="openplayer"'), "Zeile oeffnet die Akte");
});

// ================================================================ PWA
t("PWA-Dateien sind vorhanden und verdrahtet", () => {
  const need = ["manifest.webmanifest", "sw.js", "icon.svg"];
  need.forEach(f => ok(fs.existsSync(path.join(root, f)), f + " fehlt"));
  ok(html.includes('rel="manifest"'), "Manifest im Kopf verlinkt");
  ok(html.includes('serviceWorker'), "Service Worker wird registriert");
  ok(html.includes('./sw.js'), "relativer Pfad - GitHub Pages liegt unter /darts/");
});

t("Manifest ist gueltiges JSON mit den Pflichtfeldern", () => {
  const mf = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  eq(mf.name, "Darts");
  eq(mf.display, "standalone");
  eq(mf.start_url, "./", "relativ, sonst bricht der Unterpfad auf GitHub Pages");
  ok(mf.icons.length >= 1, "mindestens ein Icon");
  ok(mf.icons.some(i => i.purpose === "maskable"), "maskable fuer Android");
  ok(mf.background_color && mf.theme_color, "Farben gesetzt");
});

t("Service Worker holt zuerst aus dem Netz", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const fetchIdx = sw.indexOf("fetch(req)");
  const cacheIdx = sw.indexOf("caches.match(req)");
  ok(fetchIdx > 0 && cacheIdx > fetchIdx,
     "network-first: sonst nagelt der SW eine alte Version auf dem Handy fest");
  ok(sw.includes("skipWaiting"), "neue Fassung uebernimmt sofort");
  ok(sw.includes("caches.delete"), "alte Caches werden geraeumt");
});

// ================================================================ Echte Bedienung
// Diese Gruppe fuehrt den Klick-Handler aus statt window.DARTS direkt. Genau
// dazwischen sassen die Fehler, die 73 gruene Tests nicht gesehen haben.

t("Der Setup-Screen zeigt, was danach wirklich gespielt wird", () => {
  const ctx = boot();
  const st = ctx.D.getState().settings;
  st.gameType = 301; st.doubleOut = false; st.bestOf = 5; st.doubleIn = true;
  ctx.D.setView("home"); ctx.D.render();
  ctx.click("nav", { "data-view": "setup" });

  ok(/\bon\b/.test(ctx.classOf("gt", { "data-g": 301 }) || ""), "301 ist markiert");
  ok(/\bon\b/.test(ctx.classOf("bo", { "data-n": 5 }) || ""), "Bo5 ist markiert");
  ok(/\bon\b/.test(ctx.classOf("do", { "data-v": 0 }) || ""), "beliebiger Ausgang ist markiert");
  ok(/\bon\b/.test(ctx.classOf("din") || ""), "Doppel-In ist markiert");

  ctx.click("start");
  const m = ctx.D.getMatch();
  eq(m.gameType, 301, "gespielt wird, was auf dem Schirm stand");
  eq(m.doubleOut, false);
  eq(m.bestOf, 5);
  eq(m.doubleIn, true);
});

t("Im Setup umgestellt heisst im Spiel umgestellt", () => {
  const ctx = boot();
  ctx.D.setView("home"); ctx.D.render();
  ctx.click("nav", { "data-view": "setup" });
  ctx.click("gt", { "data-g": 701 });
  ctx.click("bo", { "data-n": 3 });
  ctx.click("do", { "data-v": 0 });
  ctx.click("start");
  const m = ctx.D.getMatch();
  eq(m.gameType, 701);
  eq(m.bestOf, 3);
  eq(m.doubleOut, false);
  eq(m.players[0].score, 701);
});

t("Ein gewonnenes Spiel ueberlebt das Wegwischen der App", () => {
  const ctx = boot();
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  ctx.D.setScore(0, 40);
  eq(throwDart(ctx.D, "D20"), "win");
  // Handy zugeklappt, PWA gekillt, App neu geoeffnet - OHNE auf "Speichern" zu tippen
  const nach = reboot(ctx);
  nach.D.setView("home"); nach.D.render();
  ok(nach.D.getHistory().length === 1 || nach.has("nav", { "data-view": "win" }) ||
     nach.has("resume"),
     "entweder ist der Sieg gebucht oder die Startseite bietet einen Weg zurueck - " +
     "sonst ist das Spiel spurlos weg");
});

t("Ein laufendes Training ueberlebt den Neustart auffindbar", () => {
  const ctx = boot();
  ctx.D.startTraining("double", "lion");
  ctx.D.trainDart(true); ctx.D.trainDart(true);
  const nach = reboot(ctx);
  eq(nach.D.getTrain() && nach.D.getTrain().idx, 2, "der Lauf liegt noch im Speicher");
  nach.D.setView("home"); nach.D.render();
  const homeWeg = nach.has("nav", { "data-view": "train" }) || nach.has("resumetrain");
  nach.D.setView("solo"); nach.D.render();
  const soloWeg = nach.has("nav", { "data-view": "train" }) || nach.has("resumetrain");
  ok(homeWeg || soloWeg,
     "es muss einen anklickbaren Weg zurueck geben - ein Lauf, den nur der Speicher kennt, " +
     "blockiert stumm den naechsten Start");
});

t("Auf dem Leg-Zwischenstand landet keine Ansage im naechsten Leg", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  D.setScore(0, 40); eq(throwDart(D, "D20"), "leg");
  eq(D.getView(), "leg", "wir stehen auf dem Zwischenstand");
  const vorher = D.getMatch().players.map(p => p.score);
  D.applySpokenResult(D.parseSpeech("triple 20 triple 20 triple 20", []), "triple 20 ...");
  eq(D.getMatch().players.map(p => p.score), vorher,
     "kein Wurf darf gebucht werden, solange der Zwischenstand steht");
});

t("Ein Fehlwurf ist nie ein Doppel - auch nicht mit gedruecktem Double", () => {
  const ctx = boot();
  const D = ctx.D;
  eq(D.dartValue(2, 0).isDouble, false, "D0 gibt es nicht");
  eq(D.dartValue(3, 0).isDouble, false);
  D.startMatch(["lion"], { gameType: 501, doubleIn: true, doubleOut: true, bestOf: 1 });
  D.applyDart(2, 0);                                  // Double gedrueckt, danebengeworfen
  eq(D.getMatch().players[0].legStart, true, "das Leg ist damit NICHT eroeffnet");
  D.applyDart(1, 20);
  eq(D.getMatch().players[0].score, 501, "und der naechste Single zaehlt weiterhin nicht");
});

t("Ueberworfen steht auf dem Bildschirm, nicht nur im Sprachmodus", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40);
  D.setView("game"); D.render();
  ctx.click("num", { "data-n": 20 });                 // 40 -> 20
  ctx.click("num", { "data-n": 20 });                 // 0 ohne Doppel -> Bust
  ok(/überworfen|Überworfen|Bust/i.test(ctx.app.innerHTML),
     "der Spieler muss sehen, dass die Aufnahme verfallen ist");
});

t("Doppel-In zeigt keinen Wurf an, den es nicht zaehlt", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion"], { gameType: 501, doubleIn: true, doubleOut: true, bestOf: 1 });
  D.setView("game"); D.render();
  ctx.click("mult", { "data-m": 3 });
  ctx.click("num", { "data-n": 20 });                 // T20, zaehlt nicht (noch nicht drin)
  const html = ctx.app.innerHTML;
  ok(!/Aufnahme: <b>60<\/b>/.test(html),
     "eine Aufnahme-Summe von 60 ist gelogen, wenn 0 gezaehlt wurde");
  ok(/\bon\b/.test(ctx.classOf("mult", { "data-m": 1 }) || ""),
     "der Multiplikator faellt auf Single zurueck, sonst wird der naechste Wurf verdreifacht");
});

t("Kein Element sieht klickbar aus, ohne es zu sein", () => {
  const ctx = boot();
  const D = ctx.D;
  // Daten anlegen, damit alle Screens etwas zu zeigen haben
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["lion", "justus"], 1);
  D.startTraining("double", "lion");
  for (let i = 0; i < 5; i++) D.trainDart(true);
  D.finishTraining();

  // Jede im Klick-Handler behandelte Aktion einsammeln - was das HTML anbietet,
  // aber der Handler nicht kennt, ist ein toter Knopf.
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const behandelt = new Set((script.match(/act===\"[a-z_0-9]+\"/g) || [])
    .map(x => x.slice(7, -1)));

  const screens = ["home", "roster", "setup", "h2h", "solo", "settings", "player"];
  const tot = [];
  screens.forEach(v => {
    if (v === "player") D.setPlayerSel("lion");
    D.setView(v); D.render();
    const h = ctx.app.innerHTML;
    // (a) angebotene Aktionen, die der Handler nicht kennt
    (h.match(/data-act="([a-z_0-9]+)"/g) || []).forEach(x => {
      const a = x.slice(10, -1);
      if (!behandelt.has(a)) tot.push(v + ": data-act=" + a + " kennt der Handler nicht");
    });
    // (b) Pfeil-Elemente ohne data-act, die auch keinen Vorfahren mit data-act haben
    (h.match(/<span(?![^>]*data-act)[^>]*>[^<]*&rsaquo;[^<]*<\/span>/g) || []).forEach(sp => {
      const vor = h.slice(0, h.indexOf(sp));
      const offen = vor.lastIndexOf("<div");
      const kopf = vor.slice(offen, offen + 200);
      if (!/data-act/.test(kopf)) tot.push(v + ": Pfeil ohne Ziel " + sp.slice(0, 60));
    });
  });
  eq(tot, [], "tote Klickziele gefunden");
});

t("Jede Aktion im Handler wird auch irgendwo angeboten", () => {
  const ctx = boot();
  const D = ctx.D;
  playMatch(D, ["lion", "arne"], 0);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const behandelt = new Set((script.match(/act===\"[a-z_0-9]+\"/g) || [])
    .map(x => x.slice(7, -1)));
  const angeboten = new Set();
  const sammle = () => (ctx.app.innerHTML.match(/data-act="([a-z_0-9]+)"/g) || [])
    .forEach(x => angeboten.add(x.slice(10, -1)));
  ["home", "roster", "setup", "h2h", "solo", "settings"].forEach(v => {
    D.setView(v); D.render(); sammle();
  });
  D.setPlayerSel("lion"); D.setView("player"); D.render(); sammle();

  // Laufendes Spiel: Board, Summen-Pad, Leg-Zwischenstand
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  D.setView("game"); D.render(); sammle();
  D.getState().settings.inputMode = "sum"; D.render(); sammle();
  D.setScore(0, 40);
  ctx.click("sumkey", { "data-k": 4 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" }); sammle();               // Ausmach-Frage: sumfin
  ctx.click("sumcancel");
  D.getState().settings.inputMode = "single";
  D.setScore(0, 40); throwDart(D, "D20"); D.render(); sammle();    // Leg-Zwischenstand

  // Home mit laufendem Spiel: fortsetzen / verwerfen
  D.setView("home"); D.render(); sammle();

  // Gewonnenes Spiel: Sieger-Screen (eigenes Bo1, damit es sicher endet)
  D.finishMatch();
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); eq(throwDart(D, "D20"), "win");
  D.render(); sammle();                                            // winagain/winhome
  D.setView("home"); D.render(); sammle();                         // "Ergebnis eintragen"
  D.finishMatch();

  // Ausspielen um Platz 2 (drei Spieler, ein Leg)
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");
  D.render(); sammle();                                            // nextplatz/platzende
  ctx.click("platzende");
  D.finishMatch();

  // Doppel-In-Frage im Summen-Modus
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion"], { gameType: 501, doubleIn: true, bestOf: 1 });
  D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 6 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" }); sammle();               // sumopen/sumcancel
  ctx.click("sumcancel");

  // Ueberworfene Summe -> Dartzahl-Frage (sumbustd)
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 20); D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 6 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" }); sammle();
  ctx.click("sumcancel");
  D.finishMatch();
  D.getState().settings.inputMode = "single";

  // Laufendes Training: auf Home und im Screen
  D.startTraining("double", "lion");
  D.setView("home"); D.render(); sammle();                         // "Übung fortsetzen"
  D.setView("train"); D.render(); sammle();
  for (let i = 0; i < 21; i++) D.trainDart(true);
  D.render(); sammle();

  // Warnbaender
  ctx.zustand.schreibenGeht = false; D.startMatch(["lion"], { gameType: 501, bestOf: 1 });
  D.setView("home"); D.render(); sammle();                         // standok/reloadstate
  ctx.zustand.schreibenGeht = true;
  const horcher = (ctx.events.storage || [])[0];
  if (horcher) { horcher({ key: "darts_v2" }); D.render(); sammle(); }

  // Der Beschaedigt-Hinweis braucht einen kaputten Stand beim Start
  const kaputt = boot({ darts_v2: '{"v":2,"roster":[{"id":"x' });
  kaputt.D.setView("home"); kaputt.D.render();
  (kaputt.app.innerHTML.match(/data-act="([a-z_0-9]+)"/g) || [])
    .forEach(x => angeboten.add(x.slice(10, -1)));

  const nie = [...behandelt].filter(a => !angeboten.has(a));
  eq(nie, [], "Handler-Zweige, die kein Bildschirm je anbietet");
});

// ================================================================ Neustart-Festigkeit
t("Nach dem Neustart steht man wieder im laufenden Spiel", () => {
  const ctx = boot();
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  throwDart(ctx.D, "T20");
  const nach = reboot(ctx);
  eq(nach.D.getView(), "game", "direkt zurueck ins Spiel, nicht auf die Startseite");
  nach.D.render();
  ok(nach.has("num", { "data-n": 20 }), "das Zahlenfeld ist sofort da");
  eq(nach.D.getMatch().players[0].score, 441, "der Stand stimmt");
});

t("Nach dem Neustart steht der Sieger-Screen wieder da", () => {
  const ctx = boot();
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  ctx.D.setScore(0, 40); throwDart(ctx.D, "D20");
  const nach = reboot(ctx);
  eq(nach.D.getView(), "win", "der Sieg wartet dort, wo man ihn verlassen hat");
  nach.D.render();
  ok(nach.has("winhome"), "und laesst sich eintragen");
  nach.click("winhome");
  eq(nach.D.getHistory().length, 1, "eingetragen");
  eq(nach.D.totalWins("lion"), 2);
});

t("Nach dem Neustart laeuft das Training weiter", () => {
  const ctx = boot();
  ctx.D.startTraining("double", "lion");
  ctx.D.trainDart(true); ctx.D.trainDart(true);
  const nach = reboot(ctx);
  eq(nach.D.getView(), "train");
  nach.D.render();
  ok(nach.has("thit"), "Treffer-Knopf ist da");
  eq(nach.D.trainTarget().short, "D3", "genau dort, wo aufgehoert wurde");
});

t("Ein gemerkter Screen ohne Zustand faellt auf die Startseite zurueck", () => {
  // Bildschirm "game" gemerkt, aber das Match wurde inzwischen verworfen
  const ctx = boot();
  ctx.D.startMatch(["lion"], { gameType: 501, bestOf: 1 });
  const roh = JSON.parse(ctx.store.get("darts_v2"));
  eq(roh._view, "game");
  roh.match = null;
  const nach = boot({ darts_v2: JSON.stringify(roh) });
  eq(nach.D.getView(), "home", "kein leerer Spielbildschirm");
  nach.D.render();
  ok(nach.app.innerHTML.includes("Neues Spiel"), "Startseite ist da");
});

t("Ein beendetes Match zeigt keinen Fortsetzen-Knopf", () => {
  const ctx = boot();
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  ctx.D.setScore(0, 40); throwDart(ctx.D, "D20");
  const nach = reboot(ctx);
  nach.D.setView("home"); nach.D.render();
  ok(!nach.has("resume"), "nichts fortzusetzen - das Spiel ist zu Ende");
  ok(nach.has("nav", { "data-view": "win" }), "stattdessen: Ergebnis eintragen");
});

// ================================================================ Datenintegritaet
t("Der 500er-Deckel der Historie frisst keine Wins", () => {
  const { D } = boot();
  const st = D.getState();
  // 500 alte Siege von Lion vorbelegen
  st.history = [];
  for (let i = 0; i < 500; i++) {
    st.history.push({ id: "h" + i, ts: i, ended: i, mode: "x01", gameType: 501,
      bestOf: 1, winnerId: "lion",
      players: [{ id: "lion", name: "Lion", legsWon: 1, darts: 9, scored: 501 },
                { id: "arne", name: "Arne", legsWon: 0, darts: 9, scored: 200 }] });
  }
  const vorher = D.totalWins("lion");
  eq(vorher, 501, "1 von Hand + 500 gespielt");
  playMatch(D, ["lion", "arne"], 0);                  // 501. Sieg -> aeltester faellt raus
  eq(D.getHistory().length, 500, "Deckel haelt");
  eq(D.totalWins("lion"), vorher + 1,
     "der abgeschnittene Sieg muss in den Handeintrag wandern, sonst verschwindet er");
});

t("Der Trainings-Deckel frisst keinen Rekord", () => {
  const { D } = boot();
  const st = D.getState();
  st.practice = [];
  for (let i = 0; i < 300; i++) {
    st.practice.push({ id: "p" + i, ts: i, ended: i, mode: "double",
                       playerId: "lion", score: i === 299 ? 21 : 1, max: 21, darts: 21 });
  }
  eq(D.bestPractice("lion", "double").score, 21, "der Rekord steht");
  // Ein neuer Lauf schiebt den aeltesten raus - der Rekord liegt aber ganz hinten
  D.startTraining("double", "lion");
  for (let i = 0; i < 63; i++) D.trainDart(false);
  D.finishTraining();
  eq(D.bestPractice("lion", "double").score, 21,
     "ein Rekord darf nicht hinten aus der Liste fallen");
});

t("Eine strukturell kaputte Sicherung crasht nicht", () => {
  const { D } = boot();
  playMatch(D, ["lion", "arne"], 0);
  const kaputt = [
    JSON.stringify({ state: { roster: [{ id: "x", name: "X" }], match: {} } }),
    JSON.stringify({ state: { roster: [{ id: "x", name: "X" }], match: { players: null } } }),
    JSON.stringify({ state: { roster: null } }),
    JSON.stringify({ state: { roster: [{ id: "x", name: "X" }], history: "keine liste" } }),
  ];
  kaputt.forEach((k, i) => {
    let err = null;
    try { err = D.importText(k); }
    catch (e) { throw new Error("Variante " + i + " wirft statt abzuweisen: " + e.message); }
    ok(typeof err === "string" || err === null, "Variante " + i + " liefert ein Ergebnis");
  });
  // Die App muss danach noch bedienbar sein
  D.setView("home"); D.render();
  ok(D.getRoster().length > 0, "es gibt noch ein Team");
});

t("Die Fehlermeldung sagt, WAS mit der Sicherung nicht stimmt", () => {
  const { D } = boot();
  const kein = [
    JSON.stringify({ state: { roster: [] } }),
    JSON.stringify({ state: { roster: null } }),
    JSON.stringify({ state: {} }),
  ];
  kein.forEach((k, i) => {
    const err = D.importText(k);
    ok(/Team/.test(err || ""),
       "Variante " + i + ' muss "kein Team" melden, nicht "beschädigt" - ' +
       "sonst sucht man den Fehler an der falschen Stelle. War: " + err);
  });
  ok(/beschädigt/.test(D.importText("{kein json") || "") ||
     /gültige/.test(D.importText("{kein json") || ""),
     "echter Datenmuell meldet dagegen Beschaedigung");
});

t("Nach dem Import einer Sicherung mit laufendem Spiel geht das Werfen weiter", () => {
  const A = boot();
  A.D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  throwDart(A.D, "T20");
  const json = JSON.stringify(A.D.exportPayload());
  // Undo-Stapel und Aufnahme aus der Sicherung entfernen - so sehen fremde/alte Staende aus
  const obj = JSON.parse(json);
  delete obj.state.match._undo;
  delete obj.state.match.currentTurn;
  delete obj.state.match.turnStartScore;

  const B = boot();
  eq(B.D.importText(JSON.stringify(obj)), null, "Import geht durch");
  let err = null;
  try { throwDart(B.D, "20"); } catch (e) { err = e.message; }
  eq(err, null, "der naechste Dart darf nicht werfen: " + err);
  ok(B.D.getMatch().players[0].score < 501, "und er wird gezaehlt");
});

t("Ein geloeschter Spieler wird nicht zum Phantom", () => {
  const ctx = boot();
  const D = ctx.D;
  playMatch(D, ["lion", "arne"], 0);
  const st = D.getState();
  st.roster = st.roster.filter(p => p.id !== "arne");   // Arne geloescht
  D.setView("h2h"); D.render();
  ok(!/vs\s*arne\b/.test(ctx.app.innerHTML),
     "kein roher Slug als Name - der Name steht in der Historie");
  ok(/Arne/.test(ctx.app.innerHTML) || !/arne/.test(ctx.app.innerHTML),
     "entweder der echte Name oder gar nicht");
});

t("Trainings-Rekordmeldung stimmt mit dem ueberein, was gespeichert wird", () => {
  const ctx = boot();
  const D = ctx.D;
  // Lauf 1: 1 Treffer, aber erst im dritten Versuch -> 63 Darts
  D.startTraining("double", "lion");
  D.trainDart(false); D.trainDart(false); D.trainDart(true);   // D1 im 3. Versuch
  for (let i = 0; i < 60; i++) D.trainDart(false);             // 20 Ziele x 3 Fehler
  D.finishTraining();
  const alt = D.bestPractice("lion", "double");
  eq(alt.score, 1); eq(alt.darts, 63);
  // Lauf 2: gleicher Score, Treffer sofort -> 61 Darts. Das IST ein Rekord.
  D.startTraining("double", "lion");
  D.trainDart(true);
  for (let i = 0; i < 60; i++) D.trainDart(false);
  D.setView("train"); D.render();
  const meldung = ctx.app.innerHTML;
  const gemeldet = /Neuer Rekord/.test(meldung);
  D.finishTraining();
  const neu = D.bestPractice("lion", "double");
  const wirklich = neu.darts < alt.darts || neu.score > alt.score;
  eq(gemeldet, wirklich,
     "die Meldung auf dem Schirm und der gespeicherte Rekord duerfen nicht auseinanderlaufen");
});

t("Eine importierte Spieler-ID kann kein HTML einschleusen", () => {
  const ctx = boot();
  const boese = '{"state":{"roster":[{"id":"x\\" data-evil=\\"1","name":"Boese","winsManual":0}],' +
                '"match":null,"history":[],"practice":[]}}';
  eq(ctx.D.importText(boese), null, "Import geht durch");
  ctx.D.setView("roster"); ctx.D.render();
  ok(!/data-evil=/.test(ctx.app.innerHTML), "kein fremdes ATTRIBUT im HTML");
  eq(ctx.D.getRoster()[0].id, "x-data-evil-1", "die ID ist entschaerft, nicht nur maskiert");
  ok(ctx.has("setme", { "data-id": "x-data-evil-1" }), "und bleibt bedienbar");
});

t("checkout kennt seine Grenzen", () => {
  const { D } = boot();
  eq(D.checkout(40, 0, true), null, "ohne Darts geht gar nichts");
  eq(D.checkout(180, 3, false), ["T20", "T20", "T20"],
     "ohne Doppel-Out sind 180 in drei Darts ausspielbar");
  eq(D.checkout(181, 3, false), null);
  eq(D.checkout(170, 3, true), ["T20", "T20", "Bull"], "mit Doppel-Out bleibt 170 die Grenze");
  eq(D.checkout(171, 3, true), null);
});

// ================================================================ Duell-Auswahl
t("Beim Umschalten des Gegners bleibe ich links stehen", () => {
  const ctx = boot();
  const D = ctx.D;
  playMatch(D, ["lion", "arne"], 0);
  playMatch(D, ["lion", "justus"], 0);
  D.setView("h2h"); D.render();
  const start = ctx.D.getState();
  eq(D.meId(), "lion");

  // Auf einen NICHT gewaehlten Gegner tippen, wenn schon zwei gewaehlt sind
  ctx.click("h2hpick", { "data-id": "arne" });
  eq(duellNamen(ctx), ["Lion", "Arne"], "Lion links, der Gegner rechts");
  ok(klassen(ctx, "h2hpick", "lion").includes("a"),
     "Lion traegt die linke Farbe");
  ok(klassen(ctx, "h2hpick", "arne").includes("b"),
     "der Gegner die rechte");

  // Und wieder zurueck auf Justus
  ctx.click("h2hpick", { "data-id": "justus" });
  eq(duellNamen(ctx), ["Lion", "Justus"], "auch nach dem zweiten Wechsel");
});

t("Der eigene Chip laesst sich abwaehlen und wieder setzen", () => {
  const ctx = boot();
  playMatch(ctx.D, ["lion", "arne"], 0);
  ctx.D.setView("h2h"); ctx.D.render();
  ctx.click("h2hpick", { "data-id": "lion" });        // abwaehlen
  ok(/Noch 1 auswählen|Zwei Spieler antippen/i.test(ctx.app.innerHTML),
     "die Auswahl springt nicht sofort zurueck");
  eq(duellNamen(ctx), null, "keine Bilanz ohne zwei Spieler");
  ctx.click("h2hpick", { "data-id": "lion" });        // wieder dazu
  eq(duellNamen(ctx), ["Lion", "Arne"], "und steht wieder links");
});

t("Zurueck und Weiter sind im Spiel nicht mehr verwechselbar", () => {
  const ctx = boot();
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  ctx.D.setView("game"); ctx.D.render();
  const undo = ctx.classOf("undo") || "";
  const skip = ctx.classOf("skip") || "";
  ok(undo !== skip, "unterschiedliche Optik: undo='" + undo + "' skip='" + skip + "'");
  ok(/ghost|sm|skipbtn/.test(skip), "der gefaehrlichere Knopf ist der zurueckhaltendere");
});

// ================================================================ Ansage
t("Der Lautsprecher-Schalter wirkt auch beim Tippen", () => {
  const ctx = boot();
  const D = ctx.D;
  eq(D.getSettings().tts, true, "Ansage ist im Auslieferungszustand an");
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setView("game"); D.render();
  ctx.click("num", { "data-n": 20 });
  ctx.click("num", { "data-n": 20 });
  ctx.click("num", { "data-n": 20 });                  // Aufnahme voll -> Ansage
  ok(ctx.gesagt.length > 0, "es wurde etwas gesagt");
  const letzte = ctx.gesagt[ctx.gesagt.length - 1];
  ok(/Lion/.test(letzte), "mit Namen: " + letzte);
  ok(/60/.test(letzte), "mit der Aufnahme");
  ok(/441/.test(letzte), "und dem Rest");
});

t("Ein Bust wird auch angesagt", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 20);
  D.setView("game"); D.render();
  ctx.click("mult", { "data-m": 3 });
  ctx.click("num", { "data-n": 20 });                  // Bust
  const letzte = ctx.gesagt[ctx.gesagt.length - 1] || "";
  ok(/Überworfen/i.test(letzte), "gesagt wurde: " + letzte);
});

t("Ausgeschaltet sagt die App nichts", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.tts = false;
  D.setView("settings"); D.render();
  ctx.click("s_tts");                                  // aus -> an
  ctx.click("s_tts");                                  // an -> aus
  eq(D.getSettings().tts, false);
  const vorher = ctx.gesagt.length;
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  D.setView("game"); D.render();
  ctx.click("num", { "data-n": 20 });
  ctx.click("num", { "data-n": 20 });
  ctx.click("num", { "data-n": 20 });
  eq(ctx.gesagt.length, vorher, "kein Wort");
});

t("Der Sprachmodus sagt nicht doppelt an", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  ctx.gesagt.length = 0;
  D.applySpokenResult(D.parseSpeech("20 20 20", ["lion", "arne"]), "20 20 20");
  const treffer = ctx.gesagt.filter(x => /Rest/i.test(x));
  eq(treffer.length, 1, "genau eine Rest-Ansage, nicht zwei: " + JSON.stringify(ctx.gesagt));
});

// ================================================================ Setup-Bedienung
t("Ein Gast laesst sich direkt im Setup dazunehmen und spielt mit", () => {
  const ctx = boot();
  ctx.D.setView("home"); ctx.D.render();
  ctx.click("nav", { "data-view": "setup" });
  ok(ctx.has("add", { "data-guest": 1 }), "das Feld ist im Setup, nicht nur im Team-Screen");
  ctx.els.newName.value = "Pascal";
  ctx.click("add", { "data-guest": 1 });
  const neu = ctx.D.getRoster().find(p => p.name === "Pascal");
  ok(neu, "im Team");
  eq(neu.guest, true, "als Gast");
  ctx.click("start");
  const namen = ctx.D.getMatch().players.map(p => p.name);
  ok(namen.includes("Pascal"),
     "wer im Setup dazukommt, spielt auch mit - sonst muss man ihn noch antippen. War: " +
     JSON.stringify(namen));
});

t("Die Spieler-Akte sagt, woher die Wins kommen", () => {
  const ctx = boot();
  playMatch(ctx.D, ["lion", "arne"], 0);
  playMatch(ctx.D, ["lion", "arne"], 0);
  eq(ctx.D.totalWins("lion"), 3, "1 von Hand + 2 gespielt");
  ctx.D.setPlayerSel("lion"); ctx.D.setView("player"); ctx.D.render();
  ok(/2 gespielt gewonnen/.test(ctx.app.innerHTML),
     "die gespielten Siege stehen da");
  ok(/1 von Hand/.test(ctx.app.innerHTML),
     "und der Handeintrag - sonst laesst sich die Zahl nicht nachrechnen");
});

t("Ohne Handeintrag steht keine Herkunftszeile im Weg", () => {
  const ctx = boot();
  ctx.D.setWins("lion", 0);
  playMatch(ctx.D, ["lion", "arne"], 0);
  ctx.D.setPlayerSel("lion"); ctx.D.setView("player"); ctx.D.render();
  ok(!/von Hand/.test(ctx.app.innerHTML), "keine Zeile, die nichts erklaert");
});

// ================================================================ Summen-Eingabe
t("Die ganze Aufnahme auf einmal eintragen", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  eq(D.applyTurnSum(81), "ok");
  eq(D.getMatch().players[0].score, 420);
  eq(D.getMatch().players[0].darts, 3, "eine Aufnahme sind drei Darts");
  eq(D.getMatch().players[0].scored, 81);
  eq(D.getMatch().currentIdx, 1, "danach ist der Naechste dran");
});

t("Eine zu hohe Summe ist ueberworfen, keine negative Zahl", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40);
  // Ohne Dartzahl fragt die App erst - sonst waere der Schnitt geraten.
  eq(D.applyTurnSum(60), "bustfrage");
  eq(D.getMatch().players[0].darts, 0, "vorher wird nichts gebucht");
  eq(D.applyTurnSum(60, 3), "bust");
  eq(D.getMatch().players[0].score, 40, "zurueck auf den Stand vor der Aufnahme");
  eq(D.getMatch().players[0].scored, 0, "nichts gutgeschrieben");
  eq(D.getMatch().players[0].darts, 3, "die Darts zaehlen fuer den Schnitt");
});

t("Rest 1 ist auch bei Summen-Eingabe ueberworfen", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 41);
  eq(D.applyTurnSum(40), "bustfrage", "auch hier wird erst gefragt");
  eq(D.applyTurnSum(40, 2), "bust");
  eq(D.getMatch().players[0].score, 41);
  eq(D.getMatch().players[0].darts, 2, "und die genannte Dartzahl wird uebernommen");
});

t("Unmoegliche Summen werden abgewiesen, nicht gebucht", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion"], { gameType: 501, bestOf: 1 });
  eq(D.applyTurnSum(181), "ungueltig");
  eq(D.applyTurnSum(-5), "ungueltig");
  eq(D.getMatch().players[0].score, 501, "nichts veraendert");
  eq(D.getMatch().players[0].darts, 0, "und keine Darts verbraucht");
});

t("Beim Ausmachen fragt die App nach der Dart-Zahl", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40);
  eq(D.applyTurnSum(40), "finish", "erst fragen, dann buchen");
  eq(D.getMatch().players[0].score, 40, "noch nichts gebucht");
  eq(D.applyTurnSum(40, 2), "win", "mit zwei Darts ausgemacht");
  eq(D.getMatch().players[0].darts, 2, "nur zwei Darts, nicht drei");
  eq(D.getMatch().players[0].checkout, 40);
  eq(D.getMatch().winnerId, "lion");
});

t("Der Schnitt stimmt bei Summen-Eingabe", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.applyTurnSum(60);                                 // Lion
  D.applyTurnSum(45);                                 // Arne
  D.applyTurnSum(60);                                 // Lion
  const p = D.getMatch().players[0];
  eq(p.scored, 120); eq(p.darts, 6);
  eq(Math.round(p.scored / p.darts * 3), 60, "Schnitt je drei Darts");
});

t("Der Ziffernblock bedient sich wie ein Taschenrechner", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setView("game"); D.render();
  ok(ctx.has("sumkey", { "data-k": 7 }), "Ziffernblock ist da");
  ok(!ctx.has("num", { "data-n": 20 }), "das Einzel-Feld ist weg");
  // Nur die Anzeigebox messen - die Zahl taucht spaeter auch in der
  // Letzte-Aufnahme-Zeile auf, dort waere sie kein Beweis.
  const anzeige = () => (ctx.app.innerHTML.match(/<div class="sumval[^"]*">([^<]*)<\/div>/) || [])[1];
  ctx.click("sumkey", { "data-k": 8 });
  ctx.click("sumkey", { "data-k": 1 });
  eq(anzeige(), "81", "81 steht in der Anzeige");
  ok(/Rest danach/.test(ctx.app.innerHTML), "und der Rest wird vorgerechnet");
  ctx.click("sumkey", { "data-k": "del" });
  eq(anzeige(), "8", "Loeschen nimmt eine Ziffer weg");
  ctx.click("sumkey", { "data-k": 1 });
  ctx.click("sumkey", { "data-k": "ok" });
  eq(D.getMatch().players[0].score, 420, "eingetragen");
  eq(anzeige(), "Aufnahme", "und das Feld ist wieder leer");
});

t("Die Ausmach-Frage laesst sich abbrechen", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40);
  D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 4 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" });
  ok(ctx.has("sumfin", { "data-d": 3 }), "die Dart-Frage steht");
  ctx.click("sumcancel");
  ok(!ctx.has("sumfin", { "data-d": 3 }), "und ist wieder weg");
  eq(D.getMatch().finished, false, "nichts gebucht");
  eq(D.getMatch().players[0].score, 40);
});

t("Der Umschalter merkt sich die Wahl", () => {
  const ctx = boot();
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  ctx.D.setView("game"); ctx.D.render();
  eq(ctx.D.sumMode(), false, "Einzel-Eingabe ist der Auslieferungszustand");
  ctx.click("imode", { "data-v": "sum" });
  eq(ctx.D.sumMode(), true, "umgeschaltet");
  ok(ctx.has("sumkey", { "data-k": 7 }), "und der Ziffernblock ist da");
  const nach = reboot(ctx);
  eq(nach.D.sumMode(), true, "die Wahl ueberlebt den Neustart");
  nach.D.render();
  ctx.click("imode", { "data-v": "single" });
  eq(ctx.D.sumMode(), false, "und laesst sich zurueckschalten");
  ok(ctx.has("num", { "data-n": 20 }), "Einzel-Feld wieder da");
});

t("Der Eingabe-Modus ueberlebt den Neustart", () => {
  const ctx = boot();
  ctx.D.getState().settings.inputMode = "sum";
  ctx.D.startMatch(["lion"], { gameType: 501, bestOf: 1 });
  const nach = reboot(ctx);
  eq(nach.D.sumMode(), true, "die Wahl bleibt");
  nach.D.render();
  ok(nach.has("sumkey", { "data-k": 5 }));
});

t("Summen-Eingabe und Einzel-Eingabe fuehren zum selben Ergebnis", () => {
  const a = boot(), b = boot();
  a.D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  seq(a.D, ["T20", "20", "1"]);                       // 60+20+1 = 81
  b.D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  b.D.applyTurnSum(81);
  const pa = a.D.getMatch().players[0], pb = b.D.getMatch().players[0];
  eq([pa.score, pa.darts, pa.scored], [pb.score, pb.darts, pb.scored],
     "Rest, Darts und erzielte Punkte identisch");
});

// ================================================================ Zuletzt-Zeile
t("Die Zuletzt-Zeile ueberlebt kein Undo als Luege", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  seq(D, ["T20", "T20", "T20"]);                    // 180, Aufnahme voll
  D.setView("game"); D.render();
  ok(/180/.test(ctx.app.innerHTML), "die Aufnahme steht da");
  D.undo(); D.undo(); D.undo();                     // alles zurueck
  eq(D.getMatch().players[0].score, 501, "Stand zurueckgesetzt");
  D.render();
  eq(zuletztZeile(ctx), null,
     "eine zurueckgenommene Aufnahme darf nicht weiter auf dem Board stehen. War: " +
     zuletztZeile(ctx));
});

t("Ein zurueckgenommener Bust verschwindet auch von der Anzeige", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 20);
  throwDart(D, "T20");                              // Bust
  D.setView("game"); D.render();
  ok(/überworfen/.test(ctx.app.innerHTML), "erst steht er da");
  D.undo();
  D.render();
  eq(zuletztZeile(ctx), null, "nach dem Zurueck ist er weg: " + zuletztZeile(ctx));
});

t("Im neuen Leg steht keine Aufnahme aus dem alten", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 3 });
  D.setScore(0, 40);
  eq(throwDart(D, "D20"), "leg");
  ctx.click("nextleg");
  eq(D.getMatch().players[0].score, 501, "neues Leg");
  eq(zuletztZeile(ctx), null,
     "der Ausmach-Wurf aus Leg 1 gehoert nicht auf das Board von Leg 2. War: " +
     zuletztZeile(ctx));
});

t("Aufnahme beenden loescht nicht, was der Vorgaenger geworfen hat", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  seq(D, ["20", "20", "20"]);                       // Lion 60, Wechsel zu Arne
  D.setView("game"); D.render();
  const vorher = zuletztZeile(ctx);
  ok(/Lion/.test(vorher || "") && /60/.test(vorher || ""),
     "erst steht Lions Aufnahme da: " + vorher);
  ctx.click("skip");                                // Arne beendet ohne Wurf
  const nachher = zuletztZeile(ctx);
  eq(nachher, vorher,
     "wer ohne Wurf weiterreicht, loescht nicht die Anzeige davor. War: " + nachher);
});

t("Undo sagt, ob es etwas zurueckgenommen hat", () => {
  const { D } = boot();
  D.startMatch(["lion"], { gameType: 501, bestOf: 1 });
  eq(D.undo(), false, "leerer Stapel");
  throwDart(D, "20");
  eq(D.undo(), true, "ein Wurf zurueck");
  eq(D.undo(), false, "und dann nichts mehr");
});

// ================================================================ Nichts wird stillschweigend verworfen
t("Ein gewonnenes, nicht eingetragenes Spiel wird nicht kommentarlos ueberschrieben", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");           // gewonnen, noch nicht eingetragen
  ctx.answers.confirm = false;                      // der Nutzer sagt "nein, nicht verwerfen"
  D.setView("setup"); D.render();
  ctx.click("start");
  ok(D.getMatch() && D.getMatch().finished,
     "das gewonnene Spiel steht noch - es wurde gefragt und verneint");
  eq(D.getHistory().length, 0);
  ctx.answers.confirm = true;                       // jetzt bewusst verwerfen
  D.setView("setup"); D.render();
  ctx.click("start");
  ok(D.getMatch() && !D.getMatch().finished, "neues Spiel laeuft");
});

t("Ein laufendes Spiel wird von 'Allein ueben' nicht stillschweigend gekippt", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 5 });
  throwDart(D, "T20");
  ctx.answers.confirm = false;
  D.setView("solo"); D.render();
  ctx.click("solox01");
  eq(D.getMatch().bestOf, 5, "das Bo5 laeuft weiter");
  eq(D.getMatch().players.length, 2);
});

t("Ein laufendes Training wird nicht stillschweigend ueberschrieben", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startTraining("double", "lion");
  for (let i = 0; i < 10; i++) D.trainDart(true);
  ctx.answers.confirm = false;
  D.setView("solo"); D.render();
  ctx.click("train_around");
  eq(D.getTrain().mode, "double", "das Doppel-Training laeuft weiter");
  eq(D.getTrain().hits, 10, "mit allen Treffern");
});

// ================================================================ Modus-Wechsel
t("Ein Wechsel des Eingabe-Modus zaehlt nichts doppelt", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setView("game"); D.render();
  ctx.click("num", { "data-n": 20 });
  ctx.click("num", { "data-n": 20 });                // zwei Darts, 40 Punkte
  eq(D.getMatch().players[0].score, 461);
  eq(D.getMatch().players[0].darts, 2);
  ctx.click("imode", { "data-v": "sum" });           // mitten in der Aufnahme umschalten
  ctx.click("sumkey", { "data-k": 6 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" });           // die Aufnahme war 60
  const p = D.getMatch().players[0];
  eq(p.darts, 3, "drei Darts geworfen, nicht fuenf (war: " + p.darts + ")");
  eq(p.score, 441, "60 Punkte abgezogen, nicht 100 (war: " + p.score + ")");
});

// ================================================================ Ehrliche Beschriftung
t("Ohne Verlauf heissen die Knoepfe nicht 'Speichern'", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.keepHistory = false;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");
  D.setView("win"); D.render();
  ok(!/Speichern/.test(ctx.app.innerHTML),
     "es wird nichts gespeichert, also darf da auch nicht Speichern stehen");
  ctx.click("winhome");
  eq(D.getHistory().length, 0, "und es wird wirklich nichts gespeichert");
});

t("Ohne Verlauf feiert das Training keinen Rekord", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.keepHistory = false;
  D.startTraining("double", "lion");
  for (let i = 0; i < 21; i++) D.trainDart(true);
  D.setView("train"); D.render();
  ok(!/Neuer Rekord/.test(ctx.app.innerHTML),
     "ein Rekord, der nicht gespeichert wird, ist keiner");
  D.finishTraining();
  eq(D.getPractice().length, 0);
});

t("Der Verlaufs-Schalter sagt, dass auch Siege nicht mehr zaehlen", () => {
  const ctx = boot();
  ctx.D.setView("settings"); ctx.D.render();
  ok(/Siege/.test(ctx.app.innerHTML),
     "der Untertext nennt nur Bilanz und Statistik, verschweigt aber die Wins");
});

// ================================================================ Speicher-Ausfall
t("Ein Geraet, das nicht speichern kann, sagt das", () => {
  const ctx = boot({}, { schreibenScheitert: true });
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  throwDart(D, "T20");
  D.setView("game"); D.render();
  eq(ctx.store.size, 0, "nichts geschrieben - das ist der Ausgangspunkt");
  ok(/speichert nicht|nicht gespeichert|Sicherung/i.test(ctx.app.innerHTML),
     "auf dem Schirm muss ein Hinweis stehen, sonst ist der Abend am Ende weg");
});

t("Solange das Speichern geht, stoert kein Warnband", () => {
  const ctx = boot();
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  throwDart(ctx.D, "T20");
  ctx.D.setView("game"); ctx.D.render();
  ok(!/speichert nicht/i.test(ctx.app.innerHTML), "kein Fehlalarm");
});

// ================================================================ Doppel-In im Summen-Modus
t("Doppel-In gilt auch bei Summen-Eingabe", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion", "arne"], { gameType: 501, doubleIn: true, doubleOut: true, bestOf: 1 });
  D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 6 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" });
  eq(D.getMatch().players[0].score, 501, "noch nichts gebucht");
  ok(ctx.has("sumopen", { "data-v": 1 }),
     "die App fragt, ob ein Doppel dabei war - stumm ignorieren waere falsch");

  // "Nein": die Darts sind geworfen, die Punkte zaehlen nicht
  ctx.click("sumopen", { "data-v": 0 });
  const p = D.getMatch().players[0];
  eq(p.score, 501, "keine Punkte");
  eq(p.darts, 3, "die Darts zaehlen fuer den Schnitt");
  eq(p.legStart, true, "immer noch nicht drin");
});

t("Mit Doppel eroeffnet zaehlt die ganze Aufnahme", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion"], { gameType: 501, doubleIn: true, doubleOut: true, bestOf: 1 });
  D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 6 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" });
  ctx.click("sumopen", { "data-v": 1 });
  const p = D.getMatch().players[0];
  eq(p.score, 441, "60 abgezogen");
  eq(p.legStart, false, "jetzt ist er drin");
  eq(p.darts, 3);
  // und der naechste Wurf braucht keine Frage mehr
  D.render();
  ctx.click("sumkey", { "data-k": 4 });
  ctx.click("sumkey", { "data-k": 5 });
  ctx.click("sumkey", { "data-k": "ok" });
  eq(D.getMatch().players[0].score, 396, "ohne erneute Nachfrage");
});

t("Die Doppel-In-Frage laesst sich abbrechen", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion"], { gameType: 501, doubleIn: true, bestOf: 1 });
  D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 6 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" });
  ctx.click("sumcancel");
  ok(!ctx.has("sumopen", { "data-v": 1 }), "Frage weg");
  eq(D.getMatch().players[0].darts, 0, "nichts gebucht");
});

t("Der Doppel-In-Hinweis verschwindet, sobald man drin ist", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion"], { gameType: 501, doubleIn: true, doubleOut: true, bestOf: 1 });
  D.setView("game"); D.render();
  ok(/Doppel-In/.test(ctx.app.innerHTML), "erst steht der Hinweis da");
  D.applyTurnSum(60, 3, true);                       // mit Doppel eroeffnet
  D.render();
  ok(!/erst ein Doppel eröffnet/.test(ctx.app.innerHTML),
     "danach nicht mehr - sonst behauptet der Schirm dauerhaft das Gegenteil");
});

// ================================================================ Sprachmodus
t("Nach einem nicht eroeffnenden Wurf zaehlen die naechsten weiter", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleIn: true, doubleOut: true, bestOf: 1 });
  D.applySpokenResult(D.parseSpeech("triple 20 doppel 20 triple 20", []), "…");
  const p = D.getMatch().players[0];
  eq(p.darts, 3, "alle drei Darts sind geworfen worden (war: " + p.darts + ")");
  eq(p.score, 401, "D20 eroeffnet, dann zaehlt T20: 501-40-60 (war: " + p.score + ")");
});

t("Eine alte Sprach-Meldung beschreibt nicht den neuen Stand", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40);
  D.applySpokenResult(D.parseSpeech("triple 20", []), "triple 20");   // Bust per Sprache
  D.setView("game"); D.render();
  ok(/überworfen/i.test(ctx.app.innerHTML), "die Meldung steht");
  // jetzt drei getippte Darts fuer Arne
  ctx.click("num", { "data-n": 20 });
  ctx.click("num", { "data-n": 20 });
  ctx.click("num", { "data-n": 20 });
  const status = (ctx.app.innerHTML.match(/id="voiceStatus"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
  ok(!/überworfen/i.test(status),
     "die Sprach-Statuszeile darf nicht weiter den alten Wurf beschreiben. War: " +
     status.replace(/<[^>]+>/g, "").trim());
});

// ================================================================ Zweites Fenster
t("Ein zweites Fenster loescht den Verlauf nicht lautlos", () => {
  const ctx = boot();
  playMatch(ctx.D, ["lion", "arne"], 0);
  playMatch(ctx.D, ["lion", "arne"], 0);
  eq(ctx.D.getHistory().length, 2);
  // Fenster B hatte einen aelteren Stand und schreibt ihn zurueck
  const alt = JSON.stringify({ v: 2, roster: ctx.D.getRoster(), match: null,
                               history: [], practice: [], settings: ctx.D.getSettings() });
  ctx.store.set("darts_v2", alt);
  const horcher = (ctx.events.storage || [])[0];
  ok(horcher, "die App hoert ueberhaupt auf fremde Schreibvorgaenge");
  horcher({ key: "darts_v2" });
  eq(ctx.D.getHistory().length, 0, "der fremde Stand wird uebernommen (nichts lief hier)");
});

t("Bei laufendem Spiel warnt die App statt zu ueberschreiben", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  throwDart(D, "T20");
  const horcher = (ctx.events.storage || [])[0];
  ok(horcher, "Horcher da");
  horcher({ key: "darts_v2" });
  ok(D.getMatch(), "das laufende Spiel bleibt");
  ok(/zweites offenes Fenster/i.test(ctx.app.innerHTML),
     "aber es steht eine Warnung auf dem Schirm");
});

t("Ein fremder Schreibvorgang auf einen anderen Schluessel stoert nicht", () => {
  const ctx = boot();
  // Mit laufendem Spiel - nur dann waere eine falsche Warnung ueberhaupt sichtbar.
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  throwDart(ctx.D, "T20");
  const horcher = (ctx.events.storage || [])[0];
  horcher({ key: "ein-ganz-anderer-key" });
  ctx.D.render();
  ok(!/zweites offenes Fenster/i.test(ctx.app.innerHTML),
     "ein fremder Schluessel darf keine Warnung ausloesen");
  horcher({});                                       // Event ohne key
  ctx.D.render();
  ok(!/zweites offenes Fenster/i.test(ctx.app.innerHTML), "auch nicht ein Event ohne Schluessel");
  horcher({ key: "darts_v2" });                      // jetzt der echte
  ctx.D.render();
  ok(/zweites offenes Fenster/i.test(ctx.app.innerHTML), "der echte Schluessel dagegen schon");
});

// ================================================================ Keine weisse Seite
t("Eine Sicherung mit kaputtem Verlauf macht die App nicht unbrauchbar", () => {
  const ctx = boot();
  playMatch(ctx.D, ["lion", "arne"], 0);
  const kaputt = JSON.stringify({ state: {
    roster: [{ id: "lion", name: "Lion", winsManual: 0 }],
    match: null, practice: [],
    history: [{ id: "x", ts: 1, winnerId: "lion" }],      // players fehlt
  }});
  let err = null;
  try { ctx.D.importText(kaputt); } catch (e) { err = e.message; }
  eq(err, null, "der Import selbst wirft nicht: " + err);
  let renderErr = null;
  try { ctx.D.setView("home"); ctx.D.render(); } catch (e) { renderErr = e.message; }
  eq(renderErr, null, "und die Startseite laesst sich zeichnen: " + renderErr);
  ok(ctx.app.innerHTML.length > 50, "es steht etwas auf dem Schirm");
});

t("Ein unbekannter Trainingsmodus blockiert den Start nicht", () => {
  const roh = { v: 2, roster: [{ id: "lion", name: "Lion", winsManual: 0 }],
                match: null, history: [], practice: [],
                settings: { gameType: 501, doubleOut: true, bestOf: 1, meId: "lion" },
                train: { mode: "gibtsnichtmehr", playerId: "lion", idx: 2, tries: 0,
                         hits: 2, darts: 2, results: [], done: false, ts: 1 } };
  let err = null, ctx = null;
  try { ctx = boot({ darts_v2: JSON.stringify(roh) }); } catch (e) { err = e.message; }
  eq(err, null, "die App startet: " + err);
  ok(ctx && ctx.D, "und ist bedienbar");
  let rErr = null;
  try { ctx.D.setView("home"); ctx.D.render(); } catch (e) { rErr = e.message; }
  eq(rErr, null, "Startseite zeichnet: " + rErr);
});

t("Ein beschaedigter Stand wird gemeldet, nicht stillschweigend ersetzt", () => {
  const ctx = boot({ darts_v2: '{"v":2,"roster":[{"id":"lion","name":"Li' });   // abgeschnitten
  ctx.D.setView("home"); ctx.D.render();
  ok(/beschädigt|Sicherung|wiederhergestellt/i.test(ctx.app.innerHTML),
     "der Nutzer muss erfahren, dass sein Stand nicht geladen werden konnte");
  ok(ctx.store.has("darts_v2_defekt"),
     "und der Rohtext wird beiseitegelegt, bevor der erste Klick ihn ueberschreibt");
});

t("Ein sauberer Stand loest keine Beschaedigt-Meldung aus", () => {
  const ctx = boot();
  ctx.D.setView("home"); ctx.D.render();
  ok(!/beschädigt/i.test(ctx.app.innerHTML), "kein Fehlalarm");
  ok(!ctx.store.has("darts_v2_defekt"), "und nichts beiseitegelegt");
});

// ================================================================ Rueckmeldung beim Sichern
t("Der Import meldet den Erfolg dort, wo man ihn ausgeloest hat", () => {
  const A = boot();
  playMatch(A.D, ["lion", "arne"], 0);
  const json = JSON.stringify(A.D.exportPayload());
  const ctx = boot();
  ctx.D.setView("settings"); ctx.D.render();
  ctx.click("s_import");
  const fi = ctx.els.impFile;
  fi.files = [{ name: "sicherung.json" }];
  ok(typeof fi.onchange === "function", "der Dateidialog ist verdrahtet");
  ctx.win.FileReader = function () {
    this.readAsText = () => { this.result = json; this.onload && this.onload(); };
  };
  fi.onchange();
  ok(/eingespielt/i.test(ctx.app.innerHTML),
     "die Erfolgsmeldung steht auf dem Einstellungs-Screen, nicht irgendwo spaeter");
  eq(ctx.D.getHistory().length, 1, "und der Verlauf ist da");
});

t("Eine nicht lesbare Datei loest eine Meldung aus, nicht Schweigen", () => {
  const ctx = boot();
  ctx.D.setView("settings"); ctx.D.render();
  ctx.click("s_import");
  const fi = ctx.els.impFile;
  fi.files = [{ name: "kaputt.json" }];
  ctx.win.FileReader = function () {
    this.readAsText = () => { this.onerror && this.onerror(); };
  };
  fi.onchange();
  // Nur die Meldezeile pruefen - "nicht" steht sonst ueberall im Fliesstext.
  const meldung = (ctx.app.innerHTML.match(/<div class="okmsg">([^<]*)<\/div>/) || [])[1] || "";
  ok(/gelesen werden/i.test(meldung),
     "sonst ist es ununterscheidbar von 'danebengetippt'. Meldezeile war: '" + meldung + "'");
});

t("Die Zwischenablage meldet keinen Erfolg, den es nicht gab", () => {
  const ctx = boot();
  let abgelehnt = false;
  ctx.win.navigator.clipboard = {
    writeText: () => { abgelehnt = true; return Promise.reject(new Error("nope")); },
  };
  ctx.D.setView("settings"); ctx.D.render();
  ctx.click("s_copy");
  return new Promise(r => setTimeout(r, 0)).then(() => {
    ok(abgelehnt, "es wurde versucht");
    ok(!/In der Zwischenablage/i.test(ctx.app.innerHTML),
       "aber nicht als Erfolg gemeldet");
  });
});

// ================================================================ Zahlen, die zusammenpassen
t("Die Akte oeffnet das Duell nicht gespiegelt", () => {
  const ctx = boot();
  const D = ctx.D;
  playMatch(D, ["lion", "justus"], 0);
  playMatch(D, ["lion", "justus"], 0);
  playMatch(D, ["lion", "justus"], 1);
  // Von der Startseite aus
  D.setView("home"); D.render();
  ctx.click("h2hopen", { "data-a": "lion" });
  const vonHome = duellNamen(ctx);
  eq(vonHome, ["Lion", "Justus"]);
  // Aus Justus' Akte heraus
  D.setPlayerSel("justus"); D.setView("player"); D.render();
  ctx.click("h2hopen", { "data-b": "lion" });
  eq(duellNamen(ctx), vonHome,
     "gleiche Bilanz, gleiche Seiten - egal von wo man kommt");
});

t("Der Anwurf haengt nicht davon ab, wo man das Duell geoeffnet hat", () => {
  const ctx = boot();
  const D = ctx.D;
  playMatch(D, ["lion", "justus"], 0);
  D.setPlayerSel("justus"); D.setView("player"); D.render();
  ctx.click("h2hopen", { "data-b": "lion" });
  ctx.click("duelstart");
  eq(D.getMatch().players[0].id, "lion",
     "der Marker-Spieler wirft an, nicht wer die Akte gerade offen hatte");
});

t("Gruen heisst ueberall 'fuehrt'", () => {
  const ctx = boot();
  const D = ctx.D;
  playMatch(D, ["lion", "justus"], 0);
  playMatch(D, ["lion", "justus"], 0);
  playMatch(D, ["lion", "justus"], 1);            // Lion 2:1 Justus
  // In Lions Akte: er fuehrt, also darf der Gegner nicht gruen sein
  D.setPlayerSel("lion"); D.setView("player"); D.render();
  const zeileLion = (ctx.app.innerHTML.match(/<div class="duel[^"]*"[^>]*>[\s\S]*?gegen Justus[\s\S]*?<\/div>/) || [""])[0];
  ok(!/duel la/.test(zeileLion),
     "Lion fuehrt - die Zeile darf den Verlierer nicht gruen faerben: " +
     (zeileLion.match(/class="([^"]*)"/) || [])[1]);
  // In Justus' Akte: er liegt zurueck
  D.setPlayerSel("justus"); D.setView("player"); D.render();
  const zeileJustus = (ctx.app.innerHTML.match(/<div class="duel[^"]*"[^>]*>[\s\S]*?gegen Lion[\s\S]*?<\/div>/) || [""])[0];
  ok(/duel la/.test(zeileJustus),
     "aus Justus' Sicht fuehrt Lion - der gehoert gruen: " +
     (zeileJustus.match(/class="([^"]*)"/) || [])[1]);
});

t("Solo-Partien verfaelschen die Duell-Statistik der Akte nicht", () => {
  const ctx = boot();
  const D = ctx.D;
  // ein echtes Duell mit bescheidenen Zahlen
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20"); D.finishMatch();
  // dann eine Solo-Runde mit 180 und hohem Finish
  D.startMatch(["lion"], { gameType: 501, doubleOut: true, bestOf: 1 });
  seq(D, ["T20", "T20", "T20"]);
  D.setScore(0, 170); seq(D, ["T20", "T20", "BULL"]);
  D.finishMatch();
  const s2 = D.playerStats("lion");
  eq(s2.games, 1, "nur das Duell zaehlt als Spiel");
  eq(s2.best, 40, "und nur dessen Werte stehen in den Duell-Zahlen (war: " + s2.best + ")");
  eq(s2.t180, 0, "der 180er aus dem Solo gehoert nicht hierher");
  eq(s2.solo, 1, "die Solo-Runde wird separat gezaehlt");
});

t("Runden zu dritt tauchen auf der Startseite auf, nicht nur in der Rangliste", () => {
  const ctx = boot();
  const D = ctx.D;
  playMatch(D, ["lion", "arne"], 1);              // Arne gewinnt das Duell
  playMatch(D, ["lion", "arne", "justus"], 1);    // und eine Dreierrunde
  playMatch(D, ["lion", "arne", "justus"], 1);
  eq(D.totalWins("arne"), 6, "3 von Hand + 3 gespielt");
  D.setView("home"); D.render();
  ok(/mehr Leuten|Runden|zu dritt/i.test(ctx.app.innerHTML),
     "sonst steht Arne auf 6, und die Duellzeile darunter erklaert nur einen davon");
});

t("Mehr als vier Duelle werden nicht stillschweigend abgeschnitten", () => {
  const ctx = boot();
  const D = ctx.D;
  ["a", "b", "c", "d", "e"].forEach(n => D.getState().roster.push(
    { id: n, name: "Spieler " + n.toUpperCase(), winsManual: 0, guest: false }));
  ["a", "b", "c", "d", "e"].forEach(n => playMatch(D, ["lion", n], 0));
  eq(D.allDuels().length, 5);
  D.setView("home"); D.render();
  const zeilen = (ctx.app.innerHTML.match(/data-act="h2hopen"/g) || []).length;
  ok(zeilen < 5, "die Karte zeigt bewusst nicht alle");
  ok(/weitere/i.test(ctx.app.innerHTML),
     "dann muss dastehen, dass es mehr sind (" + zeilen + " von 5 sichtbar)");
});

t("Ein Solo-Rekord faellt nicht hinten aus der Historie", () => {
  const { D } = boot();
  const st = D.getState();
  st.history = [];
  // aeltester Eintrag ist der Rekord
  st.history.push({ id: "rek", ts: 1, ended: 1, gameType: 501, bestOf: 1, winnerId: "lion",
    players: [{ id: "lion", name: "Lion", legsWon: 1, darts: 9, scored: 501, avg: 167 }] });
  for (let i = 0; i < 499; i++) {
    st.history.unshift({ id: "f" + i, ts: 100 + i, ended: 100 + i, gameType: 501, bestOf: 1,
      winnerId: "lion",
      players: [{ id: "lion", name: "Lion", legsWon: 1, darts: 30, scored: 501, avg: 50 },
                { id: "arne", name: "Arne", legsWon: 0, darts: 30, scored: 200, avg: 20 }] });
  }
  eq(D.bestSolo("lion", 501).darts, 9, "der Rekord steht");
  playMatch(D, ["lion", "arne"], 0);              // schiebt den aeltesten raus
  ok(D.bestSolo("lion", 501), "es gibt noch einen Solo-Rekord");
  eq(D.bestSolo("lion", 501).darts, 9,
     "und es ist derselbe - ein Rekord darf nicht vom Deckel gefressen werden");
});

// ================================================================ Sprachmodus, ehrlich
t("Startet das Mikro nicht, behauptet die App nicht 'hoert zu'", () => {
  const ctx = boot();
  ctx.win.SpeechRecognition = function () {
    this.start = () => { throw new Error("not-allowed"); };
    this.abort = () => {};
  };
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  D.setView("game"); D.render();
  // Die App hat SR beim Laden gelesen - deshalb ueber den Testhaken neu setzen
  if (!D.setSR) return;                              // Haken fehlt: Test uebersprungen
  D.setSR(ctx.win.SpeechRecognition);
  ctx.click("voice");
  ok(!/Hört zu/.test(ctx.app.innerHTML),
     "wenn start() wirft, darf der Knopf nicht weiter 'Hört zu' anzeigen");
});

t("'zurueck' bei leerem Stapel meldet keinen Erfolg", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  ctx.gesagt.length = 0;
  D.applySpokenResult(D.parseSpeech("zurück", []), "zurück");
  const gesagt = ctx.gesagt.join(" ");
  ok(!/^Zurück$/.test(gesagt.trim()),
     "es wurde nichts zurueckgenommen - das darf die Ansage nicht behaupten. War: " + gesagt);
  ok(/nichts|nicht/i.test(gesagt), "sondern sagen, dass es nichts gab: " + gesagt);
});

t("'nicht verstanden' wird auch gesagt, nicht nur geschrieben", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  ctx.gesagt.length = 0;
  D.applySpokenResult(D.parseSpeech("aehm was war das", []), "aehm was war das");
  ok(ctx.gesagt.length > 0,
     "im Bike-Modus liegt das Handy weg - Schweigen ist keine Rueckmeldung");
  ok(/verstanden/i.test(ctx.gesagt.join(" ")), "gesagt wurde: " + JSON.stringify(ctx.gesagt));
});

// ================================================================ Randfaelle
t("Ein geloeschter Spieler behaelt seinen Namen, wenn man weiterspielt", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().roster.push({ id: "timo-n", name: "Timo Neumann", winsManual: 0, guest: true });
  playMatch(D, ["lion", "timo-n"], 0);
  D.getState().roster = D.getState().roster.filter(p => p.id !== "timo-n");
  // ueber die Historie muss der Name noch da sein
  eq(D.nameOf("timo-n"), "Timo Neumann");
  // und ein neues Match darf ihn nicht auf den Schluessel zurueckwerfen
  D.startMatch(["lion", "timo-n"], { gameType: 501, bestOf: 1 });
  eq(D.getMatch().players[1].name, "Timo Neumann",
     "nicht der rohe Schluessel (war: " + D.getMatch().players[1].name + ")");
});

t("Ein namensgleicher neuer Spieler erbt keine fremden Siege", () => {
  const ctx = boot();
  const D = ctx.D;
  playMatch(D, ["lion", "arne"], 1);
  playMatch(D, ["lion", "arne"], 1);
  const vorher = D.totalWins("arne");
  D.getState().roster = D.getState().roster.filter(p => p.id !== "arne");
  D.setView("roster"); D.render();
  ctx.els.newName.value = "Arne";
  ctx.click("add", { "data-guest": 0 });
  const neu = D.getRoster().find(p => p.name === "Arne");
  ok(neu, "angelegt");
  eq(D.totalWins(neu.id), 0,
     "der Neue startet bei null, nicht bei " + vorher + " geerbten Siegen");
});

t("Ein leerer Name legt keinen Geisterspieler an und sagt warum", () => {
  const ctx = boot();
  const vorher = ctx.D.getRoster().length;
  ctx.D.setView("roster"); ctx.D.render();
  ctx.els.newName.value = "   ";
  ctx.click("add", { "data-guest": 0 });
  eq(ctx.D.getRoster().length, vorher, "nichts angelegt");
  const meldung = (ctx.app.innerHTML.match(/<div class="okmsg"[^>]*>([^<]*)<\/div>/) || [])[1] || "";
  ok(/Namen/i.test(meldung),
     "und es steht ein Hinweis da - der Platzhaltertext zaehlt nicht. War: '" + meldung + "'");
});

t("Zwei Spieler mit gleichem Namen sind unterscheidbar", () => {
  const ctx = boot();
  ctx.D.setView("roster"); ctx.D.render();
  ctx.els.newName.value = "Arne";
  ctx.answers.confirm = true;
  ctx.click("add", { "data-guest": 1 });
  const arnes = ctx.D.getRoster().filter(p => p.name.indexOf("Arne") === 0);
  ok(arnes.length === 1 || arnes[0].name !== arnes[1].name,
     "entweder abgelehnt oder unterscheidbar benannt: " +
     JSON.stringify(arnes.map(p => p.name)));
});

t("Importierte IDs kollidieren nicht miteinander", () => {
  const ctx = boot();
  const roh = JSON.stringify({ state: { roster: [
    { id: "Jörg K.", name: "Jörg K.", winsManual: 5 },
    { id: "Jörg-K!", name: "Jörg K2", winsManual: 1 },
  ], match: null, history: [], practice: [] }});
  eq(ctx.D.importText(roh), null);
  const ids = ctx.D.getRoster().map(p => p.id);
  eq(new Set(ids).size, ids.length, "beide behalten eigene Schluessel: " + JSON.stringify(ids));
  eq(ctx.D.totalWins(ids[0]), 5);
  eq(ctx.D.totalWins(ids[1]), 1, "sonst zeigen beide Zeilen denselben Stand");
});

t("Der Sieg-Screen nennt den Solo-Rekord", () => {
  const ctx = boot();
  const D = ctx.D;
  // erst ein Solo mit 3 Darts als Rekord
  D.startMatch(["lion"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20"); D.finishMatch();
  // dann ein schlechteres
  D.startMatch(["lion"], { gameType: 501, doubleOut: true, bestOf: 1 });
  seq(D, ["20", "20", "20"]);
  D.setScore(0, 40); throwDart(D, "D20");
  D.setView("win"); D.render();
  ok(/Rekord/i.test(ctx.app.innerHTML),
     "beim Alleinspielen ist der Rekord die einzige Messlatte - das Training zeigt ihn auch");
});

t("Der Werkszustand erklaert seine Wins", () => {
  const ctx = boot();
  ctx.D.setPlayerSel("arne"); ctx.D.setView("player"); ctx.D.render();
  eq(ctx.D.playerStats("arne").games, 0, "noch nichts gespielt");
  const zeile = (ctx.app.innerHTML.match(/<div class="infoline"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "";
  const text = zeile.replace(/<[^>]+>/g, "").trim();
  ok(/von Hand/i.test(text), "3 Wins ohne ein Spiel brauchen eine Erklaerung. War: '" + text + "'");
  ok(!/0 gespielt/.test(text),
     "und die Erklaerung darf nicht mit einer Null anfangen. War: '" + text + "'");
});

// ================================================================ Finish-Vorschlaege
// Der Rechner schlug bis 1.16 systematisch das kleinste Doppel vor, weil DOUBLES
// von D1 aufsteigend gebaut wurde und find() den ersten Treffer nahm. Beim Darts
// zielt man aber auf D20/D16/D8/D4 - die halbieren sich sauber beim Danebenwerfen.
const STANDARD = {
  40: "D20", 32: "D16", 36: "D18", 50: "Bull", 24: "D12", 20: "D10", 16: "D8",
  60: "20 D20", 81: "T19 D12", 96: "T20 D18",
  100: "T20 D20", 110: "T20 Bull", 170: "T20 T20 Bull",
};

t("Die bekannten Finishes stimmen mit der Standardtabelle ueberein", () => {
  const { D } = boot();
  const falsch = [];
  Object.keys(STANDARD).forEach(r => {
    const c = (D.checkout(+r, 3, true) || []).join(" ");
    if (c !== STANDARD[r]) falsch.push(r + ": " + c + " statt " + STANDARD[r]);
  });
  eq(falsch, [], "Abweichungen von dem, was jeder Spieler wirft");
});

t("Auch die mehrdeutigen Reste enden auf einem guten Doppel", () => {
  const { D } = boot();
  // Fuer 62 und 64 gibt es zwei gaengige Wege (T10 D16 / T18 D4 bzw. T16 D8 /
  // T8 D20). Beide sind in Ordnung - entscheidend ist, dass hinten ein Doppel
  // steht, das sich beim Danebenwerfen sauber halbiert.
  const gut = ["D20", "D16", "D8", "D4", "D12", "D10", "D18", "D14", "D6", "D2", "Bull"];
  [62, 64, 66, 68, 72, 76, 84, 88, 92].forEach(r => {
    const c = D.checkout(r, 3, true);
    ok(c, r + " muss ausspielbar sein");
    ok(gut.includes(c[c.length - 1]),
       r + " endet auf " + c[c.length - 1] + " (" + c.join(" ") + ")");
    eq(c.length, 2, r + " geht in zwei Darts");
  });
  // 98 ist der Sonderfall: es gibt schlicht kein gutes Doppel: 98 minus jedes
  // "gute" Doppel ergibt keine Zahl, die auf dem Board steht. Der Standardweg
  // ist deshalb T20 D19, und genau den soll die App auch vorschlagen.
  eq(D.checkout(98, 3, true), ["T20", "D19"], "der klassische 98er-Weg");
});

t("Kein Finish landet auf einem schlechten Doppel, wenn es anders geht", () => {
  const { D } = boot();
  // Diese Doppel sind die schlechtesten des Boards - man nimmt sie nur, wenn es
  // keinen anderen Weg gibt (Rest 2 -> D1, Rest 6 -> D3 usw.).
  const schlecht = ["D1", "D3", "D5", "D7", "D9", "D11", "D13"];
  const unnoetig = [];
  for (let r = 2; r <= 170; r++) {
    const c = D.checkout(r, 3, true);
    if (!c) continue;
    // Ein-Dart-Finishes haben keine Wahl: 6 ist D3, fertig.
    if (c.length < 2) continue;
    const letzte = c[c.length - 1];
    if (!schlecht.includes(letzte)) continue;
    // Gibt es ueberhaupt einen Weg auf ein besseres Doppel? Rest muss dafuer
    // durch ein gutes Doppel teilbar sein, nachdem man 1-2 Darts abgezogen hat.
    const gut = [40, 32, 16, 8, 24, 20, 36, 12, 28, 4, 50];
    const gehtBesser = gut.some(d => {
      if (r === d) return true;
      const rest = r - d;
      if (rest <= 0) return false;
      for (let n = 1; n <= 20; n++) for (const m of [1, 2, 3]) if (n * m === rest) return true;
      return rest === 25 || rest === 50;
    });
    if (gehtBesser) unnoetig.push(r + " -> " + c.join(" "));
  }
  eq(unnoetig.slice(0, 12), [], unnoetig.length + " Reste enden unnoetig auf einem schlechten Doppel");
});

t("Kein Doppel wird als Stellwurf vorgeschlagen", () => {
  const { D } = boot();
  const dumm = [];
  for (let r = 2; r <= 170; r++) {
    const c = D.checkout(r, 3, true);
    if (!c || c.length < 2) continue;
    for (let i = 0; i < c.length - 1; i++)
      if (/^D\d+$/.test(c[i])) { dumm.push(r + " -> " + c.join(" ")); break; }
  }
  eq(dumm, [], "auf einen Doppelring zielt man nicht, nur um zu stellen");
});

t("Kein T1 oder aehnlicher Unsinn als Stellwurf", () => {
  const { D } = boot();
  const dumm = [];
  for (let r = 2; r <= 170; r++) {
    const c = D.checkout(r, 3, true);
    if (!c || c.length < 2) continue;
    // Ein Stellwurf auf eine sehr kleine Zahl ist vermeidbar, wenn der Rest
    // gross genug fuer eine anstaendige Zahl ist.
    // Unter 12 ist man gezwungen: 5 geht nur als "1 D2", "T1 D1" oder "3 D1".
    if (r >= 12 && /^T?[1-4]$/.test(c[0])) dumm.push(r + " -> " + c.join(" "));
  }
  eq(dumm.slice(0, 10), [], dumm.length + " Wege stellen auf eine winzige Zahl");
});

t("Die Loesbarkeit bleibt unveraendert - dieselben Bogey-Zahlen", () => {
  const { D } = boot();
  const ohne = [];
  for (let r = 2; r <= 170; r++) if (!D.checkout(r, 3, true)) ohne.push(r);
  eq(ohne, [159, 162, 163, 165, 166, 168, 169],
     "die sieben klassischen Bogey-Zahlen, nicht mehr und nicht weniger");
});

t("Jeder Vorschlag geht rechnerisch auf und endet auf einem Doppel", () => {
  const { D } = boot();
  const wert = l => {
    if (l === "Bull") return 50;
    if (l === "25") return 25;
    const m = /^([TD])?(\d+)$/.exec(l);
    return (+m[2]) * (m[1] === "T" ? 3 : m[1] === "D" ? 2 : 1);
  };
  const kaputt = [];
  for (let r = 2; r <= 170; r++) {
    const c = D.checkout(r, 3, true);
    if (!c) continue;
    const summe = c.reduce((a, l) => a + wert(l), 0);
    const letzte = c[c.length - 1];
    if (summe !== r) kaputt.push(r + ": " + c.join(" ") + " = " + summe);
    if (!/^D\d+$/.test(letzte) && letzte !== "Bull")
      kaputt.push(r + ": endet auf " + letzte + ", das ist kein Doppel");
    if (c.length > 3) kaputt.push(r + ": " + c.length + " Darts");
  }
  eq(kaputt, [], "Vorschlaege, die nicht aufgehen");
});

t("Ohne Doppel-Out darf jedes Feld ausmachen", () => {
  const { D } = boot();
  eq(D.checkout(20, 1, false), ["20"], "ein Single macht aus");
  eq(D.checkout(180, 3, false), ["T20", "T20", "T20"]);
  // Nicht jeder Rest ist in drei Darts erreichbar (163, 166, 169 ... gibt es auf
  // dem Board nicht) - geprueft wird, dass jeder GEFUNDENE Weg aufgeht.
  const kaputt = [];
  let loesbar = 0;
  for (let r = 2; r <= 180; r++) {
    const c = D.checkout(r, 3, false);
    if (!c) continue;
    loesbar++;
    const wert = l => l === "Bull" ? 50 : l === "25" ? 25 :
      (+/^([TD])?(\d+)$/.exec(l)[2]) * (l[0] === "T" ? 3 : l[0] === "D" ? 2 : 1);
    if (c.reduce((a, l) => a + wert(l), 0) !== r) kaputt.push(r + ": " + c.join(" "));
  }
  eq(kaputt, [], "jeder gefundene Weg geht auf");
  ok(loesbar > 160, "und die allermeisten Reste sind spielbar (" + loesbar + " von 179)");
});

t("Der hoehere Stellwurf steht vorn", () => {
  const { D } = boot();
  const falsch = [];
  const wert = l => l === "Bull" ? 50 : l === "25" ? 25 :
    (+/^([TD])?(\d+)$/.exec(l)[2]) * (l[0] === "T" ? 3 : l[0] === "D" ? 2 : 1);
  for (let r = 2; r <= 170; r++) {
    const c = D.checkout(r, 3, true);
    if (!c || c.length !== 3) continue;
    if (wert(c[0]) < wert(c[1])) falsch.push(r + " -> " + c.join(" "));
  }
  eq(falsch, [], "so sagt man es nicht an");
  eq(D.checkout(170, 3, true), ["T20", "T20", "Bull"]);
  eq(D.checkout(161, 3, true), ["T20", "T17", "Bull"], "der klassische 161er");
});

// ================================================================ Zweite Nutzer-Pruefung
t("Der Zehnerblock wirft keine Eingabe still weg", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setView("game"); D.render();
  const anzeige = () => (ctx.app.innerHTML.match(/<div class="sumval[^"]*">([^<]*)<\/div>/) || [])[1];
  ctx.click("sumkey", { "data-k": 2 });
  ctx.click("sumkey", { "data-k": 0 });
  eq(anzeige(), "20", "20 steht da");
  ctx.click("sumkey", { "data-k": 0 });               // 200 waere zu viel
  eq(anzeige(), "20",
     "die dritte Ziffer wird ignoriert, nicht die ganze Eingabe verworfen. War: " + anzeige());
  ctx.click("sumkey", { "data-k": "ok" });
  eq(D.getMatch().players[0].score, 481, "und es werden 20 gebucht, nicht 0");
});

t("Eine abgewiesene Ziffer wird gemeldet", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion"], { gameType: 501, bestOf: 1 });
  D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 9 });
  ctx.click("sumkey", { "data-k": 9 });
  ctx.click("sumkey", { "data-k": 9 });               // 999
  ok(/mehr als 180|geht nicht|zu hoch/i.test(ctx.app.innerHTML),
     "sonst sieht eine verschluckte Ziffer aus wie eine gueltige Eingabe");
});

t("Unmoegliche Aufnahmen werden abgewiesen", () => {
  const { D } = boot();
  D.startMatch(["lion"], { gameType: 501, bestOf: 1 });
  // Mit drei Darts nicht erreichbar - es gibt kein Feld dafuer
  [179, 178, 176, 175, 173, 172, 169, 166, 163].forEach(n => {
    eq(D.applyTurnSum(n), "ungueltig", n + " gibt es mit drei Darts nicht");
  });
  // Diese schon
  [180, 177, 174, 171, 170, 167, 164, 161, 160, 100, 26, 0].forEach(n => {
    ok(D.applyTurnSum(n) !== "ungueltig", n + " ist eine mögliche Aufnahme");
    D.startMatch(["lion"], { gameType: 501, bestOf: 1 });
  });
});

t("In der Duell-Zeile gehoert die Farbe dem, der fuehrt", () => {
  const ctx = boot();
  const D = ctx.D;
  playMatch(D, ["lion", "arne"], 1);                  // Arne gewinnt -> Lion 0:1 Arne
  D.setView("home"); D.render();
  const zeile = (ctx.app.innerHTML.match(/<div class="duel[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/) || [""])[0];
  // Die gruene Klasse .va darf nicht auf der Zahl des Verlierers sitzen
  const m = zeile.match(/<b class="(va|vb)">(\d+)<\/b><i>:<\/i><b class="(va|vb)">(\d+)<\/b>/);
  ok(m, "Zahlen gefunden: " + zeile.slice(0, 200));
  const [, kl, links, kr, rechts] = m;
  const linksFuehrt = +links > +rechts;
  eq(kl, linksFuehrt ? "va" : "vb", "linke Zahl (" + links + ") traegt die richtige Farbe");
  eq(kr, linksFuehrt ? "vb" : "va", "rechte Zahl (" + rechts + ") traegt die richtige Farbe");
});

t("Ein einzelnes Duell heisst nicht 'Duelle'", () => {
  const ctx = boot();
  playMatch(ctx.D, ["lion", "arne"], 0);
  // Nur die Anteilszeile pruefen - "Duelle" steht auch in Ueberschriften.
  const sub = () => (ctx.app.innerHTML.match(/<div class="h2hsub">([^<]*)<\/div>/) || [])[1] || "";
  ctx.D.setView("h2h"); ctx.D.render();
  ok(/1 Duell$/.test(sub().trim()), "im Singular. War: " + sub());
  playMatch(ctx.D, ["lion", "arne"], 0);
  ctx.D.setView("h2h"); ctx.D.render();      // playMatch schaltet auf das Spiel um
  ok(/2 Duelle$/.test(sub().trim()), "und im Plural wieder mit e. War: " + sub());
});

t("Ein Fehlwurf liest sich nicht wie ein Minuszeichen", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  seq(D, ["20", "5", "MISS"]);
  D.setView("game"); D.render();
  // Im HTML steht die Entitaet, nicht das Zeichen - danach muss man suchen.
  const roh = (ctx.app.innerHTML.match(/<div class="lastturn[^"]*">([\s\S]*?)<\/div>/) || [])[1] || "";
  ok(!/&ndash;|&mdash;|\s-\s/.test(roh),
     "'20 5 –' liest sich wie eine Rechnung. War: " + roh.replace(/<[^>]+>/g, ""));
  const zeile = zuletztZeile(ctx) || "";
  ok(/20/.test(zeile) && /25/.test(zeile), "Summe stimmt trotzdem: " + zeile);
});

t("Der Speicher-Satz behauptet nichts, was noch nicht geprueft ist", () => {
  const ctx = boot({}, { schreibenScheitert: true });
  ctx.D.setView("home"); ctx.D.render();
  const html = ctx.app.innerHTML;
  ok(!/Alles bleibt auf diesem Handy gespeichert/.test(html) ||
     /speichert nicht/i.test(html),
     "auf einem Geraet, das nicht speichern kann, darf der Satz nicht allein dastehen");
});

t("Der Setup-Screen warnt, bevor man alles einstellt", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 5 });
  throwDart(D, "T20");
  D.setView("setup"); D.render();
  ok(/läuft noch|verworfen|noch ein Spiel/i.test(ctx.app.innerHTML),
     "sonst stellt man erst alles ein und wird dann ueberrascht");
});

// ================================================================ Um Platz 2 weiterspielen
// Belegt aus der Recherche: "Platz zwei und drei können so nicht ausgespielt
// werden. Dies ist insbesondere dann demotivierend, wenn ein Spieler dominant
// ist." Bei drei Leuten sass der Abgehaengte bisher nur da.
t("Nach dem Sieger laeuft das Spiel um Platz 2 weiter", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40);
  eq(throwDart(D, "D20"), "platz", "Lion ist durch, das Spiel geht weiter");
  const m = D.getMatch();
  ok(!m.finished, "das Match ist noch nicht zu Ende");
  eq(m.platz, ["lion"], "Lion hat Platz 1");
  ok(m.currentIdx !== 0, "Lion wirft nicht mehr");
  ok(["arne", "justus"].includes(m.players[m.currentIdx].id), "einer der anderen ist dran");
});

t("Der Durchgekommene wird beim Weiterreichen uebersprungen", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");            // Lion raus
  ctx.click("nextplatz");
  const gesehen = [];
  for (let i = 0; i < 6; i++) {
    gesehen.push(D.getMatch().players[D.getMatch().currentIdx].id);
    D.endTurn();
  }
  ok(!gesehen.includes("lion"), "Lion kommt nicht mehr dran: " + gesehen.join(","));
  ok(gesehen.includes("arne") && gesehen.includes("justus"), "die anderen wechseln sich ab");
});

t("Wenn nur noch einer uebrig ist, ist Schluss", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");            // Lion: Platz 1
  ctx.click("nextplatz");
  const zweiter = D.getMatch().players[D.getMatch().currentIdx];
  D.setScore(D.getMatch().currentIdx, 40);
  eq(throwDart(D, "D20"), "win", "der zweite Ausmacher beendet das Match");
  eq(D.getMatch().finished, true);
  eq(D.getMatch().platz.length, 3,
     "alle drei Plaetze stehen - wer als Letzter uebrig ist, ist Dritter");
  eq(D.getMatch().platz[1], zweiter.id);
});

t("Die Reihenfolge landet in der Historie", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");
  ctx.click("nextplatz");
  const i2 = D.getMatch().currentIdx;
  const zweiter = D.getMatch().players[i2].id;
  D.setScore(i2, 40); throwDart(D, "D20");
  const rec = D.finishMatch();
  eq(rec.winnerId, "lion", "Sieger bleibt der Sieger");
  eq(rec.platz[0], "lion");
  eq(rec.platz[1], zweiter, "und Platz 2 ist festgehalten");
  eq(D.totalWins("lion"), 2, "nur der Sieger bekommt den Win");
  eq(D.totalWins(zweiter === "arne" ? "arne" : "justus"), zweiter === "arne" ? 3 : 2,
     "Platz 2 zaehlt nicht als Sieg");
});

t("Zu zweit gibt es nichts auszuspielen", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40);
  eq(throwDart(D, "D20"), "win", "bei zwei Spielern ist der Sieg das Ende");
  eq(D.getMatch().finished, true);
  eq(D.getMatch().platz, [], "und es wird gar keine Platzliste gefuehrt");
  eq(D.getMatch().players[0].legsWon, 1, "stattdessen zaehlt das Leg ganz normal");
});

t("Bei Legs wird nicht um Plaetze gespielt", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 3 });
  D.setScore(0, 40);
  eq(throwDart(D, "D20"), "leg", "im Leg-Modus zaehlt das Leg, nicht der Platz");
});

t("Der Platz-Screen zeigt, wer durch ist und wer noch spielt", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");
  D.render();
  ok(/Lion/.test(ctx.app.innerHTML), "der Durchgekommene steht da");
  ok(/Platz 2/i.test(ctx.app.innerHTML), "und worum jetzt gespielt wird");
  ok(ctx.has("nextplatz"), "weiter");
  ok(ctx.has("winhome") || ctx.has("platzende"), "und ein Weg, es sein zu lassen");
});

// ================================================================ Bildschirm und Safari
t("Der Bildschirm wird nur waehrend des Spielens wachgehalten", () => {
  const ctx = boot();
  const angefordert = [];
  ctx.win.navigator.wakeLock = {
    request: () => { angefordert.push("an"); return Promise.resolve({
      release: () => { angefordert.push("aus"); return Promise.resolve(); },
      addEventListener: () => {} }); },
  };
  ctx.D.setView("home"); ctx.D.render();
  eq(angefordert.length, 0, "auf der Startseite nicht");
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  ctx.D.setView("game"); ctx.D.render();
  return new Promise(r => setTimeout(r, 0)).then(() => {
    eq(angefordert[0], "an", "im Spiel schon");
    ctx.D.setView("home"); ctx.D.render();
    return new Promise(r => setTimeout(r, 0));
  }).then(() => {
    ok(angefordert.includes("aus"), "und danach wieder freigegeben: " + angefordert.join(","));
  });
});

t("Ohne wakeLock im Browser passiert einfach nichts", () => {
  const ctx = boot();
  delete ctx.win.navigator.wakeLock;
  let err = null;
  try {
    ctx.D.startMatch(["lion"], { gameType: 501, bestOf: 1 });
    ctx.D.setView("game"); ctx.D.render();
  } catch (e) { err = e.message; }
  eq(err, null, "kein Absturz auf Geraeten, die das nicht koennen");
});

t("Safari ohne Installation wird vor dem 7-Tage-Loeschen gewarnt", () => {
  const ctx = boot();
  ctx.win.navigator.userAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
    "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  ctx.win.navigator.standalone = false;
  ctx.win.matchMedia = () => ({ matches: false });
  ctx.D.setView("settings"); ctx.D.render();
  ok(/7 Tagen/.test(ctx.app.innerHTML),
     "genau der Fall 'einmal die Woche spielen' - da ist der Verlauf sonst weg");
  ok(/Home-Bildschirm/.test(ctx.app.innerHTML), "mit dem Ausweg daneben");
});

t("Installiert oder in Chrome steht die Warnung nicht im Weg", () => {
  const ctx = boot();
  ctx.win.navigator.userAgent =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/120.0.0.0 Mobile Safari/537.36";
  ctx.win.matchMedia = () => ({ matches: false });
  ctx.D.setView("settings"); ctx.D.render();
  ok(!/7 Tagen/.test(ctx.app.innerHTML), "Chrome loescht nicht nach sieben Tagen");

  const b = boot();
  b.win.navigator.userAgent = "Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1";
  b.win.navigator.standalone = true;                  // vom Home-Bildschirm gestartet
  b.win.matchMedia = () => ({ matches: false });
  b.D.setView("settings"); b.D.render();
  ok(!/7 Tagen/.test(b.app.innerHTML), "installiert gilt die Regel nicht");
});

t("Ein Dart ist kein 'Darts'", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");            // ein einziger Dart
  D.render();
  ok(ctx.app.innerHTML.indexOf("1 Darts") < 0,
     "auch auf dem Platz-Screen zaehlt das Zahlwort");
  ok(ctx.app.innerHTML.indexOf("1 Dart<") >= 0 || ctx.app.innerHTML.indexOf("1 Dart ") >= 0, "im Singular");
});

// ================================================================ Layout-Regeln
// Der Testrunner kann kein Layout messen - diese Regeln halten fest, was im
// Browser gemessen wurde: ohne min-width:0 schiebt ein langer Spielername das
// ganze Board aus dem Bildschirm (390 Viewport, 417 Inhalt).
t("Die Spielerkarten koennen schrumpfen", () => {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const pcard = css.match(/\.pcard\{([^}]*)\}/);
  ok(pcard, ".pcard-Regel gefunden");
  ok(/min-width:\s*0/.test(pcard[1]),
     "ohne min-width:0 schrumpft ein Flex-Kind nicht unter seinen Inhalt: " + pcard[1]);
  const pn = css.match(/\.pcard \.pn\{([^}]*)\}/);
  ok(pn && /text-overflow:\s*ellipsis/.test(pn[1]), "und der Name wird gekuerzt");
});

t("Die Zahlenzeile der Spielerkarte schneidet nichts ab", () => {
  // Im Browser gemessen: mit white-space:nowrap frisst die Ellipsis als erstes
  // die Legs-Zahl ganz rechts - in ALLEN Konstellationen ab drei Spielern.
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const meta = css.match(/\.pcard \.pmeta\{([^}]*)\}/);
  ok(meta, ".pcard .pmeta gefunden");
  ok(!/white-space:\s*nowrap/.test(meta[1]),
     "nowrap schneidet die Legs-Zahl ab: " + meta[1]);
  ok(!/text-overflow:\s*ellipsis/.test(meta[1]),
     "und die Ellipsis frisst sie ganz: " + meta[1]);
});

t("Lange Namen brechen die Textzeilen nicht auf", () => {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  ["\.legline", "\.lastturn"].forEach(sel => {
    const r = css.match(new RegExp(sel + "\{([^}]*)\}"));
    ok(r, sel + " gefunden");
    ok(/overflow-wrap:\s*anywhere/.test(r[1]),
       sel + " braucht einen Umbruch fuer lange Namen: " + r[1]);
  });
});

// ================================================================ Kritiker-Runde 2
t("Der Sieg-Screen zeigt die ausgespielte Reihenfolge", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 1 });
  // Bewusst NICHT der erste Spieler gewinnt - sonst waere die Sortierung von
  // der Sitzordnung nicht zu unterscheiden und der Test blind.
  D.endTurn(); D.endTurn();                          // Justus (Index 2) ist dran
  eq(D.getMatch().players[D.getMatch().currentIdx].id, "justus");
  D.setScore(2, 40); throwDart(D, "D20");            // Justus: Platz 1
  ctx.click("nextplatz");
  const i2 = D.getMatch().currentIdx;
  const zweiter = D.getMatch().players[i2].name;
  D.setScore(i2, 40); throwDart(D, "D20");           // Platz 2
  D.render();
  const html = ctx.app.innerHTML;
  // Die Platz-Spalte gezielt: "1." mit dem Wort Platz darunter
  ok(/>1\.<small>Platz<\/small>/.test(html),
     "die Platzierung muss in der Zahlenspalte stehen, nicht Legs");
  const namen = (html.match(/<div class="nm">([^<]+)</g) || []).map(x => x.slice(16, -1));
  eq(namen[0], "Justus", "der Sieger oben, obwohl er hinten sass (war: " + namen.join(",") + ")");
  eq(namen[1], zweiter, "dann der Zweite");
  eq(namen[2], D.getMatch().players.find(p => p.name !== "Justus" && p.name !== zweiter).name,
     "und zuletzt der Dritte");
});

t("Ein Single auf 20 macht auch im Summen-Modus nicht aus", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 20);
  D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 2 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" });
  // Die App kann nicht wissen, ob 20 = D10 oder Single 20 war - sie muss fragen
  ok(ctx.has("sumfin", { "data-d": 1 }), "die Dartzahl-Frage kommt");
  ok(/Doppel|überworfen/i.test(ctx.app.innerHTML),
     "und bei Doppel-Out muss sie klaeren, ob es ein Doppel war");
});

t("Kein Doppel heisst ueberworfen, auch bei Summen-Eingabe", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 20);
  D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 2 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" });
  const bustKnopf = ctx.classOf("sumbust") || "";
  ok(/btn/.test(bustKnopf) && !/display:none/.test(ctx.app.innerHTML.match(/data-act="sumbust"[^>]*/)[0]),
     "der Weg 'war kein Doppel' muss auch sichtbar sein. Klasse: '" + bustKnopf + "'");
  ctx.click("sumbust");
  eq(D.getMatch().finished, false, "kein Sieg");
  eq(D.getMatch().players[0].score, 20, "zurueck auf den Stand vor der Aufnahme");
  eq(D.getMatch().currentIdx, 1, "der Naechste ist dran");
});

t("Ueber den Zehnerblock fragt die App nach der Dartzahl des Busts", () => {
  const ctx = boot();
  const D = ctx.D;
  D.getState().settings.inputMode = "sum";
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 20);
  D.setView("game"); D.render();
  ctx.click("sumkey", { "data-k": 6 });
  ctx.click("sumkey", { "data-k": 0 });
  ctx.click("sumkey", { "data-k": "ok" });           // 60 auf Rest 20 -> ueberworfen
  ok(ctx.has("sumbustd", { "data-d": 1 }), "die Frage kommt");
  eq(D.getMatch().players[0].darts, 0, "vorher wird nichts gebucht");
  ctx.click("sumbustd", { "data-d": 1 });
  eq(D.getMatch().players[0].darts, 1, "nur der eine geworfene Dart");
  eq(D.getMatch().players[0].score, 20, "Stand unveraendert");
  eq(D.getMatch().currentIdx, 1, "der Naechste ist dran");
});

t("Ein Bust kostet im Summen-Modus nicht pauschal drei Darts", () => {
  const a = boot(), b = boot();
  a.D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  a.D.setScore(0, 20);
  throwDart(a.D, "19");                              // Bust mit einem Dart
  const tippen = a.D.getMatch().players[0].darts;
  b.D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  b.D.setScore(0, 20);
  b.D.applyTurnSum(19, 1);                           // derselbe Bust, ein Dart
  eq(b.D.getMatch().players[0].darts, tippen,
     "sonst sind die Schnitte zweier Spieler derselben Partie nicht vergleichbar");
});

t("Die Ansage wird beim Ersetzen des Stands nachgezogen", () => {
  const A = boot();
  A.D.getState().settings.tts = false;
  const json = JSON.stringify(A.D.exportPayload());
  const ctx = boot();
  eq(ctx.D.getSettings().tts, true, "vorher an");
  ctx.D.importText(json);
  eq(ctx.D.getSettings().tts, false, "Einstellung uebernommen");
  ctx.gesagt.length = 0;
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  seq(ctx.D, ["20", "20", "20"]);
  eq(ctx.gesagt.length, 0,
     "und die App schweigt auch wirklich - sonst widersprechen sich zwei Screens");
});

t("Nach 'Alles zuruecksetzen' stimmt die Ansage wieder", () => {
  const ctx = boot();
  ctx.D.getState().settings.tts = false;
  ctx.D.resetAll();
  eq(ctx.D.getSettings().tts, true, "Werkszustand hat die Ansage an");
  ctx.gesagt.length = 0;
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  seq(ctx.D, ["20", "20", "20"]);
  ok(ctx.gesagt.length > 0, "also wird auch gesprochen");
});

t("Der Bildschirm-Wachhalter fordert nicht mehrfach an", () => {
  const ctx = boot();
  let offen = 0, angefordert = 0;
  ctx.win.navigator.wakeLock = {
    request: () => { angefordert++; return new Promise(r => setTimeout(() => {
      offen++; r({ release: () => { offen--; return Promise.resolve(); },
                   addEventListener: () => {} }); }, 5)); },
  };
  ctx.D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  ctx.D.setView("game");
  ctx.D.render(); ctx.D.render(); ctx.D.render();     // drei Darts in Folge
  return new Promise(r => setTimeout(r, 30)).then(() => {
    eq(angefordert, 1, "nur eine Anforderung, nicht drei (war: " + angefordert + ")");
    ctx.D.setView("home"); ctx.D.render();
    return new Promise(r => setTimeout(r, 30));
  }).then(() => {
    eq(offen, 0, "und danach ist keine Sperre mehr offen (war: " + offen + ")");
  });
});

t("Der Undo-Stapel blaeht den Speicher nicht auf", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, bestOf: 1 });
  for (let i = 0; i < 60; i++) { D.setScore(D.getMatch().currentIdx, 400); throwDart(D, "20"); }
  const bytes = ctx.store.get("darts_v2").length;
  ok(bytes < 30000,
     "jeder Dart serialisiert den ganzen Stand - " + Math.round(bytes / 1024) + " KB ist zu viel");
  ok(D.undo(), "Undo geht trotzdem noch");
});

t("Das Fremdfenster-Band verschwindet, wenn das Spiel vorbei ist", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne"], { gameType: 501, doubleOut: true, bestOf: 1 });
  throwDart(D, "T20");
  const horcher = (ctx.events.storage || [])[0];
  horcher({ key: "darts_v2" });
  D.render();
  ok(/zweites offenes Fenster/i.test(ctx.app.innerHTML), "erst steht es da");
  D.setScore(0, 40); throwDart(D, "D20");
  D.finishMatch();
  D.setView("home"); D.render();
  ok(!/zweites offenes Fenster/i.test(ctx.app.innerHTML),
     "danach wuerde 'Fremden Stand laden' die gerade gespeicherte Partie verwerfen");
});

t("Der Platz-Screen hat einen Weg zurueck", () => {
  const ctx = boot();
  const D = ctx.D;
  D.startMatch(["lion", "arne", "justus"], { gameType: 501, doubleOut: true, bestOf: 1 });
  D.setScore(0, 40); throwDart(D, "D20");
  D.render();
  ok(ctx.has("undo"), "ein Fehltipp beim Ausmachen muss direkt zurueckzunehmen sein");
});

t("Die Historie bleibt nach dem Deckeln zeitlich sortiert", () => {
  const { D } = boot();
  const st = D.getState();
  st.history = [];
  st.history.push({ id: "rek", ts: 1, ended: 1, gameType: 501, bestOf: 1, winnerId: "lion",
    players: [{ id: "lion", name: "Lion", legsWon: 1, darts: 9, scored: 501, avg: 167 }] });
  for (let i = 0; i < 499; i++) {
    st.history.unshift({ id: "f" + i, ts: 1000 + i, ended: 1000 + i, gameType: 501, bestOf: 1,
      winnerId: "lion",
      players: [{ id: "lion", name: "Lion", legsWon: 1, darts: 30, scored: 501, avg: 50 },
                { id: "arne", name: "Arne", legsWon: 0, darts: 30, scored: 200, avg: 20 }] });
  }
  playMatch(D, ["lion", "arne"], 0);
  const h = D.getHistory();
  let sortiert = true;
  for (let i = 1; i < h.length; i++)
    if ((h[i].ended || h[i].ts) > (h[i - 1].ended || h[i - 1].ts)) sortiert = false;
  ok(sortiert, "sonst steht ein geretteter Rekord mitten in der Zeitreihe");
});

// ================================================================ Als App aufs Handy
// iOS liest das Manifest NICHT und kann kein SVG als App-Icon. Ohne PNG landet
// beim "Zum Home-Bildschirm" ein graues Kaestchen statt des Dartboards.
t("Das iOS-App-Icon ist ein PNG", () => {
  const kopf = html.slice(0, html.indexOf("</head>"));
  const at = kopf.match(/<link[^>]*rel="apple-touch-icon"[^>]*>/);
  ok(at, "apple-touch-icon gesetzt");
  ok(/\.png/.test(at[0]), "und zwar als PNG - SVG ignoriert iOS: " + at[0]);
  ok(/sizes="180x180"/.test(at[0]), "mit der Groesse, die iOS erwartet");
  ok(fs.existsSync(path.join(root, "apple-touch-icon.png")), "die Datei liegt auch da");
});

t("iOS bekommt ein Startbild statt einer weissen Seite", () => {
  const kopf = html.slice(0, html.indexOf("</head>"));
  const splash = kopf.match(/<link[^>]*rel="apple-touch-startup-image"[^>]*>/g) || [];
  eq(splash.length, 4,
     "vier Geraetegroessen: 393x852, 390x844, 428x926, 375x667 (war: " + splash.length + ")");
  ["393px", "390px", "428px", "375px"].forEach(b => {
    ok(splash.some(l => l.includes("device-width:" + b)),
       "Breite " + b + " fehlt - dieses iPhone bekommt eine weisse Seite");
  });
  splash.forEach(l => {
    ok(/media="[^"]*device-width/.test(l), "jedes Startbild braucht seine media-Query: " + l);
    const datei = (l.match(/href="\.\/([^"]+)"/) || [])[1];
    ok(datei && fs.existsSync(path.join(root, datei)), "Datei fehlt: " + datei);
  });
});

t("Das Manifest erfuellt die Installations-Kriterien", () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  eq(m.display, "standalone", "sonst startet es als Browser-Tab");
  ok(m.name && m.short_name, "Name und Kurzname");
  ok(m.start_url, "Startadresse");
  const png = (m.icons || []).filter(i => i.type === "image/png");
  ok(png.some(i => i.sizes === "192x192"), "Chrome verlangt 192x192 als PNG");
  ok(png.some(i => i.sizes === "512x512"), "und 512x512");
  ok((m.icons || []).some(i => i.purpose === "maskable"),
     "ohne maskable schneidet Android das Board an");
  png.forEach(i => {
    const d = i.src.replace("./", "");
    ok(fs.existsSync(path.join(root, d)), "Icon-Datei fehlt: " + d);
  });
});

t("Der Service Worker cacht die App-Icons mit", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  ["icon-192.png", "icon-512.png", "apple-touch-icon.png"].forEach(f => {
    ok(sw.includes(f), f + " fehlt in der Offline-Liste");
  });
  const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  ok(sw.includes("manifest.webmanifest"), "das Manifest selbst auch");
  ok(m.icons.length >= 3, "und es gibt genug Icons");
});

// ---------------------------------------------------------------- Ausgabe
await Promise.all(offen);            // asynchrone Tests abwarten
console.log("");
if (fails.length) {
  console.log("FEHLGESCHLAGEN:");
  fails.forEach(f => console.log("  x " + f));
  console.log("");
}
console.log(pass + " von " + (pass + fail) + " Tests gruen.");
process.exit(fail ? 1 : 0);
