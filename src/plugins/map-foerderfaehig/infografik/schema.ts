/**
 * Datenmodell, Prompt und Parser der Infografik-Extraktion.
 *
 * Ein interner Lauf liefert die Textanteile für Canvas, SdT-Delta und
 * Wirkungskette. Der Parser ist bewusst nachsichtig gegenüber Trailing-Artefakten
 * und fehlenden Feldern — aber NICHT gegenüber fehlendem Beleg: was das Modell
 * nicht mit einer Sektion belegt, wird als „nicht belegt" geführt, nicht
 * stillschweigend übernommen.
 *
 * Reine Funktionen — der Cache- und Transport-Rahmen liegt in `run.ts`.
 */
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import { extractLastJsonObject } from '@/plugins/antraege/aufbereitung/steckbrief';

/** Wie gut eine Angabe in der Vorhabensbeschreibung belegt ist. */
export type Belegtheit = 'belegt' | 'vage' | 'fehlt';

export interface CanvasFeld {
  text: string;
  sektionIds: string[];
  belegtheit: Belegtheit;
}

/** Die vier Textfelder des Canvas, die aus der VB kommen. */
export interface CanvasTexte {
  problemSdt: CanvasFeld;
  innovation: CanvasFeld;
  technischesRisiko: CanvasFeld;
  marktVerwertung: CanvasFeld;
}

export interface SdtDeltaZeile {
  parameter: string;
  sdtWert: string;
  zielWert: string;
  /** `quantifiziert` = messbare Zahl, `qualitativ` = nur beschrieben. */
  quantifizierung: 'quantifiziert' | 'qualitativ' | 'fehlt';
  sektionIds: string[];
}

export interface WirkungsGlied {
  text: string;
  /** Zahlenziel, falls die VB eines nennt (z. B. „3 neue Arbeitsplätze"). */
  zahlenziel?: string;
  sektionIds: string[];
  belegtheit: Belegtheit;
}

export interface Wirkungskette {
  problem: WirkungsGlied;
  ergebnis: WirkungsGlied;
  verwertung: WirkungsGlied;
  wirkung: WirkungsGlied;
}

