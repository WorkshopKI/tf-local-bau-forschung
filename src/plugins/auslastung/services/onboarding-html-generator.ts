/**
 * Generiert die Standalone-Kompetenz-Onboarding-HTML.
 *
 * Pipeline:
 *  1. Antraege nach Deskriptoren-Kategorie gruppieren
 *  2. Pro Kategorie 2-3 repraesentative auswaehlen (laengste Beschreibung)
 *  3. ONBOARDING_CONFIG aus Ueberkategorien + Deskriptoren-Mapping bauen
 *  4. Template laden (Vite ?raw-Import)
 *  5. Platzhalter ersetzen: XLSX-Script + JSON-Blob
 *  6. Als Blob -> Download als `kompetenz-onboarding.html`
 */
import type { Antrag } from '@/core/services/csv/types';
import type { UeberKategorie } from '../types';
import {
  CANONICAL_AKTENZEICHEN,
  CANONICAL_TITEL,
  CANONICAL_VERBUND_TITEL,
  FIELD_PROJEKTBESCHREIBUNG,
} from '../types';
import { readAntragDeskriptoren } from './profil-aggregator';

import templateHtml from '../../../../tools/kompetenz-onboarding/template.html?raw';
import xlsxMiniScript from 'xlsx/dist/xlsx.mini.min.js?raw';

export interface OnboardingAntragJson {
  id: string;
  kategorie: string;
  ueberKategorie?: string;
  vbTitel: string;
  tvTitel?: string;
  zusammenfassung: string;
}

export interface OnboardingConfigJson {
  ueberKategorien: Array<{ id: string; name: string; farbe: string }>;
  /** Deskriptoren-Kategorie -> Ueberkategorie-IDs. */
  ueberKategorieMapping: Record<string, string[]>;
}

export interface OnboardingBlob {
  config: OnboardingConfigJson;
  antraege: OnboardingAntragJson[];
}

export interface GeneratorInput {
  antraege: Antrag[];
  kategorien: UeberKategorie[];
  /** Max Antraege im Onboarding. Default 60. */
  maxAntraege?: number;
  /** Max Antraege pro Deskriptoren-Kategorie. Default 3. */
  maxProKategorie?: number;
}

/**
 * Selektiert pro Deskriptoren-Kategorie die N informationsreichsten Antraege.
 * Kriterium: Laenge von `projektbeschreibung_text` (informationsreich).
 */
export function selectRepresentativeAntraege(
  antraege: Antrag[],
  maxProKategorie: number,
  maxTotal: number,
): Antrag[] {
  // Gruppieren nach erster Deskriptoren-Kategorie
  const byKategorie = new Map<string, Antrag[]>();
  for (const a of antraege) {
    const desc = readAntragDeskriptoren(a);
    if (desc.length === 0) continue;
    const primary = desc[0]!;
    const list = byKategorie.get(primary) ?? [];
    list.push(a);
    byKategorie.set(primary, list);
  }
  // Pro Kategorie sortieren + top-N
  const selected: Antrag[] = [];
  for (const [, list] of byKategorie.entries()) {
    list.sort((a, b) => {
      const lenA = String(a[FIELD_PROJEKTBESCHREIBUNG] ?? '').length;
      const lenB = String(b[FIELD_PROJEKTBESCHREIBUNG] ?? '').length;
      return lenB - lenA;
    });
    for (let i = 0; i < Math.min(maxProKategorie, list.length); i++) {
      selected.push(list[i]!);
      if (selected.length >= maxTotal) break;
    }
    if (selected.length >= maxTotal) break;
  }
  return selected;
}

/** Hex-Farben fuer Pill-Klassen — exportiert fuer das HTML-Template. */
const FARB_TO_HEX: Record<string, string> = {
  blue: '#3B82F6',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#EF4444',
  violet: '#8B5CF6',
  sky: '#0EA5E9',
  slate: '#64748B',
};

export function buildOnboardingBlob(input: GeneratorInput): OnboardingBlob {
  const maxAntraege = input.maxAntraege ?? 60;
  const maxProKategorie = input.maxProKategorie ?? 3;
  const selected = selectRepresentativeAntraege(input.antraege, maxProKategorie, maxAntraege);

  // ueberKategorieMapping aus den Kategorien rueckwaerts ableiten
  const mapping: Record<string, string[]> = {};
  for (const k of input.kategorien) {
    for (const d of k.deskriptorenMapping) {
      const key = d.toLowerCase();
      if (!mapping[key]) mapping[key] = [];
      if (!mapping[key].includes(k.id)) mapping[key].push(k.id);
    }
  }

  const antraegeOut: OnboardingAntragJson[] = selected.map(a => {
    const desc = readAntragDeskriptoren(a);
    const primary = desc[0]!;
    const uebers = mapping[primary] ?? [];
    return {
      id: String(a[CANONICAL_AKTENZEICHEN] ?? a.aktenzeichen),
      kategorie: primary,
      ueberKategorie: uebers[0],
      vbTitel: String(a[CANONICAL_VERBUND_TITEL] ?? a[CANONICAL_TITEL] ?? '—'),
      tvTitel: typeof a[CANONICAL_TITEL] === 'string' ? a[CANONICAL_TITEL] as string : undefined,
      zusammenfassung: String(a[FIELD_PROJEKTBESCHREIBUNG] ?? '').slice(0, 600),
    };
  });

  const configOut: OnboardingConfigJson = {
    ueberKategorien: input.kategorien.map(k => ({
      id: k.id,
      name: k.name,
      farbe: FARB_TO_HEX[k.farbe] ?? '#64748B',
    })),
    ueberKategorieMapping: mapping,
  };

  return { config: configOut, antraege: antraegeOut };
}

/**
 * Generiert das HTML als Blob — bereit zum Download.
 */
export function generateOnboardingHtml(input: GeneratorInput): Blob {
  const blob = buildOnboardingBlob(input);
  const json = JSON.stringify(blob);
  let html = templateHtml;
  // XLSX-Skript ersetzen
  html = html.replace('/*{{XLSX_SCRIPT}}*/', xlsxMiniScript).replace('<!--{{XLSX_SCRIPT}}-->', xlsxMiniScript);
  // JSON-Blob ersetzen — JSON wird direkt als JS-Literal injiziert
  html = html.replace('<!--{{ONBOARDING_DATA}}-->', json);
  return new Blob([html], { type: 'text/html' });
}

/** Triggert den Download. */
export function downloadOnboardingHtml(input: GeneratorInput): void {
  const blob = generateOnboardingHtml(input);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kompetenz-onboarding.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
