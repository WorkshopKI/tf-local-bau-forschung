/**
 * Fundstellen je Prüfkriterium — deterministisch aus dem Aspekt-Mapping.
 *
 * Der Weg ist bewusst indirekt: das Aspekt-Mapping der Antrag-Aufbereitung
 * ordnet VB-Sektionen den Prüfaspekten A–J zu (ein interner LLM-Lauf, der nur
 * auswählt und nichts umformuliert). Diese Datei bildet Kriterium → Aspekte →
 * Sektionen ab und ist damit selbst rein.
 *
 * Orama wird bewusst NICHT verwendet: der Suchindex trägt weder einen
 * Überschriftenpfad noch eine Seitenzahl noch einen Antragsbezug — für
 * Fundstellen in genau einem Dokument ist die Gliederung die bessere Grundlage.
 */
// Direkt aus den Modulen statt über das Aufbereitungs-Barrel: dieses zieht die
// gesamte Aufbereitung samt PDF-Stack nach, die der MAP nicht braucht.
import type { AspektMapping } from '@/plugins/antraege/aufbereitung/aspekte';
import { sektionZuAspekte } from '@/plugins/antraege/aufbereitung/aspekte';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import type { MapChecklistenItem } from '../checkliste/typen';

export interface Fundstelle {
  sektionId: string;
  titel: string;
  nummer?: string;
  /** Zeichen-Span im VB-Markdown — der Lesemodus springt darauf. */
  start: number;
  end: number;
  /** Prüfaspekte, über die diese Sektion gefunden wurde. */
  ueberAspekte: string[];
  /** Erste Zeilen der Sektion als Vorschau. */
  auszug: string;
}

/** Länge des Vorschau-Auszugs. */
const AUSZUG_ZEICHEN = 240;

function macheAuszug(markdown: string, sektion: VbSektion): string {
  const roh = markdown.slice(sektion.start, sektion.end);
  // Überschriftenzeile überspringen — sie steht bereits als Titel daneben.
  const ohneUeberschrift = roh.replace(/^[^\n]*\n/, '').trim();
  const text = ohneUeberschrift.replace(/\s+/g, ' ');
  return text.length > AUSZUG_ZEICHEN ? `${text.slice(0, AUSZUG_ZEICHEN)}…` : text;
}

/**
 * Sektionen zu einer Aspekt-Liste. Reihenfolge folgt der Gliederung, nicht der
 * Aspekt-Liste — der Prüfer liest das Dokument von vorn nach hinten. Rein.
 */
export function fundstellenFuerAspekte(
  aspekte: readonly string[],
  mapping: AspektMapping | null,
  gliederung: readonly VbSektion[],
  markdown: string,
): Fundstelle[] {
  if (mapping === null || aspekte.length === 0) return [];

  const proSektion = sektionZuAspekte(mapping);
  const gesucht = new Set(aspekte);

  return gliederung
    .map(sektion => {
      const treffer = (proSektion[sektion.id] ?? []).filter(a => gesucht.has(a));
      if (treffer.length === 0) return null;
      return {
        sektionId: sektion.id,
        titel: sektion.titel,
        ...(sektion.nummer !== undefined ? { nummer: sektion.nummer } : {}),
        start: sektion.start,
        end: sektion.end,
        ueberAspekte: treffer,
        auszug: macheAuszug(markdown, sektion),
      } satisfies Fundstelle;
    })
    .filter((f): f is Fundstelle => f !== null);
}

/** Fundstellen zu einem Prüfkriterium. Rein. */
export function fundstellenFuerItem(
  item: MapChecklistenItem,
  mapping: AspektMapping | null,
  gliederung: readonly VbSektion[],
  markdown: string,
): Fundstelle[] {
  return fundstellenFuerAspekte(item.aspekte ?? [], mapping, gliederung, markdown);
}
