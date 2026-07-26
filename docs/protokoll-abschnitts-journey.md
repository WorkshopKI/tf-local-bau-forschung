# Protokoll — Gutachten-Abschnitts-Journey (Phase 0–4)

Arbeitsprotokoll des Umbaus „Fallback · Auto-Feinschliff · Abschnitts-QS · Karten-Umbau".
Beschreibt **Entscheidungen und Abweichungen**, nicht den Ist-Zustand — der lebt in
[gutachten-kurzfassung.md](architecture/gutachten-kurzfassung.md),
[artefakt-engine.md](architecture/artefakt-engine.md) und
[skill-vorgaben.md](architecture/skill-vorgaben.md).

Basis: v2.333.0, HEAD `796e8c04`.

---

## Phase 0 — Inventur (verifiziert am Klon)

| Baustein | Datei | Stand |
|---|---|---|
| Generierungs-Kern (React-frei) | `gutachten/workflow-generierung.ts` | 331 Z. — `generateInto` / `laufQs` / `laufLektorat`, explizites `GenerierungsDeps` (17 Felder) |
| Hook-Bindung | `gutachten/useGutachtenWorkflow.ts` | 603 Z. — vier Orchestratoren (`runGeneration`, `generiereAlle`, `runQs`, `runLektorat`), EIN `busy`-Flag, **kein** `phase`-State |
| Persistenz | `gutachten/workflow-persistenz.ts` (46 Z.) + `workflow-store.ts` (67 Z.) | `makePersist` / `makeReduce`; kv-Key `workflow-run:<typ>:<scopeId>` |
| Datenmodell | `gutachten/types.ts` | 184 Z. — `StepRun` Z. 54–135, 7 Pflicht- + 17 Optionalfelder; `qsHinweise?: QsBefund[]` Z. 134 |
| LLM-QS | `gutachten/qs.ts` (95 Z.) + `registry/qs-basis.seed.ts` (69 Z.) | toleranter `###`-Parser, wirft nie; `QsBefund = {dimension, bewertung, text}` |
| KI-Ziel | `core/services/ai/ki-ziel.ts` | 86 Z. — `aktivesZielFuerLauf()` → `'agentisch' \| undefined` |
| Verlauf | `kurzfassung/kurzfassung-verlauf.ts` | 116 Z. — `MAX_VERLAUF = 5`, `appendVerlauf` / `snapshotOf` / `restoreVersion` |
| Satz-Mechanik | `registry/check-engine.ts:82` (`splitSentences`) + `gutachten/satzSegmente.ts` (60 Z.) + `belege.ts` (40 Z.) | eine Quelle, `data-satz-index` aligned zur Engine |
| Review-Karte | `gutachten/SectionReviewCard.tsx` | 490 Z. |
| Container | `gutachten/GutachtenSection.tsx` | 708 Z., `ActiveAbschnitt` ab Z. 553 |

### Sieben Abweichungen vom Auftragstext (Stand-Differenz v2.305.2 → v2.333.0)

1. **Kein `GutachtenWorkflowController`-Component.** Der Name ist der *Rückgabetyp* von
   `useGutachtenWorkflow`; die Container-Rolle teilen sich `GutachtenSection.tsx`
   (`ActiveAbschnitt`) und der Hook.
2. **Der Karten-Kopf liegt nicht in der Karte**, sondern als `.g-card-head` in
   `ActiveAbschnitt` (Z. 597–643). `SectionReviewCard` liefert ein Fragment ohne Chrome.
   → Phase 4 muss den Kopf verschieben, nicht nur umbauen.
3. **`QS_DIMENSIONEN` hatte null Konsumenten** (`qs.ts:14`); die tatsächliche
   Dimensionsliste stand als Prosa im Prompt (`qs-basis.seed.ts:31–51`) — stille
   Drift-Gefahr.
4. **Kein ⋯-Menü, kein Radix `DropdownMenu`** im Repo. Hausmuster: handgerollt mit
   `useClickOutside` (`suche/SearchDownloadMenu.tsx`).
5. **Die Vorfassungs-Sicherung vor dem Lektorat existiert bereits** —
   `applyLektorat` ruft `appendVerlauf(step)` (`runner.ts:213`). Phase 2 braucht dafür
   keinen neuen Code, nur einen Test, der den Kontrakt festnagelt.
