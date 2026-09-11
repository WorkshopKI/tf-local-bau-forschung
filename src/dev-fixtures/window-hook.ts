/**
 * `window.__tf` — programmatischer Zugriff auf Zustand und Fixtures.
 *
 * Motivation: die Dev-Fixtures existieren längst als reine Funktionen
 * (`applyScenario`, `resetAll`, `exportCurrentState`), waren aber ausschliesslich
 * über React-Buttons erreichbar. Eine Automation müsste sich also durch Menüs
 * klicken — fehleranfällig und langsam. Dieser Hook macht dieselben Funktionen
 * direkt aufrufbar, ohne einen zweiten Weg in die Logik zu bauen.
 *
 * Gating wie in `actions.ts`: `__TEAMFLOW_DEV_FIXTURES__` (Literal-Konstante →
 * Rollup entfernt den Zweig in Prod-Builds) UND `features.devFixtures`.
 *
 * Bewusst KEIN Import aus `local-fs/` — sonst zöge ein gewöhnliches
 * `npm run dev` den Brücken-Adapter mit in den Bundle.
 */

import type { StorageService } from '@/core/services/storage';
import { features } from '@/config/feature-flags';
import { runtimeConfig, appVersion } from '@/config/runtime-config';
import { applyScenario, type ScenarioKey } from './scenarios';
import { resetAll } from './helpers';
import { setKuratorOn, setKuratorOff, exportCurrentState } from './actions';
import { seedTestData } from '@/core/services/seed/seed-data';
import { useStartupDataStatus } from '@/core/services/csv/startup-data-status';

/** Kompakter Zustands-Abzug — das, was eine Automation zum Steuern braucht. */
export interface TfZustand {
  version: string;
  variante: string;
  route: string;
  /** Phase des Start-Datenlaufs: 'idle' | 'running' | 'done' | … */
  datenPhase: string;
  antraege: number;
  programme: string[];
  kurator: boolean;
  /** Seit dem Laden gesammelte console.error-/unhandledrejection-Meldungen. */
  fehler: number;
}

export interface TfHook {
  bereit(timeoutMs?: number): Promise<TfZustand>;
  zustand(): Promise<TfZustand>;
  szenario(key: ScenarioKey): Promise<void>;
  zuruecksetzen(): Promise<void>;
  seed(): Promise<void>;
  kurator(an: boolean): Promise<void>;
  navigiere(route: string): void;
  exportiereZustand(): Promise<unknown>;
  fehler(): string[];
}

declare global {
  interface Window { __tf?: TfHook }
}

/** Gesammelte Fehler — die Konsole ist für einen Agenten mühsam zu filtern. */
const gesammelteFehler: string[] = [];

function sammleFehler(): void {
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]): void => {
    gesammelteFehler.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(' ').slice(0, 500));
    originalError(...args);
  };
  window.addEventListener('unhandledrejection', ev => {
    gesammelteFehler.push(`unhandledrejection: ${String(ev.reason)}`.slice(0, 500));
  });
}

/** Roher Store-Zugriff wie in `actions.ts` — IDBStore typisiert nur den kv-Store. */
function zaehleStore(storage: StorageService, store: string): Promise<number> {
  return new Promise(resolve => {
    try {
      const req = storage.idb.getDb().transaction(store, 'readonly').objectStore(store).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(-1);
    } catch {
      resolve(-1);
    }
  });
}

function leseStore<T>(storage: StorageService, store: string): Promise<T[]> {
  return new Promise(resolve => {
    try {
      const req = storage.idb.getDb().transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function baueZustand(storage: StorageService): Promise<TfZustand> {
  const programme = await leseStore<{ id: string }>(storage, 'programme');
  const profil = await storage.idb.get<{ is_kurator?: boolean }>('profile');
  return {
    version: appVersion,
    variante: runtimeConfig.build.outputFilename,
    route: window.location.hash || '#/',
    datenPhase: useStartupDataStatus.getState().phase,
    antraege: await zaehleStore(storage, 'antraege'),
    programme: programme.map(p => p.id),
    kurator: profil?.is_kurator === true,
    fehler: gesammelteFehler.length,
  };
}

/**
 * Installiert `window.__tf`. No-op ohne aktive Dev-Fixtures.
 *
 * Aufruf aus `App.tsx`, sobald `storage.init()` durch ist — vorher wären die
 * Stores nicht offen und jede Abfrage liefe ins Leere.
 */
export function installiereTfHook(storage: StorageService): void {
  if (!__TEAMFLOW_DEV_FIXTURES__ || !features.devFixtures) return;
  if (window.__tf) return;

  sammleFehler();

  window.__tf = {
    /**
     * Wartet, bis die App wirklich benutzbar ist.
     *
     * Wichtigste Funktion des Hooks: ohne den `datenPhase === 'done'`-Anteil
     * fotografiert eine Automation eine leere Tabelle, weil der Startup-
     * Datenlauf (Snapshot + CSV-Check) noch läuft.
     *
     * Standard 40 s: bleibt unter der 45-s-Grenze eines `javascript_tool`-
     * Aufrufs. Darüber bräche das Werkzeug ab und verschluckte die Phase; so
     * meldet der Timeout sie, und der Aufrufer ruft erneut.
     */
    async bereit(timeoutMs = 40_000): Promise<TfZustand> {
      const ende = Date.now() + timeoutMs;
      for (;;) {
        const phase = useStartupDataStatus.getState().phase;
        const gemountet = document.querySelector('nav, main') !== null;
        // `done` wird im finally gesetzt — auch wenn der Pass scheitert oder es
        // gar kein Daten-Share-Handle gibt. Es gibt bewusst keine `error`-Phase.
        if (gemountet && phase === 'done') break;
        if (Date.now() > ende) throw new Error(`__tf.bereit: Timeout nach ${timeoutMs} ms (Phase: ${phase})`);
        await new Promise(r => setTimeout(r, 250));
      }
      return baueZustand(storage);
    },

    zustand: () => baueZustand(storage),
    szenario: (key) => applyScenario(storage, key),
    zuruecksetzen: () => resetAll(storage.idb),
    seed: async () => { await seedTestData(storage); },
    kurator: async (an) => { await (an ? setKuratorOn(storage.idb) : setKuratorOff(storage.idb)); },
    navigiere: (route) => { window.location.hash = route.startsWith('#') ? route : `#${route}`; },
    exportiereZustand: () => exportCurrentState(storage.idb),
    fehler: () => [...gesammelteFehler],
  };
}
