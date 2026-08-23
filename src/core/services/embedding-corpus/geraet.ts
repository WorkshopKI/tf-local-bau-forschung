/**
 * Das Rechenwerk der Einbettung: erkennen, wann es gestorben ist — und
 * entscheiden, womit weitergerechnet wird.
 *
 * Der Anlass (08/2026): ein Vollbau ueber 14.225 Vorhaben verlor nach ~810
 * Vektoren den WebGPU-Kontext und war danach tot. Auf zwei verschiedenen
 * Rechnern derselbe Punkt (807 beim Nutzer, 827 hier) — das ist kein sproedes
 * Einzelrecord, sondern ein Grafikspeicher, der sich ueber die Laufzeit
 * zusetzt. `embedText` hatte keinerlei Erholung: jeder weitere Aufruf warf
 * sofort.
 *
 * Diese Datei entscheidet nur; sie rechnet nichts und laedt nichts. Der Ablauf
 * steht in [erholung.ts](./erholung.ts), das Laden im
 * [wrapper.ts](./wrapper.ts).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';

/** Worauf das Modell rechnet. Mehr Backends kennt der Such-Stack nicht. */
export type EmbeddingGeraet = 'webgpu' | 'wasm';

export const GERAET_LABEL: Record<EmbeddingGeraet, string> = {
  webgpu: 'Grafikkarte',
  wasm: 'Hauptprozessor',
};

/** Fuer Saetze wie „laeuft auf DEM Hauptprozessor" — zwei Genera, ein Satzbau. */
export const GERAET_DATIV: Record<EmbeddingGeraet, string> = {
  webgpu: 'der Grafikkarte',
  wasm: 'dem Hauptprozessor',
};

/**
 * Spricht dieser Fehler von einem toten Rechenwerk — oder nur von diesem einen
 * Datensatz?
 *
 * Bewusst eng gefasst: ein Fehler, der an jedem Datensatz gleich auftritt
 * (kaputter Text, falsche Form), soll KEIN Neuladen ausloesen. Sonst laedt ein
 * Lauf vierzigmal ein 200-MB-Modell nach, nur weil ein Datensatz nicht passt.
 *
 * Der gemeldete Wortlaut zum Vergleich — er trifft gleich vier der Marker:
 * `failed to call OrtRun() … buffer_manager.cc:543 … wgpu::MapAsyncStatus …
 * Failed to execute 'mapAsync' on 'GPUBuffer': [Device] is lost.`
 */
export function istGeraeteverlust(err: unknown): boolean {
  const text = (err instanceof Error ? `${err.name}: ${err.message}` : String(err)).toLowerCase();
  return MARKER.some(m => text.includes(m));
}

const MARKER: readonly string[] = [
  // WebGPU: der Kontext ist weg, alle Puffer der Sitzung sind ungueltig.
  'device] is lost',
  'device is lost',
  'device lost',
  'device was lost',
  'device is destroyed',
  'mapasync',
  'gpubuffer',
  'webgpu',
  'gpudevice',
  // Speicher — gilt fuer beide Rechenwerke.
  'out of memory',
  'failed to allocate',
  'cannot enlarge memory',
  'memory access out of bounds',
];

/**
 * Nach so vielen Erholungen gilt der Lauf als aussichtslos.
 *
 * Ein Vollbau ueber 14.221 Vorhaben braucht bei ~810 Vektoren je Geraeteleben
 * rund achtzehn Neuladungen. Vierzig lassen Luft nach oben und verhindern
 * trotzdem, dass ein Lauf endlos Modelle nachlaedt.
 */
export const ERHOLUNG_MAX = 40;

