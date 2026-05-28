# Auslastungs-Modul (Plugin "auslastung", v1.16)

Plugin (`id: 'auslastung'`, `category: 'workflow'`, `kuratorOnly: false`, sichtbar wenn `features.auslastung === true`) für automatische Antrags-Klassifizierung in Überkategorien + MA-Zuweisung mit dreistufigem Matching. Quartalsbasierte Kapazitäts-Planung.

## Datenschutz-Kernprinzip

**MAs sind im gesamten Modul nur als anonyme IDs (MA01-MAxx) sichtbar**; echte TIB-Kürzel kommen in Profil-Daten ausschließlich im RAM während eines passwortgeschützten XLSX-Exports vor und werden nicht in `auslastung.json` gespeichert.

**Ausnahme**: die Sidecar-Datei `_intern/auslastung-kuerzel-map.json` enthält das Mapping `kuerzel ↔ anonId` als Klartext. Diese Datei ist nötig, weil Selbsteintragungen pro User ihre eigene anonId stabil auflösen müssen und eine echte Verschlüsselung dies brechen würde. Sicherheits-Effekt vs. dem alten ephemeral-Sort-Modell: effektiv unverändert, da die antraege selbst `tib_kuerz` als Klartext-Spalte enthalten und das Mapping daraus trivial ableitbar war. Die persistente Datei macht das Mapping explizit und stabilisiert die anonIds gegen alphabetische Re-Sort-Drift bei neuen Kürzeln. Profil-Daten (Kapazität, Zuweisungen, Kategorien) in `auslastung.json` referenzieren MAs weiterhin nur über anonId.

## 5 vordefinierte Überkategorien

Aus FZD-Kontext, im Admin editierbar: `IT` Industrielle Technologien, `DT` Digitale Technologien, `EU` Energie- und Umwelttechnologien, `LG` Lebens- und Gesundheitswissenschaften, `NM` Naturwissenschaftliche Methoden.

## Performance (v2.13)

Re-Mount-Latenz von 7 s → <1 s. Drei Hebel kombiniert:

- **Hebel C — Aggregate im Store**: `anonymMap`, `verbuendeById`, `historischeDeskriptorenByAnon`, `historischeAstByAnon`, `allDeskriptoren` wandern aus den Component-`useMemo`-Kaskaden in den `useCacheStore`. Single-Pass-Aggregationen über 5000+ Antraege laufen genau einmal pro Daten-Load (nicht pro Tab-Mount). `ensureAggregates()` rechnet nach, wenn die kuerzel-map später ankommt.
- **Hebel A — Banner immer sichtbar**: Der `if (!loaded)` Early-Return in `AuslastungView` ist weg. Header + `ModulLoadingBanner` rendern ab dem ersten Mount, Tabs kommen unter `loaded && (...)`. Spinner + Countdown bleiben auch beim Re-Mount sichtbar.
- **Hebel B1 — Plugin `onInit`-Pre-Cache**: Auslastung-Plugin lädt `useAuslastungData` + `useKuerzelMap` parallel beim App-Start (non-blocking, fehlertolerant). `warmupAntraegeCache` wird via `useActiveProgramm`-Subscribe getriggert sobald die programmId steht. Erster Klick auf Auslastung findet die Daten schon im Store.

Generisches Pattern für andere Plugins mit derselben Symptomatik: [docs/agents/optimize-remount-latency.md](../agents/optimize-remount-latency.md).

## Tabs (`AuslastungView`)

**Workflow-Revision 1.17 (v2.1)**: 3 Tabs statt 5 — Klassifizierung · Zuweisung (50/50-Split-Cockpit) · Übersicht (fusioniert ehemalige Kapazität + Admin). Selbsteintragung wandert auf die Homepage als Sektion `NeueAntraegeFuerDich` (Plugin "home"). Sichtbarkeit "PL-only" über Build-Variante (`features.auslastung` nur in `pl.config.json`/`dev.config.json`) — kein in-app-Rollencheck mehr. „Meine Technologien" als Tab im Einstellungs-Plugin.

Selbsteintragung-UX auf der Home:
- Pro Antrag: Aktenzeichen | Primär-Pill (gefüllt) | Aspekt-Pills (outline) | Titel | Frist „Noch X Tage" | „Übernehme ich"-Button.
- Kapazitätszeile zeigt **Anträge** ("4 von 16 Anträgen frei in Q2-2026"), keine Stunden.
- Banner-Hint „X neue Anträge in deinen Kategorien" via `useBenachrichtigung`-Hook + localStorage pro `anonId`.

