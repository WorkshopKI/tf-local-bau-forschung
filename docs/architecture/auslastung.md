# Auslastungs-Modul (Plugin "auslastung", v1.16)

Plugin (`id: 'auslastung'`, `category: 'workflow'`, `kuratorOnly: false`, sichtbar wenn `features.auslastung === true`) für automatische Antrags-Klassifizierung in Überkategorien + MA-Zuweisung mit dreistufigem Matching. Quartalsbasierte Kapazitäts-Planung.

## Datenschutz-Kernprinzip

**MAs sind im gesamten Modul nur als anonyme IDs (MA01-MAxx) sichtbar**; echte TIB-Kürzel kommen in Profil-Daten ausschließlich im RAM während eines passwortgeschützten XLSX-Exports vor und werden nicht in `auslastung.json` gespeichert.

**Ausnahme**: die Sidecar-Datei `_intern/auslastung-kuerzel-map.json` enthält das Mapping `kuerzel ↔ anonId` als Klartext. Diese Datei ist nötig, weil Selbsteintragungen pro User ihre eigene anonId stabil auflösen müssen und eine echte Verschlüsselung dies brechen würde. Sicherheits-Effekt vs. dem alten ephemeral-Sort-Modell: effektiv unverändert, da die antraege selbst `tib_kuerz` als Klartext-Spalte enthalten und das Mapping daraus trivial ableitbar war. Die persistente Datei macht das Mapping explizit und stabilisiert die anonIds gegen alphabetische Re-Sort-Drift bei neuen Kürzeln. Profil-Daten (Kapazität, Zuweisungen, Kategorien) in `auslastung.json` referenzieren MAs weiterhin nur über anonId.

## 5 vordefinierte Überkategorien

Aus FZD-Kontext, im Admin editierbar: `IT` Industrielle Technologien, `DT` Digitale Technologien, `EU` Energie- und Umwelttechnologien, `LG` Lebens- und Gesundheitswissenschaften, `NM` Naturwissenschaftliche Methoden.

## Tabs (`AuslastungView`, role-gated)

Selbsteintragung (alle User) · Klassifizierung · Zuweisung (50/50-Split-Cockpit) · Kapazität · Admin — letzte 4 nur für `is_kurator`. „Meine Technologien" als Tab im Einstellungs-Plugin.

## Aktiv/Inaktiv-Flag (`AnonymerMitarbeiter.aktiv: boolean`, Mai 2026)

Filter-Schicht für ehemalige Bearbeiter. Inaktive MAs werden aus UI (Admin-Tabelle, KapazitaetsDashboard, Zuweisungs-Cockpit) und Matching (Eligible-Sammlung in `matching-engine.ts`, Score-Aggregation in `embedding-matcher.ts`) ausgeblendet — ihre historischen Antraege bleiben aber im Embedding-Corpus als Kompetenz-Referenz für neue MAs mit ähnlichem Hintergrund. Default beim Anlegen: `true`. Migration alter Daten (`normalizeMitarbeiterRecord` in `services/auslastung-store.ts`): ebenfalls `true`. PL bekommt im Admin-Tab einen einmaligen Vorschlag-Banner (`AktivVorschlagBanner.tsx` + `services/aktiv-detection.ts`): "MAs mit Antrag im aktuellen Jahr → aktiv vorgeschlagen, sonst inaktiv". Banner erscheint nur wenn `shouldShowAktivVorschlag(mitarbeiter) === true` (alle MAs noch `aktiv: true`); ist auch nur ein MA inaktiv, gilt die Liste als gepflegt und der Banner kommt nicht wieder. Aktivieren/Deaktivieren einzeln über Aktiv-Toggle pro Tabellenzeile (Bestätigungsdialog beim Deaktivieren). "Inaktive anzeigen"-Checkbox im Header zeigt ausgegraute inaktive MAs in der Tabelle. **Lücken in der MA-Nummerierung** sind durch das Aktiv-Flag normal: anonIds bleiben stabil (siehe Pitfall #18), nur die Anzeige filtert. KapazitaetsDashboard zeigt dezenten Hilfetext "30 von 79 MAs aktiv …" wenn Lücken vorhanden sind.

## Engine-Layer (`src/plugins/auslastung/services/`)

- `klassifizierung-engine.ts` — dreistufig: **Stage 0** (Boolean-Match auf ZT-Spalten der CSV `"Künstliche"`, `"Gesundes L"`, `"Energie/Re"`, ... → direkt der Default-Überkategorie zugeordnet, höchste Confidence), **Stage 1** (Regel-Mapping aus PL-konfigurierten Deskriptoren-Listen, Multi-Label wenn 2 Kategorien matchen), **Stage 2** (Embedding-Centroid-Match, optional via `config.stage2Aktiv`).
- `bm25-matcher.ts` — Mini-BM25 für MA-Profile mit deutschen Stoppwörtern.
- `embedding-corpus.ts` — IDB-Cache `auslastung-emb:<aktz>` für Antrags-Embeddings (~40 MB bei 13k × 768d), Corpus-Build mit Progress-Callback, AbortSignal-Support. Wird seit Mai 2026 als Sidecar-Dateipaar (`_intern/auslastung-embedding-corpus.{manifest.json,bin}`) auf den SMB-Daten-Share gespiegelt — Cold-Start eines neuen Rechners lädt vom Share statt 46 min neu zu bauen. Mirroring-Logik in `embedding-corpus-mirror.ts` + Hook `useEmbeddingCorpusMirror`. Modell-Mismatch (Share-Korpus mit anderem Modell als lokal aktiv) blockiert Download und Upload mit explizitem UI-Hinweis; Antraege-Drift (`aktenzeichenSetHash` weicht ab) gibt sanften Hinweis zum inkrementellen Re-Build. Upload nutzt den bestehenden `build-lock`-Mechanismus mit `stufe: 'auslastung-corpus'`.
- `embedding-matcher.ts` — Top-K Antrags-Similarity → TIB-Score-Aggregation mit virtueller-Projekt-Confidence.
- `matching-engine.ts` — dynamische α-Fusion (BM25 vs Embedding je nach Konfidenz) + Kapazitäts-Filter + Balance-Score → Top-3 pro Antrag.
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
