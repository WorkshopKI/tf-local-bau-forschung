/**
 * Der **Vorgangsverlauf** — die Fristrechnung als nachprüfbare Aufstellung.
 * Rein, ohne React.
 *
 * **Was hier gezeigt wird, ist eine Herleitung, keine Aussage.** Jede Zeile
 * nennt einen Eingabewert samt Herkunft, die letzten beiden das Ergebnis. Wer
 * die Zahl im Kopf der Karte anzweifelt, liest sie hier nach — deshalb steht
 * das Feldkürzel des Fachsystems (`D_AAE`) daneben, nicht nur ein Datum.
 *
 * **Zwei Fristen, zwei Herkünfte — und die verwechselt man leicht.** Die
 * *Bearbeitungsfrist* ist die Regelfrist ab dem maßgeblichen Datum
 * (`ANTRAG_SLA_DAYS`, gilt für alle Anträge); die *Zieltage des Schritts*
 * kommen aus dem Statuskatalog und gelten nur für den Status, in dem der
 * Vorgang gerade steht. Beide stehen deshalb mit ihrer Quelle da.
 *
 * Gerechnet wird nichts, was schon gerechnet ist — die einzige Arithmetik ist
 * die Bearbeitungsfrist als Differenz Basis→Ziel, damit keine Zahl fest
 * verdrahtet wird (Guard `no-inline-frist-arithmetik`).
 */
import type { FristBezug } from '@/core/status/frist-bezug';
import { tageZwischen, type WaechterErgebnis } from '@/core/status/waechter';
import { formatDatum } from '@/plugins/meilensteine/labels';
import { AMPEL_COLOR } from '../../eingangAmpel';
import { FRIST_AMPEL_STUFEN, HALT_HERKUNFT, HALT_OHNE, haltBelastbar } from '../../fristAnzeige';

/** Eine Zeile des Rasters. */
export interface RasterZeile {
  label: string;
  /** ISO-Tag oder fertiger Text — Datumswerte formatiert der Renderer. */
  wert: string;
  /** Feldkürzel des Fachsystems, Mono direkt hinter dem Wert. */
  feld?: string;
  /** Fließtext-Nachsatz („— das spätere von beiden"). */
  zusatz?: string;
  /** Ergebniszeile — der Wert steht betont. */
  stark?: true;
  /** Hergeleitet statt belegt — leiser gesetzt. */
  weich?: true;
}

export interface LegendenPunkt {
  farbe: string;
  text: string;
}

export interface VorgangsverlaufModell {
  zeilen: RasterZeile[];
  /** Die Schwellen des Ampelpunktes in der Frist-Spalte. */
  legende: LegendenPunkt[];
}

export interface VorgangsverlaufEingabe {
  bezug: FristBezug;
  /** Zieltage des laufenden Schritts; `null` = keine gepflegt. */
  zieltage: number | null;
  waechter: WaechterErgebnis | null;
}

/** Was die Zeile „Zieltage des Schritts" an Stillstands-Kontext trägt. */
function zieltageZusatz(zieltage: number | null, w: WaechterErgebnis | null): string {
  const teile = [zieltage === null
    ? 'für diesen Status sind keine gepflegt'
    : 'Grenze für Stillstand, aus dem Statuskatalog'];
  if (w?.letzteAktivitaet != null) {
    teile.push(
      `letzte Aktivität ${formatDatum(w.letzteAktivitaet)}`
      + `${w.belegt ? '' : ' (genähert aus dem Export)'}`,
    );
  }
  return teile.join(' · ');
}

export function baueVorgangsverlauf(e: VorgangsverlaufEingabe): VorgangsverlaufModell {
  const { ergebnis: erg, antragsdatum, alleAntraegeDa, halt } = e.bezug;
  const zeilen: RasterZeile[] = [
    {
      label: 'Antragseingang',
      wert: antragsdatum ?? '—',
      feld: 'D_AAE',
      ...(erg.basisFeld === 'D_AAE' ? {} : { weich: true as const }),
    },
    {
      label: 'Alle Anträge da',
      wert: alleAntraegeDa ?? '—',
      ...(alleAntraegeDa === null
        ? { zusatz: 'D_XTE nicht gesetzt oder nicht gemappt' }
        : { feld: 'D_XTE' }),
      ...(erg.basisFeld === 'D_XTE' ? {} : { weich: true as const }),
    },
  ];

  if (erg.basisFeld !== undefined && erg.basisDatum !== undefined) {
    zeilen.push({
      label: 'Maßgeblich',
      wert: erg.basisDatum,
      zusatz: 'das spätere von beiden trägt die Uhr',
      stark: true,
    });
  }

  const frist = erg.basisDatum !== undefined && erg.zielDatum !== undefined
    ? tageZwischen(erg.basisDatum, erg.zielDatum)
    : null;
  zeilen.push({
    label: 'Bearbeitungsfrist',
    wert: frist === null ? '—' : `${frist} T`,
    zusatz: frist === null
      ? 'ohne Basis oder Ziel nicht bestimmbar'
      : 'Regelfrist ab dem maßgeblichen Datum',
    ...(frist === null ? { weich: true as const } : {}),
  });

  if (erg.zielDatum !== undefined) {
    zeilen.push({
      label: 'Zieltermin',
      wert: erg.zielDatum,
      zusatz: 'maßgebliches Datum plus Bearbeitungsfrist',
      stark: true,
    });
  }

  if (erg.zustand === 'angehalten') {
    zeilen.push({
      label: 'Haltedatum',
      wert: halt?.tag ?? 'unbekannt',
      zusatz: halt ? HALT_HERKUNFT[halt.herkunft] : HALT_OHNE,
      ...(halt && haltBelastbar(halt.herkunft) ? {} : { weich: true as const }),
    });
  }

  zeilen.push({
    label: 'Zieltage des Schritts',
    wert: e.zieltage === null ? '—' : `${e.zieltage} T`,
    zusatz: zieltageZusatz(e.zieltage, e.waechter),
    ...(e.zieltage === null ? { weich: true as const } : {}),
  });

  return {
    zeilen,
    legende: FRIST_AMPEL_STUFEN.map(s => ({ farbe: AMPEL_COLOR[s.ampel], text: s.text })),
  };
}
