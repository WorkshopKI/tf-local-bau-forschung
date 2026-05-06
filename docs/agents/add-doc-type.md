# Neuer Phase-2 doc_type

Wenn ein neuer Dokument-Typ (`DocType`) zur Triage-Pipeline kommt (z.B. `vertragsentwurf`, `meilensteinplan`).

## Touch-Points (Pflicht)

1. **`src/phase2/types.ts`** — `DocType`-Union erweitern.
2. **`src/phase2/triage/keywords.ts`** — `KeywordMarker` für den neuen Typ ergänzen (Stage-2-Triage). Patterns: lowercase-Substrings, `min_hits` defaults auf 1.
3. **`src/phase2/dms-csv/aktenplan-mapping.ts`** — Mapping-Eintrag falls der Typ einer DMS-Aktenplanzuordnung entspricht (Stage 0 trifft dann ohne Datei-Zugriff). Format: `'7.X Bezeichnung': { doc_type: 'neuer_typ', irrelevant: false }`.

## Optional (UI)

4. **`src/plugins/dokument-review/components/FilterBar.tsx`** — Filter-Pills werden dynamisch aus den im Manifest vorkommenden `doc_type`s gebaut, also automatisch. Aber: Sortier-Reihenfolge in der `DetailPanel`-Anzeige bei Bedarf prüfen.
5. **`src/plugins/dokument-review/components/AutoCleanupCard.tsx`** — `format_outside_whitelist`-Whitelist enthält bekannte Tupel `(doc_type, file_extension)`. Wenn der neue Typ Standard-Format hat (z.B. `pdf`), Whitelist-Eintrag ergänzen, sonst landen alle Treffer beim Auto-Cleanup als irrelevant.
6. **`src/plugins/antraege/AntragDokumenteSection.tsx`** — Lebenszyklus-Sortierung in „Dokumente" vs. „Sonstige" prüfen; ggf. neuen Typ in eine der beiden Sortier-Listen einfügen.

## Eval

7. **`src/phase2/__tests__/triage.eval.ts`** — Beispiel-Dokument zur Eval-Suite hinzufügen, falls vorhanden. Aktuelle Schwelle: ≥ 9/11 korrekt.
8. **`docs/phase-2/triage-beispiele/`** — Repräsentatives Beispiel-Dokument für manuelle Tests.

## Classifier-Version (wichtig)

Wenn die neuen Keywords auf bereits klassifizierte Dokumente erneut angewendet werden sollen:
- `CLASSIFIER_VERSION` in `src/phase2/triage/triage.ts` erhöhen
- Beim nächsten Bulk-Scan werden Skip-Liste-Einträge mit alter Version automatisch verworfen

## Verifikation

- `npm run test:phase2` — Eval-Suite grün
- Dev-Plugin „Phase-2 Triage" → einzelne Datei wählen → Triage liefert den neuen Typ
- Review-Queue: Filter-Pill für den neuen Typ erscheint, wenn entsprechende Dokumente im Manifest sind
