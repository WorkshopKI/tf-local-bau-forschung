/**
 * Bewertungslogik, Editor, Verlauf und Abschluss-Entwürfe.
 *
 * Schwerpunkt sind die drei Regeln, die man leicht falsch implementiert:
 * die B0-Nullregel, das vollständige Entfallen bedingter Blöcke und die
 * Behandlung von „n. z.".
 */
import { describe, expect, it } from 'vitest';
import { baueAblehnung, baueGutachten, baueNachforderung } from '../abschluss/markdown';
import { sucheNfBausteine, zerlegeBegriffe } from '../abschluss/nf-suche';
import { bewerte, befundeFuerItem, rechneInnoScore } from '../checkliste/bewertung';
import { aendereItem, bildeItemId, ergaenzeItem, setzeItemAktiv } from '../checkliste/editor';
import { CHECKLISTE_SEED, INNO_SCORE_KURZPFAD } from '../checkliste/seed';
import type { MapItemStatus, MapPruefung, MapStufe } from '../checkliste/typen';
import {
  migrierePruefung, neuePruefung, setzeBedingung, wendeBewertungAn,
} from '../checkliste/verlauf';
import { importiereEinreichung } from '../import/adapter';
import type { RechenBefund } from '../types';
import { DUMMY_PFAD, TEST_KONTEXT, leseFixture } from './fixtures';

const antwort = importiereEinreichung(leseFixture(DUMMY_PFAD), TEST_KONTEXT);
if (!antwort.ok) throw new Error(antwort.fehler);
const DUMMY = antwort.einreichung;
const BEFUNDE = antwort.report.befunde;

const T0 = '2026-07-20T10:00:00.000Z';

function leer(): MapPruefung {
  return neuePruefung(DUMMY.id, CHECKLISTE_SEED.version, T0);
}

function mitStufen(...stufen: MapStufe[]): MapPruefung {
  const skala = CHECKLISTE_SEED.items.filter(i => i.art === 'skala');
  return stufen.reduce(
    (p, stufe, i) => wendeBewertungAn(p, { itemId: skala[i]!.id, status: 'erfuellt', stufe }, 'TST', T0),
    leer(),
  );
}

function mitStatus(p: MapPruefung, itemId: string, status: MapItemStatus, bemerkung?: string): MapPruefung {
  return wendeBewertungAn(p, { itemId, status, ...(bemerkung ? { bemerkung } : {}) }, 'TST', T0);
}

describe('Seed-Integritaet', () => {
  it('hat eindeutige Item-IDs', () => {
    const ids = CHECKLISTE_SEED.items.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gibt jedem Skala-Item genau die vier Stufen B0 bis B3 mit 0 bis 3 Punkten', () => {
    const skala = CHECKLISTE_SEED.items.filter(i => i.art === 'skala');
    expect(skala).toHaveLength(3);
    for (const item of skala) {
      expect(item.anker?.map(a => a.stufe)).toEqual(['B0', 'B1', 'B2', 'B3']);
      expect(item.anker?.map(a => a.punkte)).toEqual([0, 1, 2, 3]);
      expect(item.anker?.every(a => a.merkmale.length > 0)).toBe(true);
    }
  });

  it('haelt die Ankertexte woertlich aus der Entscheidungshilfe', () => {
    const ziel = CHECKLISTE_SEED.items.find(i => i.id === 'inno.zielstellung');
    expect(ziel?.anker?.find(a => a.stufe === 'B1')?.merkmale).toContain(
      'Verbesserungen vorwiegend qualitativ beschrieben',
    );
    const loesung = CHECKLISTE_SEED.items.find(i => i.id === 'inno.loesungsansatz');
    expect(loesung?.anker?.find(a => a.stufe === 'B3')?.merkmale).toEqual([
      'Völlig neuer Lösungsansatz basierend auf Grundlagenforschung',
    ]);
  });

  it('kennzeichnet Ergaenzungen der App als solche', () => {
    const ergaenzt = CHECKLISTE_SEED.items.filter(i => i.herkunft === 'app');
    expect(ergaenzt.map(i => i.id)).toEqual(['kalkulation.rechnerisch']);
  });

  it('setzt die Triage-Schwelle auf 8', () => {
    expect(CHECKLISTE_SEED.innoScoreKurzpfad).toBe(8);
    expect(INNO_SCORE_KURZPFAD).toBe(8);
  });
});

