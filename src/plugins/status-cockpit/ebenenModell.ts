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
 */
import {
  kategorieFuerCode, zahPhasenVon, phaseFuerCode, ruhtFeld, hatSpalteAus,
  type MappingVersion, type StatusCategory, type ZahPhaseId,
} from '@/core/status';

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

/** Ein Verfahrensschritt und die Arbeitslisten, die seine Codes tragen. */
export interface SchrittZeile {
  id: ZahPhaseId;
  label: string;
  codeAnzahl: number;
  /** In Anzeige-Reihenfolge der Kategorie-Achse, je mit Code-Anzahl. */
  arbeitslisten: { kategorie: StatusCategory; anzahl: number }[];
}

export interface EbenenUebersicht {
  fremd: EbenenZeile[];
  eigen: EbenenZeile[];
  schritte: SchrittZeile[];
  /** Codes ohne Verfahrensschritt (Marker) — sie laufen neben dem Verfahren. */
  ohneSchritt: number;
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
 * Die ganze Karte aus der Fassung.
 *
 * `csvSpalten` entscheidet über die Ruhe-Achse (ein Kürzel ohne gemappte Spalte
 * kann nichts tragen). Fehlt sie, wird nicht geraten: dann steht dort keine Zahl,
 * sondern der Grund.
 *
 * `meilensteinFassung` kommt von außen, weil der Plan ein eigenes Sidecar ist —
 * `null` heißt „keine freigegebene Fassung", `undefined` „noch nicht geladen".
 */
export function baueEbenenUebersicht(
  v: MappingVersion,
  csvSpalten: ReadonlyMap<string, string[]>,
  meilensteinFassung: number | null | undefined,
): EbenenUebersicht {
  const phasen = zahPhasenVon(v.zahPhasen);
  const hatSpalte = hatSpalteAus(csvSpalten);

  const kuerzel = v.felder.filter(f => f.code !== undefined && f.code !== '');
  const ruhend = kuerzel.filter(f => ruhtFeld(f, hatSpalte(f))).length;

  // Codes je (Schritt, Arbeitsliste) — EINMAL je Code, obwohl jeder Code zweimal
  // im Katalog steht (TV- und Verbund-Feld).
  const codes = [...new Set(v.werte.flatMap(w => (w.code === undefined ? [] : [w.code])))];
  const jeSchritt = new Map<ZahPhaseId, Map<StatusCategory, number>>();
  let ohneSchritt = 0;
  for (const code of codes) {
    const phase = phaseFuerCode(code);
    if (phase === null) { ohneSchritt += 1; continue; }
    const kat = kategorieFuerCode(code);
    const m = jeSchritt.get(phase) ?? new Map<StatusCategory, number>();
    m.set(kat, (m.get(kat) ?? 0) + 1);
    jeSchritt.set(phase, m);
  }

  const schritte: SchrittZeile[] = phasen.map(p => {
    const m = jeSchritt.get(p.id) ?? new Map<StatusCategory, number>();
    const arbeitslisten = [...m].map(([kategorie, anzahl]) => ({ kategorie, anzahl }));
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
        hinweis: csvSpalten.size === 0
          ? 'Ruhe-Anteil unbekannt — keine CSV-Spalten geladen.'
          : `${ruhend} ruhen (keine Spalte im Export — sie können nichts tragen).`,
      },
      {
        name: 'Status',
        pflege: 'Nachtexport, gilt wie importiert',
        wert: `${codes.length}`,
        hinweis: 'Die App leitet keinen Status ab (Pitfall #44).',
      },
      {
        name: 'To-do-Regeln',
        pflege: 'PL, im Reiter To-do-Regeln',
        wert: `${v.todoRegeln?.length ?? 0}`,
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
        wert: '9',
        hinweis: 'Hängt am Statuscode. Ein neuer Zuschnitt kann sie nicht verschieben.',
      },
    ],
    schritte,
    ohneSchritt,
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
