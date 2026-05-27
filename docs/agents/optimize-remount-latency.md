# Re-Mount-Latenz eines Plugins optimieren

Wenn ein Plugin beim Wechsel von einer anderen Seite mehrere Sekunden braucht bis es interaktiv ist und der User währenddessen nichts sieht, sind das fast immer dieselben drei Hebel — in dieser Reihenfolge. Dokumentiert anhand des Auslastungs-Moduls (v2.13: 7 s → <1 s Re-Mount).

## Wann gilt das Pattern

Symptome:
- Plugin ist in [`FLAT_ROUTE_PLUGIN_IDS`](../../src/plugins.config.ts) (komplettes Unmount/Remount bei Navigation, kein Keep-Alive).
- Re-Mount nach Navigation dauert deutlich länger als gefühlt nötig, obwohl ein Zustand-Singleton-Store die Daten bereits hält.
- Initial-Mount ist (gefühlt) schneller weil dort ein Spinner/Countdown sichtbar ist, beim Re-Mount fehlt das.
- DevTools-Performance-Profile zeigt 1–3 s synchronen Main-Thread-Block kurz nach dem Mount.

Nicht passt es bei: echten Daten-Loads (IDB-Read selbst ist langsam → andere Strategie), bei Plugins mit Custom-Route-Handler (`bauantraege`, `antraege` — die haben Keep-Alive).

## Hebel C — Aggregate aus Component-`useMemo` in den Zustand-Store

**Symptom**: Hook (z.B. `useAntraegeCache`) baut mit `useMemo` mehrere abgeleitete Maps/Arrays aus einer großen Liste (5000+ Records). Diese useMemos sind **Component-scoped** und re-evaluieren bei jedem Mount. Mit Eager-Mount aller Tabs (siehe [Auslastung v2.9](../architecture/auslastung.md)) multipliziert sich das.

**Fix**: Aggregate in den Store verschieben.

1. `CacheStoreState` um die Aggregate-Felder erweitern, mit stabilen Default-Refs für den Leer-Zustand:
   ```ts
   const EMPTY_MAP: ReadonlyMap<string, X> = new Map();
   // ...
   anonymMap: AnonymMap;
   historischeXByY: Map<string, Y>;
   aggregatesKey: string | null;  // Cache-Key für Re-Compute-Skip
   ```
2. `refresh()` berechnet die Aggregate **direkt nach** dem Daten-Load und legt sie zusammen mit `antraege/verbuende` in EINEM `set({...})`-Call ab ([CLAUDE.md Lesson 16](../../CLAUDE.md): ein finaler setState).
3. Eine `ensureAggregates()`-Action berechnet sie nach, falls eine Abhängigkeit (z.B. eine Sidecar-Map) erst später lädt. Cache-Key prüfen, no-op bei Match.
4. Hook liest die Aggregate via `useStore(s => s.aggregate)` — ref-stable über Re-Mounts, keine Berechnung.
5. `invalidate()` muss die Aggregate auf die Default-Refs zurücksetzen.

Referenz: [src/plugins/auslastung/hooks/useAntraegeCache.ts](../../src/plugins/auslastung/hooks/useAntraegeCache.ts) (v2.13).

## Hebel A — Sofort sichtbares UI-Feedback bei jedem Mount

**Symptom**: Beim Initial-Mount springt die Komponente in einen Early-Return-Block mit statischem Text/Spinner. Beim Re-Mount mit bereits geladenem Store-State greift dieser Block NICHT, und der "echte" `LoadingBanner` hängt hinter dem Early-Return im Haupt-Render. Resultat: 1–2 s Blank-Screen.

**Fix**: Den Early-Return entfernen, Header + Banner immer rendern, schwere Tab-Inhalte hinter `loaded && (...)` legen.

```tsx
// VORHER:
if (!loaded) return <div>Lade ...</div>;
return (
  <div>
    <Header />
    <Tabs />
    <ModulLoadingBanner />  {/* hinter den Tabs versteckt */}
    <TabContent />
  </div>
);

// NACHHER:
return (
  <div>
    <Header subtitle={loaded ? counts : 'wird geladen …'} />
    <ModulLoadingBanner />  {/* IMMER, direkt nach Header — prominent */}
    {loaded && <><Tabs /><TabContent /></>}
  </div>
);
```

Voraussetzung: der `LoadingBanner` muss seinen Sichtbarkeits-Zustand aus einem zentralen Ready-Hook ziehen (z.B. [`useAuslastungReady`](../../src/plugins/auslastung/hooks/useAuslastungReady.ts)) und verschwindet automatisch bei `ready === true`. Hebel A funktioniert nur, wenn der Main-Thread nicht durch synchrone Berechnungen blockiert ist — daher **immer nach Hebel C**.

Referenz: [src/plugins/auslastung/views/AuslastungView.tsx](../../src/plugins/auslastung/views/AuslastungView.tsx) (v2.13).

