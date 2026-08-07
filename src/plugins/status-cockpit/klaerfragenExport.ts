/**
 * Die **Arbeitsmappe, die reihum geht**. Ihr Aufbau folgt genau daraus:
 * mehrere Personen bearbeiten sie nacheinander, wochenlang, außerhalb der App.
 *
 * - **Ein Blatt „Fragen"**, eine Zeile je Fall, damit jede Antwort an ihrem
 *   Gegenstand steht. Sortiert nach Herkunft, darin nach Vorkommen absteigend —
 *   wer seinen Teil filtert, arbeitet von oben ab.
 * - **Kontext lesbar, ohne dass jemand Spalten zieht.** Wer eine
 *   herumgereichte Datei öffnet, richtet sie nicht ein; steht der Kontext nicht
 *   da, wird geraten.
 * - **Vorgaben gesperrt, Antwortspalten entsperrt und gefüllt.** Die ID trägt
 *   die spätere Zuordnung; geht sie verloren, ist die Antwort wertlos.
 *
 * Rein bis auf den Schreibvorgang: `baueBlaetter`/`baueVeredelung` sind ohne
 * Browser testbar.
 */
import { zeitstempel, type Blatt } from '@/core/status/export/arbeitsmappe';
import {
  schreibeVeredelteArbeitsmappe,
  type BlattVeredelung, type Validierung, type VeredelungsBericht,
} from '@/core/status/export/arbeitsmappe-veredelung';
import {
  HERKUENFTE, HERKUNFT_ADRESSAT, HERKUNFT_LABEL,
  type Klaerfrage, type KlaerfragenBestand,
} from '@/core/status/klaerfragen';

/** Spalten des Blattes „Fragen" — die Reihenfolge ist die Leserichtung. */
const SPALTEN = [
  'ID', 'Herkunft', 'Betrifft', 'Frage', 'Kontext', 'Vorkommen', 'Antwort', 'Name', 'Datum',
] as const;

const BREITEN = [30, 24, 22, 44, 70, 11, 34, 16, 12];
/**
 * 1-basiert: alles Textliche außer der Zahlenspalte.
 *
 * Anfangs brachen nur Frage und Kontext um — im geöffneten Excel schnitt das die
 * **ID** ab (`bedeutung-nw-fue:A…`) und die Herkunft mitten im Wort. Die ID ist
 * der Schlüssel, über den die Antworten zurückgeordnet werden; sie halb
 * anzuzeigen lädt dazu ein, sie „aufzuräumen". Breiter machen ginge auch, drängte
 * aber die Antwortspalte aus dem Bild — und wer eine herumgereichte Datei öffnet,
 * scrollt nicht erst nach rechts.
 */
const UMBRUCH = [1, 2, 3, 4, 5];
/** 1-basiert: Antwort, Name, Datum. */
const ANTWORT = [7, 8, 9];
/** 1-basiert: die Antwortspalte, an der die Auswahllisten hängen. */
const ANTWORT_SPALTE = 7;

export interface ExportEingabe {
  fragen: readonly Klaerfrage[];
  bestand: KlaerfragenBestand;
  /** ISO-Zeitpunkt des Exports — von außen, nie eine Uhr hier drin. */
  jetztIso: string;
}

function kurzDatum(iso: string | null): string {
  if (iso === null || iso === '') return 'unbekannt';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE');
}

function kopfzeilen(e: ExportEingabe): string[] {
  return [
    'Klärfragen zum Status- und Kürzelkatalog',
    `Erhebung vom ${kurzDatum(e.jetztIso)} · Bestand vom ${kurzDatum(e.bestand.importiertAm)}`,
    `${e.bestand.gesamtVorgaenge.toLocaleString('de-DE')} Vorgänge, ganzer Bestand `
      + '(ohne Betrachtungsbereich) · Vorkommen = betroffene Vorgänge',
  ];
}

