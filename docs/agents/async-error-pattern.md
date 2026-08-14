# Async-Aktionen in UI: useAsyncAction

Pattern für Buttons / Menüpunkte / Dialog-Aktionen, deren Klick-Handler eine Promise zurückgibt. Verhindert die häufigste Fehler-Klasse aus CLAUDE.md Pitfall #15: silent swallowed Promise-Rejections in `onClick={() => void fn()}` ohne sichtbares Error-Feedback.

Hook: [src/core/hooks/useAsyncAction.ts](../../src/core/hooks/useAsyncAction.ts).

## Anti-Pattern (so NICHT)

```tsx
const handleSave = async () => {
  setBusy(true);
  try { await saveSettings(data); }
  finally { setBusy(false); }  // ← schluckt Errors!
};

<Button onClick={() => void handleSave()}>Speichern</Button>
```

Probleme:
- Promise-Rejections landen still in der Browser-Console (unter `file://` oft nicht geöffnet) — User sieht nichts.
- Doppelklick triggert zweiten Call, weil das Promise-Result nicht den Click blockiert.
- Jede Komponente wiederholt dieselbe `try/finally`-Boilerplate.

## Pro-Pattern (so JA)

```tsx
import { useAsyncAction } from '@/core/hooks/useAsyncAction';

const save = useAsyncAction(async () => {
  await saveSettings(data);
  closeDialog();
});

<Button onClick={() => save.run()} disabled={save.busy}>
  {save.busy ? 'Speichern…' : 'Speichern'}
</Button>
{save.error && (
  <div className="mt-2 text-sm text-[var(--tf-danger-text)]">
    Fehler: {save.error}
  </div>
)}
```

Effekte:
- `busy`-State automatisch, Button disabled während Action läuft.
- Error wird in `error`-State geschrieben (truncate auf 500 chars) — sichtbar im UI ohne extra try/catch.
- Doppelklick-Schutz: zweiter `run()`-Call wird ignoriert solange `busy`.

## Hook-API

```ts
interface UseAsyncActionResult<TArgs extends unknown[]> {
  run: (...args: TArgs) => Promise<void>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
}

function useAsyncAction<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<void>,
  opts?: {
    onSuccess?: () => void;
    onError?: (err: unknown) => void;  // zusätzlich zum error-State
  },
): UseAsyncActionResult<TArgs>;
```

- `fn` darf Argumente nehmen — beim Aufruf einfach `save.run(arg1, arg2)`.
- `clearError()` für „Dismiss"-Button am Error-Banner.
- `onSuccess`/`onError` für Nebeneffekte (Toast, Navigation). `onError` ZUSÄTZLICH zum `error`-State, nicht statt.

## Wann KEIN Hook

- Bei rein synchronen Aktionen (kein Promise) — direkt `onClick={handler}`.
- Bei Aktionen, deren Error nur in der Browser-Console gehört (z.B. Debug-Buttons im Dev-Plugin) — dort `void fn().catch(console.error)` reicht.
- Bei Background-Aktionen ohne UI-Feedback (z.B. Cleanup-Polling) — `useEffect` mit eigenem Error-Handling.

## Migration bestehender Stellen

Stand Mai 2026: 30 Files mit `onClick={() => void asyncFn()}`-Pattern, davon ~10 im Auslastungs-Plugin. Migration opportunistisch — wenn ein Patch ohnehin eine dieser Komponenten anfasst, gleich auf den Hook umstellen. Keine Massen-Migration.

Reference-Anwendungen (in stabilen Plugins, als Vorbild):
- [src/plugins/kuration/csv-quellen/CsvQuellenPanel.tsx](../../src/plugins/kuration/csv-quellen/CsvQuellenPanel.tsx)
- [src/plugins/kuration/foerderprogramme/filter/dialogs/FilterEditDialog.tsx](../../src/plugins/kuration/foerderprogramme/filter/dialogs/FilterEditDialog.tsx)
- [src/plugins/dokumentenquellen-kuration/components/SourceFormDialog.tsx](../../src/plugins/dokumentenquellen-kuration/components/SourceFormDialog.tsx)

## Verifikation

- `npm run typecheck` grün
- Manueller Smoke: in einem migrierten Dialog absichtlich Fehler erzeugen (z.B. ungültigen Input absenden oder offline trennen) → Error-Banner sichtbar, Button bleibt disabled während `busy`. Im Erfolgsfall normales Verhalten.

---

## CLAUDE.md-Pitfalls (Detail)

### Pitfall #15 — Async-UI-Aktionen: `useAsyncAction` ist Standard

`[test: no-raw-async-onclick]` — `try/finally` ohne `catch` + `onClick={() => void asyncFn()}` schluckt Promise-Rejections silent; unter `file://` ist die Browser-Console oft nicht offen, der User sieht nichts. Pflicht für neuen Code: `useAsyncAction(fn)` aus [src/core/hooks/useAsyncAction.ts](../../src/core/hooks/useAsyncAction.ts) (liefert `{ run, busy, error, clearError }`, fängt Rejections + schützt vor Doppelklick) — Detail in den Abschnitten oben. Hand-gerolltes `try/catch` + Error-Banner bleibt für Edge-Cases zulässig (z.B. Inline-Validierung vor dem Async-Call). **Maschinell erzwungen** durch `no-raw-async-onclick` (File-Whitelist für ~30 Legacy-Files; Inline-Ausnahme `// allow-raw-async-onclick: <grund>`).