describe('Innovationsgrad — die B0-Nullregel', () => {
  it('summiert die Stufen im Normalfall', () => {
    const s = rechneInnoScore(CHECKLISTE_SEED, mitStufen('B2', 'B3', 'B3'));
    expect(s).toMatchObject({ punkte: 8, rohSumme: 8, nullWegenB0: false, vollstaendig: true });
  });

  it('setzt die Punktzahl auf 0, sobald EINE Kategorie B0 ist — trotz B3 in den anderen', () => {
    const s = rechneInnoScore(CHECKLISTE_SEED, mitStufen('B0', 'B3', 'B3'));
    expect(s.punkte).toBe(0);
    expect(s.rohSumme).toBe(6);
    expect(s.nullWegenB0).toBe(true);
    expect(s.b0Items).toEqual(['inno.zielstellung']);
  });

  it('meldet unvollstaendig, solange nicht alle drei Kategorien bewertet sind', () => {
    expect(rechneInnoScore(CHECKLISTE_SEED, mitStufen('B2', 'B2')).vollstaendig).toBe(false);
  });

  it('verlangt die Vertiefung unterhalb von 8 Punkten', () => {
    expect(rechneInnoScore(CHECKLISTE_SEED, mitStufen('B2', 'B2', 'B3')).vertiefungNoetig).toBe(true);
    expect(rechneInnoScore(CHECKLISTE_SEED, mitStufen('B3', 'B2', 'B3')).vertiefungNoetig).toBe(false);
  });
});

describe('Bedingte Bloecke entfallen vollstaendig', () => {
  it('blendet die Vertiefungs-Items ab 8 Punkten aus', () => {
    const e = bewerte(CHECKLISTE_SEED, mitStufen('B3', 'B2', 'B3'), DUMMY, BEFUNDE);
    const vertiefung = e.zustaende.find(z => z.item.id === 'inno.risiko-beherrschbar');
    expect(vertiefung?.anwendbar).toBe(false);
    expect(e.offen).not.toContain('inno.risiko-beherrschbar');
  });

  it('haelt sie unter 8 Punkten eingeblendet und pflichtig', () => {
    const e = bewerte(CHECKLISTE_SEED, mitStufen('B1', 'B1', 'B1'), DUMMY, BEFUNDE);
    expect(e.zustaende.find(z => z.item.id === 'inno.risiko-beherrschbar')?.anwendbar).toBe(true);
    expect(e.offen).toContain('inno.risiko-beherrschbar');
  });

  it('haelt sie eingeblendet, solange der Innovationsgrad unbewertet ist', () => {
    // Sonst verschwaenden Pflichtitems, nur weil die Bewertung noch aussteht.
    const e = bewerte(CHECKLISTE_SEED, leer(), DUMMY, BEFUNDE);
    expect(e.zustaende.find(z => z.item.id === 'inno.risiko-beherrschbar')?.anwendbar).toBe(true);
  });

  it('leitet den Auftraege-Block aus den importierten Kosten ab', () => {
    const e = bewerte(CHECKLISTE_SEED, leer(), DUMMY, BEFUNDE);
    // Der Dummy plant 5.012 EUR fuer Auftraege an Dritte.
    expect(e.zustaende.find(z => z.item.id === 'auftraege.angebote')?.anwendbar).toBe(true);

    const ohneDritte = { ...DUMMY, kosten: { ...DUMMY.kosten, dritte: 0 } };
    const e2 = bewerte(CHECKLISTE_SEED, leer(), ohneDritte, BEFUNDE);
    expect(e2.zustaende.find(z => z.item.id === 'auftraege.angebote')?.anwendbar).toBe(false);
    expect(e2.offen).not.toContain('auftraege.angebote');
  });

  it('blendet den Doppelfoerderungs-Block erst nach manueller Bestaetigung ein', () => {
    const aus = bewerte(CHECKLISTE_SEED, leer(), DUMMY, BEFUNDE);
    expect(aus.zustaende.find(z => z.item.id === 'zuwendung.doppelfoerderung')?.anwendbar).toBe(false);

    const an = bewerte(
      CHECKLISTE_SEED, setzeBedingung(leer(), 'zuwendung.doppelfoerderung', true, T0), DUMMY, BEFUNDE,
    );
    expect(an.zustaende.find(z => z.item.id === 'zuwendung.doppelfoerderung')?.anwendbar).toBe(true);
  });
});

