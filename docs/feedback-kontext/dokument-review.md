# Dokument-Review

## Zweck

Die Dokumente aus den Ablage-Ordnern werden automatisch vorsortiert: gehört das hierher, was für ein Dokument ist es, zu welchem Antrag? Wo die Automatik unsicher war, entscheiden Sie hier — Typ korrigieren, Antrag zuordnen, als irrelevant abhaken.

Die Seite steht in der Seitenleiste unter „Kuration" neben der Datenpflege und ist eine eigene Arbeitsfläche: tastaturgetrieben, auf schnelles Durchgehen vieler Einträge angelegt.

## UI-Elemente & Begriffe

- **Kacheln oben:** relevant, irrelevant, zu prüfen, wartend, Fehler und Gesamtzahl. Jede Kachel ist ein Schnellfilter — ein Klick zeigt genau diese Menge.
  - **Wartend** sind Dokumente, die einen Antrag nennen, den die App (noch) nicht kennt — meist eine Projektbeschreibung vor dem nächsten Datenimport. „Wartende neu zuordnen" versucht es erneut, sobald die Antragsdaten frisch sind.
- **Aufräum-Vorschläge:** sechs Regeln, die die Warteschlange verkürzen — leere Dateien, Dokumente, die sich nicht öffnen ließen, Bescheide und Bewilligungen, sowie Dateiformate, die zu ihrem Typ nicht passen. „Vorschau anzeigen" nennt je Regel die Trefferzahl; abgehakt wird jede Regel einzeln, erst „Anwenden" schreibt.
- **Filterleiste:** vier Reihen mit Zählern — Ansicht, Sicherheit der Zuordnung, Dokument-Typ und Ablage-Ordner. Die Typ-Reihe zeigt nur Typen, die im Bestand wirklich vorkommen.
- **Liste links:** 50 Einträge je Seite, sortierbar nach „zu prüfen zuerst", Dateiname, Typ oder Sicherheit.
- **Detail rechts:** vier Abschnitte zum Lesen — Datei, was die Automatik erkannt hat, welcher Antrag zugeordnet wurde, und die Angaben aus der Ablage-Liste. Darunter die Aktionen.
- **Tastatur:** `j`/`k` (oder Pfeile) blättern, `n` springt zum nächsten offenen Fall, `i` markiert irrelevant, `r` relevant ohne Zuordnung, `a` setzt den Cursor ins Antrags-Suchfeld, `Esc` hebt die Auswahl auf. Nach `i` und `r` rückt die Liste von selbst weiter.

## Typische Aktionen

- Warteschlange mit den Aufräum-Vorschlägen verkürzen
- Dokument-Typ korrigieren
- Antrag zuordnen — über die Vorschlagsliste oder einen der angebotenen Kandidaten
- Als irrelevant abhaken oder als relevant ohne Zuordnung stehen lassen
- Erneut klassifizieren lassen (wirkt beim nächsten Durchlauf in „Suche & Index")
- Wartende Einträge nach einem Datenimport neu zuordnen

## Technik

**Route & Sichtbarkeit:** `/kuration/dokument-review`, Flag `dokumentenscan` + `kuratorOnly`; eigenständige Route, KEIN Panel des Kuration-Hubs.

**Datenmodell dahinter:** `ManifestEntry` je Datei (`triage_state` `relevant`/`irrelevant`/`review`/`pending_antrag`, `doc_type`, `match_confidence`, `matched_antrag_id`, `candidate_antrag_ids`, `triage_source`, `classifier_version`), dazu die Skip-Liste (`SkipListEntry`) und der Pending-Bucket (`phase2_pending_antraege`). Manuelle Entscheidungen schreiben `triage_source='manual'` + frischen Zeitstempel.

**Code:** `src/plugins/dokument-review/` — `DashboardCard`, `AutoCleanupCard`, `FilterBar`, `ManifestList`, `DetailPanel`, `PendingList`, `KeyboardHandler`, `useManifestData`/`useAntraegeIndex`/`useReviewActions`, `filtering.ts`. Mutationen ausschließlich über die Phase-2-API in `@/phase2`. Architektur: `docs/architecture/phase2-review-queue.md`.