6. **`normalizeSkill` ist ein feldweiser Whitelist-Neubau** (`registry/storage.ts:142`).
   Ein neues optionales Feld, das dort fehlt, geht beim ersten Lade-/Speicher-Umlauf
   lautlos verloren.
7. **`SkillRunInput.ziel` wirkt nur auf der Streamlit-Bridge** (`starteFrischenChat` +
   `submitMessage`); auf DirectLLM ist es ein No-op.

---

## Defaults

| ID | Entscheidung | Begründung |
|---|---|---|
| **D1** | Fallback-Scope = Gutachten-Modul. NF/Aufbereitung ziehen später nach. | Der Wrapper liegt in `core/services/ai/`, ist also schon geteilt; die Adoption ist ein separater, risikoarmer Schritt. |
| **D2** | Fortschritts-Phase als kleinstmögliche Erweiterung von `StreamSenke` + `useStreamingBuffer` (`phase` + `setPhase`), Status-Text in `StreamingVorschau` daraus abgeleitet. | Der Busy-Text entstand bisher implizit aus `content`/`thinking`; ein strukturiertes Feld ersetzt die Heuristik, ohne einen zweiten Zustandspfad zu eröffnen. |
| **D3** | Keine Seed-/Registry-Befüllung von `qsKriterien`. | Kriterien sind Kurationsarbeit; Code bleibt rückwärtskompatibel zu Skills ohne das Feld. Vermeidet STOPP-R. |
| **D3a** | Kein Ein/Aus-Setting für den Auto-Feinschliff. | Bewusst einfach; der manuelle Feinschliff bleibt als Aktion erhalten. |
| **D4** | Die Kriterien-Ableitung läuft über den internen Transport. | Prompt-Vorlagen sind dokumentnah zu behandeln. |
| **D5** | Rechtes `KontextPanel` startet eingeklappt, Zustand nur pro Sitzung. | Der Text soll die Bühne haben; ein Persist wäre ein weiterer localStorage-Key ohne erkennbaren Nutzen. |
| **D6** | **Fallback nur, wenn `ziel` wirkt** (`transport.name === 'Streamlit'`). | Auf DirectLLM ist `ziel` ein No-op — der Retry wäre ein exakt identischer zweiter Lauf ohne Chance auf ein anderes Ergebnis. Abweichung 7. |
| **D7** | **QS-Kriterien über einen Anhänge-Block** in `composeSkillPrompt`, nicht über einen neuen Slot im `qs-basis`-Template. | Ein Slot im Seed wäre eine Änderung an einem LIVE-Skill (Anti-Pattern-Block, STOPP-R) und würde zwischen frischen und kuratierten Installationen driften. Der Anhänge-Block ist das etablierte Muster (`teilAufgabe`/`zusatzAnweisung`) und ohne Wert ein No-op. |
| **D8** | **Kriterien-Ableitung registry-frei** (Muster `feedbackImprove.ts`), kein neuer Seed-Skill. | Ein Seed-Skill bräche die harte Zähl-Assertion in `registry.test.ts:177` und erzwänge einen Registry-Write für ein reines Editor-Hilfsmittel. |
| **D9** | **Der Bulk-Lauf `generiereAlle` zieht den Auto-Feinschliff mit.** | Nutzer-Entscheidung: nach dem Bulk ist jeder Abschnitt poliert. Kosten: doppelte Laufzeit; ein Abbruch mittendrin lässt gemischte Stände — je Abschnitt über `lektoriert` / `feinschliffUebersprungen` sichtbar, Bulk bleibt idempotent fortsetzbar. |
| **D10** | **QS-Befunde nur noch in der Karte**, der QS-Block im `KontextPanel` entfällt. | Nutzer-Entscheidung: eine Anzeige, dort wo die bewerteten Sätze stehen. Zwei synchron zu haltende Darstellungen derselben Daten entfallen. |

---

## Verschobene Punkte

- **Fallback-Adoption für NF / Antrag-Aufbereitung** (D1) — der Wrapper liegt bereit.
- **QS-Gate-Schalter an der `WorkflowDef`** (QS als harte Freigabe-Bedingung je
  Workflow konfigurierbar) — heute bewusst rein beratend.
- **Erstbefüllung der GA-Kriterien (A–G) durch die Kuratoren** (D3) — Code ist bereit,
  die Inhalte sind Fachaufgabe.
