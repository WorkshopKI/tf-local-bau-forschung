/**
 * Vergleich Paket ↔ Ziel-Stand: je Eintrag `neu` / `geaendert` / `identisch`
 * plus der vorbelegte Vorschlag. Rein — die Vorschau vor dem Schreiben ist der
 * eigentliche Sinn des Pakets (wer es einspielt, weiß oft nicht, was auf dem
 * Ziel-Share steht).
 *
 * **Der Inhaltsvergleich ist kanonisch, nicht feldweise.** Ein Diff über
 * `diffSkillVersions` sähe nur Template, Regeln, Modifikatoren und Kriterien —
 * `vorgaben`, `teilStruktur`, `systemPrompt` oder `aktiv` fielen still durchs
 * Raster und ein geänderter Skill käme als „identisch" an. Verglichen wird
 * deshalb der ganze normalisierte Record ohne die Felder, die sich beim
 * Speichern zwangsläufig ändern (Fassung, Zeitstempel, Historie).
 * `diffSkillVersions` bleibt für die ANZEIGE des Prompt-Diffs zuständig.
 */
import type { SkillRegistryFile } from '../registry/types';
import type { TextbausteinKatalog } from '../textbausteine/types';
import {
  PAKET_ARTEN, zeilenSchluessel,
  type Entscheidung, type Entscheidungen, type KuraturPaket, type PaketArt, type PaketZeile,
} from './typen';

/* -------------------------------------------------------------------------- */
/* Kanonischer Vergleich                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Stabile Zeichenkette eines Wertes: Objekt-Schlüssel sortiert, `undefined`
 * weggelassen, Array-Reihenfolge erhalten (sie ist bei Schritten und Regel-IDs
 * bedeutungstragend). `auslassen` greift auf JEDER Ebene — deshalb stehen dort
 * nur Feldnamen, die auch in der Tiefe dieselbe Bedeutung haben.
 */
