/**
 * Tests fuer die Feld-Aufloesung des Suchkorpus (v4.42.0).
 *
 * Die Mappings unten sind KEINE erfundenen Fixtures — sie sind die drei aktiven
 * Quellen des echten Bestandes (Stand 2026-08, 14 097 FKZ), auf die hier
 * relevanten Spalten eingedampft. Genau ihre Abweichungen voneinander waren der
 * Defekt:
 *
 *  - `VB_INHALT` liegt unter `inhalt_kurzzusammenfassung`, nicht unter
 *    `vb_inhalt` → die gesamte Projektbeschreibung fehlte im Suchkorpus.
 *  - `ORG_AST` liegt unter drei verschiedenen Schluesseln, einer davon
 *    kollidiert mit der kanonischen ausfuehrenden Stelle.
 *
 * Erwartungszahlen stehen hier bewusst nicht drin: geprueft wird, dass der
 * aufgeloeste Schluessel im Set landet — das bleibt richtig, wenn der Kurator
 * morgen anders mappt.
 */
import { describe, it, expect } from 'vitest';
import type { CsvSchema } from '@/core/services/csv/types';
import {
  baueKorpusFeldKarte, SLOT_REIHENFOLGE, SPALTEN_CODES,
  type KorpusFeldKarte,
} from '../services/korpusFeldAufloesung';

function schema(id: string, mapping: CsvSchema['column_mapping']): CsvSchema {
  return {
    id,
    programm_id: 'default-programm',
    csv_source_name: id,
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 50,
    column_mapping: mapping,
    created_at: '2026-08-14T00:00:00.000Z',
  };
}

/** Quelle 9052 („PrjBsp") — traegt die Projektbeschreibung. Und den Wahlkreis,
 *  den NACE-Klartext und eine eigene Schreibweise der Netzwerkangabe. */
const PRJBSP = schema('9052-prjbsp', {
  VB_TITEL: { canonical: 'verbund_titel', type: 'string' },
  VB_INHALT: { custom: 'inhalt_kurzzusammenfassung', type: 'string' },
  ORG_AFS: { canonical: 'antragsteller', type: 'string' },
  ORG_AST: { custom: 'org_ast', type: 'string' },
  NETZWERKNA: { custom: 'netzwerk_kurzname_fkz_ztp', type: 'string' },
  WKNAAK_AFS: { custom: 'wahlkreisname_afs', type: 'string' },
  NACE_LANG: { custom: 'nace_code_beschreibung_nw_antragsebene', type: 'string' },
});

/** Quelle 9097 („AnB") — mappt ORG_AST auf einen dritten Namen. Traegt die
 *  Arbeitsnotizen und die Netzwerkangabe unter ihrem kurzen Namen. */
const ANB = schema('9097-anb', {
  ORG_AFS: { canonical: 'antragsteller', type: 'string' },
  ORG_AST: { custom: 'antragsteller_ast', type: 'string' },
  NETZWERKNA: { custom: 'netzwerk', type: 'string' },
  T_YW: { custom: 'wichtig', type: 'string' },
  T_HINT: { custom: 'bemerkung', type: 'string' },
});

/** Quelle 7737 („Bgl") — die Kollision: ORG_AST auf den Schluessel von ORG_AFS.
 *  Traegt als einzige die Kontakt-Mail. */
const BGL = schema('7737-bgl', {
  ORG_AST: { custom: 'antragsteller', type: 'string' },
  ORG_AFS: { canonical: 'antragsteller', type: 'string' },
  EMAIL_PL: { custom: 'email_pl', type: 'string' },
});

/** Minimal-Basis: nur, was der Korpus ohne Schema raten wuerde. */
const BASIS: KorpusFeldKarte = {
  vbTitel: new Set(['verbundtitel']),
  abstract: new Set(['vbinhalt']),
  akronym: new Set(['akronym']),
  orgAfs: new Set(['antragsteller']),
  orgAst: new Set(['orgast']),
  ortAfs: new Set(['ortafs']),
  ortAst: new Set(['ortast']),
  landAfs: new Set(['bulandafs']),
  landAst: new Set(['bulandast']),
  emailPl: new Set(['emailpl']),
  netzwerk: new Set(['netzwerk']),
  notizWichtig: new Set(['wichtig']),
  notizBemerkung: new Set(['bemerkung']),
  wahlkreis: new Set(['wahlkreisnameafs']),
  nace: new Set(['nacelang']),
};

const ALLE = [PRJBSP, ANB, BGL];

