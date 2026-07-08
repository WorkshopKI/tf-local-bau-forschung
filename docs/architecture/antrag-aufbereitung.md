# Antrag-Aufbereitung (Paket 1 — Fundament + Zeitplan)

Eine **Vollbild-Seite pro Förderantrag**, die die Vorhabensbeschreibung (VB, 30–60 Seiten) strukturiert aufbereitet — nicht durch Zusammenfassungen, sondern durch deterministisch geerntete, **im Original verankerte** Sichten. Route `/antraege/:aktenzeichen/aufbereitung`, hinter Feature-Flag `antragAufbereitung` (**nur dev**). Eingeführt mit Paket 1 (v2.201.0).

**Paket 1 ist rein deterministisch — KEIN LLM.** Gliederungs-Parser, Tabellen-Ernte, Datenmodell/Storage, Overlay-Rahmen mit Tab-Leiste und der voll funktionsfähige **Zeitplan-Tab** (Gantt aus AP-Tabellen + Text↔Anlage-5-Plausibilität). Steckbrief- und Abdeckungs-Tab sind Platzhalter (Paket 2 = LLM-Bausteine); die übrigen fünf Tabs (Zahlen/Glossar/Fragen/Recherche/Lesemodus) sind noch nicht klickbar.

## Verortung

Alles unter [src/plugins/antraege/aufbereitung/](../../src/plugins/antraege/aufbereitung/), analog zum Muster `gutachten/`. Reine Parser-/Ernte-Funktionen sind transport- und UI-frei (vitest ohne DOM).

| Datei | Verantwortung |
|---|---|
| [gliederung.ts](../../src/plugins/antraege/aufbereitung/gliederung.ts) | `parseVbGliederung(md)` → `VbSektion[]` |
| [tabellen.ts](../../src/plugins/antraege/aufbereitung/tabellen.ts) | Pipe-Parser, Klassifikation, Zeitplan-Normalisierung, `verglichZeitplaene` |
| [quellen.ts](../../src/plugins/antraege/aufbereitung/quellen.ts) | VB (`resolveVb`, wiederverwendet) + Anlage 5 (`resolveAnlage5`, neu) |
| [types.ts](../../src/plugins/antraege/aufbereitung/types.ts) | `QuelleRef`, `RunTabelle`, `AufbereitungRun` |
| [store.ts](../../src/plugins/antraege/aufbereitung/store.ts) | `baueRun` (pur), `computeAufbereitung`/`loadAufbereitung`/`istVeraltet`/`toggleOffenerPunkt` |
| [useAufbereitung.ts](../../src/plugins/antraege/aufbereitung/useAufbereitung.ts) | State/IO: Laden, „Neu aufbereiten", Offene-Punkte-Toggle, Veraltet-Check |
| [AufbereitungPage.tsx](../../src/plugins/antraege/aufbereitung/AufbereitungPage.tsx) | Route-Seite: Kopf + Tab-Leiste |
| [AufbereitungTabs.tsx](../../src/plugins/antraege/aufbereitung/AufbereitungTabs.tsx) | Section-Tab-Strip (aktiv = `--tf-text`-Unterstrich) |
| [ZeitplanTab.tsx](../../src/plugins/antraege/aufbereitung/ZeitplanTab.tsx) | Gantt + Kennzahlen-Karte + Plausibilitäts-Sektion |
| [GanttZeitplan.tsx](../../src/plugins/antraege/aufbereitung/GanttZeitplan.tsx) | Handgebauter SVG-Gantt (pure, KEINE Chart-Library) |

## Datenmodell + Persistenz