export function kanonisch(wert: unknown, auslassen: ReadonlySet<string>): string {
  if (wert === null || typeof wert !== 'object') return JSON.stringify(wert ?? null);
  if (Array.isArray(wert)) return `[${wert.map(v => kanonisch(v, auslassen)).join(',')}]`;
  const eintraege = Object.entries(wert as Record<string, unknown>)
    .filter(([k, v]) => !auslassen.has(k) && v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${kanonisch(v, auslassen)}`);
  return `{${eintraege.join(',')}}`;
}

/**
 * Felder, die vom Vergleich ausgenommen sind — sie ändern sich beim Speichern
 * ohnehin und sagen nichts über den Inhalt.
 *
 * Bei Workflows fällt `id` heraus: der Workflow wird über seine ID zugeordnet
 * (dort also gleich), und die **Schritt**-IDs sollen den Vergleich nicht
 * verfälschen — sie werden beim Aktualisieren bewusst vom Ziel behalten
 * (`WorkflowRun.schritte` hängt daran). `parentStepId`/`qsZielStepId` bleiben
 * IM Vergleich: lieber einmal zu viel „geändert" melden als eine echte
 * Umhängung verschlucken.
 */
const AUSLASSEN: Record<PaketArt, ReadonlySet<string>> = {
  skill: new Set(['historie', 'version', 'geaendert_am']),
  regel: new Set(['geaendert_am', 'erstellt_am']),
  workflow: new Set(['version', 'id']),
  // `platzhalter` wird aus `text` abgeleitet — eine zweite, driftende Quelle im
  // Vergleich hätte nur Fehlalarme zur Folge.
  baustein: new Set(['historie', 'version', 'geaendertAm', 'geaendertVon', 'platzhalter']),
};

function istGleich(art: PaketArt, a: unknown, b: unknown): boolean {
  const aus = AUSLASSEN[art];
  return kanonisch(a, aus) === kanonisch(b, aus);
}

/* -------------------------------------------------------------------------- */
/* Zeilen                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Welche Entscheidungen eine Zeile zulässt.
 *
 * `kopie` gibt es nur für Skills und Workflows: eine kopierte **Regel** würde
 * niemand referenzieren, und ein kopierter **Baustein** bekäme eine ID, die der
 * sprechenden Katalog-Konvention (`G1.1`, `RNE-A2`) widerspricht.
 */
export function moeglicheEntscheidungen(art: PaketArt, zustand: PaketZeile['zustand']): Entscheidung[] {
  if (zustand === 'neu') return ['uebernehmen', 'ueberspringen'];
  if (zustand === 'identisch') return ['ueberspringen'];
  return art === 'skill' || art === 'workflow'
    ? ['aktualisieren', 'kopie', 'ueberspringen']
    : ['aktualisieren', 'ueberspringen'];
}

function baueZeile(
  art: PaketArt,
  id: string,
  name: string,
  paketEintrag: unknown,
  zielEintrag: unknown,
  versionen: { paket?: number; ziel?: number },
): PaketZeile {
  const zustand = zielEintrag === undefined
    ? 'neu'
    : istGleich(art, paketEintrag, zielEintrag) ? 'identisch' : 'geaendert';
  const moeglich = moeglicheEntscheidungen(art, zustand);
  return {
    art,
    id,
    name,
    zustand,
    vorschlag: moeglich[0]!,
    moeglich,
    ...(versionen.paket !== undefined ? { paketVersion: versionen.paket } : {}),
    ...(versionen.ziel !== undefined ? { zielVersion: versionen.ziel } : {}),
  };
}

/**
 * Stellt jeden Paket-Eintrag seinem Gegenstück im Ziel gegenüber. Einträge, die
 * es NUR im Ziel gibt, tauchen bewusst nicht auf — das Paket ergänzt und
 * aktualisiert, es räumt nicht auf.
 */
export function vergleichePaket(
  paket: KuraturPaket,
  file: SkillRegistryFile,
  katalog: TextbausteinKatalog | null,
): PaketZeile[] {
  const zielSkills = new Map(file.skills.map(s => [s.id, s]));
  const zielRegeln = new Map(file.regeln.map(r => [r.id, r]));
  const zielWorkflows = new Map((file.workflows ?? []).map(w => [w.id, w]));
  const zielBausteine = new Map((katalog?.bausteine ?? []).map(b => [b.id, b]));

  const zeilen: PaketZeile[] = [];
  for (const art of PAKET_ARTEN) {
    if (art === 'regel') {
      for (const r of paket.regeln) {
        zeilen.push(baueZeile('regel', r.id, r.name, r, zielRegeln.get(r.id), {}));
      }
    } else if (art === 'skill') {
      for (const s of paket.skills) {
        const ziel = zielSkills.get(s.id);
        zeilen.push(baueZeile('skill', s.id, s.name, s, ziel, { paket: s.version, ziel: ziel?.version }));
      }
    } else if (art === 'workflow') {
      for (const w of paket.workflows) {
        const ziel = zielWorkflows.get(w.id);
        zeilen.push(baueZeile('workflow', w.id, w.name, w, ziel, { paket: w.version, ziel: ziel?.version }));
      }
    } else {
      for (const b of paket.bausteine) {
        const ziel = zielBausteine.get(b.id);
        const name = b.thema ? `${b.id} — ${b.thema}` : b.id;
        zeilen.push(baueZeile('baustein', b.id, name, b, ziel, { paket: b.version, ziel: ziel?.version }));
      }
    }
  }
  return zeilen;
}

/** Vorbelegte Entscheidungen aus den Vorschlägen (Startzustand des Dialogs). */
export function vorbelegung(zeilen: PaketZeile[]): Entscheidungen {
  const out: Entscheidungen = {};
  for (const z of zeilen) out[zeilenSchluessel(z.art, z.id)] = z.vorschlag;
  return out;
}

/** Zählt die Zustände (Kopfzeile der Vorschau). */
export function zaehleZustaende(zeilen: PaketZeile[]): { neu: number; geaendert: number; identisch: number } {
  return {
    neu: zeilen.filter(z => z.zustand === 'neu').length,
    geaendert: zeilen.filter(z => z.zustand === 'geaendert').length,
    identisch: zeilen.filter(z => z.zustand === 'identisch').length,
  };
}
