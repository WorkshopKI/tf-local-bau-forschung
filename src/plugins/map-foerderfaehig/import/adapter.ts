/**
 * Import-Orchestrator: rohes Einreichungs-JSON → Strukturmodell + Report.
 *
 * Diese Datei koordiniert nur. Jede Feld-Familie hat ihr eigenes Modul
 * (`arbeitspakete`, `kosten`, `checkboxen`, `anlagen`, `laufzeit`); die Pfade
 * kommen deklarativ aus der Schema-Definition. Die Grenze ist bewusst gesetzt:
 * wächst hier Ernte-Logik, gehört sie in ein Fach-Modul, nicht hierher.
 *
 * Der Import bricht NIE ab. Fehlende Pflichtfelder, unerkannte Generationen und
 * verwaiste Referenzen werden gemeldet, nicht geworfen — eine Einreichung mit
 * Mängeln ist der Normalfall der Prüfung, kein Ausnahmezustand.
 */
import { hashText } from '@/plugins/antraege/gutachten/runner';
import type {
  MapEinreichung, MapFeldBefund, MapImportReport, MapMeldung,
} from '../types';
import { ernteAnlagen } from './anlagen';
import {
  berechneNnAnteil, ernteArbeitspakete, ernteEinsatzplanung, findeVerwaisteApRefs,
} from './arbeitspakete';
import { ernteCheckboxen } from './checkboxen';
import { leseEinreichungJson } from './json-lesen';
import { ernteKosten } from './kosten';
import { monateZwischen } from './laufzeit';
import { alsText, alsZahl, leseAlias, lesePfad, sammlePfade, sammleWerte } from './pfad';
import { rechneChecks } from './rechenchecks';
import { findeVerworfenePfade, istVerbotenerPfad } from './redaktion';
import { erkenneSchema } from './schema-erkennung';
import type { MapSchemaDefinition } from './schema-typen';

export interface ImportKontext {
  dateiname: string;
  /** Bearbeiter-Kürzel (`useMeinKuerzel()`); `null` ausserhalb einer Sitzung. */
  importiertVon: string | null;
  /** ISO-Zeitstempel — als Parameter, damit die Funktion rein und testbar bleibt. */
  importiertAm: string;
  /** djb2 über den Rohtext; setzt `importiereEinreichung`. */
  quellHash: string;
}

export interface ImportErgebnis {
  einreichung: MapEinreichung;
  report: MapImportReport;
}

/** Fehlgeschlagener Import — die Datei war nicht lesbar. */
export interface ImportFehler {
  ok: false;
  fehler: string;
}

export type ImportAntwort = ({ ok: true } & ImportErgebnis) | ImportFehler;

/** Liest ein Zielfeld über die Alias-Kette und protokolliert den Befund. */
function holeFeld(
  quelle: unknown, schema: MapSchemaDefinition, ziel: string, befunde: MapFeldBefund[],
): unknown {
  const spez = schema.felder.find(f => f.ziel === ziel);
  if (!spez) return undefined;
  const treffer = leseAlias(quelle, spez.pfade);
  befunde.push({
    ziel,
    benutzterPfad: treffer.benutzterPfad,
    status: treffer.status,
    pflicht: spez.pflicht,
  });
  return treffer.wert;
}

/**
 * Bereiche unterhalb von `data`, die keine Schema-Definition beansprucht.
 *
 * Bewusst auf Bereichsebene statt auf Blattebene: die Einreichung hat rund 500
 * Blattpfade, von denen der MAP zwei Dutzend liest. Eine Liste mit 470 Einträgen
 * „unbekannt" ist Rauschen. Die Aussage „der Bereich `data.abgeschlossenefue`
 * wird nicht ausgewertet" ist dagegen handlungsleitend. Rein.
 */
export function findeUnbeanspruchteBereiche(quelle: unknown, schema: MapSchemaDefinition): string[] {
  const beansprucht = new Set<string>();
  const merke = (pfad: string): void => {
    const teile = pfad.split('.');
    if (teile.length >= 2 && teile[0] === 'data') beansprucht.add(`data.${teile[1]}`);
  };

  for (const feld of schema.felder) feld.pfade.forEach(merke);
  merke(schema.listenPfade.arbeitspakete);
  merke(schema.listenPfade.einsatzplanung);
  schema.anlagenPfade.forEach(merke);
  schema.apRefPfade.forEach(merke);
  schema.marker.forEach(merke);

  const vorhanden = new Set<string>();
  for (const pfad of sammlePfade(quelle)) {
    if (istVerbotenerPfad(pfad)) continue;
    const teile = pfad.split('.');
    if (teile.length >= 2 && teile[0] === 'data') vorhanden.add(`data.${teile[1]}`);
  }

  return [...vorhanden].filter(b => !beansprucht.has(b)).sort();
}

/**
 * Baut aus dem geparsten Einreichungs-JSON das Strukturmodell und den Report.
 * Rein — Zeitstempel und Kürzel kommen über den Kontext herein.
 */