describe('baueKorpusFeldKarte', () => {
  it('findet die Projektbeschreibung unter dem Namen, den das Mapping vergibt', () => {
    // Der Kern-Defekt: fest verdrahtet war nur `vb_inhalt`, im Bestand heisst
    // die Spalte `inhalt_kurzzusammenfassung` — der Korpus suchte ins Leere.
    const karte = baueKorpusFeldKarte(ALLE, BASIS);
    expect(karte.abstract.has('inhaltkurzzusammenfassung')).toBe(true);
  });

  it('findet ORG_AST auch unter dem abweichenden Namen der zweiten Quelle', () => {
    const karte = baueKorpusFeldKarte(ALLE, BASIS);
    expect(karte.orgAst.has('orgast')).toBe(true);
    expect(karte.orgAst.has('antragstellerast')).toBe(true);
  });

  it('gibt den kollidierenden Schluessel NICHT an ORG_AST', () => {
    // Quelle 7737 mappt ORG_AST auf `antragsteller` — denselben Schluessel wie
    // die kanonische ausfuehrende Stelle. Beide Slots darauf zeigen zu lassen
    // waere schlechter als heute: `pickByNormalized` liefert den ersten
    // passenden Schluessel, beide Slots bekaemen denselben Wert, und die 2,5 %
    // der Saetze mit abweichender Rechtsperson verloeren ihre zweite
    // Organisation.
    const karte = baueKorpusFeldKarte(ALLE, BASIS);
    expect(karte.orgAfs.has('antragsteller')).toBe(true);
    expect(karte.orgAst.has('antragsteller')).toBe(false);
  });

  it('behaelt die Basis-Aliase — ein Programm ohne Schema sucht wie bisher', () => {
    const karte = baueKorpusFeldKarte([], BASIS);
    for (const slot of Object.keys(BASIS) as Array<keyof KorpusFeldKarte>) {
      for (const key of BASIS[slot]) {
        expect(karte[slot].has(key), `${slot}/${key}`).toBe(true);
      }
    }
  });

  it('loest die Kontakt-Mail auf, nicht die Adressen des Projektträgers', () => {
    // TIB_MAIL/BIB_MAIL/ZTP_MAIL/PFM_MAIL stehen in derselben Datei und tragen
    // die Domains des Projektträgers. Die Aufloesung ueber den Spalten-CODE
    // schliesst sie strukturell aus — sie kommen hier gar nicht erst an.
    const mitTraegerMail = schema('7737-bgl', {
      EMAIL_PL: { custom: 'email_pl', type: 'string' },
      TIB_MAIL: { canonical: 'tib_mail', type: 'string' },
      BIB_MAIL: { custom: 'bib_mail', type: 'string' },
    });
    const karte = baueKorpusFeldKarte([mitTraegerMail], BASIS);
    expect(karte.emailPl.has('emailpl')).toBe(true);
    expect(karte.emailPl.has('tibmail')).toBe(false);
    expect(karte.emailPl.has('bibmail')).toBe(false);
  });

  it('findet die Netzwerkangabe unter BEIDEN Schreibweisen des Bestandes', () => {
    // Dieselbe Spalte, zwei Schluessel: `netzwerk` (7737/9097) und
    // `netzwerk_kurzname_fkz_ztp` (9052). Wer nur einen kennt, verliert 11 491
    // der 11 492 Angaben oder eben den Rest — je nachdem, welchen er raet.
    const karte = baueKorpusFeldKarte(ALLE, BASIS);
    expect(karte.netzwerk.has('netzwerk')).toBe(true);
    expect(karte.netzwerk.has('netzwerkkurznamefkzztp')).toBe(true);
  });

  it('haelt die beiden Notizspalten getrennt, obwohl sie eine Fundstelle sind', () => {
    // Zusammengezogen wird erst im Korpus (ein Suchfeld „Notiz"). Die
    // Aufloesung muss beide Schluessel einzeln kennen, sonst faende der zweite
    // Slot den ersten Wert — und `T_HINT` waere still verschwunden.
    const karte = baueKorpusFeldKarte(ALLE, BASIS);
    expect(karte.notizWichtig.has('wichtig')).toBe(true);
    expect(karte.notizBemerkung.has('bemerkung')).toBe(true);
    expect(karte.notizWichtig.has('bemerkung')).toBe(false);
  });

  it('loest Wahlkreis und NACE-Klartext auf', () => {
    const karte = baueKorpusFeldKarte(ALLE, BASIS);
    expect(karte.wahlkreis.has('wahlkreisnameafs')).toBe(true);
    expect(karte.nace.has('nacecodebeschreibungnwantragsebene')).toBe(true);
  });

  it('ueberspringt ignorierte Spalten', () => {
    const ignoriert = schema('x', {
      VB_INHALT: { custom: 'inhalt_kurzzusammenfassung', type: 'string', ignore: true },
    });
    const karte = baueKorpusFeldKarte([ignoriert], BASIS);
    expect(karte.abstract.has('inhaltkurzzusammenfassung')).toBe(false);
  });

  it('faellt auf den kleingeschriebenen Spaltennamen zurueck, wenn nichts gemappt ist', () => {
    // `resolveFieldKey`-Kaskade: canonical → custom → col.toLowerCase().
    const roh = schema('x', { VB_INHALT: { type: 'string' } });
    const karte = baueKorpusFeldKarte([roh], BASIS);
    expect(karte.abstract.has('vbinhalt')).toBe(true);
  });

  it('vergibt jeden Slot — ein vergessener bliebe still ohne Feldmenge', () => {
    // Die Reihenfolge-Liste ist handgepflegt (sie kodiert die Kollisions-Regel).
    // Fehlt dort ein Slot, kaeme sein Korpus-Feld nie in die Karte und das Feld
    // waere leer, ohne dass irgendetwas rot wird — genau die stille Abschaltung,
    // gegen die dieses Modul gebaut ist.
    expect([...SLOT_REIHENFOLGE].sort()).toEqual(Object.keys(SPALTEN_CODES).sort());
    const karte = baueKorpusFeldKarte(ALLE, BASIS);
    for (const slot of Object.keys(SPALTEN_CODES) as Array<keyof KorpusFeldKarte>) {
      expect(karte[slot], `Slot ${slot}`).toBeInstanceOf(Set);
    }
  });

  it('vergibt keinen Schluessel an zwei Slots', () => {
    const karte = baueKorpusFeldKarte(ALLE, BASIS);
    const gesehen = new Set<string>();
    for (const slot of Object.keys(karte) as Array<keyof KorpusFeldKarte>) {
      for (const key of karte[slot]) {
        expect(gesehen.has(key), `${key} steht in mehreren Slots`).toBe(false);
        gesehen.add(key);
      }
    }
  });
});