- **`QS_DIMENSIONEN`**: der Prompt aus der Konstante zu bauen wäre eine Seed-Änderung an
  einem Live-Skill und bleibt offen. Die Drift-Gefahr ist seit v2.336.0 aber abgesichert
  (Wächter-Test statt totem Konstant).

---

## Phasen-Log

| Phase | Version | Ergebnis |
|---|---|---|
| 0 — Baseline | — | `npm run check` unverändert grün; Inventur + D1–D10 festgehalten. |
| 1 — Transport-Fallback | v2.334.0 | `mitZielFallback` + `zielWirktAuf` (`core/services/ai/ziel-fallback.ts`, 11 Tests); alle drei Gutachten-Läufe darüber; gepufferte `setError`/`setLlmAvailable`; `StepRun.zielFallback` + Info-Hinweis. `workflow-generierung.ts` 331 → 448 Z. — **bewusst nicht gesplittet** (eine Verantwortung: „wie ein Lauf gefahren wird"; ein Auslagern der Fallback-Hülle erzwänge einen strukturellen Ersatztyp für `GenerierungsDeps` samt Cast). Nach Phase 2 erneut prüfen. |
| 2 — Auto-Feinschliff | v2.335.0 | `mitFeinschliff` (Lektor-Lauf als Thunk ⇒ ohne Transport testbar, 7 Tests); Degradation bei Tor/Wurf/**Abbruch**; `checks` immer vom final angezeigten Text; `LaufPhase` in `useStreamingBuffer`/`StreamingVorschau`; `StepRun.feinschliffUebersprungen`. **Bestätigt:** die Rohentwurf-Sicherung leistet das vorhandene `applyLektorat` → `appendVerlauf(step)` (Abweichung 5) — kein neuer Code, nur ein Kontrakt-Test. **Nebenwirkung:** ein Generierungs-Zyklus schreibt jetzt ZWEI Verlaufs-Einträge (Vorfassung + Rohentwurf), `MAX_VERLAUF = 5` füllt sich doppelt so schnell; `slice(-5)` hält den Rohentwurf immer. |
| 3 — Abschnitts-QS | v2.336.0 | `SkillRecord.qsKriterien` durch alle 7 Nachzieh-Stellen + Bundle-Rundlauf (13 Tests); Kriterien-Block als **Anhang** in `composeSkillPrompt` (D7, kein Seed-Write ⇒ kein STOPP-R); `parseQsBefunde(raw, satzAnzahl)` mit 1-basierten Satz-Referenzen; `saetzeOhneBeleg` als deterministische Vorarbeit; `StepRun.qsAbnahme` + Entwertung in `applyBearbeitung`/`applyLektorat`/`applyZuruecksetzen`; Editor-Feld + registry-freie Ableitung (D8). **Bug beim Bauen gefunden:** `normalizeHistorie` baut den Baseline-Snapshot aus dem halbfertigen `skill` — `qsKriterien` muss VOR der Historien-Zeile gesetzt werden, sonst fehlt es im Baseline-Eintrag (Test hat es gefangen). **Offener Punkt aus Phase 0 geschlossen:** `QS_DIMENSIONEN` ist kein toter Konstant mehr, sondern per Drift-Wächter an den `qs-basis`-Seed gebunden (`qs-parse.test.ts`). |
| 4 — Karten-Umbau | v2.337.0 | Fünf neue Bauteile (`AbschnittKopf`/`HinweisStreifen`/`QsStrip`/`WerkzeugZeile`/`AbschnittFuss`) + reine `abschnittAnzeige.ts` (15 Tests); `SectionReviewCard` ist nur noch Komponist; QS raus aus `KontextPanel` (D10), Panel startet eingeklappt (D5). `QsHinweisList` wurde beim Umbau erst verwaist und dann um Satz-Links erweitert **statt** in den Strip dupliziert — ein Renderer für QS-Befunde. Der Satz-Sprung hat zwei Auslöser (Prop + Strip), aber EINE Implementierung (`markiereSatz`). |
| — Gate-Panne | — | **Der Phase-3-Gate-Lauf war rot, wurde aber als grün gelesen**: `npm run check \| tail` liefert den Exit-Code von `tail`, nicht von npm. v2.336.0 ging so mit einem verletzten Pitfall #15 (`onClick={() => void ableiten.run()}`) auf master; behoben in v2.337.0. **Lehre:** Exit-Code der ganzen Kette erzwingen (`npm run check > log 2>&1; echo $?`), nie am Pipe-Ende ablesen. |