export function baueEinreichung(quelle: unknown, kontext: ImportKontext): ImportErgebnis {
  const { erkennung, definition, meldungen: erkennungsMeldungen } = erkenneSchema(quelle);
  const meldungen: MapMeldung[] = [...erkennungsMeldungen];
  const feldBefunde: MapFeldBefund[] = [];

  const hole = (ziel: string): unknown => holeFeld(quelle, definition, ziel, feldBefunde);

  const start = alsText(hole('laufzeit.start'));
  const ende = alsText(hole('laufzeit.ende'));

  const arbeitspakete = ernteArbeitspakete(lesePfad(quelle, definition.listenPfade.arbeitspakete));
  const einsatzplanung = ernteEinsatzplanung(lesePfad(quelle, definition.listenPfade.einsatzplanung));

  const stamm = {
    titel: alsText(hole('stamm.titel')),
    akronym: alsText(hole('stamm.akronym')),
    kurzfassung: alsText(hole('stamm.kurzfassung')),
  };

  const summen = {
    arbeitsaufwandAp: alsZahl(hole('summen.arbeitsaufwandAp')),
    personenmonateEinsatz: alsZahl(hole('summen.personenmonateEinsatz')),
    nnAnteil: berechneNnAnteil(einsatzplanung),
  };

  const kosten = ernteKosten(quelle, definition);
  for (const ziel of [
    'kosten.personal', 'kosten.dritte', 'kosten.fue', 'kosten.temp', 'kosten.uebrige',
    'kosten.gesamt', 'kosten.beantragteZuwendung', 'kosten.foerdersatz',
  ]) {
    const spez = definition.felder.find(f => f.ziel === ziel);
    if (!spez) continue;
    const treffer = leseAlias(quelle, spez.pfade);
    feldBefunde.push({
      ziel, benutzterPfad: treffer.benutzterPfad, status: treffer.status, pflicht: spez.pflicht,
    });
  }

  const merkmale = {
    patentsituation: ernteCheckboxen(
      hole('merkmale.patentsituation'), definition.checkboxLabels['patentsituation'],
    ),
    technologieneuerung: ernteCheckboxen(
      hole('merkmale.technologieneuerung'), definition.checkboxLabels['technologieneuerung'],
    ),
  };

  const einreichung: MapEinreichung = {
    version: 1,
    id: hashText([stamm.akronym ?? '', stamm.titel ?? '', start ?? '', ende ?? ''].join('|')),
    schemaId: erkennung.schemaId,
    importiertAm: kontext.importiertAm,
    importiertVon: kontext.importiertVon,
    dateiname: kontext.dateiname,
    quellHash: kontext.quellHash,
    stamm,
    laufzeit: { start, ende, monate: monateZwischen(start, ende) },
    arbeitspakete,
    einsatzplanung,
    summen,
    kosten,
    antragsteller: { kurzprofil: alsText(hole('antragsteller.kurzprofil')) },
    merkmale,
    anlagen: ernteAnlagen(quelle, definition.anlagenPfade),
  };

  // Fehlende Pflichtfelder melden — aber den Import weiterlaufen lassen.
  for (const befund of feldBefunde) {
    if (befund.status === 'fehlend' && befund.pflicht) {
      meldungen.push({
        schwere: 'fehler',
        text: `Pflichtfeld „${befund.ziel}" fehlt in der Einreichung.`,
        kontext: definition.felder.find(f => f.ziel === befund.ziel)?.pfade.join(' | '),
      });
    } else if (befund.status === 'alias') {
      meldungen.push({
        schwere: 'hinweis',
        text: `„${befund.ziel}" kam über einen Alias-Pfad — die Datei weicht vom Primärpfad ab.`,
        kontext: befund.benutzterPfad ?? undefined,
      });
    }
  }

  if (einreichung.laufzeit.monate === null && (start !== null || ende !== null)) {
    meldungen.push({
      schwere: 'warnung',
      text: 'Die Laufzeit konnte nicht berechnet werden — Start- oder Enddatum fehlt oder ist unlesbar.',
    });
  }

  const verwaisteRefs = findeVerwaisteApRefs(
    definition.apRefPfade.flatMap(pfad => sammleWerte(quelle, pfad)),
    arbeitspakete,
  );

  const report: MapImportReport = {
    dateiname: kontext.dateiname,
    erkennung,
    zielfelder: feldBefunde,
    redaktion: { verworfenePfade: findeVerworfenePfade(quelle) },
    unbekannteFelder: findeUnbeanspruchteBereiche(quelle, definition),
    meldungen,
    befunde: rechneChecks(einreichung, verwaisteRefs),
  };

  return { einreichung, report };
}

/**
 * Einstiegspunkt vom Rohtext her: BOM-tolerant parsen, Quell-Hash stempeln,
 * Strukturmodell bauen. Wirft nicht — ein unlesbares JSON kommt als
 * `{ ok: false }` zurück, damit die Oberfläche es als Meldung zeigen kann.
 */
export function importiereEinreichung(
  rohText: string, kontext: Omit<ImportKontext, 'quellHash'>,
): ImportAntwort {
  const gelesen = leseEinreichungJson(rohText);
  if (!gelesen.ok) return { ok: false, fehler: gelesen.fehler };

  const ergebnis = baueEinreichung(gelesen.daten, {
    ...kontext,
    quellHash: hashText(rohText),
  });

  if (gelesen.hatteBom) {
    ergebnis.report.meldungen.push({
      schwere: 'hinweis',
      text: 'Die Datei beginnt mit einem UTF-8-BOM — es wurde beim Einlesen entfernt.',
    });
  }

  return { ok: true, ...ergebnis };
}
