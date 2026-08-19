/**
 * **Die Ebenen-Karte mit Live-Zahlen** — das Anzeige-Modell, rein und ohne React.
 *
 * Über einem Antrag liegen mehrere Angaben übereinander (Kürzel, Status,
 * Verfahrensschritt, Arbeitsliste, Fristen), und die Frage, die niemand
 * beantworten konnte, war nicht „wie heißen sie", sondern **was hängt woran**.
 * Das Doc dazu ist [status-achsen.md](../../../docs/architecture/status-achsen.md);
 * diese Datei rendert dieselbe Karte gegen die geltende Fassung.
 *
 * **Warum als Bildschirm und nicht nur als Doc.** Ein Doc beschreibt den Bauplan,
 * eine Abweichung findet es nicht. Katalog-Fassung 19 verschob im August 2026
 * 448 Anträge zwischen Arbeitslisten, und gemeldet hat es Wochen später ein
 * fremdes Modul. Die Zahlen hier stehen genau dort, wo kuratiert wird.
 *
 * **Zwei Spalten, die auseinanderfallen dürfen.** Die Tabelle „Verfahrensschritt
 * × Arbeitsliste" zeigt je Schritt, welche Arbeitslisten seine Codes tragen. Sie
 * ist der sichtbare Beleg der Entkopplung von v4.87: ein Schritt trägt oft
 * mehrere, und das ist richtig so — die Arbeitsliste hängt am Code.
 *
 * **Alles hier liest den ENTWURF, auch die Code-Zuordnung.** Bis v4.119 kamen
 * die Zeilen aus `v.zahPhasen` (Entwurf), die Zuordnung aber aus
 * `phaseFuerCode` — dem Snapshot der AKTIVEN Fassung. Ein im Baum umgehängter,
 * noch nicht gespeicherter Code blieb dadurch am alten Schritt stehen, ein neu
 * angelegter Schritt zeigte „0 Status", und die Seite widersprach dem Baum im
 * Nachbarreiter. `schnittVon` ist der entwurfsbezogene Weg und wird im selben
 * Hook bereits verwendet.
 */
import {
  kategorieFuerCode, zahPhasenVon, schnittVon, ruheGrund, hatSpalteAus,
  type MappingVersion, type StatusCategory, type ZahPhaseId,
} from '@/core/status';
import { KATEGORIE_REIHENFOLGE } from '@/core/utils/status-category-labels';

/** Eine Zeile der Herkunfts-Bilanz: was aus C16 kommt und was wir daraus machen. */
export interface EbenenZeile {
  /** Was die Ebene ist, in der Sprache der Oberfläche. */
  name: string;
  /** Wer sie pflegt — die eigentliche Auskunft dieser Seite. */
  pflege: string;
  /** Der Umfang, wie er gerade wirklich ist. */
  wert: string;
  /** Zusatz, wo eine Zahl allein irreführt. */
  hinweis?: string;
}

/** Arbeitslisten mit Code-Anzahl, in Anzeige-Reihenfolge der Kategorie-Achse. */
export type ArbeitslistenAnteile = { kategorie: StatusCategory; anzahl: number }[];

/** Ein Verfahrensschritt und die Arbeitslisten, die seine Codes tragen. */
export interface SchrittZeile {
  id: ZahPhaseId;
  label: string;
  codeAnzahl: number;
  arbeitslisten: ArbeitslistenAnteile;
}

/**
 * Die Codes, die neben dem Verfahren laufen.
 *
 * **Phasenlos heißt nicht Marker** — das ist ein eigenes Kennzeichen der Fassung
 * (`markerCodes`) — und es heißt erst recht nicht „Ohne Zuordnung": die
 * Arbeitsliste hängt am Code, nicht am Schritt. Deshalb trägt diese Gruppe
 * dieselbe Aufschlüsselung wie jeder Schritt, statt eines Satzes, der zwei
 * Dinge behauptet, die beide nicht folgen.
 */
export interface OhneSchritt {
  codeAnzahl: number;
  /** Wie viele davon die Fassung ausdrücklich als Marker führt. */
  markerAnzahl: number;
  arbeitslisten: ArbeitslistenAnteile;
}

export interface EbenenUebersicht {
  fremd: EbenenZeile[];
  eigen: EbenenZeile[];
  schritte: SchrittZeile[];
  ohneSchritt: OhneSchritt;
  /** Codes, deren Schritt die Fassung nicht (mehr) führt — sie fehlten sonst. */
  verwaist: number;
  fristen: EbenenZeile[];
}