describe('Status-Semantik', () => {
  it('zaehlt „NF erfuellt" wie erfuellt, „NF notwendig" dagegen als offen', () => {
    const p = mitStatus(mitStatus(leer(), 'zuwendung.website', 'nf-erfuellt'), 'eignung.effekte', 'nf-notwendig', 'Nachweis fehlt');
    const e = bewerte(CHECKLISTE_SEED, p, DUMMY, BEFUNDE);
    expect(e.offen).not.toContain('zuwendung.website');
    expect(e.nfOffen).toEqual(['eignung.effekte']);
    expect(e.abschlussbereit).toBe(false);
  });

  it('zaehlt „n. z." als erledigt, aber nicht als erfuellt', () => {
    const p = mitStatus(leer(), 'zuwendung.website', 'nicht-zutreffend');
    const e = bewerte(CHECKLISTE_SEED, p, DUMMY, BEFUNDE);
    expect(e.offen).not.toContain('zuwendung.website');
    expect(e.nichtErfuellt).not.toContain('zuwendung.website');
  });

  it('verlangt eine Bemerkung bei „nicht erfuellt" und „NF notwendig"', () => {
    const ohne = bewerte(CHECKLISTE_SEED, mitStatus(leer(), 'zuwendung.website', 'nicht-erfuellt'), DUMMY, BEFUNDE);
    expect(ohne.bemerkungFehlt).toContain('zuwendung.website');

    const mit = bewerte(
      CHECKLISTE_SEED, mitStatus(leer(), 'zuwendung.website', 'nicht-erfuellt', 'Produkt wird beworben'),
      DUMMY, BEFUNDE,
    );
    expect(mit.bemerkungFehlt).not.toContain('zuwendung.website');
  });

  it('verlangt bei „erfuellt" keine Bemerkung', () => {
    const e = bewerte(CHECKLISTE_SEED, mitStatus(leer(), 'zuwendung.website', 'erfuellt'), DUMMY, BEFUNDE);
    expect(e.bemerkungFehlt).toEqual([]);
  });
});

describe('Vorbelegung aus den Rechenchecks', () => {
  it('haengt den AP-Befund an das passende Kriterium', () => {
    const item = CHECKLISTE_SEED.items.find(i => i.id === 'arbeitsplan.ap-untersetzt')!;
    const treffer = befundeFuerItem(item, BEFUNDE);
    expect(treffer.map(b => b.id)).toEqual(['ap-pm-grenze:1']);
  });

  it('buendelt die Kalkulations-Befunde am Ergaenzungs-Item', () => {
    const item = CHECKLISTE_SEED.items.find(i => i.id === 'kalkulation.rechnerisch')!;
    expect(befundeFuerItem(item, BEFUNDE).map(b => b.id)).toEqual(['einsatz-jahr:2028']);
  });

  it('vergibt keinen Befund an Items ohne Vorbelegung', () => {
    const item = CHECKLISTE_SEED.items.find(i => i.id === 'zuwendung.website')!;
    expect(befundeFuerItem(item, BEFUNDE)).toEqual([]);
  });

  it('unterscheidet Praefix von Teilwort', () => {
    const item = CHECKLISTE_SEED.items.find(i => i.id === 'arbeitsplan.ap-untersetzt')!;
    const fremd: RechenBefund[] = [
      { id: 'ap-pm-grenze-anders', titel: '', schwere: 'hinweis', erwartet: '', gefunden: '' },
    ];
    expect(befundeFuerItem(item, fremd)).toEqual([]);
  });
});