## Hebel B1 — Plugin-`onInit`-Hook für Pre-Cache beim App-Start

**Symptom**: Erster Aufruf des Plugins nach App-Start bezahlt den vollen IDB-Read + SMB-Sidecar-Reads, weil die Stores bis dahin leer sind.

**Fix**: `onInit`-Hook im Plugin nutzen — wird non-blocking nach `storage.init()` aus [src/core/App.tsx](../../src/core/App.tsx) gerufen, parallel + fehlertolerant.

```ts
import type { TeamFlowPlugin } from '@/core/types/plugin';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useMyDataStore } from './hooks/useMyDataStore';
import { warmupMyCache } from './hooks/useMyCache';

export const myPlugin: TeamFlowPlugin = {
  // ... metadata
  onInit: async ({ storage }) => {
    // Sidecars parallel — Stores haben Idempotenz-Guards, Doppel-Load no-op.
    await Promise.allSettled([
      useMyDataStore.getState().load(storage),
      // ggf. weitere SMB-Reads
    ]);
    // Daten die activeProgrammId brauchen: jetzt wenn schon da, sonst Subscribe.
    const id = useActiveProgramm.getState().activeProgrammId;
    if (id) {
      void warmupMyCache(storage, id);
    } else {
      const unsub = useActiveProgramm.subscribe(s => {
        if (s.activeProgrammId) {
          unsub();
          void warmupMyCache(storage, s.activeProgrammId);
        }
      });
    }
  },
};
```

### Spielregeln für `onInit`

- **Idempotent**: kann mehrfach aufgerufen werden (Stores schützen sich selbst).
- **Fehlertolerant**: Errors werden vom App-Loader geschluckt — Plugin darf nicht den App-Start brechen.
- **Schnell**: Ziel <1 s. Für schwere Operationen (Embedding-Modell-Init, Korpus-Download) `scheduleIdle` aus [src/core/utils/scheduleIdle.ts](../../src/core/utils/scheduleIdle.ts) nutzen.
- **Statische Imports**: keine `await import(...)` im Plugin-Code ([CLAUDE.md Pitfall #1](../../CLAUDE.md) — dynamische Imports brechen unter `file://`).
- **Nicht** für Daten die erst beim ersten Render der Plugin-Seite gebraucht werden (lädt sonst beim App-Start umsonst).
- Externe Trigger-Funktion für den Cache-Warmup exportieren (`warmupXyzCache`), statt `useStore` aus dem Plugin-`index.tsx` zu importieren — sauberer.

Referenzen:
- Interface: [src/core/types/plugin.ts](../../src/core/types/plugin.ts) (`TeamFlowPlugin.onInit`, `PluginInitServices`).
- Aufruf-Stelle: [src/core/App.tsx](../../src/core/App.tsx) (`void Promise.allSettled(enabledPlugins.filter(p => p.onInit).map(...))`).
- Beispiel: [src/plugins/auslastung/index.tsx](../../src/plugins/auslastung/index.tsx) (v2.13).

## Reihenfolge & Granularität

1. **C zuerst** — löst die echte Latenz. Ohne C ist A nur Kosmetik (Spinner friert).
2. **A danach** — kostet ~10 Zeilen, halbiert die wahrgenommene Latenz auch in Edge-Cases.
3. **B1 optional** — verbessert primär den Initial-Load nach App-Start. Lohnt sich vor allem in Build-Varianten wo das Plugin eine Haupt-Funktion ist (z.B. `pl.config.json` für das Auslastungs-Modul).

Pro Hebel ein eigener Commit (CLAUDE.md-User-Memory: `auto-commit + build:devprod` pro Schritt), damit bei Regression einzeln revertbar.

## Verifikation

- DevTools Performance-Tab: Klick auf zwei verschiedene Plugin-Sidebar-Einträge im Wechsel. Main-Thread-Blockaden < 500 ms je Mount.
- Stoppuhr-Test: Klick → voll interaktive UI. Vergleich vorher/nachher.
- Tab-Wechsel **innerhalb** des Plugins muss unverändert schnell bleiben (Eager-Mount-Pattern darf nicht regressen).
- Mutation-Konsistenz: Externe Daten-Mutation (z.B. CSV-Re-Import) → `invalidate()` muss greifen, nächster Mount zeigt frische Daten, nicht Cache.
- `npm run check` (typecheck + test + build:dev) grün.

## Wann das Pattern NICHT lohnt

- Plugin mit Custom-Route-Handler (Keep-Alive vorhanden) — Hebel C/A nicht nötig.
- Plugin mit wenig Daten (< 500 Records) — useMemo-Re-Compute ist billig.
- Plugin nur im Dev-Build aktiv — Optimierungs-Aufwand vs. Nutzen.
- Plugin lädt eh dynamisch (z.B. asynchrone Suche) — andere Strategien (Streaming, useDeferredValue) passen besser.