export interface InfografikDaten {
  canvas: CanvasTexte;
  sdtDelta: SdtDeltaZeile[];
  wirkungskette: Wirkungskette;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const CANVAS_FELDER: ReadonlyArray<{ key: keyof CanvasTexte; frage: string }> = [
  { key: 'problemSdt', frage: 'Welches Problem wird gelöst und was ist der heutige Stand der Technik?' },
  { key: 'innovation', frage: 'Was ist der Kern der Innovation gegenüber dem Bestehenden?' },
  { key: 'technischesRisiko', frage: 'Welche konkreten technischen Entwicklungshürden bestehen?' },
  { key: 'marktVerwertung', frage: 'Welche Märkte werden adressiert und wie soll verwertet werden?' },
];

const KETTEN_GLIEDER: ReadonlyArray<{ key: keyof Wirkungskette; frage: string }> = [
  { key: 'problem', frage: 'Von welchem Ausgangsproblem geht das Vorhaben aus?' },
  { key: 'ergebnis', frage: 'Was ist das angestrebte technische Ergebnis?' },
  { key: 'verwertung', frage: 'Wie wird das Ergebnis verwertet?' },
  { key: 'wirkung', frage: 'Welche wirtschaftliche Wirkung wird erwartet (Umsatz, Arbeitsplätze)?' },
];

/** Baut das Extraktions-Prompt. Rein. */
export function buildInfografikPrompt(gliederung: readonly VbSektion[], vbMarkdown: string): string {
  const sektionsListe = gliederung
    .map(s => `- ${s.id}: ${s.nummer != null ? `${s.nummer} ` : ''}${s.titel}`)
    .join('\n');

  return [
    'Extrahiere aus der Vorhabensbeschreibung die Angaben für drei Prüfansichten.',
    '',
    'Regeln:',
    '- Belege JEDE Aussage mit den IDs der Abschnitte, aus denen sie stammt.',
    '- Formuliere wortnah am Original, 2 bis 4 Sätze je Feld.',
    '- `belegtheit`: "belegt" wenn die VB die Aussage klar trägt, "vage" wenn sie nur',
    '  angedeutet oder rein qualitativ ist, "fehlt" wenn sie gar nicht vorkommt.',
    '- Bei "fehlt" bleibt `text` leer. Erfinde nichts.',
    '',
    '## Abschnitte',
    sektionsListe,
    '',
    '## Vorhabensbeschreibung',
    vbMarkdown,
    '',
    '## Gefordertes JSON',
    '```json',
    '{',
    '  "canvas": {',
    ...CANVAS_FELDER.map(f =>
      `    "${f.key}": { "text": "…", "sektionIds": ["k-1"], "belegtheit": "belegt|vage|fehlt" },  // ${f.frage}`),
    '  },',
    '  "sdtDelta": [',
    '    { "parameter": "…", "sdtWert": "…", "zielWert": "…",',
    '      "quantifizierung": "quantifiziert|qualitativ|fehlt", "sektionIds": ["k-2"] }',
    '  ],',
    '  "wirkungskette": {',
    ...KETTEN_GLIEDER.map(g =>
      `    "${g.key}": { "text": "…", "zahlenziel": "…", "sektionIds": ["k-3"], "belegtheit": "belegt|vage|fehlt" },  // ${g.frage}`),
    '  }',
    '}',
    '```',
    '',
    'Gib ausschließlich dieses JSON-Objekt zurück.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const LEERES_FELD: CanvasFeld = { text: '', sektionIds: [], belegtheit: 'fehlt' };

function alsText(wert: unknown): string {
  return typeof wert === 'string' ? wert.trim() : '';
}

function alsSektionIds(wert: unknown, bekannt: ReadonlySet<string>): string[] {
  if (!Array.isArray(wert)) return [];
  return [...new Set(wert.filter((v): v is string => typeof v === 'string'))]
    .filter(id => bekannt.has(id));
}

/**
 * Deutet die Belegtheit. Ohne Text oder ohne gültige Fundstelle gilt eine
 * Aussage NIE als belegt — ein unbelegter Satz ist im Prüfkontext wertlos, und
 * das Modell soll ihn nicht durch eine Selbstauskunft aufwerten können.
 */
function alsBelegtheit(wert: unknown, text: string, sektionIds: readonly string[]): Belegtheit {
  if (text.length === 0) return 'fehlt';
  if (sektionIds.length === 0) return 'vage';
  return wert === 'belegt' ? 'belegt' : wert === 'vage' ? 'vage' : 'vage';
}

function alsFeld(roh: unknown, bekannt: ReadonlySet<string>): CanvasFeld {
  if (roh === null || typeof roh !== 'object') return { ...LEERES_FELD };
  const o = roh as Record<string, unknown>;
  const text = alsText(o['text']);
  const sektionIds = alsSektionIds(o['sektionIds'], bekannt);
  return { text, sektionIds, belegtheit: alsBelegtheit(o['belegtheit'], text, sektionIds) };
}

function alsGlied(roh: unknown, bekannt: ReadonlySet<string>): WirkungsGlied {
  const feld = alsFeld(roh, bekannt);
  const zahlenziel = roh !== null && typeof roh === 'object'
    ? alsText((roh as Record<string, unknown>)['zahlenziel'])
    : '';
  return { ...feld, ...(zahlenziel.length > 0 ? { zahlenziel } : {}) };
}

function alsDeltaZeile(roh: unknown, bekannt: ReadonlySet<string>): SdtDeltaZeile | null {
  if (roh === null || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;
  const parameter = alsText(o['parameter']);
  if (parameter.length === 0) return null;

  const q = o['quantifizierung'];
  return {
    parameter,
    sdtWert: alsText(o['sdtWert']),
    zielWert: alsText(o['zielWert']),
    quantifizierung: q === 'quantifiziert' ? 'quantifiziert' : q === 'qualitativ' ? 'qualitativ' : 'fehlt',
    sektionIds: alsSektionIds(o['sektionIds'], bekannt),
  };
}

/**
 * Parst die Modell-Antwort. `null` nur, wenn gar kein JSON-Objekt erkennbar ist —
 * fehlende Einzelfelder werden zu „fehlt", nicht zum Abbruch. Rein.
 */
export function parseInfografik(
  raw: string, gliederung: readonly VbSektion[],
): InfografikDaten | null {
  const objekt = extractLastJsonObject(raw);
  if (objekt === null) return null;

  const bekannt = new Set(gliederung.map(s => s.id));
  const canvasRoh = (objekt['canvas'] ?? {}) as Record<string, unknown>;
  const ketteRoh = (objekt['wirkungskette'] ?? {}) as Record<string, unknown>;

  return {
    canvas: {
      problemSdt: alsFeld(canvasRoh['problemSdt'], bekannt),
      innovation: alsFeld(canvasRoh['innovation'], bekannt),
      technischesRisiko: alsFeld(canvasRoh['technischesRisiko'], bekannt),
      marktVerwertung: alsFeld(canvasRoh['marktVerwertung'], bekannt),
    },
    sdtDelta: (Array.isArray(objekt['sdtDelta']) ? objekt['sdtDelta'] : [])
      .map(z => alsDeltaZeile(z, bekannt))
      .filter((z): z is SdtDeltaZeile => z !== null),
    wirkungskette: {
      problem: alsGlied(ketteRoh['problem'], bekannt),
      ergebnis: alsGlied(ketteRoh['ergebnis'], bekannt),
      verwertung: alsGlied(ketteRoh['verwertung'], bekannt),
      wirkung: alsGlied(ketteRoh['wirkung'], bekannt),
    },
  };
}

/**
 * Erkennt eine Antwort, die zwar formal passt, aber inhaltlich nichts trägt —
 * Grundlage des Verdächtig-Guards, der einen solchen Lauf nicht cacht. Rein.
 */
export function istInhaltsleer(daten: InfografikDaten): boolean {
  const canvasLeer = Object.values(daten.canvas).every(f => f.belegtheit === 'fehlt');
  const ketteLeer = Object.values(daten.wirkungskette).every(g => g.belegtheit === 'fehlt');
  return canvasLeer && ketteLeer && daten.sdtDelta.length === 0;
}