/** Reihenfolge: erst Herkunft, dann Vorkommen — wie `baueKlaerfragen` sie liefert. */
export function baueFragenBlatt(e: ExportEingabe): Blatt {
  return {
    name: 'Fragen',
    kopf: kopfzeilen(e),
    spalten: [...SPALTEN],
    zeilen: e.fragen.map(f => [
      f.id,
      HERKUNFT_LABEL[f.herkunft],
      f.betrifft,
      f.frage,
      f.kontext,
      f.vorkommen ?? '',
      '', '', '',
    ]),
  };
}

/**
 * Das zweite Blatt: wer was beantwortet, plus die drei Regeln, ohne die die
 * Datei kaputt zurückkommt.
 */
export function baueHinweisBlatt(e: ExportEingabe): Blatt {
  const jeHerkunft = new Map<string, number>();
  for (const f of e.fragen) jeHerkunft.set(f.herkunft, (jeHerkunft.get(f.herkunft) ?? 0) + 1);

  return {
    name: 'Hinweise',
    kopf: [
      'Jede Zeile im Blatt „Fragen" wird von der Stelle beantwortet, die unten zu ihrer '
        + 'Herkunft steht — am schnellsten über den Autofilter in der Spalte „Herkunft".',
      'Die Spalte ID bitte unverändert lassen: über sie werden die Antworten später wieder '
        + 'zugeordnet. Sortieren und Filtern ist erlaubt, die Vorgabespalten sind gesperrt.',
      'Was Sie nicht sicher wissen, bleibt leer. Eine geratene Antwort ist schlechter als '
        + 'keine — sie sieht aus wie eine Entscheidung.',
    ],
    spalten: ['Herkunft', 'Wer antwortet', 'Fragen'],
    zeilen: HERKUENFTE
      .filter(h => (jeHerkunft.get(h) ?? 0) > 0)
      .map(h => [HERKUNFT_LABEL[h], HERKUNFT_ADRESSAT[h], jeHerkunft.get(h) ?? 0]),
  };
}

export function baueBlaetter(e: ExportEingabe): Blatt[] {
  return [baueFragenBlatt(e), baueHinweisBlatt(e)];
}

/**
 * Wo die Spaltenzeile eines Blattes liegt: `baueArbeitsmappe` setzt den
 * erklärenden Kopf nach oben, dann eine Leerzeile, dann die Überschriften.
 */
function kopfZeileVon(b: Blatt): number {
  return b.kopf.length === 0 ? 1 : b.kopf.length + 2;
}

export function baueVeredelung(blaetter: readonly Blatt[], fragen: readonly Klaerfrage[]): BlattVeredelung[] {
  const [fragenBlatt, hinweisBlatt] = blaetter;
  const kopf = kopfZeileVon(fragenBlatt!);

  const validierungen: Validierung[] = [];
  fragen.forEach((f, i) => {
    if (f.optionen !== undefined && f.optionen.length > 0) {
      validierungen.push({ zeile: kopf + 1 + i, spalte: ANTWORT_SPALTE, optionen: f.optionen });
    }
  });

  return [
    {
      kopfZeile: kopf,
      letzteZeile: kopf + fragen.length,
      letzteSpalte: SPALTEN.length,
      breiten: BREITEN,
      umbruch: UMBRUCH,
      antwort: ANTWORT,
      validierungen,
    },
    {
      kopfZeile: kopfZeileVon(hinweisBlatt!),
      letzteZeile: kopfZeileVon(hinweisBlatt!) + hinweisBlatt!.zeilen.length,
      letzteSpalte: 3,
      breiten: [30, 28, 10],
      umbruch: [1, 2],
      antwort: [],
    },
  ];
}

export async function exportiereKlaerfragen(e: ExportEingabe): Promise<VeredelungsBericht> {
  const blaetter = baueBlaetter(e);
  return schreibeVeredelteArbeitsmappe(
    blaetter,
    baueVeredelung(blaetter, e.fragen),
    `klaerfragen-${zeitstempel(new Date(e.jetztIso))}.xlsx`,
  );
}
