# Der Assistent kennt den Vorgang und schlägt Fragen vor — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHER SUB-SKILL: `superpowers:executing-plans` (Schritte mit Checkboxen). Gate/Abnahme/Commit bleiben im Hauptlauf.

**Grundlage:** [docs/superpowers/specs/2026-09-10-assistent-fragevorschlaege-design.md](../specs/2026-09-10-assistent-fragevorschlaege-design.md)

## Ziel

Der Assistent bekommt zu jedem Vorgang eine deterministische **Vorgangsakte** und bietet klickbare Fragen an, die nur erscheinen, wenn ihr Signal vorliegt — im leeren Dock und als Folgefragen unter jeder Antwort. Die PL wird im Profil sichtbar und bekommt eigene Fragen. Der Bestandslauf rechnet nur noch über die zwei jüngsten Richtlinien.

## Architektur

```
Profil (Fachrolle + PL) ─┐
useStatusVerlauf(vb) ────┤
useVerbundMeilensteine ──┼─▶ baueVorgangsakte (rein) ─▶ VorgangsAkte + AkteSignale
Anträge-Store (Titel) ───┘                                   │               │
                                                              ▼               ▼
                              assembliere (Faktenblock + Blöcke)     fragenFuer / folgefragen (rein)
                                                              │               │
                                                              ▼               ▼
                                    Turn: waehleModellFuerLauf('standard') ─▶ Dock: Chips, ein Klick schickt ab
```

Blöcke je Frage: `akte` immer (mit Entität) · `verlauf` · `journal` · `bestand` (Etappen 2 und 3). Ein zugeschalteter Block bleibt für die Unterhaltung stehen.

## Tech-Stack

TypeScript, React 19, Zustand (vanilla Session-Store), Vitest (node).

## Global Constraints

