# Phase-2 Review-Queue UI (`src/plugins/dokument-review/`)

Kurator-Plugin (`id: 'dokument-review'`, `category: 'kuration'`, `kuratorOnly: true`, `order: 35`) für die Bearbeitung der Phase-2-Triage-Ergebnisse. Sichtbar wenn `features.dokumentenscan === true` UND `profile.is_kurator === true`. Phase-2-Pipeline und `Phase2RescanCard` (Bulk-Scan) bleiben unverändert.

## Layout (50/50-Split unter Header-Bereich)

- `DashboardCard` — 6 Kacheln (relevant / irrelevant / review / pending / errors / gesamt) als klickbare Quick-Filter; "Pending re-matchen"-Button erscheint nur wenn `pending > 0`.
- `FilterBar` — vier Pill-Reihen (Ansicht / Confidence / Typ / Source) mit Count-Badges. Typ-Pills werden dynamisch aus den im Manifest tatsächlich vorkommenden `doc_type`-Werten generiert.
- `ManifestList` (linke Spalte) — paginiert 50 Einträge/Seite, Sort-Dropdown (Review zuerst / Dateiname / Typ / Confidence). Selektion synchron mit Store; Selektion springt automatisch auf den ersten Page-Eintrag wenn die aktuelle Wahl durch Filterwechsel rausfällt.
- `DetailPanel` (rechte Spalte) — 4 Read-Only-Sections (Datei-Info / Triage / Match / DMS-CSV) + Aktionsleiste.
- `PendingList` (col-span-2 statt Split, wenn `viewMode='pending'`) — Holding-Bucket-Einträge mit `Manuell zuordnen` (öffnet Inline-`AntragAutocomplete`) und `Eintrag entfernen`.

## Aktionen im DetailPanel

Alle gehen über `useReviewActions`, schreiben `triage_source='manual'`, `classifier_version=CLASSIFIER_VERSION`, frischen Timestamp; Auto-Advance auf nächsten Listeneintrag in `review-queue`/`all`-Ansicht:

- *Typ ändern* — `Select` mit allen 14 `DocType`-Werten → `putManifestEntry({ doc_type, triage_reason: 'manual_doc_type:<typ>' })`
- *Antrag zuordnen* — `AntragAutocomplete` (FKZ/Akronym/Titel-Substring auf in-RAM-Index des aktiven Programms, max 8 Vorschläge) ODER Quick-Pick-Button pro `candidate_antrag_id` → `putManifestEntry({ matched_antrag_id, match_method:'manual', match_confidence:'high', requires_review:false, candidate_antrag_ids:[] })` + Skip-Liste-Eintrag wird gelöscht falls vorhanden
- *Irrelevant* — `putManifestEntry({ triage_state:'irrelevant', requires_review:false })` + `putSkipEntry({ source:'manual', reason:'manual_irrelevant', dms_*, extracted_* })`
- *Relevant ohne Zuordnung* — `putManifestEntry({ triage_state:'relevant', requires_review:false, match_confidence:'orphan' })`
- *Erneut klassifizieren* — `deleteManifestEntry()` + `deleteSkipEntry()`. Toast: „Beim nächsten Bulk-Scan im Suchindex-Plugin wird neu klassifiziert" (kein eigener Re-Trigger im Plugin — User soll explizit zur `Phase2RescanCard` gehen).

## Pending-Aktionen

- *Manuell zuordnen* — liest den existierenden Manifest-Eintrag (Pending-Triage hat `triage_state='pending_antrag'` schon angelegt), setzt `triage_state='relevant'`, `match_method='manual'`, schreibt + löscht `phase2_pending_antraege`-Row.
- *Pending re-matchen* — `rematchOnSnapshotReload(idb, activeProgrammId)` global (Button im Header der `DashboardCard`).

## Keyboard-Shortcuts

`KeyboardHandler` registriert globalen `keydown`-Listener; ignoriert Input/Textarea/Select/contenteditable; deaktiviert in `pending`-View.

| Taste | Aktion |
| --- | --- |
| `j` / `↓` / `k` / `↑` | Liste navigieren |
| `n` | nächster Review-Eintrag (skipt non-review) |
| `Enter` | Selektion fokussieren |
| `Escape` | Selektion zurücknehmen |
| `i` | Irrelevant + Auto-Advance |
| `r` | Relevant ohne Zuordnung + Auto-Advance |
| `a` | Antrag-Autocomplete-Input fokussieren (`document.querySelector('[data-tf-autocomplete-input="true"]')`) |

## Daten-Hooks