## Antragstyp-Präferenzen pro MA (v2.2)

Zusätzlich zur fachlichen `hauptKategorie` (IT/DT/EU/LG/NM) pflegt jeder MA eine **Antragstyp-Präferenz** — welche der vier Buckets FuE/DS/DL/NW er bearbeitet (Mapping auf `vb_phase`: 3=FuE, 5=DS, 4=DL, 1+2=NW, 9=Irrläufer). Zwei Felder am `AnonymerMitarbeiter`:

- `antragstypBevorzugt?: AntragstypBucket[]` — vom MA selbst gepflegt in **Einstellungen → Meine Technologien**.
- `antragstypUeberschreibung?: AntragstypBucket[]` — vom PL gepflegt in der Mitarbeiter-Tabelle (UebersichtView, Spalte „Antragstypen"). Hat Vorrang. Leeres Array → MA-Präferenz greift wieder.

Filter-Logik in `services/antragstyp-praeferenz.ts`:
- `getEffectiveAntragstypen(ma): AntragstypBucket[] | null` — Override > Bevorzugt > null (= alle erlaubt, Backwards-Kompat für pre-v2.2-Daten).
- `matchesAntragstyp(antrag, ma): boolean` — nutzt `getKategorieLabel(vb_phase)` aus `kategorieQuickfilter.ts` (Single Source of Truth), kein zweites Mapping. Irrläufer immer false bei expliziter Präferenz.

Wirkt in: `NeueAntraegeFuerDich` (Home-Selbsteintragung) + `matching-engine.ts` (Eligible-Pool VOR den teuren BM25/Embedding-Scores).

UI-Konventionen:
- MA-Profil zeigt ein Amber-Banner („Aktuell vom PL eingeschränkt") wenn `antragstypUeberschreibung` nicht leer ist. MA kann seine Präferenz weiter editieren, sie greift sobald PL den Override entfernt.
- PL-Tabelle: kleines „PL"-Badge an der effektiven Pill-Liste signalisiert aktives Override; „Override entfernen"-Button setzt es auf `undefined` zurück.

## Klassifizierungs-Modell (1.17)

Pro Antrag genau eine **Primärkategorie** + 0..n **Aspekte** (Querschnittstechnologien). Beispiel: „KI-gestützte Schadenserkennung in Brückenstrukturen" → primaer=IT (Strukturüberwachung ist Ingenieurtechnik), aspekte=[DT] (KI ist das Werkzeug).

Datenmodell:
- `Klassifizierung.vorgeschlagenePrimaer: PrimaerVorschlag | null` (Methode: `'regel' | 'embedding' | 'llm' | 'manuell'`).
- `Klassifizierung.vorgeschlageneAspekte: AspektVorschlag[]`.
- `Klassifizierung.freigegebenePrimaer: string` + `freigegebeneAspekte: string[]` (nach PL-Review).
- Deprecated 1.16-Felder `vorgeschlageneKategorien` + `freigegebeneKategorien` bleiben 1 Release im Save (`withLegacyFields` in `services/auslastung-store.ts`), Cleanup in v2.3.

MA-Modell (1.17):
- `AnonymerMitarbeiter.hauptKategorie: string` — bestimmt den Pool für Selbsteintragung + Matching.
- `AnonymerMitarbeiter.nebenKategorien: string[]` — triggert Aspekt-Bonus im Matching.
- `AnonymerMitarbeiter.abschlagProzent: number` — reduziert die effektive Quartals-Kapazität (z.B. 25% für QS-Bearbeiter).
- Deprecated `ueberKategorien` bleibt 1 Release im Save.

## LLM-Batch-Klassifizierung (1.17)

`services/llm-klassifizierung.ts` ruft den **aktiven AIBridge-Transport** (DirectLLM/OpenRouter/Streamlit) mit JSON-Schema-Mode auf. UI-Buttons (Komponente `LLMKlassifizierungButtons`) im Klassifizierungs-Tab:
- "LLM-Klassifizierung starten" — Progress-Anzeige, Bulk-Save am Ende (EIN persist, siehe CLAUDE.md Lesson 16).
- "Prompt kopieren" — `navigator.clipboard.writeText()` für Streamlit-/ChatGPT-Fallback.
- "LLM-Ergebnis einfügen" — Modal mit Textarea, robustes JSON-Parsing (Markdown-Wrapper, Umlaut-Schlüssel `primär`/`begründung`).

Hierarchie LLM > Embedding > Manuell: Methode `'llm'` mit `begruendung` in `PrimaerVorschlag` gespeichert.

## Aktiv/Inaktiv-Flag (`AnonymerMitarbeiter.aktiv: boolean`, Mai 2026)

Filter-Schicht für ehemalige Bearbeiter. Inaktive MAs werden aus UI (Admin-Tabelle, KapazitaetsDashboard, Zuweisungs-Cockpit) und Matching (Eligible-Sammlung in `matching-engine.ts`, Score-Aggregation in `embedding-matcher.ts`) ausgeblendet — ihre historischen Antraege bleiben aber im Embedding-Corpus als Kompetenz-Referenz für neue MAs mit ähnlichem Hintergrund. Default beim Anlegen: `true`. Migration alter Daten (`normalizeMitarbeiterRecord` in `services/auslastung-store.ts`): ebenfalls `true`. PL bekommt im Admin-Tab einen einmaligen Vorschlag-Banner (`AktivVorschlagBanner.tsx` + `services/aktiv-detection.ts`): "MAs mit Antrag im aktuellen Jahr → aktiv vorgeschlagen, sonst inaktiv". Banner erscheint nur wenn `shouldShowAktivVorschlag(mitarbeiter) === true` (alle MAs noch `aktiv: true`); ist auch nur ein MA inaktiv, gilt die Liste als gepflegt und der Banner kommt nicht wieder. Aktivieren/Deaktivieren einzeln über Aktiv-Toggle pro Tabellenzeile (Bestätigungsdialog beim Deaktivieren). "Inaktive anzeigen"-Checkbox im Header zeigt ausgegraute inaktive MAs in der Tabelle. **Lücken in der MA-Nummerierung** sind durch das Aktiv-Flag normal: anonIds bleiben stabil (siehe Pitfall #18), nur die Anzeige filtert. KapazitaetsDashboard zeigt dezenten Hilfetext "30 von 79 MAs aktiv …" wenn Lücken vorhanden sind.

## Engine-Layer (`src/plugins/auslastung/services/`)

- `klassifizierung-engine.ts` — dreistufig: **Stage 0** (Boolean-Match auf ZT-Spalten der CSV `"Künstliche"`, `"Gesundes L"`, `"Energie/Re"`, ... → direkt der Default-Überkategorie zugeordnet, höchste Confidence), **Stage 1** (Regel-Mapping aus PL-konfigurierten Deskriptoren-Listen, Multi-Label wenn 2 Kategorien matchen), **Stage 2** (Embedding-Centroid-Match, optional via `config.stage2Aktiv`).
- `bm25-matcher.ts` — Mini-BM25 für MA-Profile mit deutschen Stoppwörtern.
- `embedding-corpus.ts` — IDB-Cache `auslastung-emb:<aktz>` für Antrags-Embeddings (~40 MB bei 13k × 768d), Corpus-Build mit Progress-Callback, AbortSignal-Support. Wird seit Mai 2026 als Sidecar-Dateipaar (`_intern/auslastung-embedding-corpus.{manifest.json,bin}`) auf den SMB-Daten-Share gespiegelt — Cold-Start eines neuen Rechners lädt vom Share statt 46 min neu zu bauen. Mirroring-Logik in `embedding-corpus-mirror.ts` + Hook `useEmbeddingCorpusMirror`. Modell-Mismatch (Share-Korpus mit anderem Modell als lokal aktiv) blockiert Download und Upload mit explizitem UI-Hinweis; Antraege-Drift (`aktenzeichenSetHash` weicht ab) gibt sanften Hinweis zum inkrementellen Re-Build. Upload nutzt den bestehenden `build-lock`-Mechanismus mit `stufe: 'auslastung-corpus'`.
- `embedding-matcher.ts` — Top-K Antrags-Similarity → TIB-Score-Aggregation mit virtueller-Projekt-Confidence.
- `matching-engine.ts` — dynamische α-Fusion (BM25 vs Embedding je nach Konfidenz) + **weicher Kapazitäts-Score** (kein harter Filter mehr, ueberbuchte MAs bleiben im Ranking mit Malus) + Aspekt-Bonus (Antrag-Aspekt ∩ MA-Nebenkategorien) + Balance-Score → Top-3 pro Antrag. Pool-Filter ist seit 1.17 `ma.hauptKategorie === antrag.freigegebenePrimaer`.
- `kapazitaet.ts` — `computeKapazitaet` (Antrags-Sicht mit Abschlag), `kapazitaetsScore` (5 Banden + Quartals-Ende-Bonus), `tageImQuartal`-Helper.
- `llm-klassifizierung.ts` — LLM-Batch-Klassifizierung via aktivem AIBridge-Transport, JSON-Schema-Mode, Copy/Paste-Fallback.
- `anonym-map.ts` — Helper für die in-RAM-Map (Normalisierung, User→AnonId-Lookup, nextFreeAnonId). Die eigentliche Map wird aus der persistenten kuerzel-map abgeleitet (siehe Pitfall #18).
- `onboarding-kalibrierung.ts` — Spearman-Korrelation + Grid-Search über Confidence-Faktoren, für die Validierung des Standalone-Onboarding gegen historisches Matching.

## Build-Pipeline (`scripts/build-default-labels.mjs`, prebuild-Hook)

Liest `_labels/Labels PrjBsp_GPT.xlsx` → erzeugt `src/plugins/auslastung/services/default-labels.ts` (AUTO-GENERIERT, nicht manuell editieren) mit:

- `LABEL_BY_CSV_COLUMN` — 148 Klarnamen pro CSV-Spaltencode
- `ZUKUNFTSTECHNOLOGIE_FELDER` — 44 ZT-Felder (22 Themen × TV/VB-Ebene) mit Default-Mapping auf die 5 Kategorien
- `KATEGORIE_KEYWORD_HEURISTIK` — Substring-Heuristik für TECHN_/BRANCHE_-Werte als Fallback

**Pflegepunkt bei neuen ZT-Themen**: `ZT_TO_KATEGORIE`-Map in `build-default-labels.mjs` editieren → `npm run build:default-labels` → die VB-Spalten-Mappings in `docs/fixtures/schema-c.ts` ergänzen (PapaParse renamed Duplikate zu `<header>_1`). Stage-0-Match liest `customField`-Namen (`zt_*_tv` / `zt_*_vb`), nicht den CSV-Header.

## Datenmodell

`auslastung.json` auf SMB unter `_intern/auslastung.json`; Legacy-Pfad `_intern/auslastung/data.json` wird beim Laden als Fallback berücksichtigt — siehe `loadAuslastungData()`.

```typescript
interface AuslastungData {
  version: 1;
  updatedAt: string;
  config: AuslastungConfig;              // ueberKategorien, gewichtungen, stage2Aktiv, setupAbgeschlossen
  mitarbeiter: Record<string, AnonymerMitarbeiter>;  // Key = anonId (MA01)
  klassifizierungen: Klassifizierung[];  // pro Antrag: vorgeschlagene + freigegebene Kategorien
  zuweisungen: Zuweisung[];              // antragId, anonId, quartal, stunden, status
  kalibrierung?: KalibrierungsState;     // Spearman-Ergebnisse + optimale Confidence-Faktoren
}
```

## Standalone Kompetenz-Onboarding (`tools/kompetenz-onboarding/`)

Single-HTML-Datei (Vanilla-JS + Inline-SheetJS, file://-kompatibel) für neue MAs ohne SMB-Zugang. PL generiert die HTML im Admin (`generateOnboardingHtml`) — Generator liest `template.html` via Vite-`?raw`-Import + injiziert JSON-Blob mit 30-60 Beispiel-Anträgen. MA füllt aus, schickt XLSX zurück, PL importiert via `OnboardingImportDialog` → neuer MA mit `virtuelleProjekte` + Confidence-Faktoren.

## Schema-Erweiterung (`docs/fixtures/schema-c.ts`)

Mapped alle 22 ZT-TV-Spalten (`'Digitale W'`, `'Künstliche'`, ...) UND 22 ZT-VB-Spalten (`'Digitale W_1'`, `'Künstliche_1'`, ...) als Custom-Boolean-Felder. Beim Stage-0-Match werden TV und VB gleichwertig ausgewertet — Verbund-Deskriptoren vererben implizit auf alle TVs.

## Sichtbarkeits-Gates

- Plugin selbst: `features.auslastung` (default false; in `configs/dev.config.json` true). Andere Variants müssen das Flag aktiv setzen wenn das Modul gewünscht ist.
- Routing: TeamFlowPlugin.route + TeamFlowPlugin.featureFlag pflegen den Eintrag, PLUGIN_ROUTES + FLAT_ROUTE_PLUGIN_IDS werden in `src/plugins.config.ts` daraus abgeleitet.

## Nicht anfassen

- Bestehende Bearbeiter-Filter-Logik im `antraege`-Plugin (das nutzt `bearbeiter_kuerzel` aus dem Profil mit Mehrfach-Kürzel + Begleitungs-Spalten — andere Domain).
- Embedding-Modell-Init: Plugin nutzt den Singleton `embeddingService` aus dem Such-Stack, lädt kein eigenes Modell.
