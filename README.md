# 🎯 Darts

Handy-Web-App zum Darts-Zählen (X01 – 301/501/701) für Lions Team.

- **Regeln:** Single/Double/Triple, 25 & Bull, volle Bust-Logik, Doppel-Out (oder beliebiger Ausgang), Checkout-Vorschlag bei ≤ 170.
- **Team:** Arne, Justus, Lion – Gäste beliebig hinzufügbar. Wins werden pro gewonnenem Leg mitgezählt.
- **Speicher:** alles lokal im Browser (localStorage). Kein Login, kein Server, kein Sync.
- **Sprach-Eingabe (v1.1):** Mikro im Spiel antippen, Würfe laut ansagen („Triple 20, 20, Doppel 5") – die App trägt sie für den aktuellen Spieler ein und sagt zur Kontrolle laut zurück, was sie verstanden hat. Doppel/Triple **vor** die Zahl. Sprachbefehle: „zurück", „weiter", „stopp". Läuft zuverlässig auf Android-Chrome; iOS/Safari best-effort (Auto-Neustart).

Single-File-App: `index.html` – einfach öffnen. Live über GitHub Pages.