describe('Verlauf', () => {
  it('schreibt bei jedem Statuswechsel einen Eintrag mit Autor und Zeit', () => {
    const p = mitStatus(leer(), 'zuwendung.website', 'nf-notwendig', 'offen');
    expect(p.verlauf).toHaveLength(1);
    expect(p.verlauf[0]).toMatchObject({
      itemId: 'zuwendung.website', autor: 'TST', von: null, nach: { status: 'nf-notwendig' },
    });
  });

  it('macht die erledigte Nachforderung im Verlauf unterscheidbar', () => {
    // Genau dafuer sind „NF notwendig" und „NF erfuellt" eigene Status: der
    // Uebergang traegt die Information, dass eine Nachforderung lief.
    const p = mitStatus(mitStatus(leer(), 'zuwendung.website', 'nf-notwendig', 'x'), 'zuwendung.website', 'nf-erfuellt');
    expect(p.verlauf).toHaveLength(2);
    expect(p.verlauf[1]).toMatchObject({
      von: { status: 'nf-notwendig' }, nach: { status: 'nf-erfuellt' },
    });
  });

  it('schreibt keinen Eintrag, wenn sich nur die Bemerkung aendert', () => {
    const eins = mitStatus(leer(), 'zuwendung.website', 'nicht-erfuellt', 'erste Fassung');
    const zwei = mitStatus(eins, 'zuwendung.website', 'nicht-erfuellt', 'nachgeschaerft');
    expect(zwei.verlauf).toHaveLength(1);
    expect(zwei.bewertungen['zuwendung.website']?.bemerkung).toBe('nachgeschaerft');
  });

  it('mutiert die uebergebene Pruefung nicht', () => {
    const vorher = leer();
    mitStatus(vorher, 'zuwendung.website', 'erfuellt');
    expect(vorher.bewertungen).toEqual({});
  });
});

describe('Editor — Version zaehlt hoch, nichts geht verloren', () => {
  const stempel = { autor: 'ABC', zeitpunkt: '2026-07-21T09:00:00.000Z' };

  it('erhoeht die Version und stempelt Autor und Zeit', () => {
    const neu = aendereItem(CHECKLISTE_SEED, 'zuwendung.website', { kriterium: 'Neu formuliert' }, stempel);
    expect(neu.version).toBe(CHECKLISTE_SEED.version + 1);
    expect(neu.geaendertVon).toBe('ABC');
    expect(neu.geaendertAm).toBe(stempel.zeitpunkt);
    expect(neu.items.find(i => i.id === 'zuwendung.website')?.kriterium).toBe('Neu formuliert');
  });

  it('laesst die Ausgangsfassung unveraendert', () => {
    aendereItem(CHECKLISTE_SEED, 'zuwendung.website', { kriterium: 'X' }, stempel);
    expect(CHECKLISTE_SEED.version).toBe(1);
    expect(CHECKLISTE_SEED.items.find(i => i.id === 'zuwendung.website')?.kriterium)
      .toMatch(/noch nicht auf der Website/);
  });

  it('ergaenzt ein Kriterium am Ende seiner Gruppe und markiert es als App-Ergaenzung', () => {
    const neu = ergaenzeItem(CHECKLISTE_SEED, {
      gruppe: 'Arbeitsplanung', kriterium: 'Meilensteine sind terminiert', klasse: 'S',
    }, stempel);
    const ergaenzt = neu.items.find(i => i.kriterium === 'Meilensteine sind terminiert');
    expect(ergaenzt?.herkunft).toBe('app');
    expect(ergaenzt?.art).toBe('binaer');

    const indizes = neu.items.map(i => i.gruppe);
    const letzterArbeitsplan = indizes.lastIndexOf('Arbeitsplanung');
    expect(neu.items[letzterArbeitsplan]?.id).toBe(ergaenzt?.id);
  });

  it('deaktiviert statt zu loeschen', () => {
    const neu = setzeItemAktiv(CHECKLISTE_SEED, 'zuwendung.website', false, stempel);
    expect(neu.items).toHaveLength(CHECKLISTE_SEED.items.length);
    expect(neu.items.find(i => i.id === 'zuwendung.website')?.aktiv).toBe(false);
    expect(bewerte(neu, leer(), DUMMY, BEFUNDE).zustaende.some(z => z.item.id === 'zuwendung.website'))
      .toBe(false);
  });

  it('bildet kollisionsfreie IDs', () => {
    const basis = bildeItemId('Arbeitsplanung', 'Meilensteine sind terminiert', new Set());
    expect(basis).toBe('arbeitsplanu.meilensteine-sind-terminiert');
    expect(bildeItemId('Arbeitsplanung', 'Meilensteine sind terminiert', new Set([basis])))
      .toBe(`${basis}-2`);
  });

  it('loest Umlaute in der ID auf', () => {
    expect(bildeItemId('Prüfung', 'Über Ähnliches', new Set())).toBe('pruefung.ueber-aehnliches');
  });
});

