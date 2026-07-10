# Assistent-Ereignisprotokoll (Phase 0)

Fundament für den späteren persönlichen Assistenten: ein **rein deterministisches,
strikt gerätelokales, opt-in Protokoll** app-semantischer Aktionen des Nutzers.
**Phase 0 enthält kein LLM, keinen Chat, keine Assistenz-UI** — nur die
Datengrundlage, auf der spätere Phasen (Konsolidierung, Memory-Blocks, Tool-Use)
aufsetzen.

**Leitprinzip:** Das rohe Ereignisprotokoll ist die Wahrheit; alles später
Destillierte ist nur Cache. Deshalb wird hier nichts interpretiert, zusammengefasst
oder bewertet — nur app-semantische Ereignisse deterministisch aufgezeichnet.

Feature-Flag: `features.assistentProtokoll` (`isAssistentProtokollEnabled()`, nur
dev). Gated den gesamten Phase-0-Umfang (Aufzeichnung + Einstellungs-Sektion).

## Harte Invarianten (siehe Pitfall #37)

1. **Strikt lokal.** Ereignisse + Opt-in-Zustand leben ausschließlich in der
   Varianten-IndexedDB dieses Geräts. **Niemals** auf den SMB-Share, **niemals**
   in `registry.json`, **niemals** in Snapshot-/Export-Pfade. Der dedizierte Store
   `assistent_ereignisprotokoll` steht in **keiner** Snapshot-Allowlist
   ([snapshot.ts](../../src/core/services/csv/snapshot.ts) `SNAPSHOT_FILES` +
   [snapshot-sync.ts](../../src/core/services/csv/snapshot-sync.ts)
   `STORE_FILES`/`STORE_TARGETS`) — der Backup-Pfad kopiert nur den bereits auf
   dem Share liegenden `programm/`-Baum, liest nie IDB. Der Opt-in-Flag liegt im
   gerätelokalen `kv`-Store (Key `assistent-protokoll-optin`), der nie
   share-synchronisiert wird. Guard: [recorder.test.ts](../../src/core/services/assistent/protokoll/__tests__/recorder.test.ts)
   „Snapshot-Ausschluss".
2. **Strikt Opt-in.** Default aus. Die **einzige** Schreib-Gate-Stelle ist
   `protokolliereEreignis` im Recorder (prüft Flag **und** Opt-in), keine
   verstreuten Checks. Deaktivieren stoppt die Aufzeichnung sofort; Bestandsdaten
   bleiben bis zur expliziten Löschung (bzw. altern über die 90-Tage-Retention
   aus).
3. **Keine Verhaltens-/Leistungskontrolle.** Nur app-semantische Aktionen. Nie
   Tastenanschläge, Mausbewegungen, Scroll, Verweildauern, Bearbeitungszeiten,
   Idle-Erkennung, Dokument-/Gutachtentexte. Zeitstempel je Ereignis sind erlaubt;
   abgeleitete Zeitmetriken nicht.
4. **Kein LLM / kein Netzwerk** in Phase 0. Skill-Runner, AI-Bridge und
   Transport-Ladder werden nicht angefasst (nur eine fire-and-forget Telemetrie-
   Zeile um den unveränderten `runSkillInner`).
5. **Schema-Evolution nur additiv.** Jedes Ereignis trägt `version`; künftige
   Erweiterungen ausschließlich über optionale Felder (wie `AufbereitungRun`).

## Modul

`src/core/services/assistent/protokoll/`

| Datei | Verantwortung |
|---|---|
| [types.ts](../../src/core/services/assistent/protokoll/types.ts) | Schema v1, Katalog-Doku, Konstanten (Retention/Guard/Store-Name/kv-Key). |
| [store.ts](../../src/core/services/assistent/protokoll/store.ts) | Reine IDB-CRUD gegen den dedizierten Store (`idb.getDb()`, Vorbild [manifest-store.ts](../../src/phase2/scanner/manifest-store.ts)). Append + Zeit-Cursor-Queries + Retention-Löschungen. |
| [recorder.ts](../../src/core/services/assistent/protokoll/recorder.ts) | Die **Gate-Stelle** + In-Memory-Opt-in-Cache + Init + Facades (Statistik/Liste/Löschen/Export). |
| [index.ts](../../src/core/services/assistent/protokoll/index.ts) | Barrel. |