/** Wie viele Statuswerte der Fassung einen gepflegten Zieltag tragen. */
function zieltageGepflegt(v: MappingVersion): number {
  const codes = new Set<number>();
  for (const w of v.werte) {
    if (w.code !== undefined && typeof w.zieltage === 'number') codes.add(w.code);
  }
  return codes.size;
}

/**
 * Von Zähl-Map zu Anzeige-Liste, **in Taxonomie-Reihenfolge**.
 *
 * `[...map]` liefert Einfüge-Reihenfolge, und die hängt daran, in welcher
 * Reihenfolge die Codes im Katalog stehen — „In Arbeit · Zu bearbeiten"
 * statt der Ordnung, die dieselben Namen überall sonst haben.
 */
function anteile(m: ReadonlyMap<StatusCategory, number>): ArbeitslistenAnteile {
  return KATEGORIE_REIHENFOLGE
    .filter(k => m.has(k))
    .map(kategorie => ({ kategorie, anzahl: m.get(kategorie)! }));
}

/**
 * Die ganze Karte aus der Fassung.
 *
 * `csvSpalten` entscheidet über die Ruhe-Achse (ein Kürzel ohne gemappte Spalte
 * kann nichts tragen). Fehlt sie, wird nicht geraten: dann steht dort keine Zahl,
 * sondern der Grund.
 *
 * `meilensteinFassung` kommt von außen, weil der Plan ein eigenes Sidecar ist —
 * `null` heißt „keine freigegebene Fassung", `undefined` „noch nicht geladen".
 *
 * `triggerAnzahl` ebenso: die Trigger reisen nicht in der Katalog-Fassung mit,
 * sondern in einer eigenen Sidecar (`trigger-share.ts`). Sie gehören trotzdem
 * auf diese Karte — sie sind die dritte Fremdebene, die
 * [status-achsen.md](../../../docs/architecture/status-achsen.md) nennt.
 */