Ein Run pro Antrag im IDB-`kv`-Store unter **`aufbereitung:<antragKey>`** (raw `idb.get`/`idb.set`, Muster [relevanz-map.ts](../../src/plugins/antraege/gutachten/relevanz-map.ts)) — **KEIN neuer Object-Store** (Pitfall #29). `antragKey` = `KurzfassungContext.key` (Verbund-ID bzw. Aktenzeichen bei Solo). Quell-Hashes liegen IM Objekt (`QuelleRef{name,hash,gelesenAm,rolle}`, Muster `VorlageRef`); Hash via `hashText` aus [runner.ts](../../src/plugins/antraege/gutachten/runner.ts) (djb2). `istVeraltet(run, {vbHash, anlage5Hash})` vergleicht gestempelte gegen aktuelle Hashes → nur UI-Hinweis, **keine** Auto-Neuberechnung.

`AufbereitungRun`: `version`, `antragKey`, `erzeugtAm`, `quellen[]`, `gliederung`, `tabellen[]` (klassifiziert + Rolle), `zeitplan{zeilen, herkunft, achseMax} | null`, `befunde[]`, `offenePunkte[]`, `hinweis?`.

## Quellen-Auflösung

- **VB** über den bestehenden Mechanismus [`resolveVb`](../../src/plugins/antraege/kurzfassung/vbDokument.ts) (IDB-Tag `vorhabensbeschreibung` mit FKZ-Tag, Ordner-Fallback `readVbAusOrdner`).
- **Anlage 5** analog neu in `quellen.ts`: IDB — Dokumente mit FKZ-Tag, deren `filename` auf `/anlage[\s_.-]*5/i` matcht; Ordner-Fallback — `.md` in `dokumente/` über `knownIds`, Frontmatter-`quelle` gegen dieselbe Regex. Anlage 5 gewinnt für den angezeigten Zeitplan; die VB-Text-Tabelle ist Vergleichsquelle für die Befunde.

Word-Tabellen kommen als **Markdown-Pipe-Tabellen** an (mammoth → HTML → turndown-gfm, [converter](../../src/core/services/converter/index.ts)); ein HTML-Pfad existiert hier bewusst nicht.

## Zeitplan: Ernte + Normalisierung + Abgleich

`ApZeile{nummer, bezeichnung, istUnterAp, monatStart?, monatEnde?, pm?, maNr?}`. Zwei Tabellenformen:
- **`anlage5`** (`AP | Bezeichnung | Beginn | Ende | MA Nr | Aufwand PM`, Datum `dd.mm.yyyy`): **M1 = Monat des frühesten Beginn-Datums** über alle Zeilen (Default — der Projektstart steht nicht verlässlich in der Tabelle). Ober-AP-Gruppenzeilen ohne Daten tragen keine Monate (Spanne aus den Unter-APs).
- **`ap-zeitplan-text`** (Monatszahlen, getrennte Beginn/Ende **oder** eine `Laufzeit`-Range-Spalte wie `Monat 1–4`): `pm` NUR aus einer echten PM-Spalte, nie aus „Aufwand"/„Dauer" (dort stecken oft Personentage/Monatsdauer).

`verglichZeitplaene(text, anlage)` matcht Ober-APs über normalisierte Bezeichnung (Substring oder Token-Overlap ≥ 0.6), Ober-AP-Spanne aus Kindern aggregiert. Befund-Typen: `zeitraum-abweichung` (Warnung), `nur-im-text`/`nur-in-anlage`/`horizont` (Hinweis). Ein Befund wird per „Als offenen Punkt übernehmen" in `run.offenePunkte` gemerkt (später an Nachforderungen anzubinden).

## Abgrenzung: `parseVbGliederung` vs. `parseVbHeadings`

Bewusst **getrennt** von [`parseVbHeadings`](../../src/plugins/antraege/gutachten/relevanz-map.ts) — an dessen positionalen IDs (`h0`, `h-intro`) hängen die Relevanz-Map-Caches; ihn zu ändern würde sie brechen. `parseVbGliederung` braucht dagegen **H1** (Kapitel ohne H2-Kinder), **Nummerierungs-Inferenz** für als Fließtext angekommene Überschriften (Word-Custom-Styles gehen bei der Konvertierung verloren), **IHV-Ausschluss** (verhindert Phantom-Kapitel aus Inhaltsverzeichnis-Zeilen) und **stabile nummern-basierte IDs** (`k-3.1`, sonst `s<i>`, Vorspann `s-intro`, IHV `s-toc`) als Fundstellen-Anker.

## Route + Einstieg

Route `/antraege/:aktenzeichen/aufbereitung` als flag-gated **Child** unter `ShellLayout` ([Router.tsx](../../src/core/Router.tsx), `AufbereitungRoute` — Muster `AntraegeRoute`). Der Kontext wird aus dem Route-Key über `useVerbundDetailData` + `buildKurzfassungContext` aufgelöst (deep-link-/refresh-fest). Einstieg: flag-gated Button „Antrag-Aufbereitung öffnen" auf [VerbundDetail.tsx](../../src/plugins/antraege/VerbundDetail.tsx).

## Ausblick Paket 2 (LLM-Bausteine)

Steckbrief- + Abdeckungs-Tab als LLM-Sichten. Getrennte Cache-Keys pro LLM-Baustein (statt der gemeinsamen Quell-Hashes im Run). Dokument-tragende Läufe bleiben **intern** (`bridge.getTransportForSkillRun`, Pitfall #30 / [transport-policy.md](transport-policy.md)).
