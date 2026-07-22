# Neue Feedback-Kategorie hinzufügen

Wenn eine neue sichtbare `FeedbackCategory` gebraucht wird (z.B. `'doku'`, `'sicherheit'`), müssen mehrere Stellen synchron aktualisiert werden — sonst rendert die UI kein Label, der Badge ist farblos, Filter zeigen die Kategorie nicht, und (falls sponsorbar) der Sponsoring-Pfad greift nicht.

Feedback-Kategorie ist **bewusst getrennt** von Antrag-Status (CLAUDE.md Pitfall #9) und vom Feedback-**Status** (siehe [add-feedback-status.md](add-feedback-status.md)). Diese Checkliste gilt nur für `FeedbackCategory`-Erweiterungen.

> **Anti-Pattern-Schutz:** Sponsorbarkeit NIE per verstreuter `category === 'idea'`-Vergleiche prüfen — das übersieht garantiert eine Stelle. Es gibt EINEN Helper `isSponsorableCategory(category)` in [feedbackSponsoring.ts](../../src/core/services/feedback/feedbackSponsoring.ts) (aktuell nur `idea`). Eine neue sponsorbare Kategorie wird dort und NUR dort ergänzt; alle Konsumenten routen darüber.

## Touch-Points (Pflicht, in dieser Reihenfolge)

1. **Typ-Union** in [src/core/types/feedback.ts](../../src/core/types/feedback.ts):
   ```ts
   export type FeedbackCategory = 'praise' | 'problem' | 'idea' | 'question' | 'doku';
   ```
   Danach erzwingt TypeScript die Vollständigkeit aller `Record<FeedbackCategory, …>`-Maps — `npm run typecheck` zeigt die fehlenden Stellen.

2. **Theme-Token** (nur wenn eine eigene Badge-Farbe gewünscht ist) in [src/theme.css](../../src/theme.css): ein neues `--tf-<name>-bg`/`--tf-<name>-text`-Paar für **Light UND Dark** anlegen (hsl-Pattern wie die semantischen Farben, **keine** Inline-Hex). Die vier semantischen Paare (info/success/warning/danger) sind durch problem/idea/praise/question belegt. Eine dezente neutrale Variante (`--tf-bg-secondary`/`--tf-text-secondary`) geht alternativ ohne neuen Token.

3. **UI-Konstanten** in [src/components/feedback/constants.ts](../../src/components/feedback/constants.ts):
   - `CATEGORY_LABELS` — sichtbares Label (kurz, für Badges).
   - `CATEGORY_ICONS` — lucide-Icon-Name.
   - `CATEGORY_COLORS` — Badge-Klassen (Theme-Var aus Schritt 2; nicht dieselbe wie eine bestehende Kategorie, sonst optisch ununterscheidbar).
   - `LLM_CATEGORY_MAP` — falls die LLM-Klassifikation einen passenden Code liefert, darauf mappen (z.B. `ux: 'ux'`).
   - `FEEDBACK_TYPES` — neuen Typ-Eintrag mit `category`, `label`, `icon`, `fields` (genau EIN `required`-Feld), optional `llmHint` + `primary`. Das ist der sichtbare Eingabe-Pfad.
   Alle `Record<FeedbackCategory, …>` sind nach Schritt 1 typgeprüft.

4. **Deterministische Keyword-Klassifikation** in [feedbackClassification.ts](../../src/core/services/feedback/feedbackClassification.ts) `KEYWORD_CUES`: einen Cue-Block ergänzen. **Reihenfolge beachten** — spezifischere Kategorien vor generischen einsortieren (die erste passende gewinnt, z.B. `problem` vor `idea`). Greift nur im Alt-/Outbox-Fallback; der Haupt-Pfad setzt die Kategorie deterministisch über die Typ-Wahl.

5. **Sponsorbarkeit** (nur wenn die neue Kategorie sponsorbar sein soll) in [feedbackSponsoring.ts](../../src/core/services/feedback/feedbackSponsoring.ts): `isSponsorableCategory` um die Kategorie erweitern. Damit greifen `isSponsoringOpen`, Board-Card, Board-Liste, Ticket-Detail (`showEffort`/Progress), Sponsoring-Overview und das Board-Ranking automatisch — sie routen alle über den Helper.

6. **Kategorie-Filter** (hartcodierte Label↔Wert-Maps + Zähler) ergänzen:
   - öffentliches Board [feedback-board/FeedbackBoardPage.tsx](../../src/plugins/feedback-board/FeedbackBoardPage.tsx): `KAT_TO_LABEL` + `LABEL_TO_KAT` + `kategorieItems`-Zähler.
   - Kurator [feedback/sections/FeedbackTicketList.tsx](../../src/plugins/feedback/sections/FeedbackTicketList.tsx): `KAT_TO_LABEL` + `LABEL_TO_KAT`.
   - Kurator [feedback/FeedbackAdminPage.tsx](../../src/plugins/feedback/FeedbackAdminPage.tsx): `kategorieItems`-Zähler.
   Das Kategorie-Wechsel-Dropdown im Ticket-Detail iteriert über `CATEGORY_LABELS` → automatisch abgedeckt.

## Kategorie ENTFERNEN (umgekehrter Weg)

Dieselben Touch-Points rückwärts — plus **einen zusätzlichen Pflichtschritt**: bereits gespeicherte Tickets tragen den alten Wert weiter (lokal + in der geteilten `feedback.json`), und `CATEGORY_LABELS[item.category]` liefert dafür `undefined` (farbloser, leerer Badge).

- Read-Time-Migration in `normalizeLegacyFields` ([feedbackStorage.ts](../../src/core/services/feedback/feedbackStorage.ts)) ergänzen — die Funktion läuft auf **beiden** Lesepfaden (`loadLocalItems` + `readSharedFile`) und zusätzlich beim Outbox-Import (`toFeedbackItem`). Nicht-destruktiv: die Share-Datei heilt sich, sobald ein Ticket ohnehin geschrieben wird.
- **`structured`-Keys mit umschlüsseln**, wenn der entfallene Typ eigene Feldnamen hatte — sonst verlieren `feedbackTitle` (`PRIMARY_FIELD_KEY`) und `feedbackQaSegments` den Inhalt der Alt-Tickets (Vorlage: `ux` → `idea` mit `pain`→`goal`, `better`→`idea`, v2.289).
- Die Labels des entfallenen Typs bleiben in `LEGACY_UX_LABELS` ([feedbackUi.ts](../../src/components/feedback/feedbackUi.ts)) für den Text-Fallback erhalten.
- `LLMCategoryCode` + `LLM_CATEGORY_MAP`: den LLM-Code **behalten** und auf die Nachfolge-Kategorie mappen (alte `system-prompt.md` auf dem Share nennt ihn weiter).

## Nicht ändern

- **`LLMCategoryCode`** (in feedback.ts) ist die *LLM*-Ausgabe-Sprache, nicht die App-Kategorie — nur anfassen, wenn das LLM-Schema selbst einen neuen Code lernen soll.
- **`QUICK_TAGS`** (`@deprecated`) — nicht erweitern; der Eingabe-Pfad läuft über `FEEDBACK_TYPES`.

## Verifikation

- `npm run typecheck` — TS prüft die `Record<FeedbackCategory, …>`-Vollständigkeit.
- `npm run test` — Feedback-Tests fangen Mapping-/Klassifikations-Lücken (u.a. `feedbackClassification.test.ts`, `feedbackSponsoring.test.ts`, `feedbackTypeForm.test.ts`).
- Manuell: Feedback-FAB → neuen Typ wählen → Felder → Absenden. Badge mit eigener Farbe; erscheint im Board + Kurator-Filter; falls sponsorbar → Aufwand + Sponsoring wählbar.