/**
 * Wie viele Vektoren eine Erholung mindestens einbringen muss, damit sich die
 * naechste lohnt.
 *
 * **Gemessen, nicht geschaetzt** (Abnahme 08/2026, dieselbe Maschine, gleicher
 * Bestand): Grafikkarte **0,067 s** je Vektor (21.756 Vektoren in 26 min),
 * Hauptprozessor **2,02 s** je Vektor (13 Vektoren in 26 s) — Faktor **30**.
 * Ein Vollbau kostet dort ueber **zwoelf Stunden**.
 *
 * Ein Ladelauf kostet **38 s** (ebenfalls gemessen, am Knopf „Wieder mit
 * Grafikkarte versuchen"). Er rechnet sich also, solange er mehr als
 * `38 / (2,02 - 0,067)` ≈ **20** Vektoren einbringt. Fuenfzig waeren zu frueh
 * aufgegeben: bei dreissig Vektoren je Geraeteleben ist die Grafikkarte immer
 * noch schneller als der Hauptprozessor. Der Wechsel ist die Rettung, nicht die
 * Abkuerzung — die fuenf ueber dem Break-even sind die Reserve gegen eine
 * einzelne magere Runde.
 */
export const ERTRAG_MINDEST = 25;

export interface ErholungsLage {
  /** Worauf gerade gerechnet wird. */
  geraet: EmbeddingGeraet;
  /** Wie viele Vektoren seit der letzten Erholung gelungen sind. */
  seitErholung: number;
  /** Wie oft dieser Lauf sich schon erholt hat. */
  erholungen: number;
}

export type ErholungsPlan =
  | { art: 'neuladen'; geraet: EmbeddingGeraet }
  | { art: 'aufgeben'; grund: 'obergrenze' | 'hauptprozessor' };

/**
 * Was als Naechstes zu tun ist, wenn das Rechenwerk weggebrochen ist.
 *
 * Rein — der ganze Beweis, dass ein Lauf nicht endlos laedt und nicht ewig auf
 * einer toten Grafikkarte beharrt, steht in dieser Funktion und in ihrem Test.
 */
export function planeErholung(lage: ErholungsLage): ErholungsPlan {
  if (lage.erholungen >= ERHOLUNG_MAX) return { art: 'aufgeben', grund: 'obergrenze' };
  // Der Hauptprozessor verliert keinen Kontext: wenn er wirft, ist der
  // Arbeitsspeicher des Tabs am Ende — und ein zweites Modell hilft dagegen nicht.
  if (lage.geraet === 'wasm') return { art: 'aufgeben', grund: 'hauptprozessor' };
  // Erster Verlust: die Grafikkarte bekommt einen frischen Kontext. Danach
  // entscheidet der Ertrag, ob sich das noch einmal lohnt.
  if (lage.erholungen > 0 && lage.seitErholung < ERTRAG_MINDEST) {
    return { art: 'neuladen', geraet: 'wasm' };
  }
  return { art: 'neuladen', geraet: 'webgpu' };
}

/**
 * Was dieser Rechner ueber sein Rechenwerk gelernt hat.
 *
 * **Maschine-lokal** — wie die Bau-Rate: die Aussage betrifft diese Grafikkarte,
 * nicht das Team, und hat auf dem Share nichts zu suchen.
 */
export const GERAET_PRAEFERENZ_KEY = 'emb-geraet-praeferenz';

export interface GeraetPraeferenz {
  geraet: EmbeddingGeraet;
  /** Wortlaut des Fehlers, der zu dieser Festlegung gefuehrt hat. */
  grund: string;
  /** ISO-Zeitstempel. */
  am: string;
}

export async function ladeGeraetPraeferenz(idb: IDBStore): Promise<GeraetPraeferenz | null> {
  const roh = await idb.get<GeraetPraeferenz>(GERAET_PRAEFERENZ_KEY).catch(() => null);
  if (!roh || (roh.geraet !== 'wasm' && roh.geraet !== 'webgpu')) return null;
  return roh;
}

export async function merkeGeraetPraeferenz(idb: IDBStore, p: GeraetPraeferenz): Promise<void> {
  await idb.set(GERAET_PRAEFERENZ_KEY, p);
}

/** Der Nutzer will es wieder mit der Grafikkarte versuchen. */
export async function vergissGeraetPraeferenz(idb: IDBStore): Promise<void> {
  await idb.delete(GERAET_PRAEFERENZ_KEY);
}