describe('Versions-Stempel und Migration', () => {
  it('bleibt die laufende Pruefung auf ihrer Fassung', () => {
    const p = leer();
    expect(p.checklisteVersion).toBe(1);
    const neueDefinition = aendereItem(CHECKLISTE_SEED, 'zuwendung.website', { kriterium: 'X' }, {
      autor: 'ABC', zeitpunkt: T0,
    });
    // Ohne ausdrueckliches Nachziehen bleibt die Pruefung auf v1.
    expect(p.checklisteVersion).not.toBe(neueDefinition.version);
  });

  it('bewahrt Bewertungen zu entfernten Items auf, statt sie zu verwerfen', () => {
    const p = mitStatus(leer(), 'zuwendung.website', 'erfuellt');
    const ohneItem = {
      ...CHECKLISTE_SEED,
      version: 2,
      items: CHECKLISTE_SEED.items.filter(i => i.id !== 'zuwendung.website'),
    };
    const migriert = migrierePruefung(p, ohneItem);
    expect(migriert.bewertungen['zuwendung.website']).toBeUndefined();
    expect(migriert.verwaisteBewertungen.map(b => b.itemId)).toEqual(['zuwendung.website']);
    expect(migriert.checklisteVersion).toBe(2);
  });

  it('holt die Bewertung zurueck, wenn das Item wieder auftaucht', () => {
    const p = mitStatus(leer(), 'zuwendung.website', 'erfuellt');
    const ohneItem = {
      ...CHECKLISTE_SEED, version: 2,
      items: CHECKLISTE_SEED.items.filter(i => i.id !== 'zuwendung.website'),
    };
    const zurueck = migrierePruefung(migrierePruefung(p, ohneItem), { ...CHECKLISTE_SEED, version: 3 });
    expect(zurueck.bewertungen['zuwendung.website']?.status).toBe('erfuellt');
    expect(zurueck.verwaisteBewertungen).toEqual([]);
  });
});

describe('Nachforderungs-Bausteine — Auswahl, keine Formulierung', () => {
  it('filtert Stoppwoerter und kurze Woerter', () => {
    expect(zerlegeBegriffe('Bitte beschreiben Sie die Risiken')).toEqual(['risiken']);
  });

  it('findet zum AP-Kriterium den Baustein zu grossen Arbeitspaketen', () => {
    const item = CHECKLISTE_SEED.items.find(i => i.id === 'arbeitsplan.ap-untersetzt')!;
    const treffer = sucheNfBausteine(item.nfSuchbegriffe!, 'tv', 3);
    expect(treffer.length).toBeGreaterThan(0);
    expect(treffer[0]?.baustein.thema).toBe('Große Arbeitspakete (>6 PM)');
  });

  it('findet zum Schutzrechte-Kriterium den Schutzrechte-Baustein', () => {
    const treffer = sucheNfBausteine(['Schutzrechte'], 'tv', 1);
    expect(treffer[0]?.baustein.thema).toBe('Schutzrechte');
  });

  it('nennt die Woerter, die angeschlagen haben', () => {
    const treffer = sucheNfBausteine(['Technische Risiken'], 'tv', 1);
    expect(treffer[0]?.treffer).toContain('risiken');
  });

  it('liefert nichts statt irgendetwas, wenn die Begriffe nicht passen', () => {
    expect(sucheNfBausteine(['zzzzunbekanntesthema'], 'tv')).toEqual([]);
    expect(sucheNfBausteine([], 'tv')).toEqual([]);
  });

  it('bleibt im gewaehlten Scope', () => {
    expect(sucheNfBausteine(['Arbeitspakete'], 'verbund').every(t => t.baustein.scope === 'verbund'))
      .toBe(true);
  });
});

