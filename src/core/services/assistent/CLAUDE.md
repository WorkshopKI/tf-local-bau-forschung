# Assistent (Protokoll / Panel / Gedächtnis) — hier zuerst lesen

Drei Phasen, drei Docs: [../../../../docs/architecture/assistent-protokoll.md](../../../../docs/architecture/assistent-protokoll.md) (Phase 0), [../../../../docs/architecture/assistent-panel.md](../../../../docs/architecture/assistent-panel.md) (Phase 1), [../../../../docs/architecture/assistent-gedaechtnis.md](../../../../docs/architecture/assistent-gedaechtnis.md) (Phase 2).

Harte Regeln (Pitfall-Nummern → Root-[CLAUDE.md](../../../../CLAUDE.md)):

- **#37 (Protokoll)** — strikt gerätelokal (nur Varianten-IDB, NIE Share/`registry.json`/Snapshot/Export); einzige Schreib-Gate-Stelle `protokolliereEreignis` (Flag + Opt-in); nie Verhaltens-/Zeitmetrik oder Dokumenttext; Schema nur additiv.
- **#38 (Gedächtnis)** — „Operationen statt Neuschrieb" (LLM liefert nur Ops + Faktensätze, nie IDs/Belege — der Code prüft in der reinen `wendeOperationenAn`); invalidieren statt löschen; strikt lokal + doppeltes Opt-in; Konsolidierung nur intern via `getTransportForKonsolidierung()` + `BridgeMutex` (Vordergrund-Vorrang).
- **Panel (Phase 1)** — dokumentinhaltig → nur intern via `getTransportForAssistent()`; resetChat pro Turn (#36); read-only, ein Aufruf pro Turn.
