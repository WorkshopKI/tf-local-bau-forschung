/**
 * Was aus einer Klärung herausgeht — der einzige Weg, auf dem ein Ergebnis die
 * App verlässt.
 *
 * **Nichts hier schreibt zurück.** Weder in die Katalog-Fassung noch in den Seed.
 * Ein Mensch liest das Ergebnis, entscheidet und ändert den Seed; das ist eine
 * Programm-Änderung mit Release, keine Kuration zur Laufzeit.
 *
 * Drei Ausgaben, weil drei verschiedene Leute etwas anderes brauchen:
 * - **Arbeitsmappe** für den Termin — alle Stimmen nebeneinander, plus Rohdaten,
 *   damit jede Zahl nachvollziehbar bleibt;
 * - **Markdown-Kurzfassung** für das Protokoll — nur was abweicht oder
 *   kommentiert wurde;
 * - **Seed-Änderungen** für die Umsetzung — pastefähige Zeilen für die
 *   Phasen-Tabelle. Ohne sie wäre „ein Export" etwas, das jemand abtippt. Sie
 *   liegen seit v2.417 in `seedExport.ts`, weil sie ihre Zeilen aus der
 *   **Fassung** bauen und nicht aus den Antworten — eine andere Quelle, eine
 *   andere Datei.
 *
 * Rein bis auf `schreibeArbeitsmappe`/`ladeHerunter`; alle Zeilen-Erzeugung ist
 * testbar ohne Browser.
 */
import { schreibeArbeitsmappe, zeitstempel, type Blatt } from '@/core/status/export/arbeitsmappe';
import type { KatalogDrift, ZahPhase } from '@/core/status';
import { konsens } from './konsens';
import { beitraegeSortiert } from './fold';
import { zielLabel, kurzDatum } from './labels';
import { urteilSchluessel, type Klaerung, type KlaerungPunkt, type KlaerungStand } from './typen';

/** Alles, was eine Ausgabe braucht. */
export interface ExportEingabe {
  klaerung: Klaerung;
  punkte: readonly KlaerungPunkt[];
  stand: KlaerungStand;
  autoren: readonly string[];
  vorkommen: ReadonlyMap<number, number> | null;
  bestandVom: string | null;
  /** ISO-Zeitpunkt des Exports — von außen, nie eine Uhr hier drin. */
  jetztIso: string;
  /**
   * Die Bilanz der Katalog-Fassung gegenüber der Auslieferung; `null`, solange
   * keine Fassung geladen ist. Nur die Seed-Änderungen lesen sie — Arbeitsmappe
   * und Kurzfassung berichten weiter über die ANTWORTEN.
   */
  drift: KatalogDrift | null;
  /** Die Phasen der Fassung — der Seed-Export schreibt sie als neue Tabelle aus. */
  fassungPhasen: readonly ZahPhase[] | undefined;
}

function kopfzeilen(e: ExportEingabe): string[] {
  return [
    e.klaerung.titel,
    `Klärung vom ${kurzDatum(e.klaerung.datum)} · Export ${kurzDatum(e.jetztIso)}`,
    e.bestandVom === null
      ? 'Vorkommen: nicht gezählt'
      : `Vorkommen aus dem Bestand vom ${kurzDatum(e.bestandVom)} (ganzer Bestand, ohne Betrachtungsbereich)`,
    `Beteiligt: ${e.autoren.length === 0 ? '—' : e.autoren.join(', ')}`,
  ];
}

/** Wie eine Person zu einem Punkt steht, als lesbare Zelle. */
function zelleFuer(stand: KlaerungStand, punktId: string, autor: string): string {
  const u = stand.urteile.get(urteilSchluessel(autor, punktId));
  if (u === undefined) return '';
  if (u.urteil === 'zurueckgezogen') return '(zurückgezogen)';
  if (u.urteil === 'unklar') return 'unklar';
  if (u.urteil === 'passt') return 'passt';
  return u.zielWert === undefined ? 'gehört woandershin (offen)' : `→ ${zielLabel(u.zielWert)}`;
}

/** Blatt „Zuordnungen": eine Zeile je Statuscode, eine Spalte je Person. */
export function blattZuordnungen(e: ExportEingabe): Blatt {
  const zeilen = e.punkte
    .filter(p => p.art === 'phasenzuordnung')
    .map(p => {
      const b = konsens(e.stand, p, e.autoren);
      return [
        zielLabel(p.seedZiel),
        p.code ?? '',
        p.bezeichnung ?? p.titel,
        e.vorkommen?.get(p.code ?? -1) ?? '',
        ...e.autoren.map(a => zelleFuer(e.stand, p.id, a)),
        b.zustand === 'strittig' ? 'ja' : 'nein',
        b.unklarVon.length === 0 ? '' : b.unklarVon.join(', '),
        b.zustand === 'einig' && b.ziel !== p.seedZiel ? zielLabel(b.ziel) : '',
        (e.stand.kommentare.get(p.id) ?? []).length,
      ];
    });

  return {
    name: 'Zuordnungen',
    kopf: kopfzeilen(e),
    spalten: [
      'ZAH-Phase (ausgeliefert)', 'Code', 'Bezeichnung', 'Vorgänge',
      ...e.autoren,
      'strittig', 'Rückfrage von', 'Konsens abweichend', 'Beiträge',
    ],
    zeilen,
  };
}

