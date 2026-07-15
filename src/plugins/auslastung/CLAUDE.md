# Auslastungs-Modul — hier zuerst lesen

Vor Änderungen: [../../../docs/architecture/auslastung.md](../../../docs/architecture/auslastung.md) (Datenmodell, dreistufiges Matching, Anonymisierung), neuer Tab → [../../../docs/agents/add-auslastung-tab.md](../../../docs/agents/add-auslastung-tab.md).

Harte Regeln (Pitfall-Nummern → Root-[CLAUDE.md](../../../CLAUDE.md)):

- **#16 / #20** — Multi-Step-Store-Mutationen in EINEM finalen `setState` + EINEM `persist` (der Save-Lock verwirft parallele persists).
- **#17** — AnonymMap nutzt ausschließlich `tib_kuerz` (ehemalige Bearbeiter bewusst inklusive als Kompetenz-Referenz).
- **#18** — AnonymMap kommt aus der append-only `auslastung-kuerzel-map.json` (stabile anonIds, kein Sort-Drift).
- **#19** — Embedding-Modell-Wechsel bricht alle Caches team-weit (Suchindex + Auslastungs-Korpus + Kategorie-Centroids).
- **#22** — Umlaut-Kürzel (THÜ/BIB/ZTP) immer `s.normalize('NFC')` vor Map-Lookup/Speicherung.
- **#14** — Toggleable Pills mit konstanter Breite (Häkchen via `invisible`, kein `opacity`).
- **#27** — Bearbeiter-Kürzel über `useMeinKuerzel()` lesen, nicht direkt `profile.bearbeiter_kuerzel`.
