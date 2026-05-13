# Neue View (Antrags-Liste)

Wenn eine neue Liste-View für `src/plugins/antraege/` dazukommt (z.B. `meine_in_begleitung`, `bewilligt_quartal`). Views sind die Pills, die der User links oben in der Antraege-Toolbar anklickt.

## Touch-Points (Pflicht)

1. **`src/plugins/antraege/views.ts`** — `ViewKey`-String-Union erweitern und ein neues `AntragView`-Objekt im `VIEWS`-Array ergänzen. Predicate als reine Funktion auf `AntragListItem` (keine Side-Effects). Wenn ein Heute-Datum gebraucht wird: `getCurrentYear()`-Pattern verwenden (pro-Aufruf evaluiert, damit Tests via `vi.setSystemTime` injecten können).
2. **`src/plugins/antraege/__tests__/views.test.ts`** — Predicate-Test mit handgeschriebenen Fixtures aus `__tests__/fixtures/`. Mindestens ein positiver + ein negativer Case.

## Status-Domänen-Pflicht

Predicates **niemals** direkt gegen Status-Strings vergleichen (`a.status === 'bewilligt'`). Es gibt zwei Status-Domänen (Bauantrag-Snake-Case vs. Förderantrag-CSV-Rohwerte), die sich am selben `AntragListItem.status`-Feld vermischen. Stattdessen die Kategorie-Helper aus [src/core/utils/status-canonical.ts](../../src/core/utils/status-canonical.ts) verwenden: `isOpenStatus()`, `isBewilligtStatus()`, `isNachforderungStatus()`, `isBegleitungStatus()`, `isClosedStatus()`. Tests müssen die View mit **beiden** Fixture-Sätzen (`seed-antraege.ts` Bauantrag + `real-csv-antraege.ts` Förderantrag) bestehen.

## Optional (UI / Persistenz)

3. **`src/plugins/antraege/store.ts`** — wenn der neue View-Key der Default werden soll: Initial-State in der Persistenz prüfen (Zustand persistiert `activeView` über `useAntraegeStore`). Sonst nichts zu tun.
4. **`src/plugins/antraege/filter/QuickViewChips.tsx`** — rendert `VIEWS` direkt; **keine** Änderung nötig.
5. **`src/plugins/antraege/AntraegeHeader.tsx`** — konsumiert `activeView` agnostisch; **keine** Änderung nötig.

## Anti-Patterns

- Keine Predicate, die auf externe State-Stores zugreift — Tests werden brittle.
- Kein `label` mit eingefrorenem Jahr/Datum als String — wenn dynamisch gebraucht: per Function-Call in der `label`-Property (siehe `bewilligt_jahr`).
- Nicht `viewCount()` oder `getView()` anfassen — beide sind agnostisch über das `VIEWS`-Array.

## Verifikation

- `npm run test` — `views.test.ts` + `filterViewInteraction.test.ts` grün
- Manuell: Antraege-Plugin öffnen, neue Pill ist sichtbar, Count stimmt, Klick filtert die Liste korrekt