export function baueEbenenUebersicht(
  v: MappingVersion,
  csvSpalten: ReadonlyMap<string, string[]>,
  meilensteinFassung: number | null | undefined,
  triggerAnzahl: number,
): EbenenUebersicht {
  const phasen = zahPhasenVon(v.zahPhasen);
  const bekannt = new Set(phasen.map(p => p.id));
  const hatSpalte = hatSpalteAus(csvSpalten);
  const schnitt = schnittVon(v);

  const kuerzel = v.felder.filter(f => f.code !== undefined && f.code !== '');
  const gruende = kuerzel.map(f => ruheGrund(f, hatSpalte(f)));
  const ruhendOhneSpalte = gruende.filter(g => g === 'nicht-im-export').length;
  const ruhendKuratiert = gruende.filter(g => g === 'kuratiert').length;

  // Codes je (Schritt, Arbeitsliste) — EINMAL je Code, obwohl jeder Code zweimal
  // im Katalog steht (TV- und Verbund-Feld).
  const codes = [...new Set(v.werte.flatMap(w => (w.code === undefined ? [] : [w.code])))];
  const jeSchritt = new Map<ZahPhaseId, Map<StatusCategory, number>>();
  const jeOhneSchritt = new Map<StatusCategory, number>();
  let ohneSchrittAnzahl = 0;
  let markerAnzahl = 0;
  let verwaist = 0;
  for (const code of codes) {
    const kat = kategorieFuerCode(code);
    const phase = schnitt.codeZuPhase.get(code) ?? null;
    // Zeigt die Zuordnung auf einen Schritt, den diese Fassung nicht führt, wird
    // sie wie „ohne Schritt" gelesen — aber gezählt, sonst verschwände der Code
    // zwischen den Zeilen und die Summe ginge nicht mehr auf (wie im Baum).
    const gefuehrt = phase !== null && bekannt.has(phase);
    if (phase !== null && !gefuehrt) verwaist += 1;
    if (!gefuehrt) {
      ohneSchrittAnzahl += 1;
      if (schnitt.markerCodes.has(code)) markerAnzahl += 1;
      jeOhneSchritt.set(kat, (jeOhneSchritt.get(kat) ?? 0) + 1);
      continue;
    }
    const m = jeSchritt.get(phase) ?? new Map<StatusCategory, number>();
    m.set(kat, (m.get(kat) ?? 0) + 1);
    jeSchritt.set(phase, m);
  }

  const schritte: SchrittZeile[] = phasen.map(p => {
    const arbeitslisten = anteile(jeSchritt.get(p.id) ?? new Map<StatusCategory, number>());
    return {
      id: p.id,
      label: p.label,
      codeAnzahl: arbeitslisten.reduce((s, a) => s + a.anzahl, 0),
      arbeitslisten,
    };
  });

  return {
    fremd: [
      {
        name: 'Kürzel',
        pflege: 'Kürzel-Zuarbeit aus C16',
        wert: `${kuerzel.length}`,
        hinweis: ruheHinweis(csvSpalten.size, ruhendOhneSpalte, ruhendKuratiert),
      },
      {
        name: 'Status',
        pflege: 'Nachtexport, gilt wie importiert',
        wert: `${codes.length}`,
        hinweis: 'Die App leitet keinen Status ab (Pitfall #44).',
      },
      {
        name: 'Trigger',
        pflege: 'Trigger-Tabelle aus C16, eigene Datei',
        wert: `${triggerAnzahl}`,
        hinweis: triggerAnzahl === 0
          ? 'Nicht importiert — ohne sie erklärt der Katalog keine Wirkung eines Kürzels.'
          : 'Sagt je Kürzel, welchen Status es setzt. Reist NICHT in der Katalog-Fassung mit.',
      },
    ],
    eigen: [
      {
        name: 'Verfahrensschritt (ZAH-Phase)',
        pflege: 'PL, jederzeit im Baum-Editor',
        wert: `${phasen.length}`,
        hinweis: 'Steuert Leiste, Gruppierung, Zieltage und Fristlauf — nicht die Arbeitsliste.',
      },
      {
        name: 'Arbeitsliste',
        pflege: 'niemand zur Laufzeit — sie steht im Code',
        wert: `${KATEGORIE_REIHENFOLGE.length}`,
        hinweis: 'Hängt am Statuscode. Ein neuer Zuschnitt kann sie nicht verschieben.',
      },
      {
        // Steht hier und nicht bei den Fremddaten: die Regeln sind unsere
        // Erfindung und werden im Reiter nebenan bearbeitet. C16 kennt sie
        // nicht — sie neben „Status" zu stellen las sich wie ein Import.
        name: 'To-do-Regeln',
        pflege: 'PL, im Reiter To-do-Regeln',
        wert: `${v.todoRegeln?.length ?? 0}`,
        hinweis: 'Legen fest, wer als Nächstes dran ist — ohne den amtlichen Status zu ändern.',
      },
    ],
    schritte,
    ohneSchritt: {
      codeAnzahl: ohneSchrittAnzahl,
      markerAnzahl,
      arbeitslisten: anteile(jeOhneSchritt),
    },
    verwaist,
    fristen: [
      {
        name: 'Zieltage je Status',
        pflege: 'PL — gilt mit dem Speichern',
        wert: `${zieltageGepflegt(v)} von ${codes.length}`,
        hinweis: 'Grundlage des Stillstands-Wächters. Ohne Zieltag urteilt er „nicht prüfbar".',
      },
      {
        name: 'Meilenstein-Plan',
        pflege: 'PL — gilt erst mit der FREIGABE',
        wert: meilensteinFassung === undefined
          ? '…'
          : meilensteinFassung === null ? 'keine freigegeben' : `Fassung ${meilensteinFassung}`,
        hinweis: 'Gespeichert ist nicht freigegeben — die häufigste Ursache für '
          + '„meine neuen Meilensteine kommen nicht an".',
      },
    ],
  };
}

/**
 * Die Ruhe-Zeile — **mit dem Grund, der wirklich zutrifft.**
 *
 * `ruhtFeld` fasst beide Gründe zusammen; die Klammer nannte trotzdem nur
 * „keine Spalte im Export". Für ein von der PL stillgelegtes Kürzel ist das
 * schlicht falsch, und `ruhende-kuerzel.ts` verbietet die Zusammenfassung
 * ausdrücklich: das eine heißt „wir sehen es nie", das andere „jemand hat
 * entschieden".
 */
function ruheHinweis(
  spaltenAnzahl: number, ohneSpalte: number, kuratiert: number,
): string {
  if (spaltenAnzahl === 0) return 'Ruhe-Anteil unbekannt — keine CSV-Spalten geladen.';
  if (ohneSpalte + kuratiert === 0) return 'Keines ruht — jedes Kürzel ist im Blick.';
  const teile: string[] = [];
  if (ohneSpalte > 0) teile.push(`${ohneSpalte} ohne Spalte im Export (können nichts tragen)`);
  if (kuratiert > 0) teile.push(`${kuratiert} von der PL stillgelegt`);
  return `${ohneSpalte + kuratiert} ruhen: ${teile.join(', ')}.`;
}
