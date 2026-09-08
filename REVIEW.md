# Review-Policy

Diese Datei liest `/code-review` zusätzlich zur CLAUDE.md. Sie legt fest, in welchen Pässen ein Diff geprüft wird, was als **Wichtig** zählt und was als Nit, und was ausgelassen wird. Der Prozess dahinter: [docs/architecture/entwicklungsprozess.md](docs/architecture/entwicklungsprozess.md).

## Pässe

Jeder Pass wird getrennt berichtet; Befunde werden innerhalb eines Passes nach Schwere sortiert, nicht über die Pässe hinweg.

### 1. Constraints & Pitfalls

**Wichtig** ist jeder Verstoß gegen eine Regel, die im Diff unsichtbar bleibt und erst am Bestand oder unter `file://` auffällt:

- `file://`-Constraints: dynamischer `import()`, relatives `fetch()`, roher `new Worker(url)`, Service Worker, `BroadcastChannel`.
- Status-Domänen: Vergleich von `Antrag.status` oder `FeedbackStatus` gegen ein Literal statt über die Kategorie-Helfer (Pitfall #12, #21).
- Persistenz: Infrastruktur-Write ohne `atomicWrite()` / `appendToFile()` (Pitfall #10); Abgeleitetes zusätzlich persistiert (Pitfall #45); Snapshot ohne `healMissingVerbuende` (Pitfall #32).
- Sichtbarkeit: eine der vier Achsen (Flag · Freischaltung · Beta/Experten · `kuratorOnly`) vergessen oder doppelt gesetzt (Pitfall #51, #54).
- Vorgangssystem: ein aus Kürzeln abgeleiteter Status (Pitfall #44), Kürzel nicht über `todoFeld()`.
- Layout: eigenes Master/Detail, eigene Tab-Leiste, eigener Baum, eigene Kanban-Bahnen statt der geteilten Bauteile.

Nit: Namens- und Stilfragen, die ESLint nicht fängt.

### 2. Spec-Treue

Gibt es unter `docs/superpowers/specs/` eine Spec zum Vorhaben, gilt ihr `## 0. Anlass` als Maßstab. **Wichtig**: eine Anforderung des Anlasses fehlt oder ist halb umgesetzt; Verhalten im Diff, das niemand verlangt hat (Scope-Creep); eine Anforderung wirkt umgesetzt, die Umsetzung passt aber nicht zum Anlass. Ohne Spec: den Commit-Titel als Anlass nehmen und melden, dass keine Spec vorliegt.

### 3. Beleg

**Wichtig**: eine sichtbare Änderung ohne Abnahme in `dev:local` (gerenderte Zeichenkette, `window.__tf.fehler()` = 0); eine Zahl im UI ohne Einheit oder Quelle; ein neuer Guard, der nie rot war; ein „fertig" ohne Exit-Code des Gates. Nit: fehlende Messung bei einer Optimierung, deren Wirkung nur behauptet ist.

### 4. Doku-Nachzug

**Wichtig**: Changelog-Skeleton nicht ausgefüllt; ein Plugin mit UI-Änderung ohne Nachzug in `docs/feedback-kontext/<id>.md`; ein neues Modul ohne Zeile im Entscheidungsbaum der CLAUDE.md; ein Cheatsheet-Touch-Point, der beim Bauen nötig war, aber im Cheatsheet fehlt; ein neuer Fachbegriff ohne Eintrag in `CONTEXT.md`. Nit: Kommentare, die Historie statt Ist-Zustand beschreiben.

## Deckel und Ausnahmen

- Höchstens **fünf Nits** je Review; der Rest entfällt.
- Nicht prüfen: `src/generated/**`, `docs/architecture/code-map.md`, `package-lock.json`, `dist*/**`, `eval-out/**`, `_archive/**`, `docs/_archiv/**`, und das Format von `CHANGELOG.md` (erzeugt das Bump-Skript).
- Was ein Guard unter `src/__tests__/` bereits fängt, wird nicht doppelt gemeldet — das Gate ist grün oder rot.