- `useManifestData` — lädt `listManifestEntries` / `listAllSkipEntries` / `listAllPending` parallel beim Mount, hält im React-State. `reloadEntry(filename)` mergt einen einzelnen IDB-Roundtrip in den Cache; `removeEntry(filename)` ist nur State-seitig (für Optimistic-Updates nach `deleteManifestEntry`); `rematchPending(programmId)` ruft `rematchOnSnapshotReload` und reloadet Manifest+Pending.
- `useAntraegeIndex` — `listAntraegeByProgramm(activeProgrammId)` einmal beim Mount/Programm-Switch; `filter(query, max)` und `byAktenzeichen(az)` als Substring-Such-Helper für `AntragAutocomplete`.
- `useReviewActions` — wrappt die 5 Aktionen, ruft danach `onMutated(filename)` (= `reloadEntry`) bzw. `onRemoved(filename)` (= `removeEntry`) und zeigt einen Toast.

## Filter + Sort (`filtering.ts`)

Rein clientseitig auf dem in-memory-Array. `applyFilters({ viewMode, confidenceFilter, docTypeFilter, sourceFilter, sortKey })` + `isInReviewQueue(entry)` + `uniqueDocTypes(entries)`. Sort-Keys: `review_then_classified_desc` (Default) / `filename` / `doc_type` / `confidence`.

## Toast (`ReviewToast`)

Kein globales Toast-System — eigener Auto-Dismiss-Mechanismus im Store via `setTimeout(..., 3000)`. Tones `success`/`info`/`error` mappen auf Border-Farben (`--tf-success-*`/`--tf-info-*`/`--tf-danger-*`).

## Persistenz (localStorage)

Nur `viewMode` unter Key `teamflow_dokument_review_view`. Confidence/Typ/Source/Sort/Page/Selection werden bewusst nicht persistiert.

## Auto-Cleanup (`AutoCleanupCard` zwischen DashboardCard und FilterBar)

Sechs Heuristiken zum Reduzieren der Review-Queue. „Vorschau anzeigen" zeigt pro Regel die Trefferanzahl auf den aktuell offenen Review-Einträgen, jede Regel via Checkbox einzeln aktivierbar. „Anwenden" schreibt jede betroffene `ManifestEntry` auf `triage_state='irrelevant'` + `requires_review=false` (bzw. nur `requires_review=false` bei `matched_with_fkz`) und legt für irrelevant-Regeln einen `SkipListEntry` an. Reihenfolge — erster Match gewinnt; spezifische Regeln vor generischer Whitelist:

1. `zero_byte` — `size_bytes === 0` → irrelevant
2. `parse_error` — `triage_reason` startet mit `parse_error` → irrelevant
3. `bescheid` — `doc_type === 'bescheid'` → irrelevant
4. `bewilligung` — `dms_bezeichnung` enthält `Bewilligung` → irrelevant
5. `zuwendungsbescheid` — `dms_bezeichnung` enthält `ZuwB`/`Zuwendungsbescheid` → irrelevant
6. `format_outside_whitelist` — Whitelist-Tupel `(gutachten,pdf)`, `(nachforderung,doc/docx)`, `(projektbeschreibung,pdf)`, `(verwendungsnachweis,pdf/doc/docx)` — alles andere → irrelevant. **`matched_antrag_id` bleibt erhalten** für Folge-Anzeige in der Antrag-Detail-Sonstige-Section.
7. `matched_with_fkz` — Whitelist-Treffer + `matched_antrag_id` + `extracted_fkz` → `requires_review=false`, Status bleibt.

## Dokumente am Antrag

`AntragDokumenteSection` (`src/plugins/antraege/AntragDokumenteSection.tsx`) wird zweimal am Ende der Antrag-Detail-Seite eingebunden — als „Dokumente" (Whitelist-Treffer mit `triage_state='relevant'`) und „Sonstige Dokumente" (alle mit `triage_state='irrelevant'`). Beide Sections sind defaultmäßig zugeklappt. Index-Lookup via `listByMatchedAntrag(idb, aktenzeichen)` (neu in `src/phase2/scanner/manifest-store.ts`, nutzt den bestehenden `matched_antrag_id`-Index — kein Full-Table-Scan). Sortierung in „Dokumente" folgt dem Lebenszyklus (projektbeschreibung → gutachten → nachforderung → verwendungsnachweis → verwendungsnachweispruefung); in „Sonstige" stehen `gutachten_qs` und `korrespondenz` zuerst. „Öffnen"-Button lädt die Datei via `getDokumentenquelleHandle` + `makeLoadBlobFromHandle` als Blob und öffnet sie in einem neuen Tab; Object-URL wird nach 60 s revoked.

## Anti-Patterns (in diesem Plugin nicht vornehmen)

- Keine externe Virtualisierungs-Library (Pagination 50/Seite reicht für die erwartete Skala).
- Keine direkten IDB-Transaktionen — alle Mutationen über die Phase-2-API in `@/phase2`.
- Keine modalen Dialoge — Aktionen inline im `DetailPanel`.
- Kein Renderer für PDF/DOCX-Inhalte (kommt erst wenn die Volltext-Pipeline steht).
- Keine Veränderungen an `Phase2RescanCard.tsx` oder `TriagePanel.tsx`. Read-only-Accessors in `src/phase2/scanner/manifest-store.ts` (z.B. `listByMatchedAntrag`) sind erlaubt; Triage-Pipeline-Logik bleibt unverändert.