- **Pitfalls/Invarianten:** Panel-Invarianten 1–6 ([assistent-panel.md](../../architecture/assistent-panel.md)): nur intern, resetChat je Turn (#36), Fakten deterministisch, ein Aufruf je Turn. #44 (kein Status abgeleitet), #46 (kein Zustand ohne sichtbare Auskunft), #12 (Status nur über Kategorie-Helfer), #27 (Kürzel nur über `useMeinKuerzel`), §12.6 (keine Personen-Achse).
- **Rein bleibt rein:** Akte-Bau, Katalog und Assembler ohne React/IDB/Uhr; die unreine Grenze sind Hooks und `kontextSnapshot.ts`.
- **Gate:** `check:quick` im Loop, `check` vor jedem Commit, danach `build:devpl` im Hintergrund, Exit-Code prüfen.
- **Tests:** Schlägt ein neuer Test nur im Suite-Lauf fehl → Datei in `ISOLATED_TESTS`; den Test nicht verbiegen. Jeder neue Guard einmal rot gesehen.
- **Windows-Shell:** keine Heredocs; Commit-Message per Write nach `.git/COMMIT_MSG.tmp`.
- **Parallele Sessions:** nur eigene Pfade stagen. Der geteilte Bestands-Durchgang (`roh-halter.ts`) ist gebaut; Etappe 3 ändert nur, *welche* Programme gerechnet werden.
- **Abnahme:** `dev:local` (freien Port aus `.claude/launch.json` wählen), `__tf.bereit()`, `__tf.fehler()` = 0, mit ausgeschaltetem Beta-Schalter.

## Dateien im Überblick

| Datei | Rolle |
|---|---|
| `src/core/services/assistent/kontext/akte.ts` (neu, + Test) | Typ `VorgangsAkte`, `akteZeilen()` — rendert, rechnet nicht |
| `src/core/services/assistent/kontext/{types,assembliere,index}.ts` (+ Test) | Akte + Nutzerrolle in den Faktenblock, Blöcke, Systemtext, Budget |
| `src/plugins/chat/assistent/vorgangsakte.ts` (neu, + Test) | `baueVorgangsakte()` aus Verlauf, Meilensteinen, Anträgen — rein |
| `src/plugins/chat/assistent/useVorgangsakte.ts` (neu) | Hook: Verbund auflösen, laden, memoisieren |
| `src/plugins/chat/assistent/fragenKatalog.ts` (neu, + Test) — ersetzt `quickActions.ts` | Katalog, `fragenFuer`, `folgefragen` |
| `src/plugins/chat/assistent/nutzerRolle.ts` (neu, + Test) | Fachrolle + PL aus dem Profil lesen |
| `src/plugins/chat/assistent/{turn,sessionStore,kontextSnapshot,useAssistentController,AssistentPanelHost}.ts(x)` (+ `turn.test.ts`) | Verdrahtung, Modellwahl, Folgefragen |
| `src/core/types/config.ts`, `src/plugins/einstellungen/profil/AntraegeSichtGruppe.tsx` | Profilfeld `projektleitung`, Schalter, Wortwahl „nur Projektleitung" |
| `src/__tests__/conventions-daten.test.ts` | Guard: keine Bearbeiter-Spalten im Assistenten |
| Etappe 3: `src/core/status/betrachtungsbereich.ts`, `src/core/hooks/useBestandsAufgaben.ts`, `src/core/status/aufgaben-anzeige.ts` + die sechs Leser von `aufgabenAnzeige`, `src/plugins/vorgangs-board/*` | Lauf über zwei Richtlinien, benannter Grund |
| Doku: `assistent-panel.md`, `CONTEXT.md`, `feedback-kontext/*`, `vorgangssystem.md`, CHANGELOG + `changelog-user.md` | Ist-Zustand |

## Etappe 1 — Vorgangsakte, Katalog, PL, Modell (v6.54)

- [x] **T1 Nutzerrolle:** `projektleitung?: boolean` im Profil; `leseNutzerRolle(profile)` → `{ fachrolle: Rolle | 'alle', projektleitung: boolean }`; `leseStatusRolle` unverändert. Test.
- [x] **T2 Profil-UI:** Schalter „Projektleitung" unter „Meine Rolle" (sichtbar, wo das Assistent-Panel freigeschaltet ist); mit Schalter heißt „Alle Rollen" „Keine eigene – nur Projektleitung"; die Befund-Zeile schlägt dann keine Rolle aus alten Fällen vor.
- [x] **T3 Akte-Typ + Renderer** (`kontext/akte.ts`): Lage, Aufgaben je Rolle (mit Adresse, TV-Anteil, „abgeleitet"), offene Paare, Frist-Zustand mit Basis/Grund, Stillstand (belegt/„mindestens"), Meilenstein-Prognose, Verlaufs-Kennzahlen + Hauptereignisse, Titel von Verbund und TV, Kurzbeschreibung. Leere Signale entfallen. Test.
- [x] **T4 Akte-Bau** (`vorgangsakte.ts`): aus `StatusVerlauf`-Daten (`ermittleTodosAlleRollen` → `baueAufgabe` je Rolle, `offenePaareJeTeilvorhaben`, `pruefeStillstand`, `baueChronik`, `verlaufKennzahlen`), `fristErgebnisVon`, `VerbundMeilensteine`; TV-Entität schneidet auf ihr Teilvorhaben. Keine Bearbeiter-Kürzel im Ergebnis. `AkteSignale` für den Katalog. Test mit Fixture.
- [x] **T5 Hook** `useVorgangsakte(entitaet)`: Verbund auflösen (Antrag → `verbund_id`), `useStatusVerlauf`, `useVerbundMeilensteine` nur mit Flag; nur bei offenem Dock.
- [x] **T6 Assembler:** Eingabe `akte` + `nutzer`; Faktenblock rendert beides; Systemtext „Bearbeitung (AB, FB) und Projektleitung"; `GESAMT_MAX_CHARS` → 100 000. Bestehende Tests grün, neue für Akte/Nutzer.
- [x] **T7 Turn:** Modellwahl `waehleModellFuerLauf('standard', prompt.length)` → `ziel` an `submitMessage` und `starteFrischenChat`. Test: `ziel` kommt an, Aufstieg bei Überlänge.
- [x] **T8 Katalog** (`fragenKatalog.ts`): Gruppen A, B (ohne Liegezeit-Vergleich), C (nur „seit Eingang" + „TV-Eingänge", Rest Etappe 2), D, G1/G2 + Startseiten-Fragen ohne Bestand; `fragenFuer(signale)`, `folgefragen(signale, gestellt, letzteGruppe)`. `quickActions.ts` + Test entfallen. Test: jede Frage mit/ohne Signal, nie leer, Folgefragen ohne Gestelltes.
- [x] **T9 Dock:** Akte in Snapshot/Controller; leeres Dock zeigt die Katalogfragen nach Gruppe; unter der letzten Antwort 2–3 Folgefragen; Klick schickt ab.
- [x] **T10 Guard** „keine Bearbeiter-Spalten im Assistenten", rot gesehen. Modul-lokal in `__tests__/ohnePersonen.test.ts` — in `conventions-daten.test.ts` riss er die Größen-Ratsche (1 948 > 1 925 Zeilen).
- [x] **T11 Messen + Abnahme** (10.09.2026, dev:local 5177): Akte CALYPSO 3 263 Zeichen / 43 Zeilen, ZKN084412 (7 TV, 239 Termine, gekappt auf 30) 3 865 / 48 — rund 4 % des Budgets. Chips folgen den Signalen (offenes Paar → „Worauf wartet er?"); PL-Gruppe nur mit Schalter, mit Beta/Experte aus; Klick schickt ab; `__tf.fehler()` = 0. Befund dabei: „abgeschlossen" nannte noch 303 Tage Überschreitung — behoben, Test. Offen: echte Antwort + Folgefragen nur mit interner KI.
- [x] **T12 Doku + Version:** `assistent-panel.md` (Quick Actions → Fragen-Katalog, Vorgangsakte, Modell, Personen), `CONTEXT.md` (PL), Feedback-Kontext, Bump minor, Gate, Build, Commit.

## Etappe 2 — Verlauf und Journal (v6.55)

- [x] **T13 Block `verlauf`:** alle Termine + Statusabschnitte mit Dauer (`baueVerlaufFuerVorgang`, ohne Journal), Kopf „rekonstruiert" + Fassung. Test.
- [x] **T14 Block `journal`:** nur aus einem Lauf der Seite (`laufendeJournalChroniken`, Schlüssel ohne Stichtag, weil die Detailseite ihn sekundengenau stempelt); Änderungen neueste zuerst, Zurückgenommenes, unscharfe Spannen, Nullpunkt. Test.
- [x] **T15 Blöcke je Unterhaltung:** im Dock-Zustand statt im Session-Store (beides session-only; der Store kennt keine Route); „Neue Unterhaltung" und Routenwechsel lösen sie, der Kontext-Chip nennt sie. `mitBloecken` getestet.
- [x] **T16 Katalog:** C vollständig (Statusdauer, seit Export, zurückgenommen), E (Stand Gutachten und Nachforderungen aus den Karten der Artefakt-Leiste, Prüfer-Hinweise) und F (Vorgänger). **Abweichung:** „Zuwendung seit Bewilligung" entfällt — die Beträge stehen nicht in der Listen-Projektion; Werkbank-Punkte ebenso (eigener kv-Scan, kein Signal im Dock).
- [x] **T17 Messen + Abnahme** (dev:local 5177): Verlaufs-Block ZKN084412 = 239 Termine, 341 Zeilen, 24 062 Zeichen; 91 Statusabschnitte. CALYPSO: Journal-Lauf der Detailseite nach ~8 s mitgenommen, 2 Änderungen + 2 verschobene Termine → beide Journal-Fragen sichtbar. Klick schaltet „+ voller Verlauf" in den Chip; `__tf.fehler()` = 0. Offen: Gutachten-/NF-Karten und Prüfer-Hinweise ohne Läufe im lokalen Bestand nur per Test belegt.

## Etappe 3 — Bestandslauf über zwei Richtlinien, Bestandsfragen (v6.56)

- [x] **T18 Lauf-Menge:** `BESTANDSLAUF_RICHTLINIEN` aus `RICHTLINIEN_GENERATIONEN.slice(-2)`; `bestandslaufMenge(bereich)` = Bereich ∩ zwei Generationen (auch bei „Alle"). `laufeBestand(…, laufMenge)` hält die übrigen als `nichtGerechnet`; der Schlüssel trägt die Menge. Tests. **Kein Überspringen vor dem Lesen:** „Programm" ist dort die Import-Quelle, nicht die Richtlinie.
- [x] **T19 Benannter Grund:** `ZeilenAufgaben.ausserhalb(aktenzeichen)` (statt `unterprogrammId` — die Aktenzeichen hat jeder Leser schon); `aufgabenAnzeige` setzt die Nebenzeile „ältere Richtlinie – aus dem Status abgeleitet"; sechs Leser reichen es durch. Board: Chip zählt weiter nur den Bereich, daneben „N Vorgänge älterer Richtlinien nicht gerechnet". Tests.
- [x] **T20 Block `bestand`:** Grundlage mit Nenner, Stau je Rolle (Board-Zählung), Verfahrensschritte, Fristen je Verbund im 14-Tage-Fenster, Zuweisung gezählt, Liegezeit je Status + gesehener Vorgang, Plan-Risiken (`usePlanRisiken`, Projektion). Rein + Test (fand „seit 4 Tage" → Dativ korrigiert).
- [x] **T21 Katalog G + B5;** der Klick startet einen fehlenden Lauf, Dock zeigt „rechne Bestand …", danach wird abgeschickt; der Bestand-Block reist ohne Akte mit. **Abweichung:** „Was hat sich diese Woche bewegt?" entfällt — sie bräuchte ein eigenes Lesen von `stand.json`, das das Dock nie tut.
- [x] **T22 Messen + Abnahme** (dev:local 5177): Lauf gepaart 4 747 / 4 490 ms (drei Generationen, 12 359 gerechnet) gegen 3 923 / 3 926 ms (zwei, 7 273 gerechnet, 5 086 nicht) — ~15 %, `idb` bleibt. Startseite mit PL: Gruppe „Projektleitung" mit sechs Bestandsfragen; Klick → „+ Bestand", Block 34 Zeilen / 3 443 Zeichen ohne Kürzel; `__tf.fehler()` = 0.