/** Blatt „Grundsatzfragen": Frage, Begründung, und jeder Beitrag als Zeile. */
export function blattGrundsatzfragen(e: ExportEingabe): Blatt {
  const zeilen: (string | number)[][] = [];
  for (const p of e.punkte.filter(x => x.art === 'freitext')) {
    const beitraege = beitraegeSortiert(e.stand, p.id);
    if (beitraege.length === 0) {
      zeilen.push([p.titel, p.zusatz ?? '', '', '', '(kein Beitrag)']);
      continue;
    }
    for (const b of beitraege) zeilen.push([p.titel, p.zusatz ?? '', b.autor, kurzDatum(b.ts), b.text]);
  }
  return {
    name: 'Grundsatzfragen',
    kopf: kopfzeilen(e),
    spalten: ['Frage', 'Begründung', 'Name', 'Datum', 'Beitrag'],
    zeilen,
  };
}

/** Blatt „Rohdaten": jede Äußerung einzeln — damit jede Zahl belegbar bleibt. */
export function blattRohdaten(e: ExportEingabe): Blatt {
  const zeilen: (string | number)[][] = [];
  for (const p of e.punkte) {
    for (const a of e.autoren) {
      const u = e.stand.urteile.get(urteilSchluessel(a, p.id));
      if (u !== undefined) {
        zeilen.push([p.id, p.titel, a, 'Urteil', u.urteil, zielLabel(u.zielWert), kurzDatum(u.ts)]);
      }
    }
    for (const b of beitraegeSortiert(e.stand, p.id)) {
      zeilen.push([p.id, p.titel, b.autor, 'Beitrag', b.text, '', kurzDatum(b.ts)]);
    }
  }
  return {
    name: 'Rohdaten',
    kopf: kopfzeilen(e),
    spalten: ['Punkt', 'Titel', 'Name', 'Art', 'Wert', 'Zielphase', 'Datum'],
    zeilen,
  };
}

/** Die Markdown-Kurzfassung: nur Abweichungen und kommentierte Fragen. */
export function baueKurzfassung(e: ExportEingabe): string {
  const zeilen: string[] = [
    `# ${e.klaerung.titel}`,
    '',
    ...kopfzeilen(e).slice(1).map(z => `${z}  `),
    '',
    '## Abweichende Zuordnungen',
    '',
  ];

  const abweichend = e.punkte
    .filter(p => p.art === 'phasenzuordnung')
    .map(p => ({ p, b: konsens(e.stand, p, e.autoren) }))
    .filter(({ p, b }) => b.zustand === 'strittig'
      || (b.zustand === 'einig' && b.ziel !== p.seedZiel)
      || b.unklarVon.length > 0);

  if (abweichend.length === 0) {
    zeilen.push('Keine — alle beantworteten Zuordnungen bestätigen den Auslieferungsschnitt.', '');
  }
  for (const { p, b } of abweichend) {
    const stimmen = e.autoren
      .map(a => ({ a, wert: zelleFuer(e.stand, p.id, a) }))
      .filter(x => x.wert !== '')
      .map(x => `${x.a}: ${x.wert}`)
      .join(' · ');
    const urteilText = b.zustand === 'strittig'
      ? '**strittig**'
      : (b.zustand === 'einig' ? `einig → **${zielLabel(b.ziel)}**` : 'offen');
    zeilen.push(`- **${p.code} ${p.bezeichnung ?? ''}** (heute ${zielLabel(p.seedZiel)}) — ${urteilText}`);
    if (stimmen !== '') zeilen.push(`  - ${stimmen}`);
    for (const k of beitraegeSortiert(e.stand, p.id)) zeilen.push(`  - ${k.autor}: ${k.text}`);
  }

  zeilen.push('', '## Grundsatzfragen mit Beiträgen', '');
  const kommentiert = e.punkte
    .filter(p => p.art === 'freitext' && beitraegeSortiert(e.stand, p.id).length > 0);
  if (kommentiert.length === 0) zeilen.push('Keine beantwortet.', '');
  for (const p of kommentiert) {
    zeilen.push(`### ${p.titel}`, '');
    for (const b of beitraegeSortiert(e.stand, p.id)) zeilen.push(`- **${b.autor}**: ${b.text}`);
    zeilen.push('');
  }

  return zeilen.join('\n');
}

/** Alle drei Blätter in einer Mappe. */
export function baueBlaetter(e: ExportEingabe): Blatt[] {
  return [blattZuordnungen(e), blattGrundsatzfragen(e), blattRohdaten(e)];
}

/** Stößt den Download einer Textdatei an — ohne Netz, `file://`-tauglich.
 *  Exportiert, weil `seedExport.ts` denselben Weg nimmt. */
export function ladeHerunter(text: string, dateiname: string, typ: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${typ};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportiereArbeitsmappe(e: ExportEingabe): void {
  schreibeArbeitsmappe(baueBlaetter(e), `klaerung-${e.klaerung.klaerungId}-${zeitstempel(new Date(e.jetztIso))}.xlsx`);
}

export function exportiereKurzfassung(e: ExportEingabe): void {
  ladeHerunter(
    baueKurzfassung(e),
    `klaerung-${e.klaerung.klaerungId}-${zeitstempel(new Date(e.jetztIso))}.md`,
    'text/markdown',
  );
}