describe('Abschluss-Entwuerfe', () => {
  const optionen = { titelGeprueft: true, hinweis: 'Mit AB abgestimmt.' };

  it('listet im Gutachten die erfuellten Kriterien samt Bemerkung', () => {
    const p = mitStatus(mitStufen('B2', 'B3', 'B3'), 'zuwendung.website', 'erfuellt', 'Website geprüft');
    const e = bewerte(CHECKLISTE_SEED, p, DUMMY, BEFUNDE);
    const md = baueGutachten(DUMMY, CHECKLISTE_SEED, e, optionen);

    expect(md).toContain('# Gutachten (Gerüst)');
    expect(md).toContain('Test der Kurzbezeichnung');
    expect(md).toContain('**Punktzahl: 8 von 9**');
    expect(md).toContain('Website geprüft');
    expect(md).toContain('Fassung 1');
  });

  it('macht die B0-Nullregel im Gutachten transparent', () => {
    const e = bewerte(CHECKLISTE_SEED, mitStufen('B0', 'B3', 'B3'), DUMMY, BEFUNDE);
    const md = baueGutachten(DUMMY, CHECKLISTE_SEED, e, optionen);
    expect(md).toContain('**Punktzahl: 0 von 9**');
    expect(md).toContain('Einzelsumme (6)');
  });

  it('setzt in der Nachforderung den Bausteintext woertlich ein', () => {
    const p = mitStatus(leer(), 'arbeitsplan.ap-untersetzt', 'nf-notwendig', 'AP1 hat 12 PM');
    const e = bewerte(CHECKLISTE_SEED, p, DUMMY, BEFUNDE);
    const md = baueNachforderung(DUMMY, CHECKLISTE_SEED, e, optionen);

    const treffer = sucheNfBausteine(
      CHECKLISTE_SEED.items.find(i => i.id === 'arbeitsplan.ap-untersetzt')!.nfSuchbegriffe!, 'tv', 1,
    );
    expect(md).toContain(treffer[0]!.baustein.text);
    expect(md).toContain('AP1 hat 12 PM');
  });

  it('markiert fehlende Bausteine als TODO statt zu erfinden', () => {
    const ohneTreffer = {
      ...CHECKLISTE_SEED,
      items: CHECKLISTE_SEED.items.map(i =>
        i.id === 'zuwendung.website' ? { ...i, nfSuchbegriffe: ['zzzzunbekannt'] } : i),
    };
    const p = mitStatus(leer(), 'zuwendung.website', 'nf-notwendig', 'Bitte klaeren');
    const e = bewerte(ohneTreffer, p, DUMMY, BEFUNDE);
    const md = baueNachforderung(DUMMY, ohneTreffer, e, optionen);
    expect(md).toContain('[TODO Baustein zuordnen]');
  });

  it('listet in der Ablehnung die nicht erfuellten Kriterien', () => {
    const p = mitStatus(mitStufen('B0', 'B1', 'B1'), 'inno.eigenstaendig', 'nicht-erfuellt', 'Kein FuE-Gehalt');
    const e = bewerte(CHECKLISTE_SEED, p, DUMMY, BEFUNDE);
    const md = baueAblehnung(DUMMY, CHECKLISTE_SEED, e, optionen);

    expect(md).toContain('## Ablehnungsgründe');
    expect(md).toContain('Kein FuE-Gehalt');
    expect(md).toContain('mindestens eine Kategorie der Entscheidungshilfe wurde mit B0 bewertet');
  });

  it('weist den offenen Titel-Teilschritt aus', () => {
    const e = bewerte(CHECKLISTE_SEED, leer(), DUMMY, BEFUNDE);
    const md = baueGutachten(DUMMY, CHECKLISTE_SEED, e, { titelGeprueft: false, hinweis: '' });
    expect(md).toContain('**Offen:** Teilvorhabentitel prüfen');
  });
});