**Persistenz:** dedizierter Object-Store `assistent_ereignisprotokoll` (IDBStore
**v9**, keyPath `id`, Index `zeitstempel`). Der Zeitstempel-Index trägt die
Retention (Cursor `upperBound` für „älter als", aufsteigend für „Kapazität
kappen") und die „letzte 100"-Ansicht (Cursor `prev`). Der Store existiert
schema-seitig in **allen** Varianten (wie die Phase-2-Stores) — geschrieben wird
nur hinter Flag + Opt-in.

**Init:** [App.tsx](../../src/core/App.tsx) ruft nach `storage.init()` einmalig
`initProtokoll(storage.idb)` (best-effort): injiziert den Store ins Modul-Scope
(damit auch Nicht-React-Pfade wie der Skill-Runner ohne React-Context aufzeichnen),
hydratisiert den Opt-in-Cache und läuft die Retention einmal.

**Retention (deterministisch):** Ereignisse älter als `RETENTION_TAGE = 90`
werden gelöscht; harte Obergrenze `MAX_EREIGNISSE = 50 000` (ältester zuerst).
Läuft beim Start einmalig und periodisch alle `RETENTION_WRITE_INTERVALL = 200`
Writes.

**Schema-Guard:** `detail` akzeptiert nur Primitive; Strings werden auf
`MAX_DETAIL_WERT_LEN = 500` gekürzt, verschachtelte Objekte/Arrays verworfen —
verhindert versehentliches Abkippen von Dokumenttext.

## Ereignis-Katalog v1 (abschließend — nicht eigenmächtig erweitern)

| Typ | Auslöser | Anker | detail |
|---|---|---|---|
| `antrag_geoeffnet` | Antrag/Verbund-Detail geöffnet | [Router.tsx](../../src/core/Router.tsx) `AntraegeRoute`/`VerbundRoute` (dedupe je id) | status, phase (falls im Slim-Store) |
| `dokument_geoeffnet` | Dokument-/VB-Ansicht geöffnet | [AntragDokumenteSection.tsx](../../src/plugins/antraege/AntragDokumenteSection.tsx) `DokumentRow.handleOpen` | dokumentArt, antrag |
| `suche_ausgefuehrt` | Orama-Suche abgesetzt | [useUnifiedSearch.ts](../../src/core/hooks/useUnifiedSearch.ts) `done`-Transition (dedupe je Query) | query, trefferanzahl |
| `skill_gestartet` | Skill-Lauf gestartet | [run-skill.ts](../../src/core/services/skills/run/run-skill.ts) `runSkill`-Hülle | skillId |
| `skill_abgeschlossen` | Skill-Lauf beendet (Abbruch zählt nicht) | dito | skillId, erfolg |
| `gutachten_abschnitt_editiert` | Abschnitt im Editor übernommen (entprellt je Abschnitt/60 s) | [useGutachtenWorkflow.ts](../../src/plugins/antraege/gutachten/useGutachtenWorkflow.ts) `bearbeitenStep` | abschnittId — **nie Textinhalt** |
| `frist_angesehen` | Fristen-/Arbeitsvorrat-Interaktion | [MeineAntraegeBalken.tsx](../../src/plugins/home/MeineAntraegeBalken.tsx) `handleZuAntraegen` | quelle, view, sort |
| `einstellung_geaendert` | Protokoll-relevante Einstellung geändert | [AssistentTab.tsx](../../src/plugins/einstellungen/AssistentTab.tsx) | schluessel (nur Assistent) |

## Datenschutz-Begründung `suche_ausgefuehrt.query`

Suchanfragen können Namen/Antragsbezüge enthalten. **Bewusste Entscheidung: die
Query wird gespeichert**, weil (a) strikt lokal auf demselben Gerät, auf dem die
Dokumente ohnehin in IndexedDB liegen, und (b) hoher Nutzwert für spätere Assistenz.
Diese Entscheidung ist im Modul-Kommentar und in der Einstellungs-Erklärung
transparent gemacht.

## Einstellungen-UI

Sektion „Assistent & Gedächtnis" ([AssistentTab.tsx](../../src/plugins/einstellungen/AssistentTab.tsx),
registriert in [settingsPanels.tsx](../../src/plugins/einstellungen/settingsPanels.tsx),
gegated `isAssistentProtokollEnabled()`): Opt-in-Toggle mit Klartext-Erklärung,
„Meine Daten"-Ansicht (Zusammenfassung + letzte 100 Ereignisse + JSON-Export) und
vollständige Löschung mit Bestätigung. Der Tab liest/löscht/exportiert nur — die
Schreib-Gate-Stelle bleibt allein der Recorder.

## Nicht-Ziele (Phase 0)

LLM/Chat/Assistenz-UI, Konsolidierung/Memory-Blocks, Tool-Use, Share-Spiegelung,
Katalog-Erweiterung über v1 hinaus, jegliche Zeit-/Verhaltensmetrik.
